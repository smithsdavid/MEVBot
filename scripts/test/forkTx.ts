import v3RouterJson from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import 'dotenv/config'
import { utils } from 'ethers'
import { ethers } from 'hardhat'
import _ from 'lodash'
import { MarketBird } from '../../src/MarketBird'
import util from 'util'
import v3PoolJson from '../../contracts/abi/UniswapV3Pool.json'
import {
  MULTICALL,
  QUERYCALL,
  UNI_FACTORY_V3,
  WETH_ADDRESS
} from '../../src/config/addresses'
import { Executer } from '../../src/Executer'
import { InterchainMarket } from '../../src/InterchainMarket'
import { MarketV2Pair } from '../../src/MarketV2Pair'
import { MarketV3Pair } from '../../src/MarketV3Pair'
import { Route } from '../../src/Route'
import { RouteNode } from '../../src/RouteNode'
import { UniswapV3Pool } from '../../types/copypaste/UniswapV3Pool'
import { ISwapRouter, Multicall, Query, WETH9 } from '../../types/typechain'
import { getProvider } from '../../utils/getProvider'

const { FORK_WALLET_KEY } = process.env

function genPairs(): Array<MarketV2Pair | MarketV3Pair> {
  // * P1
  const pair1 = new MarketV3Pair(
    '0x27a9ff745cf1dd366d94267cb4ade2350588a187',
    [
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      '0xf1ca9cb74685755965c7458528a36934df52a3ef'
    ],
    3000,
    ''
  )

  // * P2
  const pair2 = new MarketV3Pair(
    '0x2eb8f5708f238b0a2588f044ade8dea7221639ab',
    [
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
      '0xf1ca9cb74685755965c7458528a36934df52a3ef'
    ],
    3000,
    ''
  )

  // * P3
  const pair3 = new MarketV3Pair(
    '0x6f48eca74b38d2936b02ab603ff4e36a6c0e3a77',
    [
      '0x6b175474e89094c44da98b954eedeac495271d0f',
      '0xdac17f958d2ee523a2206206994597c13d831ec7'
    ],
    500,
    ''
  )

  // * P4
  const pair4 = new MarketV3Pair(
    '0x60594a405d53811d3bc4766596efd80fd545a270',
    [
      '0x6b175474e89094c44da98b954eedeac495271d0f',
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    ],
    500,
    ''
  )

  return [pair1, pair2, pair3, pair4]
}

function genRoute(pairs: Array<MarketV2Pair | MarketV3Pair>): Route {
  const [pair1, pair2, pair3, pair4] = pairs
  const node1 = new RouteNode(
    pair1,
    undefined,
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
  )
  const node2 = new RouteNode(pair2, node1, node1.nextToken)
  const node3 = new RouteNode(pair3, node2, node2.nextToken)
  const node4 = new RouteNode(pair4, node3, node3.nextToken)
  node1.next = node2
  node2.next = node3
  node3.next = node4
  return new Route([node1, node2, node3, node4])
}

async function main() {
  const provider = getProvider()
  const signer = new ethers.Wallet(FORK_WALLET_KEY, provider)
  const mcFactory = await ethers.getContractFactory('Multicall', signer)
  const multicall = mcFactory.attach(MULTICALL) as Multicall
  const executer = new Executer()
  await executer.init()
  const V3PoolFactory = new ethers.ContractFactory(
    v3PoolJson.abi,
    v3PoolJson.bytecode,
    signer
  )
  const ERC20Factory = await ethers.getContractFactory('ERC20Template')
  const queryFactory = await ethers.getContractFactory('Query', signer)
  const query = queryFactory.attach(QUERYCALL) as Query
  const WETHFactory = await ethers.getContractFactory('WETH9', signer)
  const weth = WETHFactory.attach(WETH_ADDRESS) as WETH9
  const allPairs = genPairs()
  const route = genRoute(allPairs)
  await MarketBird.init()
  allPairs.push(
    new MarketV2Pair(
      '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',
      [
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
      ],
      ''
    )
  )
  const reveresedRoute = route.reverse()

  // console.log(route.routeNodes.map((node) => node.pair.marketAddress))
  // console.log(route.reverse().routeNodes.map((node) => node.pair.marketAddress))
  await InterchainMarket.updateSqrtsAndReserves(allPairs)
  console.log(route.toString())
  console.log(reveresedRoute.toString())
  console.log('route', route.getOutput(utils.parseEther('1'), true))
  console.log('reversed', reveresedRoute.getOutput(utils.parseEther('1'), true))
  return
  // await Promise.all(
  //   route.routeNodes.map(async (node) => {
  //     const pair = node.pair as MarketV3Pair
  //     const v3pool = V3PoolFactory.attach(pair.marketAddress) as UniswapV3Pool
  //     const [token0, token1] = [
  //       ERC20Factory.attach(pair.tokens[0]),
  //       ERC20Factory.attach(pair.tokens[1])
  //     ]
  //     const [{ sqrtPriceX96 }, balance0, balance1] = await Promise.all([
  //       await v3pool.slot0(),
  //       await token0.balanceOf(pair.marketAddress),
  //       await token1.balanceOf(pair.marketAddress)
  //     ])
  //     pair.setSqrtPrice(sqrtPriceX96)
  //     pair.setReservesViaOrderedBalances([balance0, balance1])
  //   })
  // )

  // #region Calulcate Prices
  const pair = new MarketV3Pair(
    '0xEDe8dd046586d22625Ae7fF2708F879eF7bdb8CF',
    [
      '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    ],
    3000,
    ''
  )
  // const pair = new MarketV3Pair( //1inch-usdc
  //   '0x9feBc984504356225405e26833608b17719c82Ae',
  //   [
  //     '0x111111111117dc0aa78b770fa6a738034120c302',
  //     '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  //   ],
  //   10000,
  //   ''
  // )
  // const pair = new MarketV3Pair( // working WETH USDC
  //   '0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36',
  //   [
  //     '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  //     '0xdac17f958d2ee523a2206206994597c13d831ec7'
  //   ],
  //   3000,
  //   ''
  // )
  const v3pool = V3PoolFactory.attach(pair.marketAddress) as UniswapV3Pool
  const [token0, token1] = [
    ERC20Factory.attach(pair.tokens[0]),
    ERC20Factory.attach(pair.tokens[1])
  ]
  const [{ sqrtPriceX96 }, balance0, balance1] = await Promise.all([
    await v3pool.slot0(),
    await token0.balanceOf(pair.marketAddress),
    await token1.balanceOf(pair.marketAddress)
  ])
  pair.setSqrtPrice(sqrtPriceX96)
  pair.setReservesViaOrderedBalances([balance0, balance1])

  // const [tokenIn, tokenOut] = pair.tokens
  const [tokenOut, tokenIn] = pair.tokens
  const amountIn = utils.parseEther('4000')
  // const amountIn = BigNumber.from('20000').mul(DEC_6)

  const amountOut_off = pair.getTokensOut(tokenIn, tokenOut, amountIn)
  // const fee = amountIn.mul(pair.feeTier).div(10000).div(100)
  // const amountOut_on = undefined
  // const amountOut_on = await query.oracleV3(
  //   [pair.marketAddress],
  //   amountIn.sub(fee)
  // )
  // console.log('fee', fee.toString())
  // #endregion
  0.00799326
  //#region Perform Swap
  const ERC20_IN = ERC20Factory.attach(tokenIn)
  const ERC20_OUT = ERC20Factory.attach(tokenOut)
  const UniswapV3RouterFactory = new ethers.ContractFactory(
    v3RouterJson.abi,
    v3RouterJson.bytecode,
    signer
  )
  const uniRouter = (await UniswapV3RouterFactory.deploy(
    UNI_FACTORY_V3,
    WETH_ADDRESS
  )) as ISwapRouter

  const balanceBefore = await ERC20_OUT.balanceOf(signer.address)
  await ERC20_IN.approve(uniRouter.address, amountIn)
  // console.log(await v3pool.slot0())
  await uniRouter.exactInput(
    {
      amountIn,
      amountOutMinimum: 0,
      deadline: _.now() + 99999,
      path: utils.solidityPack(
        ['address', 'uint24', 'address'],
        [tokenIn, pair.feeTier, tokenOut]
      ),
      recipient: signer.address
    },
    {
      gasLimit: 800_000
    }
  )
  // console.log(await v3pool.slot0())
  const balanceAfter = await ERC20_OUT.balanceOf(signer.address)

  // console.log(route.getOutput(amountIn, true))

  // console.log('In   ', amountIn.div(DEC_6))
  // console.log('In   ', utils.formatEther(amountIn))
  console.log(
    'Real ',
    balanceAfter.sub(balanceBefore).toString()
    // utils.formatEther(balanceAfter.sub(balanceBefore).toString())
  )
  console.log('Off  ', amountOut_off.toString())
  // console.log('Off  ', utils.formatEther(amountOut_off.toString()))
  //#endregion

  //#region
  // console.log(route.toString(), '\n')
  // const { types, swaps } = route.encodeRoute(amountIn)
  // const wethBef = await signer.getBalance()
  // // await weth.transfer(multicall.address, utils.parseEther('0.5'))
  // try {
  //   await multicall.multicall(amountIn, 0, types, swaps, {
  //     gasLimit: 2_000_000
  //   })
  // } catch (e) {}

  // const wethDelta = (await signer.getBalance()).sub(wethBef)

  // console.log('wethDelta', utils.formatEther(wethDelta))

  // provider.on('block', async (number) => {
  //   console.log('new block', number)
  //   await InterchainMarket.updateSqrtsAndReserves(allPairs)

  //   const amountOut = route.getOutput(amountIn)
  //   console.log('\nInput:', utils.formatEther(amountIn))
  //   console.log('Output:', utils.formatEther(amountOut), '\n')
  // })

  // #endregion
}

main()
