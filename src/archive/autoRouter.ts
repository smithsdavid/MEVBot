import { CurrencyAmount, Percent, Token, TradeType } from '@uniswap/sdk-core'
import {
  AlphaRouter,
  ChainId
} from '../../uniswap/smart-order-router/build/main/src'
import 'dotenv/config'
import { BigNumber, utils } from 'ethers'
import { getProvider } from '../../utils/getProvider'
import util from 'util'
import { Pair } from '@uniswap/sdk'

async function main() {
  const provider = getProvider()
  const router = new AlphaRouter({ chainId: 1, provider })

  const routePromises: Promise<number>[] = []

  const startTimestamp = Date.now()

  const V3_SWAP_ROUTER_ADDRESS = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'
  const MY_ADDRESS = '0x21db76B75db2f5d4f9505Eae7d8cE53eB9AEd2B5'

  const WETH = new Token(
    1,
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    18,
    'WETH',
    'Wrapped Ether'
  )
  Pair

  const USDC = new Token(
    ChainId.MAINNET,
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    6,
    'USDC',
    'USD//C'
  )

  const typedValueParsed = '100000000000000000000'
  const wethAmount = CurrencyAmount.fromRawAmount(
    WETH,
    utils.parseEther('1').toString()
  )

  const route = await router.route(wethAmount, USDC, TradeType.EXACT_INPUT, {
    recipient: MY_ADDRESS,
    slippageTolerance: new Percent(5, 100),
    deadline: Math.floor(Date.now() / 1000 + 1800)
  })

  if (!route) {
    process.exit(1)
  }

  const transaction = {
    data: route.methodParameters?.calldata,
    to: V3_SWAP_ROUTER_ADDRESS,
    value: BigNumber.from(route.methodParameters?.value),
    from: MY_ADDRESS,
    gasPrice: BigNumber.from(route.gasPriceWei)
  }

  // console.log('Done in ', Date.now() - startTimestamp, ' ms')

  // * Measuring route completion time
  // for (let i = 0; i < 100; i++) {
  //   routePromises.push(
  //     new Promise(async (res, rej) => {
  //       const start = Date.now()
  //       try {
  //         await router.route(wethAmount, USDC, TradeType.EXACT_INPUT, {
  //           recipient: MY_ADDRESS,
  //           slippageTolerance: new Percent(5, 100),
  //           deadline: Math.floor(Date.now() / 1000 + 1800)
  //         })
  //         const end = Date.now()
  //         console.log('Completed ', i, end - start)
  //         res(end - start)
  //       } catch (e) {
  //         console.error('error', e)
  //       }
  //     })
  //   )
  // }
  // const compTimes = await Promise.all(routePromises)
  // const avgCompTime =
  //   compTimes.filter((a) => a != undefined).reduce((a, b) => a + b) /
  //   compTimes.length
  // console.log('avgCompTime', avgCompTime)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
