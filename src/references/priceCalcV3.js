function toPlainString(num) {
  return ('' + +num).replace(
    /(-?)(\d*)\.?(\d*)e([+-]\d+)/,
    function (a, b, c, d, e) {
      return e < 0
        ? b + '0.' + Array(1 - e - c.length).join(0) + c + d
        : b + c + d + Array(e - d.length + 1).join(0)
    }
  )
}

async function PairAddressV3(address0, address1, fee) {
  const Fact_Contract = new web3.eth.Contract(V3Factory, V3FactoryContract)
  let par = await Fact_Contract.methods
    .getPool(address0, address1, fee)
    .call({})
  return par
}

async function V3pairInfo(Toke0, Toke1, par, fee, Decs0, Decs1, Cblock) {
  //log(Cblock);
  let block = Cblock == 0 ? 'latest' : '0x' + Cblock.toString(16)
  log(block)
  const Pair_Contract = new web3.eth.Contract(PAIR3, par)
  let sqrtP = await Pair_Contract.methods.slot0().call(block)
  return [par, sqrtP[0], Toke0, Toke1, 10 ** Decs0, 10 ** Decs1]
}

async function GetPrice(T0, T1, pr, Pfee, decs0, decs1, Cblock) {
  // T0 = Token0, T1 = Token1, Pfee = pool fee, decs0 = decimals T0, decs1 = decimals T1
  let pairA = await V3pairInfo(T0, T1, pr, Pfee, decs0, decs1, Cblock) // Get sqrtPriceX96 from slot0 call on pool contract
  if (pairA[0] == '0x0000000000000000000000000000000000000000') {
    log('No Pair')
  }

  let sqrtPrice = web3.utils.toBN(pairA[1].toString()) // sqrtPriceX96 to bignumber
  let PriceC = sqrtPrice.mul(sqrtPrice) // sqrtPriceX96 * sqrtPriceX96
  let PriceB = PriceC.mul(web3.utils.toBN('1000000000000000000')) // above priceC * 1eth
  let Price2 = PriceB.shrn(96 * 2) // shift above priceB right 192

  let receive0 = web3.utils.toBN(pairA[4]).mul(Price2) // price2 * decimals token 0

  /* receive == Price of toknen 1 in relation to token 0*/
  let receive = receive0.div(web3.utils.toBN('1000000000000000000')) // above receive0 div by 1eth

  let mapping = web3.utils.unitMap // setup mapping for Decimals conversion
  let MapKey = '' // I'm sure better ways with math
  let MapKey0 = ''
  for (const key in mapping) {
    if (mapping[key] === pairA[5].toString()) {
      MapKey0 = key
    }
    if (mapping[key] === pairA[4].toString()) {
      MapKey = key
    }
  }

  /* ConvPrice == Price of toknen 1 in relation to token 0*/
  let ConvPrice = web3.utils.fromWei(receive.toString(), MapKey0)

  /* price == Price of token 0 in relation to token 1*/
  let price = parseInt(10 ** decs1) / parseInt(receive) //  above receive div by 1 token of token 1 10**decimals token1

  let pln = toPlainString(price) //  just converts into normal number. mostly useful for scientific notation
  log('Buy 1 token of token 0 with token 1')
  log(T0)
  log(ConvPrice.toString())
  log('But 1 token of token 1 with token 0')
  log(T1)
  log(pln)
}
