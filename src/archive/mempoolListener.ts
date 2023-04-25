import BlocknativeSdk from 'bnc-sdk'
import 'dotenv/config'
import { constants } from 'ethers'
import { ethers } from 'hardhat'
import util from 'util'
import WebSocket from 'ws'
import SuhsiAbiJSON from '../contracts/abi/sushiABI.json'
import UniAbiJSON from '../contracts/abi/uniABI.json'
import { ArbitrageDataEntry } from '../types/custom/ArbitrageDataEntry'
import {
  ArbitrageDataMap,
  ArbitrageScanResult
} from '../types/custom/ArbitrageDataMap'
import { ArbitrageOperation } from '../types/custom/ArbitrageOperation'
import { Token } from '../types/custom/Token'
import { TokenDictionary } from '../types/custom/TokenDictionary'
import { Executor } from '../types/typechain'
import { delay } from '../utils/delay'
import { loadDataFromFile } from '../utils/files/loadArrayFromFile'
import { getProvider } from '../utils/getProvider'
import { getGasOptions } from '../utils/tx/getGasOptions'
import { setupDeployer } from './config/setupDeployer'
import { setupFactories } from './config/setupFactories'

let success = 0
const successTX: string[] = []
let failed = 0
let noMatch = 1

// !!!!!!!
// ! If not errors show it is because \node_modules\bnc-sdk\dist\cjs\index.js line 8748
// !!!!!!!

type TxLogEntry = {
  status: 'pending' | 'complete'
  blockSubmit: number
  blockMined: number | undefined
  timestampSubmit: number
  timestampMined: number | undefined
  timeToMined: number | undefined
  blocksToMined: number | undefined
}

type TxLog = { [hash: string]: TxLogEntry }

let txLog: TxLog = {}
const provider = getProvider()

type SwapCall = {
  methodName:
    | 'exactInputSingle'
    | 'exactOutputSingle'
    | 'swapExactTokensForTokens'
    | 'swapTokensForExactTokens'
    | 'exactInput'
  params: {
    tokenIn: string
    tokenOut: string
    path: string | string[]
    fee: string
    recipient: string
    amountIn: string
    amountInMax: string
    amountOut: string
    amountOutMin: string
    sqrtPriceLimitX96: string
    params: {
      tokenIn: string
      tokenOut: string
      path: string
      fee: string
      recipient: string
      amountOut: string
      amountOutMinimum: string
      amountIn: string
      amountInMaximum: string
      sqrtPriceLimitX96: string
    }
  }
}

type Trade = {
  path: string[]
  fee: string | undefined
  amountIn: string
  amountOut: string
}

const convertToTrade = (swapCall: SwapCall) => {
  let trade: Trade | undefined = undefined
  const { methodName, params } = swapCall
  let tokenDictionary: TokenDictionary = loadDataFromFile('tokenDictionary')

  if (methodName === 'exactInputSingle' || methodName === 'exactOutputSingle') {
    trade = {
      path: [params.params.tokenIn, params.params.tokenOut],
      amountIn: params.params.amountIn || params.params.amountInMaximum,
      amountOut: params.params.amountOut || params.params.amountOutMinimum,
      fee: params.params.fee
    }
  } else if (
    methodName === 'swapExactTokensForTokens' ||
    methodName === 'swapTokensForExactTokens'
  ) {
    trade = {
      path: params.path as string[],
      amountIn: params.amountIn || params.amountInMax,
      amountOut: params.amountOut || params.amountOutMin,
      fee: undefined
    }
  } else if (methodName === 'exactInput') {
    const path = params.params.path.slice(2)
    const tokenIn = '0x' + path.slice(0, 40)
    const tokenOut = '0x' + path.slice(-40)

    const getKeyMatch = (mKey: string) => {
      let tdKeys = Object.keys(tokenDictionary)
      tdKeys = tdKeys.filter((k) => k.toLowerCase() === mKey.toLowerCase())

      return tdKeys.length > 0 ? tdKeys[0] : ''
    }

    trade = {
      path: [
        tokenDictionary[getKeyMatch(tokenIn)].address,
        tokenDictionary[getKeyMatch(tokenOut)].address
      ],
      amountIn: params.amountIn || params.amountInMax,
      amountOut: params.amountOut || params.amountOutMin,
      fee: undefined
    }
  }

  return trade
}

const updateTxLog = async (tx: any, type: 'ADD' | 'UPDATE') => {
  if (type === 'ADD') {
    txLog[tx.hash] = {
      status: 'pending',
      blockSubmit: provider.blockNumber,
      blockMined: undefined,
      timestampSubmit: Date.now(),
      timestampMined: undefined,
      timeToMined: undefined,
      blocksToMined: undefined
    }
  } else if (txLog[tx.hash] != undefined) {
    txLog[tx.hash] = {
      ...txLog[tx.hash],
      status: 'complete',
      blockMined: provider.blockNumber,
      timestampMined: Date.now(),
      timeToMined: Date.now() - txLog[tx.hash].timestampSubmit,
      blocksToMined: provider.blockNumber - txLog[tx.hash].blockSubmit
    }
  }
}

const evalLog = () => {
  console.log('txLog', txLog)

  Object.keys(txLog).forEach(
    (key) => txLog[key].blockSubmit < 0 && delete txLog[key]
  )

  if (!txLog || txLog == {}) return

  const totalTxs = Object.entries(txLog).length

  const compCount = Object.entries(txLog).filter(
    ([, tx]) => tx.status === 'complete'
  ).length

  const pendingCount = Object.entries(txLog).filter(
    ([, tx]) => tx.status === 'pending'
  ).length

  let totalCompTime = 0
  Object.entries(txLog).forEach((a) => {
    if (a[1].status == 'complete' && a[1].blockSubmit >= 0) {
      totalCompTime = totalCompTime + a[1].timeToMined!
    }
    return a
  })
  const avgCompTime = totalCompTime / totalTxs

  let totalBlocks = 0
  Object.entries(txLog).forEach((a) => {
    if (a[1].status == 'complete' && a[1].blockSubmit >= 0) {
      totalBlocks = totalBlocks + a[1].blocksToMined!
    }
    return a
  })
  const avgBlocks = totalBlocks / totalTxs

  console.log('--- TX LOG ---')
  console.log(`Total ${totalTxs}`)
  console.log(`Pending ${pendingCount}`)
  console.log(`Complete ${compCount}`)
  console.log(`AvgCompTime ${avgCompTime}`)
  console.log(`AvgBlocks ${avgBlocks}`)
}

const printStats = () => {
  // console.log(
  //   '\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n'
  // )
  console.log('##############################################')
  console.log(
    `\n> Success ${success} ${(success / (success + failed)) * 100} %`
  )
  console.log(`> Failed ${failed} ${(failed / (success + failed)) * 100} %`)
  console.log(`> NoMatch ${noMatch}`)
  console.log('\n> ---- List of Successful TX')
  console.log(successTX)
  console.log('\n##############################################')
}

const sendTX = async () => {
  console.log('\n> Sending TX')

  const { deployer } = setupDeployer()
  const gasOptions = await getGasOptions(2_000_000)

  const tx = await deployer.sendTransaction({
    to: '0xBe8466096B24A93656627bdcBFA22F8d4Ec927Cb',
    value: ethers.utils.parseEther('0.1'),
    gasLimit: gasOptions.gasLimit,
    gasPrice: gasOptions.gasPrice.mul(2)
  })

  console.log(tx.hash)
  const recipe = await tx.wait()
  console.log('Tx finished')
}

const getArbitragepair = (search0: Token, search1: Token) => {
  let arbDictionary: ArbitrageDataMap = loadDataFromFile('arbitrage')

  let match: ArbitrageDataEntry | undefined = undefined

  Object.entries(arbDictionary).forEach((arbEntry) => {
    const [key, entry] = arbEntry
    const { token0, token1 } = entry
    const search = [search0.address, search1.address]

    if (search.includes(token0.address) && search.includes(token1.address)) {
      match = entry
    }
  })

  return match
}

const includesSushiToken = (trade: Trade) => {}

const analyseArbitrage = async (entry: ArbitrageDataEntry) => {
  let promisesArbscan: Promise<void>[] = []

  const { ExecutorFactory } = await setupFactories()
  const executor = ExecutorFactory.attach(process.env.EXECUTOR) as Executor

  const arbOps: {
    op: ArbitrageOperation
    result: ArbitrageScanResult
  }[] = []

  const getArbitragePromise = (params: {
    sushipool: string
    unipool: string
    flashpool0: string | undefined
    flashpool1: string | undefined
  }) =>
    new Promise<void>((res, rej) => {
      executor
        .scanArbitrage({
          sushipool: params.sushipool,
          unipool: params.unipool
        })
        .then(async (result) => {
          if (result[1] == true || result[3] == true) {
            arbOps.push({
              op: {
                sushipool: params.sushipool,
                unipool: params.unipool,
                flashpool0: params.flashpool0,
                flashpool1: params.flashpool1
              },
              result
            })
          }

          res()
        })
        .catch((e: any) => {
          res()
        })
    })

  for (let i = 0; i < entry.unipools.length; i++) {
    promisesArbscan.push(
      getArbitragePromise({
        sushipool: entry.sushipool,
        unipool: entry.unipools[i],
        flashpool0:
          entry.flashpool0 && entry.flashpool0.length > i
            ? entry.flashpool0[i]
            : undefined,
        flashpool1:
          entry.flashpool1 && entry.flashpool1.length > i
            ? entry.flashpool1[i]
            : undefined
      })
    )
  }

  await Promise.all(promisesArbscan)

  console.log(`\n> Resulted in ${arbOps.length} Arbitrage Opportunities`)

  let executableEntries: ArbitrageOperation[] = []

  arbOps.forEach(({ op }) => {
    if (op.flashpool0 && op.flashpool1) {
      executableEntries.push(op)
    }
  })

  return executableEntries
}

const executeArbitrage = async (arbOps: ArbitrageOperation[]) => {
  if (arbOps.length == 0) return

  const { ExecutorFactory } = await setupFactories()
  const executor = ExecutorFactory.attach(process.env.EXECUTOR) as Executor

  const op = arbOps[0]
  let options = await getGasOptions(850_000)
  options = {
    ...options,
    gasPrice: options.gasPrice.mul(2)
  }

  const executionOp = {
    sushipool: op.sushipool,
    unipool: op.unipool,
    flashpool0: op.flashpool0 ? op.flashpool0 : constants.AddressZero,
    flashpool1: op.flashpool1 ? op.flashpool1 : constants.AddressZero
  }

  executor
    .execute(executionOp, options)
    .then(async (tx) => {
      console.log('> ARB TX ', tx.hash)

      const recipe = await tx.wait()

      console.log('> Success: ', recipe.transactionHash)
      success++
      successTX.push(tx.hash)
      printStats()
    })
    .catch((e) => {
      // console.log(e)
      console.log('> Tx Failed')
      failed++
      printStats()
    })
}

const executeMatch = async (
  tokenIn: Token,
  tokenOut: Token,
  arbitragePair: ArbitrageDataEntry,
  amountIn: number,
  amountOut: number,
  methodName: string,
  gas: string,
  gasPrice: string,
  gasPriceGwei: string,
  hash: string,
  tag: string
) => {
  console.log('\n\n\n\n\n--------------------')
  console.log(`> Arbitrage Match ${tag}`)
  console.log(
    `\n${amountIn} ${tokenIn.symbol} => ${amountOut} ${tokenOut.symbol}\n`
  )
  console.log('Method: ' + methodName)
  console.log(`Gas ${gas} GasPrice ${gasPrice} GasPriceGwei ${gasPriceGwei}`)
  console.log('Hash: ' + hash)

  // sendTX()

  // const arbOps = await analyseArbitrage(arbitragePair)

  // if (arbOps.length > 0) {
  //   executeArbitrage(arbOps)
  // }
}

const extractParamsFromTrade = (swapCall: any) => {}

async function main() {
  console.log('> Process startet')

  const options = {
    dappId: process.env.BLOCKNATIVE_API_KEY,
    networkId: 1, // 137 Polygon
    ws: WebSocket
    // transactionHandlers: [(event: any) => console.log(event.transaction)],
    // onerror: (error: any) => {
    //   console.log(error)
    // }
  }

  const blocknative = new BlocknativeSdk(options)

  console.log(`\n> Uploading ABI`)

  await blocknative.configuration({
    scope: process.env.SUSHI_ROUTER,
    abi: SuhsiAbiJSON
  })
  const sushiListener = blocknative.account(process.env.SUSHI_ROUTER)

  await blocknative.configuration({
    scope: process.env.UNI_ROUTER_2,
    abi: UniAbiJSON
  })
  const uniListener = blocknative.account(process.env.UNI_ROUTER_2)

  console.log(await getGasOptions())

  // sushiListener.emitter.on('txPool', (transaction: any) => {
  //   const { hash, gas, gasPrice, gasPriceGwei } = transaction
  //   const { methodName, params } = transaction.contractCall
  //   const path = params?.path

  //   if (path) {
  //     const token0 = tokenDictionary[path[0]]
  //     const token1 = tokenDictionary[path[path.length - 1]]

  //     let arbitragePair = undefined

  //     if (token0 && token1) {
  //       arbitragePair = getArbitragepair(token0, token1)
  //     }

  //     if (arbitragePair) {
  //       let amount0
  //       let amount1

  //       if (methodName == 'swapTokensForExactTokens') {
  //         amount0 = params[Object.keys(params)[1]] / 10 ** token0.decimals
  //         amount1 = params[Object.keys(params)[0]] / 10 ** token1.decimals
  //       } else {
  //         amount0 = params[Object.keys(params)[0]] / 10 ** token0.decimals
  //         amount1 = params[Object.keys(params)[1]] / 10 ** token1.decimals
  //       }

  //       executeMatch(
  //         token0,
  //         token1,
  //         arbitragePair,
  //         amount0,
  //         amount1,
  //         methodName,
  //         gas,
  //         gasPrice,
  //         gasPriceGwei,
  //         hash,
  //         'SUSHI'
  //       )
  //     } else {
  //       console.log('\n\n\n> TX SUHSI - no pair found')
  //       console.log('>', transaction.hash)
  //       noMatch++
  //     }

  //     printStats()
  //   }

  //   // console.log(transaction)
  //   console.log(transaction.contractCall)
  // })

  // uniListener.emitter.on('txPool', (transaction: any) => {
  //   console.log('ADD')
  //   updateTxLog(transaction, 'ADD')
  //   evalLog()
  // })
  // uniListener.emitter.on('txConfirmed', (transaction: any) => {
  //   console.log('UPDATE')
  //   updateTxLog(transaction, 'UPDATE')
  //   evalLog()
  // })

  uniListener.emitter.on('txPool', (transaction: any) => {
    const { hash, gas, gasPrice, gasPriceGwei } = transaction
    const { subCalls, methodName } = transaction.contractCall

    console.log(util.inspect(transaction))

    if (subCalls) {
      // subCalls.forEach((sc: any, index: number) => console.log(index, sc.data))

      const swapCall: SwapCall = subCalls[0].data

      console.log('\n\n\nswapCall', swapCall)

      const trade = convertToTrade(swapCall)
      console.log('trade', trade)

      if (!trade) {
        return
      }

      // let token0
      // let token1

      // if (swapCall?.params?.path) {
      //   const [t0, t1] = extractTokenFromPath(swapCall.params.path as any)

      //   const getKeyMatch = (mKey: string) => {
      //     let tdKeys = Object.keys(tokenDictionary)
      //     tdKeys = tdKeys.filter((k) => k.toLowerCase() === mKey.toLowerCase())

      //     return tdKeys.length > 0 ? tdKeys[0] : ''
      //   }

      //   token0 = tokenDictionary[getKeyMatch(t0)]
      //   token1 = tokenDictionary[getKeyMatch(t1)]
      // } else {
      //   token0 = tokenDictionary[swapCall.params.tokenIn as string]
      //   token1 = tokenDictionary[swapCall.params.tokenOut as string]
      // }

      // let arbitragePair = undefined

      // if (token0 && token1) {
      //   arbitragePair = getArbitragepair(token0, token1)
      // }

      // if (arbitragePair) {
      //   let amount0 = 0
      //   let amount1 = 0

      //   if (swapCall.params.amountIn) {
      //     amount0 = Number(swapCall.params.amountIn)
      //     amount1 = Number(swapCall.params.amountOutMinimum)
      //   } else {
      //     amount0 = Number(swapCall.params.amountInMaximum)
      //     amount1 = Number(swapCall.params.amountOut)
      //   }

      //   amount0 = amount0 / 10 ** token0.decimals
      //   amount1 = amount1 / 10 ** token1.decimals

      //   executeMatch(
      //     token0,
      //     token1,
      //     arbitragePair,
      //     amount0,
      //     amount1,
      //     methodName,
      //     gas,
      //     gasPrice,
      //     gasPriceGwei,
      //     hash,
      //     'UNI'
      //   )
      // } else {
      //   console.log('\n\n\n> TX UNI - no pair found')
      //   console.log('>', transaction.hash)
      //   noMatch++
      // }

      // printStats()
    }
  })

  console.log(`\n> Listening...`)

  while (1) {
    await delay(5000)
    // console.log(`\n> Listening...`)
  }

  console.log(`\n> Exit`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
