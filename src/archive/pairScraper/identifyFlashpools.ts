import { saveDataToFile } from '../../utils/files/saveArrayToFile'
import { ArbitrageDataMap } from '../../types/custom/ArbitrageDataMap'
import { loadDataFromFile } from '../../utils/files/loadArrayFromFile'

export const identifyFlashpools = async (arbitrageData: ArbitrageDataMap) => {
  console.log(`\n> Identifying flashpools for Entries`)
  const arbKeys = Object.keys(arbitrageData)
  let flashpools: FlashpoolMap = loadDataFromFile('flashpools')

  arbKeys.forEach(async (key) => {
    const entry = arbitrageData[key]

    if (!entry.flashpool0 || entry.flashpool0.length < entry.unipools.length) {
      entry.flashpool0 = []

      entry.unipools.forEach((unipool) => {
        if (flashpools[entry.token0.address].pool) {
          if (flashpools[entry.token0.address].pool != unipool) {
            entry.flashpool0!.push(flashpools[entry.token0.address].pool)
          } else if (flashpools[entry.token0.address].backupPool) {
            entry.flashpool0!.push(flashpools[entry.token0.address].backupPool)
          }
        }
      })
    }

    if (!entry.flashpool1 || entry.flashpool1.length < entry.unipools.length) {
      entry.flashpool1 = []

      entry.unipools.forEach((unipool) => {
        if (flashpools[entry.token1.address].pool) {
          if (flashpools[entry.token1.address].pool != unipool) {
            entry.flashpool1!.push(flashpools[entry.token1.address].pool)
          } else if (flashpools[entry.token1.address].backupPool) {
            entry.flashpool1!.push(flashpools[entry.token1.address].backupPool)
          }
        }
      })
    }

    arbitrageData[key] = entry
  })

  saveDataToFile(arbitrageData, 'arbitrage')
}
