import { TransactionRequest } from '@ethersproject/abstract-provider/src.ts'
import 'dotenv/config'
import { BigNumber, utils } from 'ethers'
import { Executer } from '../../src/Executer'
import { ethers } from 'hardhat'
import { MULTICALL } from '../../src/config/addresses'
import { MarketV2Pair } from '../../src/MarketV2Pair'
import { MarketV3Pair } from '../../src/MarketV3Pair'
import { Route } from '../../src/Route'
import { RouteNode } from '../../src/RouteNode'
import { Multicall } from '../../types/typechain'
import { getProvider } from '../../utils/getProvider'

const { DEV_WALLET_KEY } = process.env

async function main() {
  const signer = new ethers.Wallet(DEV_WALLET_KEY, getProvider())
  const mcFactory = await ethers.getContractFactory('Multicall')
  const multicall = mcFactory.attach(MULTICALL) as Multicall
  const executer = new Executer()
  await executer.init()
  //#region Pair & Route Setup
  // * P1
  const pair1 = new MarketV3Pair(
    '0x1d42064fc4beb5f8aaf85f4617ae8b3b5b8bd801',
    [
      '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    ],
    3000,
    ''
  )
  pair1.setSqrtPrice(BigNumber.from('4216034058684444218439531517'))
  pair1.setReservesViaOrderedBalances([
    BigNumber.from('1837013292141996858196823'),
    BigNumber.from('679483137800147957335')
  ])

  // * P2
  const pair2 = new MarketV3Pair(
    '0xfaa318479b7755b2dbfdd34dc306cb28b420ad12',
    [
      '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    ],
    500,
    ''
  )
  pair2.setSqrtPrice(BigNumber.from('4230365301260023762260674495'))
  pair2.setReservesViaOrderedBalances([
    BigNumber.from('1311485037011546810165'),
    BigNumber.from('1088304836979147478')
  ])

  // * P3
  const pair3 = new MarketV2Pair(
    '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',
    [
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    ],
    ''
  )
  pair3.setReservesViaOrderedBalances([
    BigNumber.from('124882889695836'),
    BigNumber.from('50884336877798794326659')
  ])

  // * P4
  const pair4 = new MarketV3Pair(
    '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
    [
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    ],
    500,
    ''
  )
  pair4.setSqrtPrice(BigNumber.from('1601492753912767026050911918356235'))
  pair4.setReservesViaOrderedBalances([
    BigNumber.from('36882837759064'),
    BigNumber.from('66505364970363720563951')
  ])

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
  const route = new Route([node1, node2, node3, node4])
  //#endregion

  console.log(route.toString())
  const amountIn = utils.parseEther('1')
  const amountOut = route.getOutput(amountIn)
  const profitPreCut = amountOut.sub(amountIn)
  const increasePreCut = profitPreCut.mul(1000).mul(100).div(amountIn)
  const aaveShare = amountIn.mul(9).div(10000)
  const gasFees = utils.parseEther('0.018') // 600_000 @30 Gwei
  const profit = profitPreCut.sub(aaveShare).sub(gasFees)
  const increase = profit.mul(1000).mul(100).div(amountIn)

  console.log('Input:', utils.formatEther(amountIn))
  console.log('Output:', utils.formatEther(amountOut))
  console.log('Profit PreCut:', utils.formatEther(profitPreCut))
  console.log('Increase PreCut:', increasePreCut.toNumber() / 1000, '%')
  console.log('Aave:', utils.formatEther(aaveShare))
  console.log('Gas:', utils.formatEther(gasFees))
  console.log('Profit:', utils.formatEther(profit))
  console.log('Increase:', increase.toNumber() / 1000, '%')

  // await executer.simulate(route, amountIn, profitPreCut)

  console.log(route.encodeRoute(amountIn))

  // const { types, swaps } = route.encodeRoute(amountIn)
  // const { data } = await multicall.populateTransaction.multicall(
  //   amountIn,
  //   BigNumber.from(0),
  //   types,
  //   swaps
  // )

  // const transaction: TransactionRequest = {
  //   to: MULTICALL,
  //   type: 2,
  //   data,
  //   gasLimit: 2_000_000
  // }

  // const tx = await signer.sendTransaction(transaction)
  // console.log(tx.hash)
  // await tx.wait()
  // console.log('tx complete')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
