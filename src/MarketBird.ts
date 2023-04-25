import axios from 'axios'
import chalk from 'chalk'
import CoinGecko from 'coingecko-api'
import { BigNumber } from 'ethers'
import fs from 'fs'
import _ from 'lodash'
import path from 'path'
import util from 'util'
import { Token } from '../types/Token'
import {
  MIN_TOKEN_VALUE_USD,
  RELOAD_DEX_TOKEN,
  RELOAD_TOKEN_PRICES,
  SIZES_DOLLAR_NOMINATED
} from './config/config'
import { QUERY_TOKENS } from './config/query'
import {
  SUSHI_SUBGRAPH,
  UNISWAP_V2_SUBGRAPH,
  UNISWAP_V3_SUBGRAPH
} from './config/subgraph'

type Prices = {
  symbol: string
  usd: number
}

type File = 'alltoken' | 'allprices' | 'sizechart'
type SizeChart = Record<string, Array<string>>

export class MarketBird {
  private static _coinData: any
  private static CoinGecko = new CoinGecko()
  public static ALL_DEX_TOKEN: Array<Token> = []
  public static SIZE_CHART: SizeChart = {}

  private static filenames: Record<File, string> = {
    allprices: 'allGeckoPrices.json',
    alltoken: 'allDexToken.json',
    sizechart: 'sizechart.json'
  }

  private static async fetchToken(endpoint: string): Promise<Array<Token>> {
    let token: Array<Token> = []
    let allToken: Array<Token> = []

    let skip = 0
    const BATCH_SIZE = 100
    do {
      const response = await axios.post(
        endpoint,
        {
          query: QUERY_TOKENS,
          variables: {
            batchSize: BATCH_SIZE,
            skip
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      token = response.data?.data?.tokens || []
      if (token && token.length > 0) {
        allToken.push(...token)
        skip += BATCH_SIZE
        console.log('skip', skip)
      }
    } while (token.length > 0)
    return allToken
  }

  private static async fetchPrices(): Promise<Array<any>> {
    let prices: Array<Token> = []
    let allPrices: Array<Token> = []

    let { CoinGecko } = MarketBird
    let page = 0
    const BATCH_SIZE = 250
    do {
      let response = await CoinGecko.coins.all({ page, per_page: BATCH_SIZE })

      if (response.data) {
        prices = response.data.map((data: any) => ({
          symbol: data.symbol,
          usd: data.market_data.current_price['usd']
        }))
      }

      if (prices && prices.length > 0) {
        allPrices.push(...prices)
        page++
        console.log('page', page * BATCH_SIZE)
      }
    } while (prices.length > 0)
    return allPrices
  }

  static async init(): Promise<void> {
    console.log(chalk.gray('- Init Marketbird'))
    let endpoints = [UNISWAP_V3_SUBGRAPH, UNISWAP_V2_SUBGRAPH, SUSHI_SUBGRAPH]

    try {
      let allToken: Array<Token>
      let allPrices: Array<Prices>

      if (RELOAD_DEX_TOKEN) {
        let allTokenResponses = await Promise.all(
          endpoints.map((endpoint) => this.fetchToken(endpoint))
        )
        allToken = _.chain(allTokenResponses)
          .flatten()
          .uniqWith(_.isEqual)
          .sortBy((token) => token.symbol)
          .value()
        this.serialize('alltoken', allToken)
      } else {
        allToken = this.getSerialized('alltoken')
      }

      if (RELOAD_TOKEN_PRICES) {
        allPrices = await this.fetchPrices()
        allPrices = _.chain(allPrices)
          .filter(
            (price) =>
              price.usd != undefined && price.usd >= MIN_TOKEN_VALUE_USD
          )
          .map((price) => ({ ...price, symbol: price.symbol.toUpperCase() }))
          .value()
        this.serialize('allprices', allPrices)
      } else {
        allPrices = this.getSerialized('allprices')
      }

      let sizeChart: SizeChart = {}
      if (RELOAD_TOKEN_PRICES || RELOAD_DEX_TOKEN) {
        const allTokenWithPrices = _.chain(allToken)
          .map((token) =>
            _.assign(token, _.find(allPrices, { symbol: token.symbol }))
          )
          .filter((combination) => combination.usd != undefined)
          .value()

        allTokenWithPrices.forEach((tp) => {
          sizeChart[tp.id] = [
            ...SIZES_DOLLAR_NOMINATED.map((size) => {
              const fullToken = BigNumber.from(Math.floor(size / tp.usd))
              return tp.decimals > 0
                ? fullToken.mul(BigNumber.from(10).pow(tp.decimals)).toString()
                : fullToken.toString()
            })
          ]
        })
        this.serialize('sizechart', sizeChart)
      } else {
        sizeChart = this.getSerialized('sizechart')
      }

      this.SIZE_CHART = sizeChart
      this.ALL_DEX_TOKEN = allToken

      // console.log('allPrices', allPrices.length)
      // console.log('allToken', allToken.length)
    } catch (e) {
      console.error('error', e)
    }
  }

  private static serialize(file: File, data: any): void {
    fs.writeFileSync(
      path.join(__dirname, `../data/${this.filenames[file]}`),
      JSON.stringify(data)
    )
  }
  private static getSerialized(file: File): any {
    return JSON.parse(
      fs
        .readFileSync(path.join(__dirname, `../data/${this.filenames[file]}`))
        .toString()
    )
  }
}
