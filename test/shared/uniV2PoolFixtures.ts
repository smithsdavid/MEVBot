import v2PairJson from '@uniswap/v2-core/build/UniswapV2Pair.json'
import { Fixture } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { ERC20Template } from '../../types/typechain/ERC20Template'
import { IUniswapV2Factory } from '../../types/typechain/IUniswapV2Factory'
import { IUniswapV2Pair } from '../../types/typechain/IUniswapV2Pair'
import { WETH9 } from '../../types/typechain/WETH9'
import { ERC20Fixtures } from './ERC20Fixtures'
import { uniV2Fixtures } from './uniV2Fixtures'
import { wethFixture } from './weth9Fixture'

let sDaiWethPool: IUniswapV2Pair
let sUsdcWethPool: IUniswapV2Pair

export const uniV2PoolFixtures: Fixture<{
  sDaiWethPool: IUniswapV2Pair
  sUsdcWethPool: IUniswapV2Pair
}> = async (wallets, provider) => {
  const { dai, usdc } = await ERC20Fixtures(wallets, provider)
  const { weth } = await wethFixture(wallets, provider)

  const { sushiFactory } = await uniV2Fixtures(wallets, provider)

  const [deployer] = wallets

  if (!sDaiWethPool && !sUsdcWethPool) {
    sDaiWethPool = await createPair(dai, weth, sushiFactory, deployer)
    sUsdcWethPool = await createPair(usdc, weth, sushiFactory, deployer)
  }

  return { sDaiWethPool, sUsdcWethPool }
}

const createPair = async (
  token0: ERC20Template | WETH9,
  token1: ERC20Template | WETH9,
  factory: IUniswapV2Factory,
  deployer: Wallet
) => {
  const UniswapV2PairFactory = new ethers.ContractFactory(
    v2PairJson.abi,
    v2PairJson.bytecode,
    deployer
  )

  await factory.createPair(token0.address, token1.address)

  const pool = UniswapV2PairFactory.attach(
    await factory.getPair(token0.address, token1.address)
  ) as IUniswapV2Pair

  return pool
}
