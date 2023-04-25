import { WalletData } from '../../../types/archive/custom/WalletData'
import { ERC20 } from '../../../types/typechain'
import { loadDataFromFile } from '../../../utils/files/loadArrayFromFile'
import { saveDataToFile } from '../../../utils/files/saveArrayToFile'
import { setupDeployer } from '../../../utils/getDeployer'
import { setupFactories } from '../../archive/setupFactories'

export const updateBalances = async () => {
  console.log(`\n> Updating Wallet Balances`)

  const { ERC20Factory } = await setupFactories()
  const { provider } = setupDeployer()

  const walletsData: WalletData[] = loadDataFromFile('bot/wallets')

  const ERC20Addresses = new Set<string>()
  walletsData.forEach((wallet) => {
    if (!wallet.ERC20Balances[provider.network.name]) {
      wallet.ERC20Balances[provider.network.name] = {}
    }

    // Populating addresses
    Object.keys(wallet.ERC20Balances[provider.network.name]).forEach((key) =>
      ERC20Addresses.add(key)
    )
  })

  // ERC20Addresses.add('0xc2132D05D31c914a87C6611C10748AEb04B58e8F') // add new ones
  const ERC20Tokens: ERC20[] = Array.from(ERC20Addresses).map((address) =>
    ERC20Factory.attach(address)
  )

  const loadingPromises: Promise<void>[] = []

  walletsData.forEach((wallet) => {
    loadingPromises.push(
      new Promise<void>(async (res, rej) => {
        try {
          const ERC20LoadingPromises: Promise<void>[] = []

          wallet.nativeBalances[provider.network.name] = (
            await provider.getBalance(wallet.address)
          ).toString()

          if (!wallet.ERC20Balances[provider.network.name]) {
            wallet.ERC20Balances[provider.network.name] = {}
          }

          ERC20Tokens.forEach(async (ERC20) => {
            ERC20LoadingPromises.push(
              new Promise<void>((res, rej) =>
                ERC20.balanceOf(wallet.address)
                  .then((balance) => {
                    wallet.ERC20Balances[provider.network.name][ERC20.address] =
                      balance.toString()
                    res()
                  })
                  .catch((e) => {
                    console.error('error', e)
                    rej()
                  })
              )
            )
          })

          await Promise.all(ERC20LoadingPromises)

          res()
        } catch (e) {
          console.error('error', e)
          rej()
        }
      })
    )
  })

  await Promise.all(loadingPromises)
  saveDataToFile(walletsData, 'bot/wallets')

  console.log(`>>> ${walletsData.length} Wallet Balances updated`)

  return true
}
