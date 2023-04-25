import chalk from 'chalk'
import { BigNumber, utils } from 'ethers'
import fs from 'fs'
import _ from 'lodash'
import path from 'path'
import {
  TOP_V2_WETH_PAIRS,
  TOP_V3_WETH_PAIRS,
  WETH_ADDRESS
} from './config/addresses'
import {
  HARD_PURGE,
  LIVE_MODE,
  MAX_ROUTE_NODES,
  MIN_ETH_ROUTE_THROUGHPUT,
  MIN_ROUTE_NODES
} from './config/config'
import { Executer } from './Executer'
import { MarketGraph } from './MarketGraph'
import { MarketV2Pair } from './MarketV2Pair'
import { MarketV3Pair } from './MarketV3Pair'
import { Route } from './Route'
import { RouteNode } from './RouteNode'

type SerializeableRoute = {
  marketAddress: string
  prevToken: string
}[]

export class Arbitrage {
  public get topRoutes(): Array<[Route, BigNumber, BigNumber]> {
    return this._topRoutes
  }
  public get allRoutes(): Array<Route> {
    return this._allRoutes
  }

  private _allRoutes: Array<Route>
  private _topRoutes: Array<[Route, BigNumber, BigNumber]>
  private _market: Array<MarketV2Pair | MarketV3Pair>
  private _marketGraph: MarketGraph

  constructor(
    market: Array<MarketV2Pair | MarketV3Pair>,
    marketGraph: MarketGraph
  ) {
    this._allRoutes = []
    this._market = market
    this._marketGraph = marketGraph
    this._topRoutes = []
    this.init()
  }

  private init(): void {
    console.log(chalk.gray('- Init Arbitrage'))
    if (!LIVE_MODE) {
      const allSerializedRoutes: Array<SerializeableRoute> = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../data/routes.json')).toString()
      )

      for (const sRoute of allSerializedRoutes) {
        const route = this.deserializeRoute(sRoute)
        if (!route) continue
        this._allRoutes.push(route)
      }
      console.log(chalk.gray(`- loaded ${this.allRoutes.length} routes`))
    } else {
      // Limit to selected WETH pairs for now
      const topWethPairs = _.filter(this._market, (pair) =>
        _.includes(
          [...TOP_V3_WETH_PAIRS, ...TOP_V2_WETH_PAIRS].map((address) =>
            address.toLocaleLowerCase()
          ),
          pair.marketAddress
        )
      )

      let i = 1
      console.log(chalk.gray(`- ${topWethPairs.length} starting nodes`))
      for (const startNode of topWethPairs) {
        const moreRoutes = this._marketGraph.getAllRoutesFromStartNode(
          startNode,
          WETH_ADDRESS,
          MIN_ROUTE_NODES,
          MAX_ROUTE_NODES
        )
        this._allRoutes.push(...moreRoutes)
        console.log(chalk.gray(`- #${i} added ${moreRoutes.length} routes`))
        i++
      }
      console.log(chalk.gray(`- ${this._allRoutes.length} routes found`))
    }

    this.removeMinETHRoutes()
    this.deepSort()
    if (HARD_PURGE) {
      this.hardPurge()
    }
    this.serializeRoutes()
    console.log(
      chalk.gray('- Initiated with', this._allRoutes.length, 'Routes')
    )
  }

  public deepSort(): void {
    this.populateOptimalInputsDeep()
    this.sortAll()
  }

  public shallowSort(): void {
    this.sortShallow()
    this.populateOptimalInputsShallow()
    this.sortTop()
  }

  public populateOptimalInputsShallow(): void {
    this._topRoutes = _.chain(this._topRoutes)
      .map(([route], i) => {
        route.calculateOptimalInput()
        return [route, route.optimalInput.input, route.optimalInput.profit]
      })
      .value() as [Route, BigNumber, BigNumber][]
  }

  private sortTop(): void {
    this._topRoutes = _.chain(this._topRoutes)
      .sort((a, b) => {
        const [, , aProfit] = a
        const [, , bProfit] = b
        return aProfit.gt(bProfit) ? -1 : aProfit.lt(bProfit) ? 1 : 0
      })
      .value()
  }

  private sortShallow(): void {
    this._allRoutes = _.chain(this._allRoutes)
      .forEach((route) => {
        route.refreshOptimalInput()
      })
      .sort((a, b) => {
        const aProfit = a.optimalInput.profit
        const bProfit = b.optimalInput.profit
        return aProfit.gt(bProfit) ? -1 : aProfit.lt(bProfit) ? 1 : 0
      })
      .value()

    this._topRoutes = _.chain(this._allRoutes)
      .take(100)
      .map((route) => [
        route,
        route.optimalInput.input,
        route.optimalInput.profit
      ])
      .value() as [Route, BigNumber, BigNumber][]
  }

  public populateOptimalInputsDeep(): void {
    // console.log(chalk.gray('- Populating Optimal Inputs'))
    this._allRoutes.forEach((route, i) => {
      if (i > 0 && i % 1000 == 0) {
        console.log(chalk.gray(`- ${i} done`))
      }
      route.calculateOptimalInput()
    })
    console.log(chalk.gray(`- ${this._allRoutes.length} done`))
  }

  private sortAll(): void {
    this._allRoutes = _.chain(this._allRoutes)
      .sort((a, b) => {
        const aProfit = a.optimalInput.profit
        const bProfit = b.optimalInput.profit
        return aProfit.gt(bProfit) ? -1 : aProfit.lt(bProfit) ? 1 : 0
      })
      .value()

    this._topRoutes = _.chain(this._allRoutes)
      .take(100)
      .map((route) => [
        route,
        route.optimalInput.input,
        route.optimalInput.profit
      ])
      .value() as [Route, BigNumber, BigNumber][]
  }

  private removeMinETHRoutes(): void {
    this._allRoutes = _.chain(this._allRoutes)
      .filter((route) =>
        route
          .getOutput(MIN_ETH_ROUTE_THROUGHPUT)
          .gt(MIN_ETH_ROUTE_THROUGHPUT.mul(50).div(100))
      )
      .value()
  }

  private hardPurge(): void {
    this._allRoutes = _.take(
      this._topRoutes.map((topRoute) => topRoute[0]),
      5
    )
  }

  private serializeRoutes(): void {
    const serializeableRoutes: Array<SerializeableRoute> = []
    for (const route of this._allRoutes) {
      const serializedRoute: SerializeableRoute = _.map(
        route.routeNodes,
        (node) => ({
          marketAddress: node.pair.marketAddress,
          prevToken: node.prevToken
        })
      ) as SerializeableRoute
      serializeableRoutes.push(serializedRoute)
    }
    fs.writeFileSync(
      path.join(__dirname, '../data/routes.json'),
      JSON.stringify(serializeableRoutes)
    )
  }

  private deserializeRoute(sRoute: SerializeableRoute): Route | undefined {
    const nuked = Executer.getNuked()

    const routeNodes: Array<RouteNode> = []
    let currentNode: RouteNode | undefined = undefined
    let lastNode: RouteNode | undefined = undefined
    for (const sNode of sRoute) {
      const pair = this._market.find(
        (pair) => pair.marketAddress === sNode.marketAddress
      )
      if (!pair) {
        console.log(
          'NO PAIR FOUND from serialized route searched',
          sNode.marketAddress
        )
        break
      }
      currentNode = new RouteNode(pair, lastNode, sNode.prevToken)
      if (lastNode) {
        lastNode.next = currentNode
      }
      routeNodes.push(currentNode)
      lastNode = currentNode
    }

    return !nuked.includes(Route.generateIdentifier(routeNodes))
      ? new Route(routeNodes)
      : undefined
  }
}
