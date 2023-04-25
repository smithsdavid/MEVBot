import { TransactionRequest } from '@ethersproject/abstract-provider/src.ts'
import {
  FlashbotsBundleProvider,
  FlashbotsBundleTransaction
} from '@flashbots/ethers-provider-bundle'
import 'dotenv/config'
import { BigNumber, utils } from 'ethers'
import { ethers } from 'hardhat'
import { MULTICALL } from '../src/config/addresses'
import { Multicall } from '../types/typechain'
import { getProvider } from '../utils/getProvider'

const { FLASHBOTS_RELAY_SIGNING_KEY, DEV_WALLET_KEY } = process.env
const MAX_PRIORITY_FEE_PER_GAS = BigNumber.from('2000000000') // 2 Gwei
const CHAIN_ID = 1

const getFlashbotsProvider = async () => {
  const reputationWallet = new ethers.Wallet(
    FLASHBOTS_RELAY_SIGNING_KEY,
    getProvider()
  ) // ethers.js signer wallet, only for signing request payloads, not transactions

  return await FlashbotsBundleProvider.create(
    getProvider(), // a normal ethers.js provider, to perform gas estimiations and nonce lookups
    reputationWallet
    // 'https://relay-goerli.epheph.com/',
    // 'goerli'
  )
}

async function calculateGas(baseFeePerGas: BigNumber) {
  const maxBaseFeeInFutureBlock =
    FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(
      baseFeePerGas as BigNumber,
      1
    )

  return {
    maxFeePerGas: maxBaseFeeInFutureBlock,
    maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
    gasLimit: 700_000
  } as TransactionRequest
}

async function main() {
  const provider = getProvider()
  const signer = new ethers.Wallet(DEV_WALLET_KEY, getProvider())
  const mcFactory = await ethers.getContractFactory('Multicall')
  const multicall = mcFactory.attach(MULTICALL) as Multicall
  const flashbotsProvider = await getFlashbotsProvider()
  const block = await provider.getBlock('latest')
  const gasOptions = await calculateGas(block.baseFeePerGas as BigNumber)

  const types: Array<number> = [2, 2, 3, 3]
  const swaps: Array<string> = [
    '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000b4e16d0168e52d35cacd2c6185b44281ec28c9dc',
    '0x000000000000000000000000000000000000000000000000000000009fdfee28000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000cb84d72e61e383767c4dfeb2d8ff7f4fb89abc6e00000000000000000000000042b7b8f8f83fa5cbf0176f8c24ad51ebcd4b5f17',
    '0x00000000000000000000000000000000000000000000002f47cb5de228f1bbbd000000000000000000000000cb84d72e61e383767c4dfeb2d8ff7f4fb89abc6e000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000000000bb8000000000000000000000000ea0faef12cf887a5b1a8b8a85b782022d0d122f8',
    '0x00000000000000000000000000000000000000000000000000000000cfbdbb40000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000000000000000000000000000000000000000000bb800000000000000000000000088e6a0c2ddd26feeb64f039a2c41296fcb3f5640'
  ]
  const amountIn = utils.parseEther('1')
  const { data } = await multicall.populateTransaction.multicall(
    amountIn,
    BigNumber.from('0'), // 0.01
    types,
    swaps
  )

  // const { data } = await multicall.populateTransaction.call(
  //   signer.address,
  //   BigNumber.from('100000000000000'),
  //   '0x'
  // )

  const loadUpTx: TransactionRequest = {
    to: MULTICALL,
    type: 2,
    chainId: CHAIN_ID,
    value: BigNumber.from('20000000000000000'), // 0.04
    ...gasOptions
  }

  const transaction: TransactionRequest = {
    to: MULTICALL,
    from: signer.address,
    type: 2,
    data,
    chainId: CHAIN_ID,
    ...gasOptions
  }

  const txBundle: FlashbotsBundleTransaction[] = [
    { signer, transaction: loadUpTx },
    { signer, transaction }
  ]
  const signedBundle = await flashbotsProvider.signBundle(txBundle)

  const simulation = (await flashbotsProvider.simulate(
    signedBundle,
    block.number + 1
  )) as any

  console.log('\n\nsimulation', simulation, '\n\n')

  if ('error' in simulation || simulation.firstRevert !== undefined) {
    console.log('Simulation Error\n')
  }

  // console.log(
  //   `Submitting bundle, profit sent to miner: ${bigNumberToDecimal(
  //     simulation.coinbaseDiffy
  //   )}, effective gas price: ${bigNumberToDecimal(
  //     simulation.coinbaseDiff.div(simulation.totalGasUsed),
  //     9
  //   )} GWEI`
  // )

  // const res = simulation.results[0]
  // const gasPrice = BigNumber.from(res.gasPrice)
  // const gasUsed = BigNumber.from(res.gasUsed)
  // console.log('cost', utils.formatEther(gasPrice.mul(gasUsed)))
  // console.log(Buffer.from((simulation as any).results[0].revert).toString())

  // if ('error' in simulation) {
  //   console.log(`Simulation Error: ${simulation.error.message}`)
  // } else {
  //   console.log(
  //     `Simulation Success: ${block.number} ${JSON.stringify(
  //       simulation,
  //       null,
  //       2
  //     )}`
  //   )
  // }

  // const res = await flashbotsProvider.sendRawBundle(
  //   signedBundle,
  //   block.number + 2
  // )
  // console.log('\n\nres', res)
}

function bigNumberToDecimal(value: BigNumber, base = 18): number {
  const divisor = BigNumber.from(10).pow(base)
  return value.mul(10000).div(divisor).toNumber() / 10000
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })

// * eth_callback
// const transaction: TransactionRequest = {
//   to: MULTICALL,
//   from: signer.address,
//   type: 2,
//   data
// }
// console.log('\n\ntransaction', transaction)
// const result = await provider.send('eth_call', [transaction])
// console.log('result', result)
