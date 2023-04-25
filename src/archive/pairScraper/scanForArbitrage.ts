import { ArbitrageDataEntry } from '../../types/custom/ArbitrageDataEntry'
import {
  ArbitrageDataMap,
  ArbitrageScanResult
} from '../../types/custom/ArbitrageDataMap'
import { ArbitrageOperation } from '../../types/custom/ArbitrageOperation'
import { Executor } from '../../types/typechain/Executor'
import { clearLastLine } from '../../utils/console/clearLastLine'
import { saveDataToFile } from '../../utils/files/saveArrayToFile'
import { setupFactories } from '../config/setupFactories'

export const scanForArbitrage = async (arbitrageData: ArbitrageDataMap) => {
  console.log(`\> Scanning for Arbitrage`)

  const { ExecutorFactory } = await setupFactories()
  const executor = ExecutorFactory.attach(process.env.EXECUTOR) as Executor

  let promisesArbscan: Promise<void>[] = []
  let pairsChecked = 0
  let isFirstItem = true
  let arbKeys = Object.keys(arbitrageData)

  const arbOps: {
    op: ArbitrageOperation
    result: ArbitrageScanResult
  }[] = []

  let totalCombinations = 0
  arbKeys.forEach((key) => {
    totalCombinations = totalCombinations + arbitrageData[key].unipools.length
  })

  arbKeys.forEach(async (key, i) => {
    const entry = arbitrageData[key]

    const getArbitragePromise = (params: {
      sushipool: string
      unipool: string
      flashpool0: string | undefined
      flashpool1: string | undefined
    }) =>
      new Promise<void>((res, rej) => {
        executor
          .scanArbitrage({
            sushipool: params.sushipool,
            unipool: params.unipool
          })
          .then(async (result) => {
            !isFirstItem && clearLastLine()
            isFirstItem = false

            pairsChecked++
            console.log(
              `>>> ${pairsChecked} of ${totalCombinations} Combinations Checked`
            )

            if (result[1] == true || result[3] == true) {
              arbOps.push({
                op: {
                  sushipool: params.sushipool,
                  unipool: params.unipool,
                  flashpool0: params.flashpool0,
                  flashpool1: params.flashpool1
                },
                result
              })
            }

            res()
          })
          .catch((e) => {
            pairsChecked++
            console.log(
              `>>> ${pairsChecked} of ${arbKeys.length} Pairs Error; Probably overflow`
            )
            // rej()
            res()
          })
      })

    for (let i = 0; i < entry.unipools.length; i++) {
      promisesArbscan.push(
        getArbitragePromise({
          sushipool: entry.sushipool,
          unipool: entry.unipools[i],
          flashpool0:
            entry.flashpool0 && entry.flashpool0.length > i
              ? entry.flashpool0[i]
              : undefined,
          flashpool1:
            entry.flashpool1 && entry.flashpool1.length > i
              ? entry.flashpool1[i]
              : undefined
        })
      )
    }

    // ? cooldown
    if (i % 100 == 0) {
      console.log('### cooldown')
      await Promise.all(promisesArbscan)
      promisesArbscan = []
      clearLastLine()
    }
  })

  await Promise.all(promisesArbscan)

  saveDataToFile(arbOps, 'arbOps')

  console.log(`>>> ${arbOps.length} Arbitrage Opportunities found`)

  return arbOps
}
