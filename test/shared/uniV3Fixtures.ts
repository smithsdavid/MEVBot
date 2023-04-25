import v3FactoryJson from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
import v3PositionManagerJson from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import v3RouterJson from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import { Fixture } from 'ethereum-waffle'
import { constants, ethers } from 'ethers'
// import v3NFTDescriptorJson from '../../contracts/archive/copypaste/NFTDescriptor.json'
import { NFTDescriptor } from '../../types/copypaste/NFTDescriptor'
import { NonfungiblePositionManager } from '../../types/copypaste/NonfungiblePositionManager'
import { UniswapV3Factory } from '../../types/copypaste/UniswapV3Factory'
import { ISwapRouter } from '../../types/typechain/ISwapRouter'
import { wethFixture } from './weth9Fixture'

let uniFactory: UniswapV3Factory
let uniRouter: ISwapRouter
let positionManager: NonfungiblePositionManager

export const uniV3Fixtures: Fixture<{
  uniFactory: UniswapV3Factory
  uniRouter: ISwapRouter
  positionManager: NonfungiblePositionManager
}> = async (wallets, provider) => {
  const { weth } = await wethFixture(wallets, provider)
  const [deployer] = wallets

  const UniswapV3FactoryFactory = new ethers.ContractFactory(
    v3FactoryJson.abi,
    v3FactoryJson.bytecode,
    deployer
  )

  const UniswapV3RouterFactory = new ethers.ContractFactory(
    v3RouterJson.abi,
    v3RouterJson.bytecode,
    deployer
  )

  const PositionManageFactory = new ethers.ContractFactory(
    v3PositionManagerJson.abi,
    v3PositionManagerJson.bytecode,
    deployer
  )

  // const NFTDescriptorFactory = new ethers.ContractFactory(
  //   v3NFTDescriptorJson.abi,
  //   v3NFTDescriptorJson.bytecode,
  //   deployer
  // )

  if (!uniFactory && !uniRouter && !positionManager) {
    uniFactory = (await UniswapV3FactoryFactory.deploy()) as UniswapV3Factory

    uniRouter = (await UniswapV3RouterFactory.deploy(
      uniFactory.address,
      weth.address
    )) as ISwapRouter

    // const nftDescriptor = (await NFTDescriptorFactory.deploy()) as NFTDescriptor

    positionManager = (await PositionManageFactory.deploy(
      uniFactory.address,
      weth.address,
      // nftDescriptor.address
      constants.AddressZero
    )) as NonfungiblePositionManager
  }

  return {
    uniFactory,
    uniRouter,
    positionManager
  }
}
