import 'dotenv/config'
import { constants, Wallet } from 'ethers'
import { ArbitrageDataMap } from '../../types/archive/custom/ArbitrageDataMap'
import { ArbitrageOperation } from '../../types/archive/custom/ArbitrageOperation'
import { WalletData } from '../../types/archive/custom/WalletData'
import { Executor } from '../../types/typechain/Executor'
import { loadDataFromFile } from '../../utils/files/loadArrayFromFile'
import { saveDataToFile } from '../../utils/files/saveArrayToFile'
import { getGasOptions } from '../../utils/getGasOptions'
import { getBots } from '../botnet/util/getBots'
import { setupDeployer } from '../../utils/getDeployer'
import { setupFactories } from './setupFactories'
import { fetchAllSushiPairAddresses } from '../pairScraper/fetchAllSushiPairAddresses'
import { findUniswapMatches } from '../pairScraper/findUniswapMatches'
import { identifyFlashpools } from '../pairScraper/identifyFlashpools'
import { scanForArbitrage } from '../pairScraper/scanForArbitrage'

// !#################
// ! Note to continue
// * Arbitrage execution works -> https://polygonscan.com/tx/0xc0372a71a155890640a06b930dafed65cebba16ed9e544424e850e7581552a47
// * ps: printing data with revert()
// * Problem: Calculation is off so arbitrage return is lower than fees (flash- & swap-)
// * Next step: Improve calculation
// * -> in "copy" file is calculation from discord server
// * -> current calc in Executor.sol Line 149
// * Left to Improve
// * -> Webhook for trading activity + trigger arbitrage scan
// * -> forward funds in executor
// * -> "best input amount for arb" calculation in contract
// !!
// !#################

const filterArbitrageData = (arbitrageData: ArbitrageDataMap) => {
  const arbKeys = Object.keys(arbitrageData)
  const filteredArbitrageData: ArbitrageDataMap = {}

  arbKeys.forEach((key) => {
    const entry = arbitrageData[key]

    if (entry.flashpool0!.length > 0 && entry.flashpool1!.length > 0) {
      filteredArbitrageData[key] = entry
    }
  })

  saveDataToFile(filteredArbitrageData, 'arbitrage')

  return filteredArbitrageData
}

async function main() {
  console.log('> Process startet')

  const { sushiPairAddresses, resolvedSushiPairs } =
    await fetchAllSushiPairAddresses()

  const arbitrageData = await findUniswapMatches(
    sushiPairAddresses,
    resolvedSushiPairs
  )

  await identifyFlashpools(arbitrageData)

  const filteredArbitrageData = filterArbitrageData(arbitrageData)
  console.log(Object.keys(filteredArbitrageData).length)

  const arbOps = await scanForArbitrage(filteredArbitrageData)

  // ! NO EXEC
  process.exit(1)

  // * Executing Arbitrage Opportunities
  console.log(`\n> Executing Opportunities`)

  const { provider } = setupDeployer()

  const { ExecutorFactory } = await setupFactories()
  const executor = ExecutorFactory.attach(process.env.EXECUTOR) as Executor

  let promisesOperations: Promise<void>[] = []
  let succeeded: [string, ArbitrageOperation | undefined][] = []
  let failed: [string, ArbitrageOperation | undefined][] = []
  let isFirstItem = true
  const arbKeys = Object.keys(arbitrageData)

  const options = await getGasOptions(850_000)

  // * Spam Bomb arbitrage
  const bots = getBots()
  const walletsData: WalletData[] = loadDataFromFile('bot/wallets')

  const generateOperationPromise = (op: ArbitrageOperation, bot: Wallet) =>
    new Promise<void>((res, rej) => {
      const executionOp = {
        sushipool: op.sushipool,
        unipool: op.unipool,
        flashpool0: op.flashpool0 ? op.flashpool0 : constants.AddressZero,
        flashpool1: op.flashpool1 ? op.flashpool1 : constants.AddressZero
      }

      executor
        .connect(bot)
        .execute(executionOp, options)
        .then(async (tx) => {
          // !isFirstItem && clearLastLine()
          // isFirstItem = false

          const recipe = await tx.wait()

          succeeded.push([recipe.transactionHash, op])
          console.log('Success: ', recipe.transactionHash)

          console.log(
            `>>> Succeeded ${succeeded.length}; Failed ${failed.length}`
          )

          res()
        })
        .catch((e) => {
          // !isFirstItem && clearLastLine()
          // isFirstItem = false

          if (e.receipt) {
            failed.push([e.receipt.transactionHash, op])
            console.log('Failed: ', [e.receipt.transactionHash, op])
          } else {
            failed.push(['Probably gas error', undefined])
          }

          console.log(
            `>>> Succeeded ${succeeded.length}; Failed ${failed.length}`
          )

          console.log(e)

          res()
        })
    })

  let executableEntries: ArbitrageOperation[] = []

  arbOps.forEach(({ op }) => {
    if (op.flashpool0 && op.flashpool1) {
      executableEntries.push(op)
    }
  })

  // console.log(executableEntries)
  // console.log(executableEntries.length)

  executableEntries.forEach((op, i) => {
    if (i < bots.length) {
      promisesOperations.push(generateOperationPromise(op, bots[i]))
    }
  })

  await Promise.all(promisesOperations)

  console.log('Succeeded', succeeded)
  console.log('Failed', failed)

  console.log(`\n> Done`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
