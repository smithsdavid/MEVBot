import { CHAIN_ID } from '../src/config/config'
import { ethers, network } from 'hardhat'

const keys: { [network: string]: string } = {
  goerli: process.env.ALCHEMY_API_GOERLI,
  mainnet: process.env.ALCHEMY_API_MAINNET,
  matic: process.env.ALCHEMY_API_POLYGON,
  maticmum: process.env.ALCHEMY_API_MUMBAI,
  rinkeby: process.env.ALCHEMY_API_RINKEBY
}

export const getProvider = () =>
  network.name === 'fork'
    ? // ? new ethers.providers.JsonRpcProvider('http://localhost:8545')
      new ethers.providers.JsonRpcProvider('http://localhost:8545', {
        chainId: CHAIN_ID,
        name: 'fork'
      })
    : new ethers.providers.AlchemyProvider(network.name, keys[network.name])
