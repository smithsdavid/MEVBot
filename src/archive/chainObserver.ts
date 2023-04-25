import { ethers } from 'hardhat'
import sushi from '@sushiswap/sushi-data'
import { ApolloClient, InMemoryCache, gql } from '@apollo/client'

import 'dotenv/config'

async function main() {
  const APIURL = 'https://api.studio.thegraph.com/query//<SUBGRAPH_NAME>/'

  const tokensQuery = gql`
    query {
      tokens {
        id
        tokenID
        contentURI
        metadataURI
      }
    }
  `

  const client = new ApolloClient({
    uri: APIURL,
    cache: new InMemoryCache()
  })

  client
    .query({
      query: tokensQuery
    })
    .then((data) => console.log('Subgraph data: ', data))
    .catch((err) => {
      console.log('Error fetching data: ', err)
    })
  // const sushiPairs = await sushi.exchange.pairs()
  // console.log('sushiPairs', sushiPairs)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
