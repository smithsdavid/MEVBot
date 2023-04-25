import chalk from 'chalk'
import { utils, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import _ from 'lodash'
import { drawBlock } from '../utils/draw/drawBlock'
import { drawInit } from '../utils/draw/drawInit'
import { drawRoute } from '../utils/draw/drawRoute'
import { getProvider } from '../utils/getProvider'
import { Arbitrage } from './Arbitrage'
import { HARD_PURGE, MIN_PROFIT } from './config/config'
import { QUERY_V2_POOLS, QUERY_V3_POOLS } from './config/query'
import {
  SUSHI_SUBGRAPH,
  UNISWAP_V2_SUBGRAPH,
  UNISWAP_V3_SUBGRAPH
} from './config/subgraph'
import { Executer } from './Executer'
import { InterchainMarket } from './InterchainMarket'
import { MarketBird } from './MarketBird'
import { MarketGraph } from './MarketGraph'

const { FLASHBOTS_RELAY_SIGNING_KEY, DEV_WALLET_KEY } = process.env

async function main() {

  const provider = getProvider()
  const signer = new ethers.Wallet(DEV_WALLET_KEY, getProvider())
  const flashbotsRelaySigningWallet = new Wallet(
    FLASHBOTS_RELAY_SIGNING_KEY,
    provider
  )

  drawInit(
    await signer.getAddress(),
    await flashbotsRelaySigningWallet.getAddress()
  )

  // * INFO: The marketbird gets all token and fetches prices for it so I can determine USD to Token
  await MarketBird.init()

  // * INFO: Loads alls markets
  // Make sure both v3 and v2 pairs are loaded or decoding breaks in getting pairs
  let markets = await InterchainMarket.getMarkets([
    // [UNISWAP_V3_SUBGRAPH_POLYGON, QUERY_V3_POOLS],
    // [SUSHI_SUBGRAPH_POLYGON, QUERY_V2_POOLS]
    [UNISWAP_V3_SUBGRAPH, QUERY_V3_POOLS],
    [UNISWAP_V2_SUBGRAPH, QUERY_V2_POOLS],
    [SUSHI_SUBGRAPH, QUERY_V2_POOLS]
  ])

  console.log(
    'size overview',
    _.countBy(markets.allMarketPairs, (pair) => pair.size)
  )

  // * INFO: Saves Routes and does calculation
  const arbitrage = new Arbitrage(
    markets.allMarketPairs,
    new MarketGraph(markets.allMarketPairs) // * INFO: A graph including all dex pairs for route finding
  )

  if (HARD_PURGE) {
    // * INFO: Purge so only a few pairs are left to Mainnet Fork Testing purpose
    console.log(chalk.gray('- Purging Markets'))
    markets = InterchainMarket.purge(
      markets.allMarketPairs,
      _.take(
        arbitrage.topRoutes.map(([route]) => route),
        5
      )
    )
  } else {
    // * INFO: Purgin markets base on criteria set in config file
    console.log(chalk.gray('- Purging Markets'))
    markets = InterchainMarket.purge(
      markets.allMarketPairs,
      arbitrage.allRoutes
    )
  }

  console.log(chalk.gray('Total Routes:', arbitrage.allRoutes.length))
  console.log(chalk.gray('Total Markets:', markets.allMarketPairs.length))

  // * INFO: Executer Simulates and Executes Trades
  const executer = new Executer()
  await executer.init()

  const allConfidenceScores = _.countBy(
    arbitrage.allRoutes,
    (pair) => pair.confidenceScore
  )
  const topConfidenceScores = _.countBy(
    arbitrage.topRoutes,
    ([pair]) => pair.confidenceScore
  )

  console.log('all Routes scores')
  _.keys(allConfidenceScores)
    .sort()
    .forEach((key) => console.log(key.slice(0, 3), allConfidenceScores[key]))
  console.log('\ntop routes scored')
  _.keys(topConfidenceScores)
    .sort()
    .forEach((key) => console.log(key.slice(0, 3), topConfidenceScores[key]))

  const tr = _.take(arbitrage.topRoutes)[0][0]
  // console.log(tr.routeNodes.map((node) => node.pair))

  // console.log('Best')
  // tr.calculateOptimalInput()

  // console.log('Worst')
  // console.log(chalk.red('weakest 50 routes'))
  // const worst = _.chain(arbitrage.allRoutes)
  //   .take(3000)
  //   .reverse()
  //   .take(50)
  //   .value()
  // worst.forEach((route) => {
  //   const { input, profit } = route.optimalInput
  //   drawRoute(route, input, profit)
  // })
  // worst[0].calculateOptimalInput()

  provider.on('block', async (blockNr) => {
    drawBlock(blockNr)

    await Promise.all([
      await InterchainMarket.updateSqrtsAndReserves(markets.allMarketPairs),
      await executer.refreshGas()
    ])

    // * INFO: Recalc all with optimal input, finds new optimal input for top routes and sorts top routes
    arbitrage.shallowSort()

    _.take(arbitrage.topRoutes, 3).forEach(
      async ([route, optimalInput, profit], i) => {
        console.log(chalk.bgBlue(`\n###    ROUTE ${i + 1}   ###`))
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

    console.log(
      `Success: ${executer.successCount} Failures: ${executer.failureCount} Total: ${executer.totalTries}`
    )

    // const [route, optimalInput, profit] = _.take(arbitrage.topRoutes)[0]
    // await executer.submit(route, optimalInput, profit)
  })
}
main()
