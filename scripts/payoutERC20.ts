import 'dotenv/config'
import { BigNumber, Wallet } from 'ethers'
import { ethers } from 'hardhat'
import { ERC20Template } from '../types/typechain'
import { getProvider } from '../utils/getProvider'

async function main() {
  console.log('\n> PayoutERC20')
  const multicallAddress = '0x388906078494f565b5c1562f32f9a236a607262d'
  const ERC20Address = '0x3c68ce8504087f89c640d02d133646d98e64ddd9'
  const receiver = '0x21db76B75db2f5d4f9505Eae7d8cE53eB9AEd2B5'
  const amount = BigNumber.from('102324334940539824')

  const provider = getProvider()
  const deployer = new Wallet(process.env.DEV_WALLET_KEY, provider)
  const mcFactory = await ethers.getContractFactory('Multicall', deployer)
  const multicall = mcFactory.attach(multicallAddress)

  const ERC20Factory = await ethers.getContractFactory('ERC20Template')
  const erc20 = ERC20Factory.attach(ERC20Address) as ERC20Template
  const { data } = await erc20.populateTransaction.transfer(receiver, amount)
  console.log('data', data)

  if (!data) throw new Error('no tx data')
  const tx = await multicall.call(ERC20Address, 0, data)
  console.log('tx: ', tx.hash)
  await tx.wait()
  console.log('complete')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
