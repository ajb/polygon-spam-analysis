const chalk = require('chalk')
const ethers = require('ethers')
const filter = require('lodash.filter')
const reduce = require('lodash.reduce')
const uniq = require('lodash.uniq')
const compact = require('lodash.compact')

const START_BLOCK = 23565100
const END_BLOCK = 23565200
const SPAM_CUTOFF = 5

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
      const isSpam = filter(block.transactions, t => t.to === address).length > SPAM_CUTOFF

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
    spamRates.push(spamRate)
    console.log(chalk.bold(`Block ${i}, found ${spam} spam txs, ${total} total transactions. Spam rate ${spamRate}%`))
    console.log('')
  }

  provider._websocket.close()

  const sum = reduce(spamRates, function (sum, a) { return sum + a }, 0)
  const avg = Math.round(sum / spamRates.length)
  console.log('')
  console.log(chalk.bold(`Analyzed ${spamRates.length} blocks. Average spam rate ${avg}%`))
}

main()
