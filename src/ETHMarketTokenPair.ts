import { BigNumber } from 'ethers'
import _ from 'lodash'

export type MarketType = 'v2' | 'v3'

export abstract class ETHMarketTokenPair {
  get marketAddress(): string {
    return this._marketAddress
  }

  get tokens(): [string, string] {
    return _.take(this._tokens, 2) as [string, string]
  }

  get feeTier(): number {
    return this._feeTier
  }

  get protocol(): string {
    return this._protocol
  }

  get marketType(): MarketType {
    return this._marketType
  }

  protected readonly _marketAddress: string
  protected readonly _tokens: Array<string>
  protected readonly _feeTier: number
  protected readonly _protocol: string
  private readonly _marketType: MarketType

  constructor(
    marketAddress: string,
    tokens: Array<string>,
    fee: number, // in BPS 3000 => 0.3%
    protocol: string,
    marketType: MarketType
  ) {
    this._marketAddress = marketAddress
    this._tokens = tokens
    this._feeTier = fee
    this._protocol = protocol
    this._marketType = marketType
  }

  abstract getTokensIn(
    tokenIn: string,
    tokenOut: string,
    amountOut: BigNumber
  ): BigNumber

  abstract getTokensOut(
    tokenIn: string,
    tokenOut: string,
    amountOut: BigNumber
  ): BigNumber
}
