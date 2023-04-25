import { Fixture } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { WETH9 } from '../../types/typechain/WETH9'

let weth: WETH9

export const wethFixture: Fixture<{ weth: WETH9 }> = async ([deployer]) => {
  const WETHFactory = await ethers.getContractFactory('WETH9', deployer)

  if (!weth) {
    weth = (await WETHFactory.deploy()) as WETH9
  }

  return { weth }
}
