import { Fixture } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { ERC20Template } from '../../types/typechain/ERC20Template'

let dai: ERC20Template
let usdc: ERC20Template

export const ERC20Fixtures: Fixture<{
  dai: ERC20Template
  usdc: ERC20Template
}> = async ([deployer]) => {
  const ERC20Factory = await ethers.getContractFactory(
    'ERC20Template',
    deployer
  )

  if (!dai) {
    dai = (await ERC20Factory.deploy('xDAI', 'DAI', 18)) as ERC20Template
    usdc = (await ERC20Factory.deploy('USDC', 'USDC', 6)) as ERC20Template
  }

  return { dai, usdc }
}
