import { BigNumber } from 'ethers'
import _ from 'lodash'
import { WETH_ADDRESS } from './config/addresses'
import { PENALTIES, SIZES_DOLLAR_NOMINATED } from './config/config'
import { ETHMarketTokenPair } from './ETHMarketTokenPair'
import { MarketBird } from './MarketBird'
import { TokenBalances } from './MarketV2Pair'

export class MarketV3Pair extends ETHMarketTokenPair {
  public get sqrtPrice(): BigNumber {
    return this._sqrtPrice
  }
  public get balances(): TokenBalances {
    return this._tokenBalances
  }

  private _sqrtPrice: BigNumber
  private _tokenBalances: TokenBalances
  private _size: number
  public get size(): number {
    return this._size
  }

  constructor(
    marketAddress: string,
    tokens: Array<string>,
    feeTier: number,
    protocol: string
  ) {
    super(
      marketAddress.toLowerCase(),
      tokens.map((t) => t.toLowerCase()),
      feeTier,
      protocol,
      'v3'
    )
    this._sqrtPrice = BigNumber.from(0)
    this._tokenBalances = _.zipObject(tokens, [
      BigNumber.from(0),
      BigNumber.from(0)
    ])
    this._size = -1
  }

  setSqrtPrice(sqrtPrice: BigNumber): void {
    if (!_.isEqual(this._sqrtPrice, sqrtPrice)) {
      this._sqrtPrice = sqrtPrice
    }
  }

  setReservesViaOrderedBalances(balances: Array<BigNumber>): void {
    const tokenBalances = _.zipObject(this._tokens, balances)
    if (!_.isEqual(this._tokenBalances, tokenBalances)) {
      this._tokenBalances = tokenBalances
    }
    this._size < 0 && this.setPoolSize()
  }

  private setPoolSize(): void {
    const [balance0, balance1] = [
      this._tokenBalances[this.tokens[0]],
      this._tokenBalances[this.tokens[1]]
    ]
    const [m0, m1] = [
      MarketBird.SIZE_CHART[this.tokens[0]].map((n) => BigNumber.from(n)),
      MarketBird.SIZE_CHART[this.tokens[1]].map((n) => BigNumber.from(n))
    ]
    const index0 = m0
      ? _.findIndex(m0, (entry: BigNumber) => entry.lt(balance0))
      : -1
    const index1 = m1
      ? _.findIndex(m1, (entry: BigNumber) => entry.lt(balance1))
      : -1
    const size0 = index0 >= 0 ? index0 : SIZES_DOLLAR_NOMINATED.length // else max size
    const size1 = index1 >= 0 ? index1 : SIZES_DOLLAR_NOMINATED.length
    this._size = Math.max(size0, size1)
  }

  getTokensIn(
    tokenIn: string,
    tokenOut: string,
    amountOut: BigNumber
  ): BigNumber {
    return tokenIn < tokenOut
      ? this.oneForZero(amountOut) // reversed order w/ tokenIn
      : this.zeroForOne(amountOut)
  }

  getTokensOut(
    tokenIn: string,
    tokenOut: string,
    amountIn: BigNumber
  ): BigNumber {
    const feeAmount = amountIn.mul(this._feeTier).div(10000).div(100)
    amountIn = amountIn.sub(feeAmount)
    let amountOut =
      tokenIn < tokenOut ? this.zeroForOne(amountIn) : this.oneForZero(amountIn)
    amountOut = amountOut.mul(PENALTIES[this._size]).div(100_000)
    return amountOut
  }

  private zeroForOne(amount: BigNumber): BigNumber {
    return amount.mul(this.sqrtPrice.pow(2)).div(BigNumber.from(2).pow(192))
  }

  private oneForZero(amount: BigNumber): BigNumber {
    return amount.mul(BigNumber.from(2).pow(192)).div(this.sqrtPrice.pow(2))
  }
}
