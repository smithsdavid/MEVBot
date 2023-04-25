import v2FactoryJson from '@uniswap/v2-core/build/UniswapV2Factory.json'
import v2RouterJson from '@uniswap/v2-periphery/build/UniswapV2Router02.json'
import { Fixture } from 'ethereum-waffle'
import { ethers } from 'ethers'
import { IUniswapV2Factory } from '../../types/typechain/IUniswapV2Factory'
import { IUniswapV2Router02 } from '../../types/typechain/IUniswapV2Router02'
import { wethFixture } from './weth9Fixture'

let sushiFactory: IUniswapV2Factory
let sushiRouter: IUniswapV2Router02

export const uniV2Fixtures: Fixture<{
  sushiFactory: IUniswapV2Factory
  sushiRouter: IUniswapV2Router02
}> = async (wallets, provider) => {
  const { weth } = await wethFixture(wallets, provider)
  const [deployer] = wallets

  const UniswapV2FactoryFactory = new ethers.ContractFactory(
    v2FactoryJson.abi,
    v2FactoryJson.bytecode,
    deployer
  )

  const UniswapV2RouterFactory = new ethers.ContractFactory(
    v2RouterJson.abi,
    v2RouterJson.bytecode,
    deployer
  )

  if (!sushiFactory && !sushiRouter) {
    sushiFactory = (await UniswapV2FactoryFactory.deploy(
      ethers.constants.AddressZero
    )) as IUniswapV2Factory

    sushiRouter = (await UniswapV2RouterFactory.deploy(
      sushiFactory.address,
      weth.address
    )) as IUniswapV2Router02
  }

  return {
    sushiFactory,
    sushiRouter
  }
}
