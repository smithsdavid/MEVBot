import { BigNumber } from 'ethers'
import { Token } from '../../types/Token'

const DEC6 = BigNumber.from(10).pow(6)
const DEC7 = BigNumber.from(10).pow(7)
const DEC8 = BigNumber.from(10).pow(8)
const DEC17 = BigNumber.from(10).pow(17)
const DEC18 = BigNumber.from(10).pow(18)
const MIN_BALANCE_PER_TOKEN = BigNumber.from(100)

const MIN_AMOUNTS: { [token: string]: BigNumber } = {
  '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270': BigNumber.from(10).mul(DEC18), // WMATIC
  // '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619': BigNumber.from(1).mul(DEC18), // WETH
  // '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6': BigNumber.from(1).mul(DEC8) // WBTC
  '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174': BigNumber.from(10).mul(DEC6), // USDC
  '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': BigNumber.from(10).mul(DEC6), // USDT
  '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619': BigNumber.from(5).mul(DEC17), // WETH 0.5
  '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6': BigNumber.from(5).mul(DEC7) // WBTC 0.5
}

export const getMinTokenBalance = (token: Token) =>
  MIN_AMOUNTS[token.address]
    ? MIN_AMOUNTS[token.address]
    : MIN_BALANCE_PER_TOKEN.mul(BigNumber.from(10).pow(token.decimals))
