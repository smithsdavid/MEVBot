import { network } from 'hardhat'

const MULTICALL_ADDRESSES: { [network: string]: string } = {
  mainnet: '0x765a22438cBF214992E98afdDb7E94914ea63FB1',
  matic: '0x0000000000000000000000000000000000000000',
  fork: '0x765a22438cBF214992E98afdDb7E94914ea63FB1'
}
export const MULTICALL = MULTICALL_ADDRESSES[network.name]
export const QUERYCALL = '0x8F4ec854Dd12F1fe79500a1f53D0cbB30f9b6134' // fork

export const SUSHI_FACTORY = '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac'
export const UNI_FACTORY_V2 = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'
export const UNI_FACTORY_V3 = '0x1F98431c8aD98523631AE4a59f267346ea31F984'
export const UNI_ROUTER_V2 = ''
export const UNI_ROUTER_V3 = '0xE592427A0AEce92De3Edee1F18E0157C05861564'
export const LENDING_POOL_ADDRESS_PROVIDER =
  '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5'

export const SUSHI_ROUTER_MUMBAI = '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'
export const UNISWAP_LOOKUP_CONTRACT_ADDRESS =
  '0x5EF1009b9FCD4fec3094a5564047e190D72Bd511'

//#region Token
const WETH_ADDRESSES: { [network: string]: string } = {
  mainnet: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  fork: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  matic: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
}
export const WETH_ADDRESS = WETH_ADDRESSES[network.name].toLowerCase()

const USDC_ADDRESSES: { [network: string]: string } = {
  mainnet: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  fork: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  matic: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
}
export const USDC_ADDRESS = USDC_ADDRESSES[network.name].toLowerCase()

const USDT_ADDRESSES: { [network: string]: string } = {
  mainnet: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  fork: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  matic: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
}
export const USDT_ADDRESS = USDT_ADDRESSES[network.name].toLowerCase()

const DAI_ADDRESSES: { [network: string]: string } = {
  mainnet: '0x6b175474e89094c44da98b954eedeac495271d0f',
  fork: '0x6b175474e89094c44da98b954eedeac495271d0f',
  matic: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
}
export const DAI_ADDRESS = DAI_ADDRESSES[network.name].toLowerCase()

const WBTC_ADDRESSES: { [network: string]: string } = {
  mainnet: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  fork: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  matic: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6'
}
export const WBTC_ADDRESS = WBTC_ADDRESSES[network.name].toLowerCase()

const UNI_ADDRESSES: { [network: string]: string } = {
  mainnet: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  fork: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  matic: '0xb33EaAd8d922B1083446DC23f610c2567fB5180f'
}
export const UNI_ADDRESS = UNI_ADDRESSES[network.name].toLowerCase()

const SUSHI_ADDRESSES: { [network: string]: string } = {
  mainnet: '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2',
  fork: '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2',
  matic: '0x0b3F868E0BE5597D5DB7fEB59E1CADBb0fdDa50a'
}
export const SUSHI_ADDRESS = SUSHI_ADDRESSES[network.name].toLowerCase()
export const SNX_ADDRESS = '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f'
//#endregion

//#region TOP PAIRS
const TOP_V3_WETH_PAIRS_PER_NETWORK: { [network: string]: string[] } = {
  mainnet: [
    '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', // WETH - USDC 500 fee
    '0x11b815efb8f581194ae79006d24e0d814b7697f6', // WETH - USDT 500 fee
    '0x4585fe77225b41b697c938b018e2ac67ac5a20c0', // WETH - WBTC 500 fee
    '0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801', // WETH - UNI 3000 fee
    '0x60594a405d53811d3bc4766596efd80fd545a270' // WETH - DAI  500 fee
  ],
  matic: ['0x45dda9cb7c25131df268515131f647d726f50608'], // WETH - USDC 500 fee
  fork: [
    '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', // WETH - USDC 500 fee
    '0x11b815efb8f581194ae79006d24e0d814b7697f6', // WETH - USDT 500 fee
    '0x4585fe77225b41b697c938b018e2ac67ac5a20c0', // WETH - WBTC 500 fee
    '0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801', // WETH - UNI 3000 fee
    '0x60594a405d53811d3bc4766596efd80fd545a270' // WETH - DAI  500 fee
  ]
}

// WETH => USDC, USDT, DAI, WBTC, APE, UNI
export const TOP_V3_WETH_PAIRS = TOP_V3_WETH_PAIRS_PER_NETWORK[
  network.name
].map((entry) => entry.toLowerCase())

export const TOP_V2_WETH_PAIRS = []
// Removed pairs for now, just need stable entry points for routes
// [
//   // uni v2
//   '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',
//   '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852',
//   '0xbb2b8038a1640196fbe3e38816f3e67cba72d940',
//   '0xd3d2e2692501a5c9ca623199d38826e513033a17',
//   '0xa478c2975ab1ea89e8196811f51a7b7ade33eb11',
//   '0xb011eeaab8bf0c6de75510128da95498e4b7e67f',
//   // sushi
//   '0xc3d03e4f041fd4cd388c549ee2a29a9e5075882f',
//   '0x397ff1542f962076d0bfe58ea045ffa2d347aca0',
//   '0x06da0fd433c1a5d7a4faa01111c044910a184553',
//   '0xceff51756c56ceffca006cd410b03ffc46dd3a58',
//   '0xdafd66636e2561b0284edde37e42d192f2844d40'
// ].map((entry) => entry.toLowerCase())
//#endregion

export const TOKEN_BLACKLIST: Array<string> = [
  '0x6b4c7a5e3f0b99fcd83e9c089bddd6c7fce5c611',
  '0x9EA3b5b4EC044b70375236A281986106457b20EF' // token disabled uniswap
].map((entry) => entry.toLowerCase())
