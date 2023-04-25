import 'dotenv/config'
import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { WalletData } from '../../types/archive/custom/WalletData'
import { saveDataToFile } from '../../utils/files/saveArrayToFile'
import { setupDeployer } from '../../utils/getDeployer'

async function main() {
  console.log(`\n> Generating Wallets`)

  const { provider } = await setupDeployer()

  const AMOUNT = 16
  const wallets: WalletData[] = []

  for (let i = 0; i < AMOUNT; i++) {
    const wallet = ethers.Wallet.createRandom()
    wallets.push({
      address: wallet.address,
      mnemonic: wallet.mnemonic.phrase,
      privateKey: wallet.privateKey,
      nativeBalances: {
        [provider.network.name]: BigNumber.from(0).toString()
      },
      ERC20Balances: {}
    })
  }

  saveDataToFile(wallets, 'bot/wallets')

  console.log(`\n> ${AMOUNT} Wallets generated`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
