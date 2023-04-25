import chalk from 'chalk'
import { MIN_PROFIT } from 'config/config'
import { Wallet } from 'ethers'
import { ethers } from 'hardhat'
import _ from 'lodash'
import { Arbitrage } from '../../src/Arbitrage'
import { QUERY_V2_POOLS, QUERY_V3_POOLS } from '../../src/config/query'
import {
  SUSHI_SUBGRAPH,
  UNISWAP_V2_SUBGRAPH,
  UNISWAP_V3_SUBGRAPH
} from '../../src/config/subgraph'
import { Executer } from '../../src/Executer'
import { InterchainMarket } from '../../src/InterchainMarket'
import { MarketBird } from '../../src/MarketBird'
import { MarketGraph } from '../../src/MarketGraph'
import { drawBlock } from '../../utils/draw/drawBlock'
import { drawInit } from '../../utils/draw/drawInit'
import { drawRoute } from '../../utils/draw/drawRoute'
import { getProvider } from '../../utils/getProvider'

const { FLASHBOTS_RELAY_SIGNING_KEY, FORK_WALLET_KEY } = process.env

async function main() {
  const provider = getProvider()
  const signer = new ethers.Wallet(FORK_WALLET_KEY, provider)
  const flashbotsRelaySigningWallet = new Wallet(
    FLASHBOTS_RELAY_SIGNING_KEY,
    provider
  )
  await MarketBird.init()
  const executer = new Executer()
  await executer.init()

  drawInit(
    await signer.getAddress(),
    await flashbotsRelaySigningWallet.getAddress()
  )

  let markets = await InterchainMarket.getMarkets([
    [UNISWAP_V3_SUBGRAPH, QUERY_V3_POOLS],
    [UNISWAP_V2_SUBGRAPH, QUERY_V2_POOLS],
    [SUSHI_SUBGRAPH, QUERY_V2_POOLS]
  ])
  const arbitrage = new Arbitrage(
    markets.allMarketPairs,
    new MarketGraph(markets.allMarketPairs)
  )

  const topRoute = _.take(arbitrage.topRoutes, 1)[0]
  // topRoute[0].routeNodes
  //   .map((node) => node.pair)
  //   .forEach((pair) => console.log(util.inspect(pair, { depth: null })))
  topRoute[0].getOutput(topRoute[1], true)
  drawRoute(...topRoute)
  try {
    await executer.submit(...topRoute)
  } catch (e) {
    console.error('error')
  }

  provider.on('block', async (blockNr) => {
    drawBlock(blockNr)
    await Promise.all([
      await InterchainMarket.updateSqrtsAndReserves(markets.allMarketPairs),
      await executer.refreshGas()
    ])
    arbitrage.shallowSort()
    _.take(arbitrage.topRoutes, 3).forEach(
      async ([route, optimalInput, profit], i) => {
        console.log(chalk.bgBlue('\n###   ROUTE   ###'))
        drawRoute(route, optimalInput, profit)
        if (profit.gt(MIN_PROFIT)) {
          try {
            await executer.submit(route, optimalInput, profit)
          } catch (e) {
            console.error('error')
          }
        }
      }
    )
  })
}

main()

// v3pool.ticks(BigNumber.from('-277000')
// liquidityGross: BigNumber { value: "217401366982725649305" }, // the total amount of position liquidity that uses the pool either as tick lower or tick upper
// liquidityNet: BigNumber { value:  "-217401366982725649305" }, // how much liquidity changes when the pool price crosses the tick
// feeGrowthOutside0X128: BigNumber { value: "58537967984514364401394253460909286809788" },
// feeGrowthOutside1X128: BigNumber { value: "0" },
// tickCumulativeOutside: BigNumber { value: "-43713544" },
// secondsPerLiquidityOutsideX128: BigNumber { value: "19504093347776816969471738" },
// secondsOutside: 158,
// initialized: true

// Thesis for filtering:
// when the liquidityNet is relatively high to liqidityGross, I assume a huge impact on the sqrtPrice
