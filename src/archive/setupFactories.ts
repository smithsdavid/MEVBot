import v3FactoryJson from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
import v3PoolJson from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import 'dotenv/config'
import { ethers } from 'hardhat'
import { setupDeployer } from '../../utils/getDeployer'

export const setupFactories = async () => {
  const { deployer } = setupDeployer()

  const sushiPairFactory = await ethers.getContractFactory(
    'UniswapV2Pair',
    deployer
  )
  const sushiFactoryFactory = await ethers.getContractFactory(
    'UniswapV2Factory',
    deployer
  )
  const uniPoolFactory = new ethers.ContractFactory(
    v3PoolJson.abi,
    v3PoolJson.bytecode,
    deployer
  )
  const uniFactoryFactory = new ethers.ContractFactory(
    v3FactoryJson.abi,
    v3FactoryJson.bytecode,
    deployer
  )
  const ERC20Factory = await ethers.getContractFactory('ERC20', deployer)
  const ExecutorFactory = await ethers.getContractFactory('Executor', deployer)

  return {
    sushiPairFactory,
    sushiFactoryFactory,
    uniPoolFactory,
    uniFactoryFactory,
    ERC20Factory,
    ExecutorFactory
  }
}
