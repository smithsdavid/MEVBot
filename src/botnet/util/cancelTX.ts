import 'dotenv/config'
import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { getGasOptions } from '../../../utils/getGasOptions'
import { setupDeployer } from '../../../utils/getDeployer'

async function main() {
  console.log('\n> Cancelling TXs')

  const { provider } = setupDeployer()

  const HIGHEST_NONCE = 535

  const botmaster = new ethers.Wallet(process.env.BOT_MASTER_KEY, provider)
  let gasOptions = await getGasOptions(100_000)

  gasOptions = {
    ...gasOptions,
    gasPrice: gasOptions.gasPrice.mul(150).div(100)
  }

  const promises_cancelTX: Promise<void>[] = []

  const txCount = await botmaster.getTransactionCount()
  let nonce = BigNumber.from(txCount)

  console.log(`>>> Cancelling TX from ${nonce} to ${HIGHEST_NONCE}`)

  // for (let i = nonce.toNumber(); i < HIGHEST_NONCE; i++) {
  //   promises_cancelTX.push(
  //     new Promise<void>((res, rej) => {
  //       botmaster
  //         .sendTransaction({
  //           to: botmaster.address,
  //           value: 0,
  //           nonce,
  //           ...gasOptions
  //         })
  //         .then(async (tx) => {
  //           const recipe = await tx.wait()

  //           if (recipe.status == 1) {
  //             console.log('>>> Tx success')
  //           } else {
  //             console.log('>>> Tx failed', recipe.transactionHash)
  //           }

  //           console.log()
  //           res()
  //         })
  //         .catch((e) => {
  //           console.log(e)

  //           res()
  //         })
  //     })
  //   )
  // }

  console.log('>>> Waiting for TX to complete')

  const tx = await botmaster.sendTransaction({
    to: botmaster.address,
    value: 0,
    nonce: 426,
    ...gasOptions
  })
  console.log(tx.hash)
  await tx.wait()

  await Promise.all(promises_cancelTX)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
