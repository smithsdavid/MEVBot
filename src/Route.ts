import { BigNumber, utils } from 'ethers'
import _ from 'lodash'
import { DEC_18, SIZE_INPUT_LIMITS } from './config/config'
import { RouteNode } from './RouteNode'

export type OptimalInput = {
  input: BigNumber
  output: BigNumber
  profit: BigNumber
}

export class Route {
  private _routeNodes: Array<RouteNode>
  private _optimalInput: OptimalInput
  private _identifier: string
  private _nuked: boolean

  public get identifier(): string {
    return this._identifier
  }

  public get routeNodes(): Array<RouteNode> {
    return this._routeNodes
  }

  public get optimalInput(): OptimalInput {
    return this._optimalInput
  }

  public get confidenceScore(): number {
    return Math.max(...this._routeNodes.map((node) => node.pair.size))
  }

  constructor(routeNodes: Array<RouteNode>) {
    this._routeNodes = routeNodes
    this._optimalInput = {
      input: BigNumber.from('0'),
      output: BigNumber.from('0'),
      profit: BigNumber.from('0')
    }
    this._identifier = Route.generateIdentifier(routeNodes)
    this._nuked = false
  }

  public static generateIdentifier(routeNodes: Array<RouteNode>): string {
    const addresses = routeNodes.map((node) => node.pair.marketAddress)
    const types = Array(addresses.length)
      .fill('x')
      .map((_) => 'address')
    return utils.solidityKeccak256(types, addresses)
  }

  public refreshOptimalInput(): void {
    if (this._nuked) return

    let input = this.optimalInput.input
    let output = this.getOutput(input)
    if (!output.eq(this._optimalInput.output)) {
      let profit = output.sub(input)
      this._optimalInput = {
        input,
        output,
        profit
      }
    }
  }

  public calculateOptimalInput(): void {
    const inOut: Array<{
      input: BigNumber
      output: BigNumber
      profit: BigNumber
    }> = []
    let output = BigNumber.from(1)
    let input = utils.parseEther('0.5')
    if (this._nuked) return

    let inOutProportion = 100
    let prevProportion = 0

    while (output.gt(0) && input.lt(utils.parseEther('100'))) {
      output = this.getOutput(input)
      // console.log(input.toString(), ';', output.toString())

      if (output.eq(0)) {
        input = input.sub(utils.parseEther('0.25'))
        output = this.getOutput(input)
        if (output.gt(0)) {
          inOut.push({
            input,
            output,
            profit: output.sub(input)
          })
          break
        }
      }
      if (output.gt(0)) {
        inOut.push({
          input,
          output,
          profit: output.sub(input)
        })
        input = input.add(utils.parseEther('0.5'))
      }
      // inOutProportion = output.mul(100).div(input).toNumber()
      // if (
      //   prevProportion > inOutProportion ||
      //   input.gt(utils.parseEther('100'))
      // ) {
      //   break
      // }
      // prevProportion = inOutProportion
    }

    const sortedOutputs = _.chain(inOut)
      .sortBy((io) => io.profit)
      .reverse()
      .value()

    if (sortedOutputs.length === 1) {
      this._optimalInput = sortedOutputs[0]
    } else {
      let iBInput = sortedOutputs[0].input.add(sortedOutputs[1].input).div(2)
      let iBOutput = this.getOutput(iBInput)
      let iBProfit = iBOutput.sub(iBInput)
      if (iBProfit.gt(sortedOutputs[0].profit)) {
        this._optimalInput = {
          input: iBInput,
          output: iBOutput,
          profit: iBProfit
        }
      } else {
        this._optimalInput = sortedOutputs[0]
      }
    }
  }

  public getOutput(amountIn: BigNumber, logSteps: boolean = false): BigNumber {
    let currentAmount = amountIn
    let amountsTracker: string[] = [amountIn.toString()]
    if (this._nuked) return BigNumber.from(0)

    for (const node of this._routeNodes) {
      const inLimitv3 = node.pair.balances[node.prevToken]
        .mul(SIZE_INPUT_LIMITS[node.pair.size])
        .div(1000)
      const outLimitv2 = node.pair.balances[node.nextToken] // do not overshoot pool

      // ! this does not work for v3 as tick has it's own liqudity
      if (node.pair.marketType == 'v3' && currentAmount.gt(inLimitv3)) {
        // prevent inaccurate calc which makes route calc useless
        currentAmount = BigNumber.from(0)
        break
      }

      const amountOut = node.pair.getTokensOut(
        node.prevToken,
        node.nextToken,
        currentAmount
      )

      if (node.pair.marketType == 'v2' && amountOut.gt(outLimitv2)) {
        console.log('Hit outLimitv2')
        console.log(amountOut)
        currentAmount = BigNumber.from(0)
        break
      }

      if (logSteps) {
        console.log(`> ${node.prevToken} => ${node.nextToken}`)
        console.log(`  ${currentAmount} => ${amountOut}`)
        amountsTracker.push(amountOut.toString())
      }

      currentAmount = amountOut
      // currentAmount = amountOut.mul(99985).div(100000) // -0,015%
      // currentAmount = amountOut.mul(10000 - i).div(10000)
    }

    if (logSteps) {
      console.log('amountsTracker', amountsTracker)
    }

    // let deduct = amountIn.div(DEC_18).toNumber()
    // deduct = deduct > 3 ? 3 : deduct

    return currentAmount
  }

  public encodeRoute(amountIn: BigNumber): {
    types: Array<number>
    swaps: Array<string>
  } {
    const types: Array<number> = []
    const swaps: Array<string> = []
    let nextAmount = amountIn
    for (const node of this._routeNodes) {
      const data = node.encode(nextAmount)
      nextAmount = node.pair.getTokensOut(
        node.prevToken,
        node.nextToken,
        nextAmount
      )
      swaps.push(data)
      types.push(node.pair.marketType === 'v2' ? 2 : 3)
    }

    return { types, swaps }
  }

  public nuke(): void {
    this._optimalInput = {
      input: BigNumber.from('0'),
      output: BigNumber.from('0'),
      profit: BigNumber.from('0')
    }
    this._nuked = true
  }

  public toString(): string {
    return this._routeNodes
      .map(
        ({ pair: { marketAddress, marketType, size } }, i) =>
          `=> ${marketAddress} ${marketType} c${size}` +
          (i < this._routeNodes.length ? '\n' : '')
      )
      .reduce((a, b) => a + b)
  }

  public reverse(): Route {
    const newNodes = this._routeNodes
      .slice()
      .reverse()
      .map((node) => new RouteNode(node.pair, node.next, node.nextToken))
    for (let i = 0; i < newNodes.length; i++) {
      if (i + 1 < newNodes.length) {
        newNodes[i].next = newNodes[i + 1]
      }
    }
    return new Route(newNodes)
  }
}
