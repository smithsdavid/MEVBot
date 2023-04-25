import { AlchemyProvider, JsonRpcProvider } from '@ethersproject/providers'
import axios from 'axios'
import chalk from 'chalk'
import { BigNumber, Contract, utils } from 'ethers'
import fs from 'fs'
import { ethers, network } from 'hardhat'
import _ from 'lodash'
import path from 'path'
import { Query } from '../types/typechain'
import { getProvider } from '../utils/getProvider'
import { UNISWAP_QUERY_ABI } from './config/abi'
import {
  QUERYCALL,
  TOKEN_BLACKLIST,
  UNISWAP_LOOKUP_CONTRACT_ADDRESS,
  WETH_ADDRESS
} from './config/addresses'
import { UNISWAP_QUERY_BYTECODE } from './config/bytecode'
import { LIVE_MODE, MIN_SIZE, MIN_TX_FOR_NODE } from './config/config'
import { POOL_OR_PAIR_RESULT } from './config/query'
import { MarketBird } from './MarketBird'
import { MarketV2Pair } from './MarketV2Pair'
import { MarketV3Pair } from './MarketV3Pair'
import { Route } from './Route'

const BATCH_COUNT_LIMIT = 100
const BATCH_SIZE = 1000

export class InterchainMarket {
  private static _provider: AlchemyProvider | JsonRpcProvider = getProvider()

  private static async getMarketOnChain(
    factoryAddress: string
  ): Promise<Array<MarketV2Pair | MarketV3Pair>> {
    const uniswapQuery = new Contract(
      UNISWAP_LOOKUP_CONTRACT_ADDRESS,
      UNISWAP_QUERY_ABI,
      this._provider
    )

    const marketPairs = new Array<MarketV2Pair | MarketV3Pair>()

    for (let i = 0; i < BATCH_COUNT_LIMIT * BATCH_SIZE; i += BATCH_SIZE) {
      const pairs: Array<Array<string>> = (
        await uniswapQuery.functions.getPairsByIndexRange(
          factoryAddress,
          i,
          i + BATCH_SIZE
        )
      )[0]

      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i]
        const marketAddress = pair[2]
        const token = _.take(pair, 2)

        if (_.intersection(TOKEN_BLACKLIST, token).length === 0) {
          const marketPair = new MarketV2Pair(marketAddress, token, '')
          marketPairs.push(marketPair)
        }
      }

      if (pairs.length < BATCH_SIZE) {
        break
      }
    }

    return marketPairs
  }

  static async getMarketSubgraph(
    endpoint: string,
    query: string
  ): Promise<Array<MarketV2Pair | MarketV3Pair>> {
    const marketPairs = new Array<MarketV2Pair | MarketV3Pair>()

    for (
      let i = 0;
      i < BATCH_COUNT_LIMIT * BATCH_SIZE && i <= 5000;
      i += BATCH_SIZE
    ) {
      const { data } = await axios.post(
        endpoint,
        {
          query,
          variables: {
            skip: i,
            batchSize: BATCH_SIZE,
            txCount: MIN_TX_FOR_NODE
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      let pairs = (data.data?.pairs ||
        data.data?.pools) as POOL_OR_PAIR_RESULT[]

      if (!pairs) {
        console.log('CONNECTION ISSUE?')
        console.log(data)
        continue
      }

      const resultLength = pairs.length
      const isV2 = data.data?.pairs != undefined

      _.forEach(pairs, (pair) => {
        const token = [
          pair.token0.id.toLowerCase(),
          pair.token1.id.toLowerCase()
        ]

        if (_.intersection(TOKEN_BLACKLIST, token).length === 0) {
          const marketPair = isV2
            ? new MarketV2Pair(pair.id.toLowerCase(), token, '')
            : new MarketV3Pair(
                pair.id.toLowerCase(),
                token,
                Number(pair.feeTier) || 3000,
                ''
              )
          marketPairs.push(marketPair)
        }
      })

      if (resultLength < BATCH_SIZE) {
        break
      }
    }

    return marketPairs
  }

  static async getMarkets(subgraphs: [string, string][]): Promise<{
    allMarketPairs: Array<MarketV2Pair | MarketV3Pair>
  }> {
    let allMarketPairs: Array<MarketV2Pair | MarketV3Pair> = []
    console.log(chalk.gray('- Loading markets'))

    if (!LIVE_MODE) {
      allMarketPairs = this.getSerializedMarkets()
    } else {
      const allPairs = await Promise.all(
        _.map(subgraphs, (graph) =>
          InterchainMarket.getMarketSubgraph(...graph)
        )
      )

      allMarketPairs = _.chain(allPairs)
        .flatten()
        .groupBy((pair) => pair.tokens[0])
        .pickBy((a) => a.length > 1) // remove markets with token deadend
        .values()
        .flatten()
        .value()

      allMarketPairs = this.removeUnpricedPairs(allMarketPairs)
      this.serializeMarkets(allMarketPairs)
    }

    await InterchainMarket.updateSqrtsAndReserves(allMarketPairs)

    if (LIVE_MODE) {
      // do not filter stored pairs, it will break some routes
      allMarketPairs = this.filterMarkets(allMarketPairs)
    }

    return { allMarketPairs }
  }

  static async updateSqrtsAndReserves(
    marketPairs: Array<MarketV2Pair | MarketV3Pair>
  ): Promise<void> {
    const { v2: v2MarketPairs, v3: v3MarketPairs } = _.groupBy(
      marketPairs,
      (pair) => pair.marketType
    )
    const pairAddressesV2 = _.map(v2MarketPairs, (pair) => pair.marketAddress)
    const pairAddressesV3 = _.map(v3MarketPairs, (pair) => pair.marketAddress)
    console.log(chalk.gray(`- Updating ${pairAddressesV2.length} v2 Markets`))
    console.log(chalk.gray(`- Updating ${pairAddressesV3.length} v3 Markets`))
    let result
    let reservesV2, sqrtsV3, reservesV3

    if (network.name === 'fork') {
      const signer = new ethers.Wallet(
        process.env.FORK_WALLET_KEY,
        getProvider()
      )
      const queryFactory = await ethers.getContractFactory('Query', signer)
      const query = queryFactory.attach(QUERYCALL) as Query
      result = await query.getSqrtsAndReservesByPairs(
        pairAddressesV2,
        pairAddressesV3
      )

      reservesV2 = result[0]
      sqrtsV3 = result[1]
      reservesV3 = result[2]
    } else {
      const uniswapQuery = new Contract(
        '0xFa12318aBEDD366Dd6D20D398983fD4504A4B915', // arbitrary address
        UNISWAP_QUERY_ABI,
        this._provider
      )

      result = await this._provider.send('eth_call', [
        await uniswapQuery.populateTransaction.getSqrtsAndReservesByPairs(
          pairAddressesV2,
          pairAddressesV3
        ),
        'latest',
        {
          '0xFa12318aBEDD366Dd6D20D398983fD4504A4B915': {
            code: UNISWAP_QUERY_BYTECODE
            // stateDiff: {
            //   '0x0': ETH_ACCOUNT_ADDRESS //often 0 Slot is owner of contract
            // }
          }
        }
      ])

      const abiCoder = new utils.AbiCoder()
      const decoded = abiCoder.decode(
        [
          'uint256[4]',
          `uint256[3][${pairAddressesV2.length}]`,
          'uint256',
          `uint256[2][${pairAddressesV3.length}]`,
          'uint256',
          `uint256[2][${pairAddressesV3.length}]`
        ],
        result
      )
      const [, _reservesV2, , _sqrtsV3, , _reservesV3] = decoded
      reservesV2 = _reservesV2
      sqrtsV3 = _sqrtsV3
      reservesV3 = _reservesV3
    }

    // If it breaks keep in mind decode differs when only v2/v3 results are returned

    for (let i = 0; i < v2MarketPairs.length; i++) {
      ;(v2MarketPairs[i] as MarketV2Pair).setReservesViaOrderedBalances(
        reservesV2[i]
      )
    }

    for (let i = 0; i < v3MarketPairs.length; i++) {
      ;(v3MarketPairs[i] as MarketV3Pair).setSqrtPrice(sqrtsV3[i][0])
      ;(v3MarketPairs[i] as MarketV3Pair).setReservesViaOrderedBalances(
        reservesV3[i]
      )
    }
  }

  static purge(
    markets: Array<MarketV2Pair | MarketV3Pair>,
    routes: Array<Route>
  ): {
    allMarketPairs: Array<MarketV2Pair | MarketV3Pair>
  } {
    markets = _.filter(markets, ({ tokens }) =>
      routes.some(
        (route) =>
          route.routeNodes
            .map((node) => node.pair)
            .filter((pair) => _.isEqual(pair.tokens, tokens)).length > 0
      )
    )
    this.serializeMarkets(markets)
    return { allMarketPairs: markets }
  }

  private static serializeMarkets(
    markets: Array<MarketV2Pair | MarketV3Pair>
  ): void {
    fs.writeFileSync(
      path.join(__dirname, '../data/markets.json'),
      JSON.stringify(markets)
    )
  }

  private static getSerializedMarkets(): Array<MarketV2Pair | MarketV3Pair> {
    const marketsData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../data/markets.json')).toString()
    )
    let allMarketPairs: Array<MarketV2Pair | MarketV3Pair> = _.map(
      marketsData,
      (pair) => {
        return pair._marketType === 'v2'
          ? new MarketV2Pair(pair._marketAddress, pair._tokens, '')
          : new MarketV3Pair(
              pair._marketAddress,
              pair._tokens,
              Number(pair._feeTier),
              ''
            )
      }
    )

    return allMarketPairs
  }

  private static filterMarkets(
    markets: Array<MarketV2Pair | MarketV3Pair>
  ): Array<MarketV2Pair | MarketV3Pair> {
    console.log(chalk.gray('- filtering markets'))
    return _.chain(markets)
      .filter((pair) => {
        const [token0, token1] = pair.tokens.map((t) => t.toLowerCase())
        const res0 = pair.balances[token0]
        const res1 = pair.balances[token1]

        const isToken0Existing = MarketBird.SIZE_CHART[token0] != undefined
        const isToken1Existing = MarketBird.SIZE_CHART[token1] != undefined

        const isReserve0Enough = isToken0Existing
          ? res0.gte(MarketBird.SIZE_CHART[token0][MIN_SIZE])
          : false

        const isReserve1Enough = isToken1Existing
          ? res1.gte(MarketBird.SIZE_CHART[token1][MIN_SIZE])
          : false

        return isReserve0Enough && isReserve1Enough
      })
      .value()
  }

  private static removeUnpricedPairs(
    markets: Array<MarketV2Pair | MarketV3Pair>
  ): Array<MarketV2Pair | MarketV3Pair> {
    console.log(chalk.gray('- removing unpriced pairs'))
    return _.chain(markets)
      .filter((pair) => {
        const [token0, token1] = pair.tokens.map((t) => t.toLowerCase())
        const isToken0Existing = MarketBird.SIZE_CHART[token0] != undefined
        const isToken1Existing = MarketBird.SIZE_CHART[token1] != undefined
        return isToken0Existing && isToken1Existing
      })
      .value()
  }
}
