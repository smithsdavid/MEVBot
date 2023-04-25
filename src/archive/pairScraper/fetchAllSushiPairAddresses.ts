import { MetaConfig } from '../../types/custom/MetaConfig'
import { UniswapV2Pair } from '../../types/typechain'
import { UniswapV2Factory } from '../../types/typechain/UniswapV2Factory'
import { clearLastLine } from '../../utils/console/clearLastLine'
import { loadDataFromFile } from '../../utils/files/loadArrayFromFile'
import { saveDataToFile } from '../../utils/files/saveArrayToFile'
import { getMinTokenBalance } from '../../utils/poolFiltering/getMinTokenBalance'
import { loadTokenData } from '../../utils/loadTokenData'
import { setupFactories } from '../config/setupFactories'

export const fetchAllSushiPairAddresses = async () => {
  console.log(`\n> Initiating Sushi Pair Addresses`)
  console.log('>>> Loading existing Addresses')

  const { sushiFactoryFactory, sushiPairFactory, ERC20Factory } =
    await setupFactories()

  const sushiFactory = sushiFactoryFactory.attach(
    process.env.SUSHI_FACTORY
  ) as UniswapV2Factory

  const totalSushiPoolsCount = await sushiFactory.allPairsLength()

  let resolvedSushiPairs: [string, string][] = loadDataFromFile('sushiPairs')
  let sushiPairAddresses: string[] = loadDataFromFile('sushiPairAddresses')
  let metaconfig: MetaConfig = loadDataFromFile('metaconfig')
  let { filteredSushiPairs } = metaconfig

  let promises_allSushiPairAddresses: Promise<void>[] = []
  let isFirstItem = true

  const quicksave = () => {
    metaconfig = {
      ...metaconfig,
      filteredSushiPairs
    }

    saveDataToFile(metaconfig, 'metaconfig')
    saveDataToFile(sushiPairAddresses, 'sushiPairAddresses')
    saveDataToFile(resolvedSushiPairs, 'sushiPairs')
  }

  console.log(`>>> ${sushiPairAddresses.length} loaded`)
  console.log(`>>> ${totalSushiPoolsCount.toNumber()} Sushi Pairs in existence`)

  if (metaconfig.filteredSushiPairs < totalSushiPoolsCount.toNumber()) {
    console.log(
      `>>> ${totalSushiPoolsCount
        .sub(metaconfig.filteredSushiPairs)
        .toNumber()} new Sushi Pair Addresses found`
    )

    for (
      let i = metaconfig.filteredSushiPairs;
      i < totalSushiPoolsCount.toNumber();
      i++
    ) {
      promises_allSushiPairAddresses.push(
        new Promise(async (res, rej) => {
          try {
            !isFirstItem && clearLastLine()
            isFirstItem = false
            filteredSushiPairs++

            try {
              const pairAddr = await sushiFactory.allPairs(i)
              const pair = sushiPairFactory.attach(pairAddr) as UniswapV2Pair

              const { token0, token1 } = await loadTokenData(
                ...(await Promise.all([pair.token0(), pair.token1()]))
              )

              const Token0 = ERC20Factory.attach(token0.address)
              const Token1 = ERC20Factory.attach(token1.address)

              const [token0Balance, token1Balance] = await Promise.all([
                Token0.balanceOf(pairAddr),
                Token1.balanceOf(pairAddr)
              ])

              if (
                token0Balance.gt(getMinTokenBalance(token0)) &&
                token1Balance.gt(getMinTokenBalance(token1))
              ) {
                sushiPairAddresses.push(pairAddr)
                resolvedSushiPairs.push([token0.address, token1.address])
              }
            } catch (e) {
              console.error('BS-POOL')
            }

            console.log(
              `>>> ${
                sushiPairAddresses.length
              } matches;  ${totalSushiPoolsCount.sub(filteredSushiPairs)} left`
            )
            res()
          } catch (e) {
            console.log(e)
            rej()
          }
        })
      )

      // ? cooldown
      if (i % 50 == 0) {
        clearLastLine()
        console.log('### cooldown')
        quicksave()
        await Promise.all(promises_allSushiPairAddresses)
        promises_allSushiPairAddresses = []
      }
    }

    await Promise.all(promises_allSushiPairAddresses)

    quicksave()

    // console.log(
    //   `>>> ${newSushiPairAddresses.length} Sushi Pair Addresses have been added\n`
    // )
  }

  return { sushiPairAddresses, resolvedSushiPairs }
}
