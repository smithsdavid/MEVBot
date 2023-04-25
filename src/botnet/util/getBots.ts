import { Wallet, ethers } from 'ethers'
import { WalletData } from '../../../types/archive/custom/WalletData'
import { loadDataFromFile } from '../../../utils/files/loadArrayFromFile'
import { setupDeployer } from '../../../utils/getDeployer'

export const getBots = () => {
  const { provider } = setupDeployer()

  const walletsData: WalletData[] = loadDataFromFile('bot/wallets')
  const wallets: Wallet[] = walletsData.map(
    (data) => new ethers.Wallet(data.privateKey, provider)
  )

  return wallets
}
