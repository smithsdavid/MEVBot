import { ethers } from 'hardhat'
import { getProvider } from './getProvider'

export const getGasOptions = async (gasLimit: number = 25_000) => {
  const provider = getProvider()
  const price = ethers.utils.formatUnits(await provider.getGasPrice(), 'gwei')
  return {
    gasLimit,
    gasPrice: ethers.utils.parseUnits(price, 'gwei')
  }
}
