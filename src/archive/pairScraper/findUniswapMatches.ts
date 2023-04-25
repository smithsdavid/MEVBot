import { FeeAmount } from '@uniswap/v3-sdk'
import { BigNumber, constants } from 'ethers'
import { UniswapV3Factory } from '../../types/copypaste/UniswapV3Factory'
import { UniswapV3Pool } from '../../types/copypaste/UniswapV3Pool'
import { ArbitrageDataMap } from '../../types/custom/ArbitrageDataMap'
import { MetaConfig } from '../../types/custom/MetaConfig'
import { clearLastLine } from '../../utils/console/clearLastLine'
import { loadDataFromFile } from '../../utils/files/loadArrayFromFile'
import { saveDataToFile } from '../../utils/files/saveArrayToFile'
import { generateIdHash } from '../../utils/poolFiltering/generateIdHash'
import { getMinTokenBalance } from '../../utils/poolFiltering/getMinTokenBalance'
import { setupFactories } from '../config/setupFactories'
import { loadTokenData } from '../../utils/loadTokenData'

export const findUniswapMatches = async (
  allSushiPairAddresses: string[],
  resolvesSushiPairs: [string, string][]
) => {
  console.log(`\> Initiating Arbitrage Entries`)
  console.log('>>> Loading existing Entries')

  const { uniFactoryFactory, ERC20Factory } = await setupFactories()

  const uniFactory = uniFactoryFactory.attach(
    process.env.UNI_FACTORY
  ) as UniswapV3Factory

  let metaconfig: MetaConfig = loadDataFromFile('metaconfig')

  const arbitrageData: ArbitrageDataMap = loadDataFromFile('arbitrage')
  let flashpools: FlashpoolMap = loadDataFromFile('flashpools')

  let promise_arbitrageData: Promise<void>[] = []

  let pairsChecked = 0
  let matchesFound = 0
  let isFirstItem = true
  let newPairs = resolvesSushiPairs.length - 1 - metaconfig.lastCheckedId

  const quicksave = (lastCheckedId: number) => {
    metaconfig = {
      ...metaconfig,
      lastCheckedId,
      arbitrageEntries: Object.keys(arbitrageData).length
    }
    saveDataToFile(metaconfig, 'metaconfig')
    saveDataToFile(flashpools, 'flashpools')
    saveDataToFile(arbitrageData, 'arbitrage')
  }

  const generatePoolPromise = (
    token0Addr: string,
    token1Addr: string,
    fee: FeeAmount
  ) =>
    new Promise<string>((res, rej) => {
      uniFactory
        .getPool(token0Addr, token1Addr, fee)
        .then((pool) => {
          res(pool)
        })
        .catch((e) => {
          console.log(e)
          rej()
        })
    })

  console.log(`>>> ${Object.keys(arbitrageData).length} loaded`)

  if (newPairs > 0) {
    console.log(
      `>>> Comparing new Pairs from ID ${metaconfig.lastCheckedId} onward`
    )

    for (let i = metaconfig.lastCheckedId; i < resolvesSushiPairs.length; i++) {
      const token0Address = resolvesSushiPairs[i][0]
      const token1Address = resolvesSushiPairs[i][1]

      const { token0, token1 } = await loadTokenData(
        resolvesSushiPairs[i][0],
        resolvesSushiPairs[i][1]
      )

      const Token0 = ERC20Factory.attach(token0.address)
      const Token1 = ERC20Factory.attach(token1.address)

      promise_arbitrageData.push(
        new Promise<void>((res, rej) => {
          Promise.all([
            generatePoolPromise(
              token0.address,
              token1.address,
              FeeAmount.LOWEST
            ),
            generatePoolPromise(token0.address, token1.address, FeeAmount.LOW),
            generatePoolPromise(
              token0.address,
              token1.address,
              FeeAmount.MEDIUM
            ),
            generatePoolPromise(token0.address, token1.address, FeeAmount.HIGH)
          ])
            .then(async (poolAddresses) => {
              !isFirstItem && clearLastLine()
              isFirstItem = false
              pairsChecked++

              let liqudityOverview: [string, BigNumber, BigNumber][] = []
              let unipools: string[] = []

              const tempPools = poolAddresses.filter(
                (pool) => pool != constants.AddressZero
              )

              for (let i = 0; i < tempPools.length; i++) {
                const pool = tempPools[i]

                try {
                  const [token0Balance, token1Balance] = await Promise.all([
                    Token0.balanceOf(pool),
                    Token1.balanceOf(pool)
                  ])

                  if (
                    token0Balance.gt(getMinTokenBalance(token0)) &&
                    token1Balance.gt(getMinTokenBalance(token1))
                  ) {
                    liqudityOverview.push([pool, token0Balance, token1Balance])
                  }
                } catch (e) {
                  console.error('Whatefuck !?!?!?')
                }
              }

              if (liqudityOverview.length > 0) {
                liqudityOverview = liqudityOverview.sort((aOv, bOv) => {
                  const a = aOv[1].add(aOv[2])
                  const b = bOv[1].add(bOv[2])
                  return a.lt(b) ? 1 : a.gt(b) ? -1 : 0
                })

                // * Add largest pool as flashpool
                const [liquAddr, liquTokenBalance0, liquTokenBalance1] =
                  liqudityOverview[0]

                const exPool0 = flashpools[token0Address]
                const exPool1 = flashpools[token1Address]

                if (
                  !exPool0 ||
                  BigNumber.from(exPool0.balance).lt(liquTokenBalance0)
                ) {
                  flashpools[token0Address] = {
                    ...flashpools[token0Address],
                    pool: liquAddr,
                    balance: liquTokenBalance0.toString()
                  }
                } else if (
                  !exPool0.backupPool ||
                  (exPool0.pool != liquAddr &&
                    BigNumber.from(exPool0.backupBalance).lt(liquTokenBalance0))
                ) {
                  flashpools[token0Address] = {
                    ...flashpools[token0Address],
                    backupPool: liquAddr,
                    backupBalance: liquTokenBalance0.toString()
                  }
                }

                if (
                  !exPool1 ||
                  BigNumber.from(exPool1.balance).lt(liquTokenBalance1)
                ) {
                  flashpools[token1Address] = {
                    ...flashpools[token1Address],
                    pool: liquAddr,
                    balance: liquTokenBalance1.toString()
                  }
                } else if (
                  !exPool1.backupPool ||
                  (exPool1.pool != liquAddr &&
                    BigNumber.from(exPool1.backupBalance).lt(liquTokenBalance1))
                ) {
                  flashpools[token1Address] = {
                    ...flashpools[token1Address],
                    backupPool: liquAddr,
                    backupBalance: liquTokenBalance1.toString()
                  }
                }

                unipools = liqudityOverview.map((ov) => ov[0])

                // * Create arbitrage entry
                if (unipools.length > 0) {
                  matchesFound = matchesFound + tempPools.length

                  arbitrageData[generateIdHash(token0Address, token1Address)] =
                    {
                      token0,
                      token1,
                      sushipool: allSushiPairAddresses[i],
                      unipools,
                      flashpool0: undefined,
                      flashpool1: undefined
                    }
                }
              }

              console.log(
                `>>> ${pairsChecked} of ${newPairs} Pairs Checked; ${matchesFound} Matches found`
              )

              res()
            })
            .catch((e) => {
              console.log(e)
              rej()
            })
        })
      )

      // ? cooldown
      if (i % 30 == 0) {
        console.log('### cooldown')
        await Promise.all(promise_arbitrageData)
        quicksave(i)
        promise_arbitrageData = []
        clearLastLine()
      }
    }

    await Promise.all(promise_arbitrageData)

    console.log(`>>> ${matchesFound} Arbitrage Entries have been added`)

    quicksave(resolvesSushiPairs.length - 1)
  }

  return arbitrageData
}
