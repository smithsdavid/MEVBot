import 'dotenv/config'
import { updateBalances } from './shared/updateBalances.1'

async function main() {
  await updateBalances()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error)
    process.exit(1)
  })
