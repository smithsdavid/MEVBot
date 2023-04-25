import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Percent, Token } from '@uniswap/sdk-core'
import {
  FeeAmount,
  NonfungiblePositionManager,
  Pool,
  Position,
  TICK_SPACINGS
} from '@uniswap/v3-sdk'
import { BigNumber, constants, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { NonfungiblePositionManager as NonfungiblePositionManagerContract } from '../../types/copypaste/NonfungiblePositionManager'
import { UniswapV3Pool } from '../../types/copypaste/UniswapV3Pool'
import { ERC20Template } from '../../types/typechain/ERC20Template'
import { WETH9 } from '../../types/typechain/WETH9'
import { getPoolState } from './getPoolState'
import { getPoolImmutables } from './getPoolImmutables'
import { getMinTick, getMaxTick } from './tickMath'

export const addLiqudityUni = async (
  pool: UniswapV3Pool,
  liquidity: BigNumber,
  sender: Wallet,
  positionManager: NonfungiblePositionManagerContract
) => {
  const [immutables, state] = await Promise.all([
    getPoolImmutables(pool),
    getPoolState(pool)
  ])

  const ERC20Factory = await ethers.getContractFactory('ERC20Template', sender)

  const token0 = ERC20Factory.attach(immutables.token0) as ERC20Template
  const token1 = ERC20Factory.attach(immutables.token1) as ERC20Template

  await token0.approve(positionManager.address, constants.MaxUint256)
  await token1.approve(positionManager.address, constants.MaxUint256)

  const decimalsToken0 = await token0.decimals()
  const decimalsToken1 = await token1.decimals()

  const Token0 = new Token(3, immutables.token0, decimalsToken0, 'T0', 'Token0')
  const Token1 = new Token(3, immutables.token1, decimalsToken1, 'T1', 'Token1')

  const poolInstance = new Pool(
    Token0,
    Token1,
    immutables.fee,
    state.sqrtPriceX96.toString(),
    state.liquidity.toString(),
    state.tick
  )

  const position = new Position({
    pool: poolInstance,
    liquidity: liquidity.toString(),
    tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
    tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM])
  })

  const deadline = (await ethers.provider.getBlock('latest')).timestamp * 2

  // mint position
  const { calldata, value } = NonfungiblePositionManager.addCallParameters(
    position,
    {
      slippageTolerance: new Percent(1), // 100% to ignore massive price change
      recipient: sender.address,
      deadline
    }
  )

  await sender.sendTransaction({
    data: calldata,
    to: positionManager.address,
    gasPrice: 1509345330
  })
}

// add liquidity to position
// const { calldata, value } = NonfungiblePositionManager.addCallParameters(
//   position,
//   {
//     slippageTolerance: new Percent(50, 10_000),
//     deadline: deadline,
//     tokenId: 1
//   }
// )

// remove liquidity from position
// const { calldata, value } = NonfungiblePositionManager.removeCallParameters(
//   position,
//   {
//     tokenId: 1,
//     liquidityPercentage: new Percent(1),
//     slippageTolerance: new Percent(50, 10_000),
//     deadline: deadline,
//     collectOptions: {
//       expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(TokenA, 0),
//       expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(TokenB, 0),
//       recipient: deployer.address
//     }
//   }
// )
