export const UNISWAP_QUERY_ABI = [
  {
    inputs: [
      {
        internalType: 'contract UniswapV2Factory',
        name: '_uniswapFactory',
        type: 'address'
      },
      { internalType: 'uint256', name: '_start', type: 'uint256' },
      {
        internalType: 'uint256',
        name: '_stop',
        type: 'uint256'
      }
    ],
    name: 'getPairsByIndexRange',
    outputs: [{ internalType: 'address[3][]', name: '', type: 'address[3][]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'contract IUniswapV2Pair[]',
        name: '_pairs',
        type: 'address[]'
      }
    ],
    name: 'getReservesByPairs',
    outputs: [{ internalType: 'uint256[3][]', name: '', type: 'uint256[3][]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'contract IUniswapV2Pair[]',
        name: '_pairs',
        type: 'address[]'
      },
      {
        internalType: 'contract IUniswapV3Pair[]',
        name: '_pairs',
        type: 'address[]'
      }
    ],
    name: 'getSqrtsAndReservesByPairs',
    outputs: [
      { internalType: 'address[3][]', name: '', type: 'address[3][]' },
      { internalType: 'uint256[2][]', name: '', type: 'uint256[2][]' },
      { internalType: 'uint256[2][]', name: '', type: 'uint256[2][]' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
]
