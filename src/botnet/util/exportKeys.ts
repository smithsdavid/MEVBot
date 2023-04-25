import 'dotenv/config'
import { WalletData } from '../../../types/archive/custom/WalletData'
import { loadDataFromFile } from '../../../utils/files/loadArrayFromFile'
import { saveDataToFile } from '../../../utils/files/saveArrayToFile'

export const updateBalances = async () => {}

async function main() {
  console.log(`\n> Exporting Wallet Keys`)

  const walletsData: WalletData[] = loadDataFromFile('bot/wallets')
  const keys = walletsData.map((data) => data.privateKey)

  saveDataToFile(keys, `bot/keys/$keys_${Date.now()}`)

  console.log(`\n> ${walletsData.length} Private Keys exported`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
