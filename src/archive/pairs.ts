import sushi from '@sushiswap/sushi-data'

export const generatePossiblePaths = (
  aTokenSymbol: string,
  intraPairs: sushi.exchange.Pair[]
) =>
  intraPairs
    .map((p) => [
      [aTokenSymbol, p.token0.symbol, p.token1.symbol, aTokenSymbol],
      [aTokenSymbol, p.token1.symbol, p.token0.symbol, aTokenSymbol]
    ])
    .flat(1)

export const getSymbolsTradeableWithToken = (
  aTokenSymbol: string,
  pairs: sushi.exchange.Pair[]
) =>
  pairs.map((p) =>
    p.token0.symbol === aTokenSymbol ? p.token1.symbol : p.token0.symbol
  )

export const getPairsWithSymbols = (
  allowedIntras: string[],
  pairs: sushi.exchange.Pair[]
) =>
  pairs.filter(
    (p) =>
      allowedIntras.includes(p.token0.symbol) &&
      allowedIntras.includes(p.token1.symbol)
  )

export const getPair = (
  symbols: [string, string],
  pairs: sushi.exchange.Pair[]
) => getPairWithHighestLiquidity(getPairsWithSymbols(symbols, pairs))

const getPairWithHighestLiquidity = (pairs: sushi.exchange.Pair[]) => {
  if (pairs.length <= 0) {
    throw new Error('No pairs provided')
  }

  let returnMatch: sushi.exchange.Pair = pairs[0]

  // get match with greatest liquidity
  pairs.forEach((p) => {
    if (!returnMatch) {
      returnMatch = p
    } else {
      if (returnMatch.reserveUSD < p.reserveUSD) {
        returnMatch = p
      }
    }
  })

  return returnMatch
}

export const filterPairsBySingleToken = (
  symbol: string,
  pairs: sushi.exchange.Pair[]
) =>
  pairs.filter((p) => p.token0.symbol === symbol || p.token1.symbol === symbol)

export const getAllPairAboveUSD = async (minUSDReserve: number) =>
  (await sushi.exchange.pairs()).filter((p) => p.reserveUSD >= minUSDReserve)
