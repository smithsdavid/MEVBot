import _ from 'lodash'
import { MarketGraph } from './MarketGraph'
import { MarketV2Pair } from './MarketV2Pair'
import { MarketV3Pair } from './MarketV3Pair'
import { IUniswapV3Pool } from '../types/typechain'
import v3PoolJson from '../contracts/abi/UniswapV3Pool.json'
import { ethers } from 'hardhat'
import { BigNumber, utils } from 'ethers'
import { TickMath } from '@uniswap/v3-sdk'
import { AbiCoder } from 'ethers/lib/utils'

export class RouteNode {
  public get pair(): MarketV2Pair | MarketV3Pair {
    return this._pair
  }

  public get prev(): RouteNode | undefined {
    return this._prev
  }
  public get next(): RouteNode | undefined {
    return this._next
  }
  public set next(value: RouteNode | undefined) {
    if (_.isEqual(value?._pair.marketAddress, this._pair)) {
      throw new Error('Route Node cannot link to itself')
    }
    this._next = value
  }

  public get prevToken(): string {
    return this._prevToken
  }
  public get nextToken(): string {
    return _.isEqual(
      this._pair.tokens[0].toLowerCase(),
      this._prevToken.toLowerCase()
    )
      ? this._pair.tokens[1]
      : this._pair.tokens[0]
  }

  private _pair: MarketV2Pair | MarketV3Pair
  private _prevToken: string
  private _next: RouteNode | undefined
  private _prev: RouteNode | undefined

  constructor(
    pair: MarketV2Pair | MarketV3Pair,
    prevNode: RouteNode | undefined,
    prevToken: string
  ) {
    this._pair = pair
    this._prevToken = prevToken
    this._prev = prevNode
    this._next = undefined
  }

  public nextPossibleConnections(
    market: MarketGraph
  ): Array<MarketV2Pair | MarketV3Pair> {
    const allConnections = market.graph.get(this._pair.marketAddress)
    const filteredConnections = _.filter(allConnections, (pair) => {
      const includesNextToken = _.includes(pair.tokens, this.nextToken)
      const isPrevPair = this._prev
        ? _.isEqual(pair.marketAddress, this._prev.pair.marketAddress)
        : false
      return includesNextToken && !isPrevPair
    })
    return filteredConnections
  }

  encode(amountIn: BigNumber): string {
    const abiCoder = new AbiCoder()
    let data: string = ''
    if (this.pair.marketType == 'v2') {
      data = abiCoder.encode(
        ['uint256', 'address', 'address', 'address'],
        [amountIn, this.prevToken, this.nextToken, this.pair.marketAddress]
      )
    } else if (this.pair.marketType == 'v3') {
      data = abiCoder.encode(
        ['uint256', 'address', 'address', 'uint24', 'address'],
        [
          amountIn,
          this.prevToken,
          this.nextToken,
          this.pair.feeTier,
          this.pair.marketAddress
        ]
      )
    }
    return data
  }
}
