import { utils } from 'ethers'

export const generateIdHash = (token0: string, token1: string) =>
  utils.keccak256(utils.toUtf8Bytes(token0.concat(token1)))
