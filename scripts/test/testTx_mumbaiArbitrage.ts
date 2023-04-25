import { TransactionRequest } from '@ethersproject/abstract-provider/src.ts'
import 'dotenv/config'
import { BigNumber, utils } from 'ethers'
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
  const amountIn = utils.parseEther('0.0001') // 0.0001 ETH
  const mcFactory = await ethers.getContractFactory('Multicall')
  const multicall = mcFactory.attach(MULTICALL) as Multicall
  const WETH = '0x3c68ce8504087f89c640d02d133646d98e64ddd9' // mumbai
  const USDC = '0x2058a9d7613eee744279e3856ef0eada5fcbaa7e' // mumbai
  const pairV3 = new MarketV3Pair(
    '0xe38e246599d7ca12dd9538b349636e83cd30cb83',
    [USDC, WETH],
    3000,
    ''
  )
  const pairV2 = new MarketV2Pair(
    '0x4b9cd4645e1d58fa0785cb964acdde86357a56d4',
    [USDC, WETH],
    ''
  )
  pairV2.setReservesViaOrderedBalances([
    BigNumber.from('5438524584'),
    BigNumber.from('822219613846974022')
  ])
  pairV3.setSqrtPrice(BigNumber.from('1532206830318832126677328761423858'))
  const nodev2 = new RouteNode(pairV2, undefined, WETH)
  const nodev3 = new RouteNode(pairV3, nodev2, nodev2.nextToken)
  const route = new Route([nodev2, nodev3])
  const { types, swaps } = route.encodeRoute(amountIn)

  const { data } = await multicall.populateTransaction.multicall(
    amountIn,
    BigNumber.from(0),
    types,
    swaps
  )

  const transaction: TransactionRequest = {
    to: MULTICALL,
    type: 2,
    data,
    gasLimit: 2_000_000
  }

  const tx = await signer.sendTransaction(transaction)
  console.log(tx.hash)
  await tx.wait()
  console.log('tx complete')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
