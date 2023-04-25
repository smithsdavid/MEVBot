import 'dotenv/config'
import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'

async function main() {
  console.log(`\n> Generating Wallets`)

  const wallet = ethers.Wallet.createRandom()
  console.log({
    address: wallet.address,
    mnemonic: wallet.mnemonic.phrase,
    privateKey: wallet.privateKey,
    ethBalance: BigNumber.from(0).toString(),
    ERC20Balances: {}
  })

  console.log(`\n> Wallet generated`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
