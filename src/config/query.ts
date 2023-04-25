import gql from 'graphql-tag'

export type V3_RESULTS = {
  data: {
    data: {
      pools: { id: string; token0: { id: string }; token1: { id: string } }[]
    }
  }
}

export type POOL_OR_PAIR_RESULT = {
  id: string
  feeTier?: string
  reserve0?: string
  reserve1?: string
  token0: { id: string }
  token1: { id: string }
}

export const QUERY_V3_POOLS = `
  query Pools($skip: Int!, $batchSize: Int!, $txCount: Int!) {
    pools(
      skip: $skip
      first: $batchSize
      orderBy: txCount
      orderDirection: desc
      where: { liquidity_gt: 10000, txCount_gt: $txCount }
    ) {
      id
      feeTier
      token0 {
        id
      }
      token1 {
        id
      }
    }
  }
`

export const QUERY_V2_POOLS = `
  query Pairs($skip: Int!, $batchSize: Int!, $txCount: Int!) {
    pairs(
      skip: $skip
      first: $batchSize
      orderBy: txCount
      orderDirection: desc
      where: { txCount_gt: $txCount }
    ) {
      id
      reserve0
      reserve1
      token0 {
        id
      }
      token1 {
        id
      }
    }
  }
`

export const QUERY_TOKENS = `
    query Tokens($skip: Int!, $batchSize: Int!) {
      tokens(skip: $skip, first: $batchSize) {
        id
        symbol
        name
        decimals
      }
    }
`
