import 'dotenv/config'
import { BigNumber, utils, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { WalletData } from '../../types/archive/custom/WalletData'
import { ERC20 } from '../../types/typechain'
import { loadDataFromFile } from '../../utils/files/loadArrayFromFile'
import { saveDataToFile } from '../../utils/files/saveArrayToFile'
import { getGasOptions } from '../../utils/getGasOptions'
import { setupDeployer } from '../../utils/getDeployer'
import { setupFactories } from '../archive/setupFactories'
import { updateBalances } from './shared/updateBalances.1'

async function main() {
  await updateBalances()

  console.log(`\n> Collecting Wallet Balances`)

  const { ERC20Factory } = await setupFactories()
  const { provider } = setupDeployer()

  const walletsData: WalletData[] = loadDataFromFile('bot/wallets')
  const wallets: Wallet[] = walletsData.map(
    (data) => new ethers.Wallet(data.privateKey, provider)
  )

  const collectSummary: [string, BigNumber, number][] = [] // symbol, funds, decimals

  let loadingPromises: Promise<void>[] = []

  console.log(`>>> Collecting available ERC20 Token`)

  const ERC20Addresses = new Set<string>()
  walletsData.forEach((wallet) => {
    // Populating addresses
    Object.keys(wallet.ERC20Balances[provider.network.name]).forEach((key) =>
      ERC20Addresses.add(key)
    )
  })
  const ERC20Tokens: ERC20[] = Array.from(ERC20Addresses).map((address) =>
    ERC20Factory.attach(address)
  )
  const ERC20GasOptions = await getGasOptions(70_000)

  for (let i = 0; i < ERC20Tokens.length; i++) {
    const ERC20 = ERC20Tokens[i]

    const totalFundsToCollect = walletsData
      .map((wallet) => {
        return BigNumber.from(
          wallet.ERC20Balances[provider.network.name][ERC20.address]
        )
      })
      .reduce((prev, next) => prev.add(next))

    const [symbol, decimals] = await Promise.all([
      await ERC20Tokens[i].symbol(),
      await ERC20Tokens[i].decimals()
    ])

    if (totalFundsToCollect.gt(0)) {
      collectSummary.push([symbol, totalFundsToCollect, decimals])
    }

    if (totalFundsToCollect.gt(0)) {
      console.log(
        `>>> Collecting ${totalFundsToCollect.toString()} of ${symbol}`
      )

      loadingPromises = []

      wallets.forEach((wallet, index) => {
        loadingPromises.push(
          new Promise<void>(async (res, rej) => {
            try {
              const balance = BigNumber.from(
                walletsData[index].ERC20Balances[provider.network.name][
                  ERC20.address
                ]
              )

              if (balance.gt(0)) {
                const tx = await ERC20.connect(wallet).transfer(
                  process.env.BOT_MASTER_WALLET,
                  balance,
                  ERC20GasOptions
                )

                const recipe = await tx.wait()

                if (recipe.status == 1) {
                  walletsData[index].ERC20Balances[provider.network.name][
                    ERC20.address
                  ] = '0'
                }
              }

              res()
            } catch (e) {
              console.error('error', e)
              rej()
            }
          })
        )
      })
    } else {
      console.log(`>>> No Wallet holds ${symbol} funds`)
    }

    await Promise.all(loadingPromises)
    loadingPromises = []
  }

  await Promise.all(loadingPromises)

  const nativeWalletsBalances = walletsData.filter((data) =>
    BigNumber.from(data.nativeBalances[provider.network.name] || 0).gt(0)
  )
  const walletsWithNativeBalance = nativeWalletsBalances.length

  const nativeGasOptions = await getGasOptions(26_000)

  const txCostWei = BigNumber.from(nativeGasOptions.gasLimit).mul(
    nativeGasOptions.gasPrice
  )

  const totalNativeFunds = nativeWalletsBalances
    .map((data) =>
      BigNumber.from(data.nativeBalances[provider.network.name] || 0)
    )
    .reduce((prev, next) => prev.add(next))
    .sub(txCostWei.mul(walletsWithNativeBalance))

  if (totalNativeFunds.gt(0)) {
    console.log(
      `>>> Collecting ${utils.formatEther(totalNativeFunds)} of ${
        provider.network.name
      } Native Currency `
    )

    collectSummary.push([
      `${provider.network.name} Native Currency`,
      totalNativeFunds,
      18
    ])

    loadingPromises = []

    walletsData.forEach((data, i) => {
      const fundsToCollect = BigNumber.from(
        data.nativeBalances[provider.network.name]
      ).sub(txCostWei)

      if (fundsToCollect.gt(0)) {
        BigNumber.from(data.nativeBalances[provider.network.name]).sub(
          txCostWei
        )

        loadingPromises.push(
          new Promise<void>(async (res, rej) => {
            try {
              const nativeAmount = (
                await provider.getBalance(data.address)
              ).sub(txCostWei)

              const tx = await wallets[i].sendTransaction({
                to: process.env.BOT_MASTER_WALLET,
                value: nativeAmount,
                ...nativeGasOptions
              })

              await tx.wait()

              // console.log(
              //   `>>> collected ${utils.formatEther(
              //     fundsToCollect
              //   )} from ${data.address.substring(0, 8)}`
              // )

              walletsData[i].nativeBalances[provider.network.name] = (
                await provider.getBalance(wallets[i].address)
              ).toString()

              res()
            } catch (e) {
              console.log(`>>> tx in wallet ${wallets[i].address} failed`)
              rej()
            }
          })
        )
      }
    })
  } else {
    console.log('No Native Funds to collect')
  }

  await Promise.all(loadingPromises)

  saveDataToFile(walletsData, 'bot/wallets')

  if (collectSummary.length > 0) {
    console.log(`>>> ${walletsData.length} Wallet Balances collected`)

    console.log(`> Summary`)
    collectSummary
      .filter((entry) => entry[1].gt(0))
      .forEach((entry) =>
        console.log(`>>> ${entry[0]} - ${entry[1].div(entry[2])}`)
      )
  } else {
    console.log(`>>> All funds already collected`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
