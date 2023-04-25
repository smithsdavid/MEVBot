import { ethers } from 'hardhat'

export function getRawTx(tx) {
  try {
    if (tx['type'] == 2) {
      tx['gasPrice'] = null
    }

    function addKey(accum, key) {
      if (tx[key] !== null && tx[key] !== undefined) {
        accum[key] = tx[key]
      }
      return accum
    }

    // Extract the relevant parts of the transaction and signature
    const txFields =
      'accessList chainId data gasPrice gasLimit maxFeePerGas maxPriorityFeePerGas nonce to type value'.split(
        ' '
      )
    const sigFields = 'v r s'.split(' ')

    // Seriailze the signed transaction
    const raw = ethers.utils.serializeTransaction(
      txFields.reduce(addKey, {}),
      sigFields.reduce(addKey, {})
    )

    // Double check things went well
    if (ethers.utils.keccak256(raw) !== tx.hash) {
      throw new Error('serializing failed!')
    }

    return raw
  } catch (e) {
    console.log(tx)
    console.log(e.message)
  }
}

// sign own bundle then Transactions.txs.push(rawTransaction) adds tx from other to bundle
