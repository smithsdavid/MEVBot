import chalk from 'chalk'
import { asciiEmoji } from '../asciiEmoji'

export function drawBlock(blockNr: number) {
  console.log('\n\n\n\n\n\n\n\n\n\n')
  console.log(chalk.gray('    ', asciiEmoji(), '\n'))
  console.log(chalk.bgYellow('#######################'))
  console.log(chalk.bgYellow(`##  Block #${blockNr}  ##`))
  console.log(chalk.bgYellow('#######################\n'))
}
