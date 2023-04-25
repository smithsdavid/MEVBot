import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-gas-reporter'
import 'hardhat-contract-sizer'
import '@typechain/hardhat'
import 'dotenv/config'
import { HardhatUserConfig } from 'hardhat/types'

const settings = {
  optimizer: {
    enabled: true,
    runs: 200
  }
}

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    compilers: [
      { version: '0.5.16', settings },
      { version: '0.6.12', settings },
      { version: '0.6.6', settings },
      { version: '0.7.0', settings },
      { version: '0.7.6', settings },
      { version: '0.8.11', settings },
      { version: '0.8.10', settings }
    ]
  },
  networks: {
    hardhat: {},
    mainnet: {
      url: process.env.ALCHEMY_URL_MAINNET,
      accounts: [process.env.DEV_WALLET_KEY]
    },
    maticmum: {
      url: process.env.ALCHEMY_URL_MUMBAI,
      accounts: [process.env.DEV_WALLET_KEY]
    },
    matic: {
      url: process.env.ALCHEMY_URL_POLYGON,
      accounts: [process.env.DEV_WALLET_KEY]
    },
    rinkeby: {
      url: process.env.ALCHEMY_URL_RINKEBY,
      accounts: [process.env.DEV_WALLET_KEY]
    },
    goerli: {
      url: process.env.ALCHEMY_URL_GOERLI,
      accounts: [process.env.DEV_WALLET_KEY]
    },
    fork: {
      url: 'http://localhost:8545',
      accounts: [process.env.FORK_WALLET_KEY]
    }
  },
  contractSizer: {
    alphaSort: false,
    runOnCompile: false,
    disambiguatePaths: false
  },
  gasReporter: {
    currency: 'EUR',
    gasPrice: 15,
    enabled: !!process.env.REPORT_GAS,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },
  typechain: {
    outDir: 'types/typechain'
  }
}

export default config
