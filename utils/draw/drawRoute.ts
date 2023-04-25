import chalk from 'chalk'
import { BigNumber, utils } from 'ethers'
import { Route } from '../../src/Route'

export function drawRoute(
  route: Route,
  optimalInput: BigNumber,
  profit: BigNumber
) {
  console.log()
  console.log('Input: ', utils.formatEther(optimalInput))
  console.log(
    'Output:',
    utils.formatEther(route.getOutput(optimalInput)).slice(0, 7)
    // utils.formatEther(route.getOutput(optimalInput))
  )
  console.log(
    profit.gt(utils.parseEther('0.03'))
      ? chalk.bgGreen('Profit:', utils.formatEther(profit).slice(0, 7))
      : `Profit: ${utils.formatEther(profit).slice(0, 7)}`
  )
  console.log()
  console.log(chalk.gray('Confidence: ', route.confidenceScore))
  console.log(chalk.gray(route.toString()))
}
