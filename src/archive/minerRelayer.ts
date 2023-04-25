import {
  FlashbotsBundleProvider,
  FlashbotsBundleTransaction
} from '@flashbots/ethers-provider-bundle'
import 'dotenv/config'
import { BigNumber, utils } from 'ethers'
import { ethers } from 'hardhat'
import { TransactionRequest } from '@ethersproject/abstract-provider/src.ts'
import { getProvider } from '../utils/getProvider'
import UniABI from '../contracts/abi/uniABI.json'
import { UniswapV2Router02 } from '../types/typechain'

const { FLASHBOTS_RELAY_SIGNING_KEY, DEV_WALLET_KEY } = process.env

const ETHER = BigNumber.from(10).pow(18)
const GWEI = BigNumber.from(10).pow(9)
const PRIORITY_FEE_PER_GAS = BigNumber.from('2')

const BLOCKS_IN_FUTURE = 2

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

const getSigner = () => new ethers.Wallet(DEV_WALLET_KEY, getProvider())

async function calculateGas(baseFeePerGas: BigNumber) {
  const maxBaseFeeInFutureBlock =
    FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(
      baseFeePerGas as BigNumber,
      1
    )

  return {
    maxFeePerGas: PRIORITY_FEE_PER_GAS.add(maxBaseFeeInFutureBlock),
    maxPriorityFeePerGas: PRIORITY_FEE_PER_GAS,
    gasLimit: 42000
  } as TransactionRequest
}

async function main() {
  // const CHAIN_ID = 5 // Goerli
  const CHAIN_ID = 1
  const provider = getProvider()

  const flashbotsProvider = await getFlashbotsProvider()
  const block = await provider.getBlock('latest')

  const signer = getSigner()
  const gasOptions = await calculateGas(block.baseFeePerGas as BigNumber)

  // const uniswap = new ethers.Contract(
  //   process.env.UNI_ROUTER_2,
  //   UniABI,
  //   signer
  // ) as UniswapV2Router02
  // const amountOut = utils.parseEther('0.001')
  // const unsignedSwap = uniswap.populateTransaction.swapETHForExactTokens(
  //   amountOut,
  //   [process.env.WETH],
  //   signer.address,
  //   Date.now() + 10000
  // )

  const eip1559Transaction: TransactionRequest = {
    to: '0xBe8466096B24A93656627bdcBFA22F8d4Ec927Cb',
    value: 100000,
    type: 2,
    data: '0x',
    chainId: CHAIN_ID,
    ...gasOptions
  }

  const swapTransaction: TransactionRequest = {
    to: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    value: 100000,
    type: 2,
    data: '0x5ae401dc00000000000000000000000000000000000000000000000000000000626a724f00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000e404e45aaf000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000004d224452801aced8b2f0aebe155379bb5d5943810000000000000000000000000000000000000000000000000000000000000bb800000000000000000000000042898cef6a2e62849e1ac0293e8295659a66be8f00000000000000000000000000000000000000000000000014d1120d7b16000000000000000000000000000000000000000000000000000b9462c3add68a8319000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
    chainId: CHAIN_ID,
    ...gasOptions
  }

  const txBundle: FlashbotsBundleTransaction[] = [
    { signer, transaction: eip1559Transaction },
    { signer, transaction: swapTransaction }
  ]

  const signedBundle = await flashbotsProvider.signBundle(txBundle)

  const start = Date.now()
  const simulation = await flashbotsProvider.simulate(
    signedBundle,
    block.number + 1
  )
  const end = Date.now()

  console.log('simulation', simulation)

  console.log('Total time ', end - start)

  if ('error' in simulation) {
    console.log(`Simulation Error: ${simulation.error.message}`)
  } else {
    console.log(
      `Simulation Success: ${block.number} ${JSON.stringify(
        simulation,
        null,
        2
      )}`
    )
  }

  // const flashbotsTransactionResponse = (await flashbotsProvider.sendBundle(
  //   txBundle,
  //   block.number + BLOCKS_IN_FUTURE
  // )) as any

  // console.log('flashbotsTransactionResponse', flashbotsTransactionResponse)

  // const result = await flashbotsTransactionResponse.wait()
  // console.log('result', result)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
