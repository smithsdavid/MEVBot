import v3PoolJson from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import { FeeAmount } from '@uniswap/v3-sdk'
import { Fixture, MockProvider } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { UniswapV3Factory } from '../../types/copypaste/UniswapV3Factory'
import { UniswapV3Pool } from '../../types/copypaste/UniswapV3Pool'
import { ERC20Template } from '../../types/typechain/ERC20Template'
import { WETH9 } from '../../types/typechain/WETH9'
import { encodePriceSqrt } from '../utils/encodePriceSqrt'
import { ERC20Fixtures } from './ERC20Fixtures'
import { uniV3Fixtures } from './uniV3Fixtures'
import { wethFixture } from './weth9Fixture'

let uDaiWethPool: UniswapV3Pool
let uUsdcWethPool: UniswapV3Pool
let uUsdcDaiPool: UniswapV3Pool

export const uniV3PoolFixtures: Fixture<{
  uDaiWethPool: UniswapV3Pool
  uUsdcWethPool: UniswapV3Pool
  uUsdcDaiPool: UniswapV3Pool
}> = async (wallets, provider) => {
  const { dai, usdc } = await ERC20Fixtures(wallets, provider)
  const { weth } = await wethFixture(wallets, provider)

  if (!uDaiWethPool && !uDaiWethPool && !uUsdcDaiPool) {
    uDaiWethPool = await createPool(dai, weth, [1, 1], wallets, provider)
    uUsdcWethPool = await createPool(
      usdc,
      weth,
      [1, 380_000_000], //by trying so 2700 USDC gives 1 WETH
      wallets,
      provider
    )
    uUsdcDaiPool = await createPool(usdc, dai, [1, 1], wallets, provider)
  }

  return { uDaiWethPool, uUsdcWethPool, uUsdcDaiPool }
}

const createPool = async (
  token0: ERC20Template | WETH9,
  token1: ERC20Template | WETH9,
  sqrtRatio: [number, number],
  wallets: Wallet[],
  provider: MockProvider
) => {
  const { uniFactory } = await uniV3Fixtures(wallets, provider)
  const [deployer] = wallets

  const UniswapV3PoolFactory = new ethers.ContractFactory(
    v3PoolJson.abi,
    v3PoolJson.bytecode,
    deployer
  )

  await uniFactory.createPool(token0.address, token1.address, FeeAmount.MEDIUM)

  const pool = UniswapV3PoolFactory.attach(
    await uniFactory.getPool(token0.address, token1.address, FeeAmount.MEDIUM)
  ) as UniswapV3Pool

  await pool.initialize(encodePriceSqrt(...sqrtRatio))

  return pool
}
