import _ from 'lodash'
import { MarketV2Pair } from './MarketV2Pair'
import { MarketV3Pair } from './MarketV3Pair'
import { RouteNode } from './RouteNode'
import util from 'util'
import { Route } from './Route'
import { delay } from '../utils/delay'
import { Executer } from './Executer'
import chalk from 'chalk'
import { clearLastLine } from '../utils/console/clearLastLine'

export class MarketGraph {
  public get graph(): Map<string, Array<MarketV2Pair | MarketV3Pair>> {
    return this._graph
  }

  public getNode(
    pairAddress: string
  ): Array<MarketV2Pair | MarketV3Pair> | undefined {
    return this._graph.get(pairAddress.toLowerCase())
  }

  private _graph: Map<string, Array<MarketV2Pair | MarketV3Pair>>

  constructor(markets: Array<MarketV2Pair | MarketV3Pair>) {
    this._graph = new Map<string, Array<MarketV2Pair | MarketV3Pair>>()
    this.initializeGraph(markets)
  }

  private initializeGraph(markets: Array<MarketV2Pair | MarketV3Pair>): void {
    for (const pair of markets) {
      this.addNode(pair)

      const token0Markets = _.filter(
        markets,
        (comPair) =>
          _.includes(comPair.tokens, pair.tokens[0]) &&
          !_.isEqual(comPair.marketAddress, pair.marketAddress)
      )

      const token1Markets = _.filter(
        markets,
        (comPair) =>
          _.includes(comPair.tokens, pair.tokens[1]) &&
          !_.isEqual(comPair.marketAddress, pair.marketAddress)
      )

      _.forEach(token0Markets, (comPair) => this.addEdge(pair, comPair))
      _.forEach(token1Markets, (comPair) => this.addEdge(pair, comPair))
    }
  }

  private addNode(pair: MarketV2Pair | MarketV3Pair): void {
    const { marketAddress } = pair

    if (!this._graph.has(marketAddress)) {
      this._graph.set(marketAddress.toLowerCase(), [])
    }
  }

  private addEdge(
    pair: MarketV2Pair | MarketV3Pair,
    edgePair: MarketV2Pair | MarketV3Pair
  ): void {
    if (!this._graph.has(pair.marketAddress)) {
      this.addNode(pair)
    }

    if (!this._graph.has(edgePair.marketAddress)) {
      this.addNode(edgePair)
    }

    const isInPairAlready = _.includes(
      this._graph.get(pair.marketAddress)?.map((pair) => pair.marketAddress),
      edgePair.marketAddress
    )

    const isInEdgePairAlready = _.includes(
      this._graph
        .get(edgePair.marketAddress)
        ?.map((pair) => pair.marketAddress),
      pair.marketAddress
    )

    if (!isInPairAlready) {
      this._graph.get(pair.marketAddress)!.push(edgePair)
    }
    if (!isInEdgePairAlready) {
      this._graph.get(edgePair.marketAddress)!.push(pair)
    }
  }

  public getAllRoutesBetweenTwoNodes(
    startNode: MarketV2Pair | MarketV3Pair,
    endNode: MarketV2Pair | MarketV3Pair,
    startEndToken: string,
    minEdges: number = 0,
    maxEdges: number = 3
  ): Array<Route> {
    let allRoutes: Array<Route> = []
    startEndToken = startEndToken.toLowerCase()

    console.log('from', startNode.marketAddress, 'to', endNode.marketAddress)

    if (
      !_.includes(startNode.tokens, startEndToken) ||
      !_.includes(endNode.tokens, startEndToken)
    ) {
      throw new Error('Token used for entry & exit does not exist on end-nodes')
    }

    const queue: Array<Array<RouteNode>> = [
      [new RouteNode(startNode, undefined, startEndToken)]
    ]

    while (queue.length > 0) {
      const route = queue.shift()!
      const lastNode = route[route.length - 1]

      let connections = lastNode.nextPossibleConnections(this)
      if (!connections) continue

      for (const pair of connections) {
        const thisNode = new RouteNode(pair, lastNode, lastNode.nextToken)
        const newRoute = [..._.cloneDeep(route), thisNode]
        lastNode.next = thisNode

        if (thisNode.pair.marketAddress === endNode.marketAddress) {
          // if route establishes with token that I do not want to exit with it is correct
          if (!_.isEqual(thisNode.prevToken, startEndToken)) {
            if (newRoute.length >= minEdges) {
              allRoutes.push(new Route(newRoute))
            }
          }
        }

        if (newRoute.length < maxEdges) {
          queue.push(newRoute)
        }
      }
    }

    console.log(
      'getAllRoutesBetweenTwoNodes routes found: ',
      allRoutes.length,
      '\n'
    )

    return allRoutes
  }

  public getAllRoutesFromStartNode(
    startNode: MarketV2Pair | MarketV3Pair,
    startEndToken: string,
    minEdges: number = 0,
    maxEdges: number = 3
  ): Array<Route> {
    const nuked = Executer.getNuked()
    let allRoutes: Array<Route> = []
    startEndToken = startEndToken.toLowerCase()

    if (!_.includes(startNode.tokens, startEndToken)) {
      throw new Error('Token used for entry & exit does not exist on end-nodes')
    }

    const queue: Array<Array<RouteNode>> = [
      [new RouteNode(startNode, undefined, startEndToken)]
    ]

    while (queue.length > 0) {
      // console.log('in queue: ', queue.length)
      // clearLastLine()
      const route = queue.shift()!
      const lastNode = route[route.length - 1]

      let connections = lastNode.nextPossibleConnections(this)
      if (!connections) continue

      for (const pair of connections) {
        const thisNode = new RouteNode(pair, lastNode, lastNode.nextToken)
        const newRoute = [..._.cloneDeep(route), thisNode]
        lastNode.next = thisNode

        if (_.isEqual(thisNode.nextToken, startEndToken)) {
          if (
            newRoute.length >= minEdges &&
            !nuked.includes(Route.generateIdentifier(newRoute))
          ) {
            const route = new Route(newRoute)
            allRoutes.push(route)
            allRoutes.push(route.reverse())
          }
        }

        if (newRoute.length < maxEdges) {
          queue.push(newRoute)
        }
      }
    }
    return allRoutes
  }
}
