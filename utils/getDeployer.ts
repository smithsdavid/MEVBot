import { ethers, network } from 'hardhat'
import { getProvider } from './getProvider'

export const setupDeployer = () => {
  const provider = getProvider()

  const deployer = new ethers.Wallet(process.env.DEV_WALLET_KEY, provider)
  return { deployer, provider }
}
