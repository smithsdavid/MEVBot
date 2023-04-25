import { BigNumber, utils } from 'ethers'
import { network } from 'hardhat'

export const LIVE_MODE = false
export const HARD_PURGE = false
export const RELOAD_DEX_TOKEN = false
export const RELOAD_TOKEN_PRICES = false
export const MIN_ROUTE_NODES = 2
export const MAX_ROUTE_NODES = 4
export const MIN_TX_FOR_NODE = 50
export const MIN_ETH_ROUTE_THROUGHPUT = utils.parseEther('1')
export const MIN_TOKEN_VALUE_USD = 0.00000001
export const MIN_PROFIT = utils.parseEther('0.02')

export const CHAIN_ID = network.name === 'fork' ? 31337 : 1
export const MAX_MINER_REWARD = utils.parseEther('0.1')
export const MAX_MINER_REWARD_SHARE = BigNumber.from('500') // 50 %

export const DEC_18 = BigNumber.from(10).pow(18)
export const DEC_8 = BigNumber.from(10).pow(8)
export const DEC_6 = BigNumber.from(10).pow(6)

// filter $
// use 40k $ basis how much eth for max throughput
// 0.5% max input?

export const SIZES_DOLLAR_NOMINATED = [
  10_000_000, 1_000_000, 750_000, 500_000, 250_000, 100_000, 40_000
]
export const PENALTIES = [
  10000, // 0%
  99995, // 0.005%
  99990, // 0.01%
  99980, // 0.02%
  99950, // 0.05%
  99700, // 0.3%
  99000 // 1%
]
export const SIZE_INPUT_LIMITS = [
  50, // 5%
  50, // 5%
  50, // 5%
  40, // 4%
  // sizes from here do not make sense, its all less than 1 eth
  15, // 1.5%
  3, // 0.3%
  2 // 0.2%
]
// export const MIN_SIZE = SIZES_DOLLAR_NOMINATED.length - 1 // 0 is largest
export const MIN_SIZE = 4
