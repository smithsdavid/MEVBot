import { HARD_PURGE, LIVE_MODE } from '../../src/config/config'
import chalk from 'chalk'

export function drawInit(signerAddress: string, relaySignerAddress: string) {
  console.log()
  console.log(chalk.gray('Searcher Wallet Address: ' + signerAddress))
  console.log(
    chalk.gray('Flashbots Relay Signing Wallet Address: ' + relaySignerAddress)
  )
  console.log()
  console.log(
    LIVE_MODE
      ? chalk.bgCyan('LIVE_MODE ┬─┬﻿ ノ( ゜-゜ノ)')
      : chalk.bgGray('SERIALIZED')
  )
  HARD_PURGE && console.log(chalk.bgRed('HARD_PURGE (╯°□°）╯︵ ┻━┻'))
  console.log()
}
