import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { UniswapV3Pool } from '../../types/copypaste/UniswapV3Pool'
import { ERC20Template } from '../../types/typechain/ERC20Template'
import { IUniswapV2Pair } from '../../types/typechain/IUniswapV2Pair'

export const observePoolState = async (
  pool: UniswapV3Pool | IUniswapV2Pair,
  type: 'SUSHI' | 'UNI'
) => {
  const token0Address = await pool.token0()
  const token1Address = await pool.token1()

  const ERC20Factory = await ethers.getContractFactory('ERC20Template')

  const token0 = ERC20Factory.attach(token0Address) as ERC20Template
  const token1 = ERC20Factory.attach(token1Address) as ERC20Template

  const [
    token0Symbol,
    token1Symbol,
    token0Balance,
    token1Balance,
    token0Decimals,
    token1Decimals,
    liquidity
  ] = await Promise.all([
    await token0.symbol(),
    await token1.symbol(),
    await token0.balanceOf(pool.address),
    await token1.balanceOf(pool.address),
    await token0.decimals(),
    await token1.decimals(),
    type === 'SUSHI'
      ? await (pool as IUniswapV2Pair).totalSupply()
      : await (pool as UniswapV3Pool).liquidity()
  ])

  console.log()
  console.log(`${type} ${token0Symbol}-${token1Symbol}`)
  console.log(`Liqu. ${liquidity}`)
  console.log(
    `t0 ${token0Symbol} Dec: ${token0Decimals} Balance: ${token0Balance.div(
      BigNumber.from(10).pow(token0Decimals)
    )} (${token0Balance})`
  )
  console.log(
    `t1 ${token1Symbol} Dec: ${token1Decimals} Balance: ${token1Balance.div(
      BigNumber.from(10).pow(token1Decimals)
    )} (${token1Balance})`
  )
}
