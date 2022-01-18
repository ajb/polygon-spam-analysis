const chalk = require('chalk')
const ethers = require('ethers')
const BigNumber = require('bignumber.js')
const reduce = require('lodash.reduce')

const START_BLOCK = parseInt(process.env.START_BLOCK, 10)
const END_BLOCK = parseInt(process.env.END_BLOCK, 10)
const TOTAL_BLOCKS = END_BLOCK - START_BLOCK

async function main () {
  const provider = new ethers.providers.WebSocketProvider(process.env.POLYGON_RPC_WS)

  const gasLimits = []
  const gasUseds = []

  for (let i = START_BLOCK; i < END_BLOCK; i++) {
    process.stdout.clearLine()
    process.stdout.cursorTo(0)
    process.stdout.write(chalk.blue.underline(`${i - START_BLOCK + 1}/${TOTAL_BLOCKS} Checking block ${i}`))
    const block = await provider.getBlock(i)
    gasLimits.push(BigNumber(block.gasLimit.toString()))
    gasUseds.push(BigNumber(block.gasUsed.toString()))
  }

  const gasLimitSum = reduce(gasLimits, function (sum, l) {
    return BigNumber.sum(sum, l)
  }, BigNumber(0))

  const gasUsedSum = reduce(gasUseds, function (sum, l) {
    return BigNumber.sum(sum, l)
  }, BigNumber(0))

  const averageGasLimit = gasLimitSum.div(gasLimits.length).shiftedBy(-6).toFixed() + 'm'
  const averageGasUsed = gasUsedSum.div(gasUseds.length).shiftedBy(-6).toFixed() + 'm'

  console.log('')
  console.log({
    START_BLOCK,
    END_BLOCK,
    averageGasLimit,
    averageGasUsed
  })

  provider._websocket.close()
}

main()
