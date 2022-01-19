const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const ethers = require('ethers')

const START_BLOCK = parseInt(process.env.START_BLOCK, 10)
const END_BLOCK = parseInt(process.env.END_BLOCK, 10)
const TOTAL_BLOCKS = END_BLOCK - START_BLOCK

async function main () {
  const provider = new ethers.providers.WebSocketProvider(process.env.POLYGON_RPC_WS)

  const baseFees = []

  for (let i = START_BLOCK; i < END_BLOCK; i++) {
    process.stdout.clearLine()
    process.stdout.cursorTo(0)
    process.stdout.write(chalk.blue.underline(`${i - START_BLOCK + 1}/${TOTAL_BLOCKS} Checking block ${i}`))
    const block = await provider.getBlock(i)
    baseFees.push([
      block.number,
      block.baseFeePerGas.toString(),
      block.gasUsed.toString(),
      block.gasLimit.toString(),
      block.gasUsed.mul(100).div(block.gasLimit).toString()
    ])
  }

  const baseFeesCsv = [
    'block,basefee,gasused,gaslimit,targetpercent',
    ...baseFees.map(b => b.join(','))
  ].join('\n')

  const fp = path.join(__dirname, 'out', 'basefees', `${START_BLOCK}-${END_BLOCK}.csv`)
  fs.writeFileSync(fp, baseFeesCsv, 'utf-8')

  console.log('')
  console.log(chalk.green(`Done! Wrote to ${fp}`))

  provider._websocket.close()
}

main()
