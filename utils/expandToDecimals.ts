import { BigNumber } from 'ethers'

export function expandToDecimals(n: number, decimals = 18): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(decimals))
}
