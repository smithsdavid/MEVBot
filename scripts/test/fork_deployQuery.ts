import 'dotenv/config'
import { BigNumber, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { getProvider } from '../../utils/getProvider'

async function main() {
  console.log('\n> Deploying Query')
  const provider = getProvider()
  const deployer = new Wallet(process.env.FORK_WALLET_KEY, provider)

  const queryFactory = await ethers.getContractFactory('Query', deployer)
  const query = await queryFactory.deploy({
    gasLimit: 2_000_000,
    gasPrice: BigNumber.from('80000000000')
  })

  console.log('\n>>> Waiting for deployment to finish')
  console.log(query.address)
  await query.deployed()

  console.log('\n> Multicall address ', query.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
