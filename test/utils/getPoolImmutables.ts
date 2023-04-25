import { UniswapV3Pool } from '../../types/copypaste/UniswapV3Pool'
import { Immutables } from './interfaces'

export async function getPoolImmutables(pool: UniswapV3Pool) {
  const [factory, token0, token1, fee, tickSpacing, maxLiquidityPerTick] =
    await Promise.all([
      pool.factory(),
      pool.token0(),
      pool.token1(),
      pool.fee(),
      pool.tickSpacing(),
      pool.maxLiquidityPerTick()
    ])

  const immutables: Immutables = {
    factory,
    token0,
    token1,
    fee,
    tickSpacing,
    maxLiquidityPerTick
  }

  return immutables
}
