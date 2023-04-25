import {
  LENDING_POOL_ADDRESS_PROVIDER,
  UNI_FACTORY_V3,
  WETH_ADDRESS
} from '../src/config/addresses'
import 'dotenv/config'
import { BigNumber, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { ERC20Template } from '../types/typechain'
import { getGasOptions } from '../utils/getGasOptions'
import { getProvider } from '../utils/getProvider'

async function main() {
  console.log('\n> Deploying Multicall')
  const provider = getProvider()
  const deployer = new Wallet(process.env.DEV_WALLET_KEY, provider)
  const gasOptions = await getGasOptions(1_800_000)

  const newGas = {
    gasLimit: 2_800_000,
    gasPrice: BigNumber.from('16000000000') //! 16 Gwei
  }

  console.log('gasOptions', gasOptions)
  console.log('newGas', newGas)

  const mcFactory = await ethers.getContractFactory('Multicall', deployer)
  const multicall = await mcFactory.deploy(
    deployer.address,
    LENDING_POOL_ADDRESS_PROVIDER,
    WETH_ADDRESS,
    UNI_FACTORY_V3,
    {
      ...newGas
    }
  )

  console.log('\n>>> Waiting for deployment to finish')
  console.log(multicall.address)
  await multicall.deployed()

  console.log('\n> Multicall address ', multicall.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
