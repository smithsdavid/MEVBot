import v3RouterJson from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import v3PoolJson from '../../contracts/abi/UniswapV3Pool.json'
import 'dotenv/config'
import { BigNumber, utils } from 'ethers'
import { ethers } from 'hardhat'
import _ from 'lodash'
import {
  MULTICALL,
  QUERYCALL,
  UNI_FACTORY_V3,
  WETH_ADDRESS
} from '../../src/config/addresses'
import { ISwapRouter, WETH9, Query } from '../../types/typechain'
import { getProvider } from '../../utils/getProvider'
import { UniswapV3Pool } from '../../types/copypaste/UniswapV3Pool'

async function main() {
  const signer = new ethers.Wallet(
    process.env.FORK_WALLET_KEY, // from ganache cli
    getProvider()
  )

  // const amountIn = utils.parseEther('100')
  // const ERC20Address = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  // const from = WETH_ADDRESS
  // const to = ERC20Address
  // const fee = '500'

  const ERC20Address = WETH_ADDRESS
  let from = ERC20Address
  let to = '0x6b175474e89094c44da98b954eedeac495271d0f'
  let fee = '100'

  //#region Setup
  const V3PoolFactory = new ethers.ContractFactory(
    v3PoolJson.abi,
    v3PoolJson.bytecode,
    signer
  )
  const ERC20Factory = await ethers.getContractFactory('ERC20Template')
  const WETHFactory = await ethers.getContractFactory('WETH9')
  const UniswapV3RouterFactory = new ethers.ContractFactory(
    v3RouterJson.abi,
    v3RouterJson.bytecode,
    signer
  )
  const queryFactory = await ethers.getContractFactory('Query', signer)
  const query = (await queryFactory.attach(QUERYCALL)) as Query
  const weth = WETHFactory.attach(WETH_ADDRESS) as WETH9
  const uniRouter = (await UniswapV3RouterFactory.deploy(
    UNI_FACTORY_V3,
    WETH_ADDRESS
  )) as ISwapRouter
  const ERC20 = ERC20Factory.attach(ERC20Address)
  const v3pool = V3PoolFactory.attach(
    // '0x4e68ccd3e89f51c3074ca5072bbac773960dfa36' // problem pool
    '0x11b815efb8f581194ae79006d24e0d814b7697f6'
  ) as UniswapV3Pool
  const gasOptions = {
    maxFeePerGas: BigNumber.from('90000000000'),
    gasLimit: 2_000_000
  }
  if ((await signer.getBalance()).gt(utils.parseEther('500'))) {
    await weth.deposit({
      value: utils.parseEther('500'),
      ...gasOptions
    })
  }
  //#endregion

  // console.log(await query.oracleV3([v3pool.address]))

  // console.log(await v3pool.slot0())
  // console.log(await v3pool.ticks(BigNumber.from('-199870')))
  // console.log(await v3pool.ticks(BigNumber.from('-181980')))

  // console.log(await ERC20.balanceOf(MULTICALL))
  return
  const amountIn = await ERC20.balanceOf(signer.address)

  if (from === WETH_ADDRESS) {
    await weth.approve(uniRouter.address, amountIn, gasOptions)
  } else {
    await ERC20.approve(uniRouter.address, amountIn, gasOptions)
  }

  console.log('AmountIn', utils.formatEther(amountIn))
  await uniRouter.exactInput(
    {
      amountIn: amountIn,
      amountOutMinimum: 0,
      deadline: _.now() + 99999,
      path: utils.solidityPack(
        ['address', 'uint24', 'address'],
        [from, fee, to]
      ),
      recipient: signer.address
    },
    gasOptions
  )

  console.log('WETH balance after swap', await weth.balanceOf(signer.address))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
