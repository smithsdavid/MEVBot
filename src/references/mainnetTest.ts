import { utils } from 'ethers'
import { getProvider } from '../../utils/getProvider'

const provider = getProvider()

const ETH_ACCOUNT_ADDRESS = ''
const CONTRACT_ADDRESS = ''
const RECIPIENT_ADDRESS = ''
const contract = { deployedBytecode: '' } // real contract instead

async function testNotDeployedContract() {
  await provider.send('eth_call', [
    {
      from: ETH_ACCOUNT_ADDRESS,
      to: CONTRACT_ADDRESS,
      data: iface.encodeFuntionalData('transfer', [
        RECIPIENT_ADDRESS,
        utils.parseEther('1.0')
      ])
    },
    'latest',
    {
      '0x42': {
        code: contract.deployedBytecode,
        stateDiff: {
          '0x0': ETH_ACCOUNT_ADDRESS //often 0 Slot is owner of contract
        }
      }
    }
  ])
}
