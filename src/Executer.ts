import { TransactionRequest } from '@ethersproject/abstract-provider/src.ts'
import { AlchemyProvider, JsonRpcProvider } from '@ethersproject/providers'
import {
  FlashbotsBundleProvider,
  FlashbotsBundleTransaction
} from '@flashbots/ethers-provider-bundle'
import chalk from 'chalk'
import { BigNumber, utils, Wallet } from 'ethers'
import fs from 'fs'
import { ethers, network } from 'hardhat'
import path from 'path'
import { Multicall } from '../types/typechain'
import { getProvider } from '../utils/getProvider'
import { MULTICALL } from './config/addresses'
import {
  CHAIN_ID,
  MAX_MINER_REWARD,
  MAX_MINER_REWARD_SHARE as MINER_REWARD_SHARE
} from './config/config'
import { Route } from './Route'

const { FORK_WALLET_KEY, DEV_WALLET_KEY, FLASHBOTS_RELAY_SIGNING_KEY } =
  process.env

export class Executer {
  private _signer: Wallet | undefined
  private _flashbotsProvider: FlashbotsBundleProvider | undefined
  private _provider: AlchemyProvider | JsonRpcProvider | undefined
  private _multicall: Multicall | undefined

  private _counter: [number, number, number] = [0, 0, 0]
  public get successCount(): number {
    return this._counter[0]
  }
  public get failureCount(): number {
    return this._counter[1]
  }
  public get totalTries(): number {
    return this._counter[2]
  }

  private GAS_LIMIT = 2_000_000
  private MAX_PRIORITY_FEE_PER_GAS = BigNumber.from('1000000000') // 1 Gwei
  private _gasOptions: TransactionRequest = {}

  constructor() {}

  async init(): Promise<void> {
    this._provider = getProvider()
    this._signer = new ethers.Wallet(
      network.name === 'fork' ? FORK_WALLET_KEY : DEV_WALLET_KEY,
      this._provider
    )
    this._flashbotsProvider = await this.getFlashbotsProvider()
    const mcFactory = await ethers.getContractFactory('Multicall')
    this._multicall = mcFactory.attach(MULTICALL) as Multicall
    this._gasOptions = await this.refreshGas()
  }

  private async getFlashbotsProvider(): Promise<FlashbotsBundleProvider> {
    const reputationWallet = new ethers.Wallet(
      FLASHBOTS_RELAY_SIGNING_KEY,
      getProvider()
    ) // ethers.js signer wallet, only for signing request payloads, not transactions

    return await FlashbotsBundleProvider.create(
      getProvider(), // a normal ethers.js provider, to perform gas estimiations and nonce lookups
      reputationWallet
    )
  }

  public async refreshGas(): Promise<TransactionRequest> {
    const block = await this._provider!.getBlock('latest')
    const maxBaseFeeInFutureBlock =
      FlashbotsBundleProvider.getMaxBaseFeeInFutureBlock(
        block.baseFeePerGas as BigNumber,
        1
      )

    return {
      maxFeePerGas: maxBaseFeeInFutureBlock,
      maxPriorityFeePerGas: this.MAX_PRIORITY_FEE_PER_GAS,
      gasLimit: this.GAS_LIMIT
    } as TransactionRequest
  }

  private async generaterTXData(
    route: Route,
    amountIn: BigNumber,
    minerRewardPercent: BigNumber
  ): Promise<TransactionRequest> {
    const { types, swaps } = route.encodeRoute(amountIn)
    const { data } = await this._multicall!.populateTransaction.multicall(
      amountIn,
      minerRewardPercent,
      types,
      swaps
    )

    const transaction: TransactionRequest = {
      to: MULTICALL,
      type: 2,
      data,
      chainId: CHAIN_ID,
      ...this._gasOptions
    }

    return transaction
  }

  public async submit(
    route: Route,
    amountIn: BigNumber,
    expectedProfit: BigNumber
  ): Promise<boolean> {
    const minerRewardPercent = this.calculateMinerReward(expectedProfit)
    const transaction = await this.generaterTXData(
      route,
      amountIn,
      minerRewardPercent
    )

    try {
      const [success, gasUsed, nuked] = await this.simulate(transaction)
    } catch (e) {
      console.error('simulation call threw error', e)
      return false
    }
    return true
    // const [success, gasUsed, nuked] = [true, BigNumber.from(600_000), false]
    // console.log('success', success, 'gasUsed', gasUsed)

    // if (nuked) {
    //   console.log(chalk.bgRed('NUKE ヽ༼ ಠ益ಠ ༽ﾉ'))
    //   this.addNuked(route)
    //   return false
    // }

    // const txCost = gasUsed // !
    // // const txCost = gasUsed.mul(transaction.maxFeePerGas!)

    // if (network.name === 'fork') {
    //   console.log(chalk.cyan('sending tx'))
    //   await this._signer?.sendTransaction(transaction)
    // }

    // console.log('txCost', txCost)
    // if (success && expectedProfit.gt(txCost)) {
    //   console.log(chalk.bgBlueBright('\n###   Profitable ROUTE   ###'))
    //   // drawRoute(route, amountIn, expectedProfit)
    //   console.log(
    //     chalk.bgGreen('Profit', utils.formatEther(expectedProfit.sub(txCost)))
    //   )
    //   console.log()
    // }

    return true
  }

  public async simulate(
    transaction: TransactionRequest
  ): Promise<[boolean, BigNumber, boolean]> {
    const block = await this._provider!.getBlock('latest')
    const txBundle: FlashbotsBundleTransaction[] = [
      { signer: this._signer!, transaction }
    ]
    const signedBundle = await this._flashbotsProvider!.signBundle(txBundle)
    const simulation = (await this._flashbotsProvider!.simulate(
      signedBundle,
      block.number
      // block.number + 1
    )) as any
    let nuked = false
    let np = false
    let success = false

    console.log('simulation', simulation)

    if ('error' in simulation || simulation.firstRevert !== undefined) {
      console.log('Simulation Failed\n')
      nuked =
        simulation.results?.some((res: any) => res.revert?.includes('NUKE')) ||
        false
      np =
        simulation.results?.some((res: any) => res.revert?.includes('NP')) ||
        false
      this.incrFailure()
    } else {
      console.log(chalk.bgYellowBright('### Success ʕᵔᴥᵔʔ'))
      console.log('\n\nsimulation', simulation, '\n\n')
      this.incrSuccess()
      success = true
    }
    return [success, BigNumber.from(simulation.totalGasUsed), nuked]
  }

  private calculateMinerReward(expectedProfit: BigNumber): BigNumber {
    return expectedProfit.mul(MINER_REWARD_SHARE).div(100).lte(MAX_MINER_REWARD)
      ? MINER_REWARD_SHARE
      : MAX_MINER_REWARD.mul(1000).div(expectedProfit)
  }

  private addNuked(route: Route): void {
    const nuked = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../data/nuked.json')).toString()
    ) as string[]

    if (!nuked.includes(route.identifier)) {
      nuked.push(route.identifier)
      fs.writeFileSync(
        path.join(__dirname, '../data/nuked.json'),
        JSON.stringify(nuked)
      )
    }

    route.nuke()
  }

  private incrSuccess(): void {
    this._counter[0]++
    this._counter[2]++
  }
  private incrFailure(): void {
    this._counter[1]++
    this._counter[2]++
  }

  public static getNuked(): string[] {
    return JSON.parse(
      fs.readFileSync(path.join(__dirname, '../data/nuked.json')).toString()
    ) as string[]
  }
}
