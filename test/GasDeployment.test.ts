import chai from './config/chaisetup'
import { Uniswapv3Query } from '../types/typechain/Uniswapv3Query'
import { ethers } from 'hardhat'
import { constants } from 'ethers'

const { expect } = chai

describe('Deployment Gas Measuring', () => {
  beforeEach(async () => {
    const uniswapv3QueryFactory = await ethers.getContractFactory(
      'Uniswapv3Query'
    )
    const mcFactory = await ethers.getContractFactory('Multicall')

    const uniswapv3Query = await uniswapv3QueryFactory.deploy()

    const multicall = await mcFactory.deploy(
      constants.AddressZero,
      constants.AddressZero,
      constants.AddressZero,
      constants.AddressZero
    )
  })

  it('Deploys contracts', () => {
    expect(true).equal(true)
  })
})
