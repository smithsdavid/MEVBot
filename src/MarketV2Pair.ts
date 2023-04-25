import { BigNumber } from 'ethers'
import _ from 'lodash'
import { WETH_ADDRESS } from './config/addresses'
import { PENALTIES, SIZES_DOLLAR_NOMINATED } from './config/config'
import { ETHMarketTokenPair } from './ETHMarketTokenPair'
import { MarketBird } from './MarketBird'

export interface TokenBalances {
  [tokenAddress: string]: BigNumber
}

export class MarketV2Pair extends ETHMarketTokenPair {
  private _tokenBalances: TokenBalances
  private _size: number
  public get size(): number {
    return this._size
  }

  get balances(): TokenBalances {
    return this._tokenBalances
  }

  constructor(marketAddress: string, tokens: Array<string>, protocol: string) {
    super(
      marketAddress.toLowerCase(),
      tokens.map((t) => t.toLowerCase()),
      3000,
      protocol,
      'v2'
    )
    this._tokenBalances = _.zipObject(tokens, [
      BigNumber.from(0),
      BigNumber.from(0)
    ])
    this._size = -1
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
    this._size = Math.max(size0, size1)
  }

  getTokensIn(
    tokenIn: string,
    tokenOut: string,
    amountOut: BigNumber
  ): BigNumber {
    const reserveIn = this._tokenBalances[tokenIn]
    const reserveOut = this._tokenBalances[tokenOut]
    return this.getAmountIn(reserveIn, reserveOut, amountOut)
  }

  getTokensOut(
    tokenIn: string,
    tokenOut: string,
    amountIn: BigNumber
  ): BigNumber {
    const reserveIn = this._tokenBalances[tokenIn]
    const reserveOut = this._tokenBalances[tokenOut]
    let amountOut = this.getAmountOut(reserveIn, reserveOut, amountIn)
    amountOut = amountOut.mul(PENALTIES[this._size]).div(100_000)
    return amountOut
  }

  private getAmountIn(
    reserveIn: BigNumber,
    reserveOut: BigNumber,
    amountOut: BigNumber
  ): BigNumber {
    const numerator: BigNumber = reserveIn.mul(amountOut).mul(1000)
    const denominator: BigNumber = reserveOut.sub(amountOut).mul(997)
    return numerator.div(denominator).add(1)
  }

  private getAmountOut(
    reserveIn: BigNumber,
    reserveOut: BigNumber,
    amountIn: BigNumber
  ): BigNumber {
    const amountInWithFee: BigNumber = amountIn.mul(997)
    const numerator = amountInWithFee.mul(reserveOut)
    const denominator = reserveIn.mul(1000).add(amountInWithFee)
    return numerator.div(denominator)
  }
}
