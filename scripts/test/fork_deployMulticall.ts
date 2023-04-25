import 'dotenv/config'
import { BigNumber, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import {
  LENDING_POOL_ADDRESS_PROVIDER,
  UNI_FACTORY_V3,
  WETH_ADDRESS
} from '../../src/config/addresses'
import { getProvider } from '../../utils/getProvider'

async function main() {
  console.log('\n> Deploying Multicall')
  const provider = getProvider()
  const deployer = new Wallet(process.env.FORK_WALLET_KEY, provider)

  const newGas = {
    gasLimit: 2_000_000,
    gasPrice: BigNumber.from('50000000000')
  }

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
