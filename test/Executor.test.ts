import { Fixture } from 'ethereum-waffle'
import { BigNumber, constants, utils, Wallet } from 'ethers'
import { ethers, waffle } from 'hardhat'
import { NonfungiblePositionManager } from '../types/copypaste/NonfungiblePositionManager'
import { UniswapV3Factory } from '../types/copypaste/UniswapV3Factory'
import { UniswapV3Pool } from '../types/copypaste/UniswapV3Pool'
import { ERC20Template } from '../types/typechain/ERC20Template'
import { Executor } from '../types/typechain/Executor'
import { ISwapRouter } from '../types/typechain/ISwapRouter'
import { IUniswapV2Factory } from '../types/typechain/IUniswapV2Factory'
import { IUniswapV2Pair } from '../types/typechain/IUniswapV2Pair'
import { IUniswapV2Router02 } from '../types/typechain/IUniswapV2Router02'
import { SingleSwapper } from '../types/typechain/SingleSwapper'
import { WETH9 } from '../types/typechain/WETH9'
import chai from './config/chaisetup'
import { ERC20Fixtures } from './shared/ERC20Fixtures'
import { uniV2Fixtures } from './shared/uniV2Fixtures'
import { uniV2PoolFixtures } from './shared/uniV2PoolFixtures'
import { uniV3Fixtures } from './shared/uniV3Fixtures'
import { uniV3PoolFixtures } from './shared/uniV3PoolFixtures'
import { wethFixture } from './shared/weth9Fixture'
import { addLiqudityUni } from './utils/addLiqudityUni'
import { expandToDecimals } from './utils/expandToDecimals'
import { observePoolState } from './utils/observePoolState'

const { expect } = chai

describe.skip('Executor', () => {
  const TOTAL_INITIAL_WETH_RESERVE = expandToDecimals(9_999_999)

  const S_DAI_WETH = [expandToDecimals(10_000_000), expandToDecimals(10_000)]
  const U_DAI_WETH_LIQUIDITY = expandToDecimals(100_000)
  const U_USDC_DAI_LIQUIDITY = expandToDecimals(100_000)

  const S_USDC_WETH = [
    BigNumber.from('3403648981886'),
    BigNumber.from('1293386613116656629890')
  ]
  // const S_USDC_WETH = [expandToDecimals(2_700_000), expandToDecimals(1_000_000)]
  const U_USDC_WETH_LIQUIDITY = BigNumber.from('66349333296721306') // from real uni pool
  // const U_USDC_WETH_LIQUIDITY = expandToDecimals(1_000)

  let wallets: Wallet[]
  let deployer: Wallet
  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  let sushiFactory: IUniswapV2Factory
  let sushiRouter: IUniswapV2Router02

  let uniFactory: UniswapV3Factory
  let uniRouter: ISwapRouter
  let positionManager: NonfungiblePositionManager

  let dai: ERC20Template
  let usdc: ERC20Template
  let weth: WETH9

  let sDaiWethPool: IUniswapV2Pair
  let sUsdcWethPool: IUniswapV2Pair
  let uDaiWethPool: UniswapV3Pool
  let uUsdcWethPool: UniswapV3Pool
  let uUsdcDaiPool: UniswapV3Pool

  let executor: Executor
  let singleSwapper: SingleSwapper

  const initFixture: Fixture<{
    uniFactory: UniswapV3Factory
    uniRouter: ISwapRouter
    positionManager: NonfungiblePositionManager
    sushiFactory: IUniswapV2Factory
    sushiRouter: IUniswapV2Router02
    dai: ERC20Template
    usdc: ERC20Template
    weth: WETH9
    sDaiWethPool: IUniswapV2Pair
    uDaiWethPool: UniswapV3Pool
    sUsdcWethPool: IUniswapV2Pair
    uUsdcWethPool: UniswapV3Pool
    uUsdcDaiPool: UniswapV3Pool
  }> = async (wallets, provider) => {
    let { dai, usdc } = await ERC20Fixtures(wallets, provider)
    let { weth } = await wethFixture(wallets, provider)
    let { sushiFactory, sushiRouter } = await uniV2Fixtures(wallets, provider)
    let { uniFactory, uniRouter, positionManager } = await uniV3Fixtures(
      wallets,
      provider
    )
    let { sDaiWethPool, sUsdcWethPool } = await uniV2PoolFixtures(
      wallets,
      provider
    )
    let { uDaiWethPool, uUsdcWethPool, uUsdcDaiPool } = await uniV3PoolFixtures(
      wallets,
      provider
    )

    // approve & fund wallets

    return {
      uniFactory,
      uniRouter,
      positionManager,
      sushiFactory,
      sushiRouter,
      dai,
      usdc,
      weth,
      sDaiWethPool,
      uDaiWethPool,
      sUsdcWethPool,
      uUsdcWethPool,
      uUsdcDaiPool
    }
  }

  before('create fixture loader', async () => {
    wallets = await (ethers as any).getSigners()
    ;[deployer] = wallets

    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({
      uniFactory,
      uniRouter,
      positionManager,
      sushiFactory,
      sushiRouter,
      dai,
      usdc,
      weth,
      sDaiWethPool,
      uDaiWethPool,
      sUsdcWethPool,
      uUsdcWethPool,
      uUsdcDaiPool
    } = await loadFixture(initFixture))
  })

  beforeEach('init balances', async () => {
    await ethers.provider.send('hardhat_setBalance', [
      deployer.address,
      expandToDecimals(100_000_000).toHexString()
    ])

    await deployer.sendTransaction({
      to: weth.address,
      value: TOTAL_INITIAL_WETH_RESERVE
    })

    // * Sushi pair add liquidity
    await dai.approve(sushiRouter.address, S_DAI_WETH[0])
    await usdc.approve(sushiRouter.address, S_USDC_WETH[0])

    await sushiRouter.addLiquidityETH(
      dai.address,
      S_DAI_WETH[0],
      0,
      0,
      deployer.address,
      (await ethers.provider.getBlock('latest')).timestamp * 2,
      { value: S_DAI_WETH[1] }
    )

    await sushiRouter.addLiquidityETH(
      usdc.address,
      S_USDC_WETH[0],
      0,
      0,
      deployer.address,
      (await ethers.provider.getBlock('latest')).timestamp * 2,
      { value: S_USDC_WETH[1] }
    )

    expect(await sDaiWethPool.balanceOf(deployer.address)).to.be.gt(0)
    expect(await sUsdcWethPool.balanceOf(deployer.address)).to.be.gt(0)

    // * Add Liquidity to pool
    await addLiqudityUni(
      uDaiWethPool,
      U_DAI_WETH_LIQUIDITY,
      deployer,
      positionManager
    )
    await addLiqudityUni(
      uUsdcWethPool,
      U_USDC_WETH_LIQUIDITY,
      deployer,
      positionManager
    )
    await addLiqudityUni(
      uUsdcDaiPool,
      U_USDC_DAI_LIQUIDITY,
      deployer,
      positionManager
    )
  })

  beforeEach('init executor and helper', async () => {
    const ExecutorFactory = await ethers.getContractFactory(
      'Executor',
      deployer
    )

    executor = (await ExecutorFactory.deploy(
      uniRouter.address,
      sushiRouter.address,
      uniFactory.address,
      weth.address
    )) as Executor

    const SingleSwapperFactory = await ethers.getContractFactory(
      'SingleSwapper',
      deployer
    )

    singleSwapper = (await SingleSwapperFactory.deploy(
      uniRouter.address
    )) as SingleSwapper
  })

  it.skip('calculates ETH difference with 10k USDC', async () => {
    // sqrtPriceX96 is stored in pool.slot0()

    const USDC_IN = BigNumber.from(1000).mul(10 ** 6)

    const uniEthOut = await executor.uGetAmountOutToken1(
      ethers.BigNumber.from('1501009630085791590188703858443673'),
      USDC_IN
    )

    const sushiEthOut = await executor.sGetAmountOut(
      ethers.BigNumber.from('10 ** 6').mul(USDC_IN),
      ethers.BigNumber.from('10266865533565'),
      ethers.BigNumber.from('3727558961668604611823')
    )

    const diffOut = sushiEthOut.gt(uniEthOut)
      ? sushiEthOut.sub(uniEthOut)
      : uniEthOut.sub(sushiEthOut)

    console.log(
      `
        Sushi ${USDC_IN} USDC: ${utils.formatEther(sushiEthOut)} ETH 
        Uni ${USDC_IN} USDC: ${utils.formatEther(uniEthOut)} ETH 
        ----------------------------
        Difference: ${utils.formatEther(diffOut)} ETH ${utils.formatEther(
        diffOut.mul(2700)
      )} $
      `
    )
  })

  it.skip('calculates price uni to sushi', async () => {
    const USDC_IN = BigNumber.from(1000).mul(10 ** 6)

    const uniEthOut = await executor.uGetAmountOutToken1(
      ethers.BigNumber.from('1501009630085791590188703858443673'),
      USDC_IN
    )

    const sushiUSDCOut = await executor.sGetAmountOut(
      uniEthOut,
      ethers.BigNumber.from('3727558961668604611823'),
      ethers.BigNumber.from('10266865533565')
    )

    console.log(
      `
        Uni ${USDC_IN.div(10 ** 6)} USDC -> ${utils.formatEther(uniEthOut)} ETH
        Sushi ${utils.formatEther(uniEthOut)} ETH -> ${sushiUSDCOut.div(
        10 ** 6
      )} USDC
      `
    )
  })

  it.skip('calculates price sushi to uni', async () => {
    const USDC_IN = BigNumber.from(1000).mul(10 ** 6)

    const sushiETHOut = await executor.sGetAmountOut(
      USDC_IN,
      ethers.BigNumber.from('10266865533565'),
      ethers.BigNumber.from('3727558961668604611823')
    )

    const uniUSDCOut = await executor.uGetAmountOutToken0(
      ethers.BigNumber.from('1501009630085791590188703858443673'),
      sushiETHOut
    )

    const diffOut = USDC_IN.gt(uniUSDCOut)
      ? USDC_IN.sub(uniUSDCOut)
      : uniUSDCOut.sub(USDC_IN)

    console.log(
      `
        Sushi ${USDC_IN.div(10 ** 6)} USDC -> ${utils.formatEther(
        sushiETHOut
      )} ETH
        Uni ${utils.formatEther(sushiETHOut)} ETH -> ${uniUSDCOut.div(
        10 ** 6
      )} USDC
        ----------------------------
        Difference: ${diffOut.div(10 ** 6)}USDC
      `
    )
  })

  it.skip('observes pool state', async () => {
    await observePoolState(sDaiWethPool, 'SUSHI')
    await observePoolState(uDaiWethPool, 'UNI')
    await observePoolState(sUsdcWethPool, 'SUSHI')
    await observePoolState(uUsdcWethPool, 'UNI')
  })

  it.skip('calculates USDC -> WETH with pool data', async () => {
    const USDC_IN = BigNumber.from(2700).mul(10 ** 6)

    const { sqrtPriceX96 } = await uUsdcWethPool.slot0()
    const [reserve0, reserve1] = await sUsdcWethPool.getReserves()

    const uniEth = await executor.uGetAmountOutToken0(sqrtPriceX96, USDC_IN)
    const sushiEth = await executor.sGetAmountOut(USDC_IN, reserve1, reserve0)

    console.log(
      `
        Uni ${USDC_IN.div(10 ** 6)} USDC -> ${utils.formatEther(uniEth)} WETH
        Sushi ${USDC_IN.div(10 ** 6)} USDC -> ${utils.formatEther(
        sushiEth
      )} WETH
      `
    )
  })

  it.skip('executes swap in v3 and flashes', async () => {
    const USDC_IN = expandToDecimals(20_700, 6)
    const WETH_ROUTE = expandToDecimals(5)
    const USDC_ROUTE = expandToDecimals(2_700, 6)

    const printPrice = async () => {
      const USDC_IN = BigNumber.from(2700).mul(10 ** 6)

      const { sqrtPriceX96 } = await uUsdcWethPool.slot0()
      const [reserve0, reserve1] = await sUsdcWethPool.getReserves()

      const uniEth = await executor.uGetAmountOutToken0(sqrtPriceX96, USDC_IN)
      const sushiEth = await executor.sGetAmountOut(USDC_IN, reserve1, reserve0)

      console.log(
        `
        Uni ${USDC_IN.div(10 ** 6)} USDC -> ${utils.formatEther(uniEth)} WETH
        Sushi ${USDC_IN.div(10 ** 6)} USDC -> ${utils.formatEther(
          sushiEth
        )} WETH\n
      `
      )
    }

    const printRoutes = async (tag: string) => {
      const [u01s10, isProfitable_u01s10, u10s01, isProfitable_u10s01] =
        await executor.getUniToSushi({
          amount0: WETH_ROUTE,
          amount1: USDC_ROUTE,
          unipool: uUsdcWethPool.address,
          sushipool: sUsdcWethPool.address
        })

      const [s01u10, isProfitable_s01u10, s10u01, isProfitable_s10u01] =
        await executor.getSushiToUni({
          amount0: WETH_ROUTE,
          amount1: USDC_ROUTE,
          unipool: uUsdcWethPool.address,
          sushipool: sUsdcWethPool.address
        })

      console.log(
        `${tag}
        Uni
          WETH u01s10 prof: ${isProfitable_u01s10}  in: ${utils.formatEther(
          WETH_ROUTE
        )} out: ${utils.formatEther(u01s10)}
          USDC u10s01 prof: ${isProfitable_u10s01}  in: ${USDC_ROUTE.div(
          10 ** 6
        )} out: ${u10s01.div(10 ** 6)}
        Sushi
          WETH s01u10 prof: ${isProfitable_s01u10} in: ${utils.formatEther(
          WETH_ROUTE
        )} out: ${utils.formatEther(s01u10)}
          USDC s10u01 prof: ${isProfitable_s10u01} in: ${USDC_ROUTE.div(
          10 ** 6
        )} out: ${s10u01.div(10 ** 6)}`
      )
    }

    await usdc.approve(singleSwapper.address, USDC_IN)
    await singleSwapper.swapExactInputSingle(
      USDC_IN,
      usdc.address,
      weth.address
    )

    await printRoutes('AFTER SWAP')

    const [token0, token1, fee, flashToken0, flashToken1, flashFee] =
      await Promise.all([
        uUsdcWethPool.token0(),
        uUsdcWethPool.token1(),
        uUsdcWethPool.fee(),
        uDaiWethPool.token0(),
        uDaiWethPool.token1(),
        uDaiWethPool.fee()
      ])

    // await executor.initFlash({
    //   token0,
    //   token1,
    //   fee,
    //   flashToken0,
    //   flashToken1,
    //   flashFee,
    //   amount0: expandToDecimals(1),
    //   amount1: 0
    // })
  })

  it.skip('flashswap', async () => {
    const [token0, token1, fee, flashToken0, flashToken1, flashFee] =
      await Promise.all([
        uUsdcWethPool.token0(),
        uUsdcWethPool.token1(),
        uUsdcWethPool.fee(),
        uDaiWethPool.token0(),
        uDaiWethPool.token1(),
        uDaiWethPool.fee()
      ])

    // to cover fees
    // await weth.transfer(executer.address, utils.parseEther('0.03'))

    console.log(uDaiWethPool.address)

    // await executor.initFlash({
    //   token0,
    //   token1,
    //   fee,
    //   flashToken0,
    //   flashToken1,
    //   flashFee,
    //   amount0: expandToDecimals(10),
    //   amount1: 0
    // })
  })

  it.skip('flash on profitable swap', async () => {
    const USDC_IN = expandToDecimals(20_700, 6)

    await usdc.approve(singleSwapper.address, USDC_IN)
    await singleSwapper.swapExactInputSingle(
      USDC_IN,
      usdc.address,
      weth.address
    )

    await executor.execute({
      unipool: uUsdcWethPool.address,
      sushipool: sUsdcWethPool.address,
      flashpool0: uDaiWethPool.address,
      flashpool1: constants.AddressZero
    })
  })

  it.skip('calculates multiple throughputs', async () => {
    const USDC_IN = expandToDecimals(20_700, 6)
    const WETH_INITIAL = utils.parseEther('0.1')
    const USDC_INITIAL = expandToDecimals(10, 6)

    await usdc.approve(singleSwapper.address, USDC_IN)
    const balBef = await weth.balanceOf(deployer.address)

    await singleSwapper.swapExactInputSingle(
      USDC_IN,
      usdc.address,
      weth.address
    )

    const balAft = await weth.balanceOf(deployer.address)

    console.log(balBef.sub(balAft))
    console.log(utils.formatEther(balBef.sub(balAft)))

    const results: [BigNumber, boolean, BigNumber, boolean][] = []
    const calcPromises: Promise<[BigNumber, boolean, BigNumber, boolean]>[] = []

    for (let i = 0; i < 30; i++) {
      calcPromises.push(
        executor.getUniToSushi({
          amount0: WETH_INITIAL.mul(10 * i),
          amount1: USDC_INITIAL.mul(10 * i),
          unipool: uUsdcWethPool.address,
          sushipool: sUsdcWethPool.address
        })
      )
    }

    calcPromises.push(
      executor.getUniToSushi({
        amount0: BigNumber.from('6466933065583283149'),
        amount1: USDC_INITIAL,
        unipool: uUsdcWethPool.address,
        sushipool: sUsdcWethPool.address
      })
    )
    results.push(...(await Promise.all(calcPromises)))

    if (results.some((result) => result[1])) {
      console.log('Profitable Route u01s10')
      results.forEach((result, index) => {
        console.log(
          `${utils.formatEther(WETH_INITIAL.mul(10 * index))} ${result[0]} ${
            result[1]
              ? `Profit ${utils.formatEther(
                  result[0].sub(WETH_INITIAL.mul(10 * index))
                )}`
              : ''
          }`
        )
      })
    } else {
      console.log('Profitable Route u10s01')
      results.forEach((result, index) => {
        console.log(
          `u10s01 ${USDC_INITIAL.mul(10 * index).div(10 ** 6)} ${result[2]} ${
            result[3]
              ? `Profit ${utils.formatEther(
                  result[2].sub(WETH_INITIAL.mul(10 * index))
                )}`
              : ''
          }`
        )
      })
    }
  })

  it.skip('calculates multiple throughputs', async () => {
    const USDC_IN = expandToDecimals(20_700, 6)
    const WETH_INITIAL = utils.parseEther('0.1')
    const USDC_INITIAL = expandToDecimals(10, 6)

    await usdc.approve(singleSwapper.address, USDC_IN)

    await singleSwapper.swapExactInputSingle(
      USDC_IN,
      usdc.address,
      weth.address
    )

    const results: [BigNumber, boolean, BigNumber, boolean][] = []
    const calcPromises: Promise<[BigNumber, boolean, BigNumber, boolean]>[] = []

    for (let i = 0; i < 30; i++) {
      calcPromises.push(
        executor.getUniToSushi({
          amount0: WETH_INITIAL.mul(10 * i),
          amount1: USDC_INITIAL.mul(10 * i),
          unipool: uUsdcWethPool.address,
          sushipool: sUsdcWethPool.address
        })
      )
    }

    calcPromises.push(
      executor.getUniToSushi({
        amount0: BigNumber.from('6466933065583283149'),
        amount1: USDC_INITIAL,
        unipool: uUsdcWethPool.address,
        sushipool: sUsdcWethPool.address
      })
    )
    results.push(...(await Promise.all(calcPromises)))

    if (results.some((result) => result[1])) {
      console.log('Profitable Route u01s10')
      results.forEach((result, index) => {
        console.log(
          `${utils.formatEther(WETH_INITIAL.mul(10 * index))} ${result[0]} ${
            result[1]
              ? `Profit ${utils.formatEther(
                  result[0].sub(WETH_INITIAL.mul(10 * index))
                )}`
              : ''
          }`
        )
      })
    } else {
      console.log('Profitable Route u10s01')
      results.forEach((result, index) => {
        console.log(
          `u10s01 ${USDC_INITIAL.mul(10 * index).div(10 ** 6)} ${result[2]} ${
            result[3]
              ? `Profit ${utils.formatEther(
                  result[2].sub(WETH_INITIAL.mul(10 * index))
                )}`
              : ''
          }`
        )
      })
    }
  })

  it.skip('calculates', async () => {
    // const f = (x: number) => (2 * x ** 2) / (1 + 2 * x)

    // for (let x = 0; x < 100; x++) {
    //   console.log(x, f(x))
    // }

    const amountIn = utils.parseEther('5')

    const { sqrtPriceX96 } = await uUsdcWethPool.slot0()
    const [sRes0, sRes1] = await sUsdcWethPool.getReserves()

    // * Off Chain
    const uGetAmountOutToken1 = (
      sqrtRatioX96: BigNumber,
      token0amountIn: BigNumber
    ) => {
      return token0amountIn
        .mul(sqrtRatioX96.pow(2))
        .div(BigNumber.from(2).pow(192))
    }

    const sGetAmountOut = (
      amountIn: BigNumber,
      reserveIn: BigNumber,
      reserveOut: BigNumber
    ) => {
      const amountInWithFee = amountIn.mul(997)
      const numerator = amountInWithFee.mul(reserveOut)
      const denominator = reserveIn.mul(1000).add(amountInWithFee)
      return numerator.div(denominator)
    }

    const amountOut = sGetAmountOut(
      uGetAmountOutToken1(sqrtPriceX96, amountIn),
      sRes1,
      sRes0
    )

    console.log(' in', amountIn)
    console.log('out', amountOut)

    // * On Chain
    const [amountOutC] = await executor.getUniToSushi({
      amount0: amountIn,
      amount1: 0,
      unipool: uUsdcWethPool.address,
      sushipool: sUsdcWethPool.address
    })

    console.log('out', amountOutC, 'contract')

    // * Merge
    const merge = (
      amountIn: BigNumber,
      sqrtRatioX96: BigNumber,
      reserveIn: BigNumber, // token1
      reserveOut: BigNumber // token0
    ) => {
      const u01 = amountIn
        .mul(sqrtRatioX96.pow(2))
        .div(BigNumber.from(2).pow(192))

      const amountInWithFee = u01.mul(997) // input is token1
      const numerator = amountInWithFee.mul(reserveOut)
      const denominator = reserveIn.mul(1000).add(amountInWithFee)
      return numerator.div(denominator)
    }

    const mergeOut = merge(amountIn, sqrtPriceX96, sRes1, sRes0)

    console.log('out', mergeOut, 'merge')

    // * Compare Calc with reserves vs. sqrtX96
    // const [uRes0, uRes1] = await Promise.all([
    //   await weth.balanceOf(uUsdcWethPool.address),
    //   await usdc.balanceOf(uUsdcWethPool.address)
    // ])

    // const cc_u01_usual = uGetAmountOutToken1(sqrtPriceX96, amountIn)
    // const cc_u01_sushi = sGetAmountOut(amountIn, uRes0, uRes1)
    // console.log('u01', cc_u01_usual, 'usual')
    // console.log('u01', cc_u01_sushi, 'sushi')
    // console.log('diff', cc_u01_sushi.sub(cc_u01_usual))

    // const cc_out = sGetAmountOut(cc_u01_sushi, sRes1, sRes0)
    // console.log('out', cc_out, 'dobuleSushi')
    // console.log('diff', cc_out.sub(amountOutC), 'dobuleSushi')
    // // ! Diff too big, 0,003 ETH on 1 ETH Input
  })

  it('trade USDC and arbitrage u01s10', async () => {
    const tradeUSDCInUniPool = async (amount: BigNumber) => {
      await usdc.approve(singleSwapper.address, amount)

      await singleSwapper.swapExactInputSingle(
        amount,
        usdc.address,
        weth.address
      )
    }

    const amountOut_u01s10 = (
      amountIn: BigNumber,
      sqrtRatioX96: BigNumber,
      reserveIn: BigNumber, // token1
      reserveOut: BigNumber // token0
    ) => {
      const u01 = amountIn
        .mul(sqrtRatioX96.pow(2))
        .div(BigNumber.from(2).pow(192))

      const amountInWithFee = u01.mul(997) // input is token1
      const numerator = amountInWithFee.mul(reserveOut)
      const denominator = reserveIn.mul(1000).add(amountInWithFee)
      return numerator.div(denominator)
    }

    await tradeUSDCInUniPool(expandToDecimals(27_000, 6))

    const { sqrtPriceX96 } = await uUsdcWethPool.slot0()
    const [sRes0, sRes1] = await sUsdcWethPool.getReserves()

    for (let x = -10; x <= 10; x++) {
      const amountIn = utils.parseEther(x.toString())
      const amountOut = amountOut_u01s10(amountIn, sqrtPriceX96, sRes1, sRes0)
      const profit = amountOut.sub(amountIn)
      // console.log('amountOut', amountOut)

      // console.log(
      //   `${utils.parseEther(x.toString())} | ${utils
      //     .formatEther(amountOut)
      //     .substring(0, 5)}`
      // )
      console.log(`${x} | ${amountOut.toString()}`)
      // console.log(`${x} | ${profit.toString()}`)
      // console.log(`${x} | ${utils.formatEther(profit).substring(0, 8)}`)
    }
    console.log('\n')

    // u01s10
    const optimalAmount = await executor.calculateOptimalInputAmount(
      sqrtPriceX96,
      sRes1,
      sRes0,
      0
    )

    console.log('optimalAmount', optimalAmount.toString(), '\n')

    // console.log(
    //   'optimalAmount out',
    //   amountOut_u01s10(optimalAmount, sqrtPriceX96, sRes1, sRes0)
    //     .sub(optimalAmount)
    //     .toString()
    // )

    const tx = await executor.execute({
      unipool: uUsdcWethPool.address,
      sushipool: sUsdcWethPool.address,
      flashpool0: uDaiWethPool.address,
      flashpool1: uUsdcDaiPool.address
    })

    const recipe = await tx.wait()
    console.log('gasUsed', recipe.gasUsed)
  })

  it.skip('trade WETH and arbitrage u10s01', async () => {
    const tradeWethInUniPool = async (amount: BigNumber) => {
      await weth.approve(singleSwapper.address, amount)

      await singleSwapper.swapExactInputSingle(
        amount,
        weth.address,
        usdc.address
      )
    }

    const u10s01 = (
      amountIn: BigNumber,
      sqrtRatioX96: BigNumber,
      reserveIn: BigNumber, // token0
      reserveOut: BigNumber // token1
    ) => {
      const u10 = amountIn
        .mul(BigNumber.from(2).pow(192))
        .div(sqrtRatioX96.pow(2))

      const amountInWithFee = u10.mul(997)
      const numerator = amountInWithFee.mul(reserveOut)
      const denominator = reserveIn.mul(1000).add(amountInWithFee)
      return numerator.div(denominator)
    }

    await tradeWethInUniPool(utils.parseEther('10'))

    const { sqrtPriceX96 } = await uUsdcWethPool.slot0()
    const [sRes0, sRes1] = await sUsdcWethPool.getReserves()

    for (let x = -20; x <= 50; x++) {
      const amountIn = expandToDecimals(1000 * x, 6)
      const amountOut = u10s01(amountIn, sqrtPriceX96, sRes0, sRes1)
      const profit = amountOut.sub(amountIn)

      console.log(`${x * 1000} | ${profit.div(10 ** 6).toString()}`)
    }

    // console.log('token0', await uUsdcDaiPool.token0())
    // console.log('token1', await uUsdcDaiPool.token1())
    // console.log('dai', dai.address)
    // console.log('usdc', usdc.address)
    // console.log('weth', weth.address)

    await executor.execute({
      unipool: uUsdcWethPool.address,
      sushipool: sUsdcWethPool.address,
      flashpool0: uDaiWethPool.address,
      flashpool1: uUsdcDaiPool.address
    })

    // u10s01
    // const optimalAmount = await executor.calculateOptimalInputAmount(
    //   sqrtPriceX96,
    //   sRes0,
    //   sRes1,
    //   1
    // )

    // console.log('optimalAmount', optimalAmount.toString())
  })
})
