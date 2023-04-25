import { UniswapV3Pool } from '../../types/copypaste/UniswapV3Pool'
import { State } from './interfaces'

export async function getPoolState(pool: UniswapV3Pool) {
  const [liquidity, slot] = await Promise.all([pool.liquidity(), pool.slot0()])

  const PoolState: State = {
    liquidity,
    sqrtPriceX96: slot[0],
    tick: slot[1],
    observationIndex: slot[2],
    observationCardinality: slot[3],
    observationCardinalityNext: slot[4],
    feeProtocol: slot[5],
    unlocked: slot[6]
  }

  return PoolState
}
