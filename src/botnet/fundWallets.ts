import 'dotenv/config'
import { BigNumber, utils } from 'ethers'
import { ethers } from 'hardhat'
import { WalletData } from '../../types/archive/custom/WalletData'
import { ERC20 } from '../../types/typechain'
import { loadDataFromFile } from '../../utils/files/loadArrayFromFile'
import { setupDeployer } from '../../utils/getDeployer'
import { setupFactories } from '../archive/setupFactories'
import { expandToDecimals } from '../../utils/expandToDecimals'
import { getGasOptions } from '../../utils/getGasOptions'
import { updateBalances } from './shared/updateBalances.1'

async function main() {
  const { ERC20Factory } = await setupFactories()
  const { provider } = setupDeployer()

  const botmaster = new ethers.Wallet(process.env.BOT_MASTER_KEY, provider)
  let ERC20GasOptions = await getGasOptions(100_000)
  let NativeGasOptions = await getGasOptions(30_000)

  // if replacement is needed
  // gasOptions = {
  //   ...gasOptions,
  //   gasPrice: gasOptions.gasPrice.mul(110).div(100)
  // }

  const walletsData: WalletData[] = loadDataFromFile('bot/wallets')

  const txCount = await botmaster.getTransactionCount()
  let nonce = BigNumber.from(txCount)

  console.log(`\n> Funding ${walletsData.length} Wallets`)
  console.log(`>>> Starting with nonce ${nonce}`)

  // * CONFIGURE HERE
  const ERC20Funding: [string, BigNumber][] = [
    // ['0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', expandToDecimals(1, 6)], // USDC
    // ['0xc2132D05D31c914a87C6611C10748AEb04B58e8F', expandToDecimals(4, 5)] // USDT
  ]
  const nativeFunding: { [network: string]: BigNumber } = {
    matic: expandToDecimals(1, 18)
  }
  // ****************

  const ERC20Tokens: ERC20[] = ERC20Funding.map((entry) =>
    ERC20Factory.attach(entry[0])
  )

  const nativeSharePerWallet = nativeFunding[provider.network.name].div(
    walletsData.length
  )

  console.log(`\n> Funding ERC20 Token`)

  let ERC20FundingPromises: Promise<void>[] = []

  if (ERC20Funding.length > 0) {
    for (let i = 0; i < ERC20Tokens.length; i++) {
      const ERC20 = ERC20Tokens[i]

      const sharePerWallet = ERC20Funding[i][1].div(walletsData.length)

      const [symbol, decimals] = await Promise.all([
        await ERC20Tokens[i].symbol(),
        await ERC20Tokens[i].decimals()
      ])

      console.log(
        `>>> Sending ${ERC20Funding[i][1].div(
          decimals
        )} ${symbol} to each wallet`
      )

      walletsData.forEach((data, index) => {
        ERC20FundingPromises.push(
          new Promise<void>(async (res, rej) => {
            try {
              const tx = await ERC20.connect(botmaster).transfer(
                data.address,
                sharePerWallet,
                {
                  nonce,
                  ...ERC20GasOptions
                }
              )

              const recipe = await tx.wait()

              console.log(
                `>>> ${data.address.substring(
                  0,
                  8
                )}... succesfully received ${utils.formatEther(
                  nativeSharePerWallet
                )}`
              )

              if (recipe.status == 1) {
                walletsData[index].ERC20Balances[provider.network.name][
                  ERC20.address
                ] = '0'
              }

              res()
            } catch (e) {
              console.error('error', e)
              rej()
            }
          })
        )

        nonce = nonce.add(1)
      })

      await Promise.all(ERC20FundingPromises)
      ERC20FundingPromises = []
    }
  } else {
    console.log('>>> No ERC20 Funding specified')
  }

  console.log(`>>> Executing Native Funding`)
  let nativeFundingPromises: Promise<void>[] = []

  for (let i = 0; i < walletsData.length; i++) {
    const data = walletsData[i]

    nativeFundingPromises.push(
      new Promise<void>(async (res, rej) => {
        try {
          const tx = await botmaster.sendTransaction({
            to: data.address,
            value: nativeSharePerWallet,
            nonce,
            ...NativeGasOptions
          })

          // console.log(`>>> TX ${tx.hash} queued`)

          await tx.wait()

          console.log(
            `>>> ${data.address.substring(
              0,
              8
            )}... succesfully received ${utils.formatEther(
              nativeSharePerWallet
            )}`
          )

          res()
        } catch (e) {
          console.error('error', e)
          rej()
        }
      })
    )

    if (i % 10 == 0) {
      console.log('cooldown, index ', i)
      await Promise.all(nativeFundingPromises)
      nativeFundingPromises = []
    }

    nonce = nonce.add(1)
  }
  walletsData.forEach((data) => {})

  console.log(`>>> Waiting for ${nativeFundingPromises.length} TXs to be mined`)
  await Promise.all(nativeFundingPromises)
  console.log(`>>> Native Balances transferred`)

  await updateBalances()
  console.log(`>Done`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
