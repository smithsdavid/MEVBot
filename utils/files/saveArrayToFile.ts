import * as fs from 'fs'
import path from 'path'

export const saveDataToFile = (pairs: any, filename: string) => {
  fs.writeFileSync(
    path.join(__dirname, `../../data/${filename}.json`),
    JSON.stringify(pairs)
  )
}
