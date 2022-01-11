const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const ethers = require('ethers')
const filter = require('lodash.filter')
const reduce = require('lodash.reduce')
const uniq = require('lodash.uniq')
const compact = require('lodash.compact')

const START_BLOCK = parseInt(process.env.START_BLOCK, 10)
const END_BLOCK = parseInt(process.env.END_BLOCK, 10)
const SPAM_CUTOFF = 5

const OK_LIST = [
  '0x2953399124F0cBB46d2CbACD8A89cF0599974963', // opensea
  '0xdf9B4b57865B403e08c85568442f95c26b7896b0', // sunflower
  '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff' // qs router
]

async function main () {
  const provider = new ethers.providers.WebSocketProvider(process.env.POLYGON_RPC_WS)
  const spamRates = []

  for (let i = START_BLOCK; i < END_BLOCK; i++) {
    console.log(chalk.blue.underline(`Checking block ${i}`))
    let total = 0
    let spam = 0
    const spammersInBlock = {}

    const block = await provider.getBlockWithTransactions(i)
    const txTos = compact(block.transactions.map(tx => tx.to))

    for (const address of uniq(txTos)) {
      const isSpam = filter(block.transactions, t => t.to === address).length >= SPAM_CUTOFF && !OK_LIST.includes(address)

      if (isSpam) {
        spammersInBlock[address] = true
        console.log(chalk.red(`found block spammer ${address}`))
      }
    }

    for (const tx of block.transactions) {
      total += 1
      if (tx.to && spammersInBlock[tx.to]) {
        spam += 1
      }
    }

    const spamRate = spam > 0 ? Math.round(spam / total * 100) : 0
    spamRates.push({ block: i, rate: spamRate, spam, total })
    console.log(chalk.bold(`Block ${i}, found ${spam} spam txs, ${total} total transactions. Spam rate ${spamRate}%`))
    console.log('')
  }

  provider._websocket.close()

  const sum = reduce(spamRates, function (sum, a) { return sum + a.rate }, 0)
  const avg = Math.round(sum / spamRates.length)
  console.log('')
  console.log(chalk.bold(`Analyzed ${spamRates.length} blocks. Average spam rate ${avg}%`))
  console.log('')
  console.log('')

  const csvArr = ['block,rate,spam,total']

  for (const s of spamRates) {
    csvArr.push(`${s.block},${s.rate},${s.spam},${s.total}`)
  }

  fs.writeFileSync(path.join(__dirname, './out.csv'), csvArr.join('\n'), 'utf-8')
}

main()
