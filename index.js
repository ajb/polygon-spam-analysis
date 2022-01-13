const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const chalk = require('chalk')
const ethers = require('ethers')
const filter = require('lodash.filter')
const reduce = require('lodash.reduce')
const uniq = require('lodash.uniq')
const compact = require('lodash.compact')
const { contractVerified, saveVerifiedCache } = require('./polygonscan')

const START_BLOCK = parseInt(process.env.START_BLOCK, 10)
const END_BLOCK = parseInt(process.env.END_BLOCK, 10)
const TOTAL_BLOCKS = END_BLOCK - START_BLOCK
const SPAM_CUTOFF = 5
const OUTPUT_PATH = path.join(__dirname, `./out/${START_BLOCK}-${END_BLOCK}/`)
mkdirp.sync(OUTPUT_PATH)

const OK_LIST = [
  '0x6e5Fa679211d7F6b54e14E187D34bA547c5d3fe0' // sunflower minter
]

async function main () {
  const provider = new ethers.providers.WebSocketProvider(process.env.POLYGON_RPC_WS)
  const spamRates = []
  const totalSpamCounts = []
  const eoas = {}

  for (let i = START_BLOCK; i < END_BLOCK; i++) {
    console.log(chalk.blue.underline(`${i - START_BLOCK + 1}/${TOTAL_BLOCKS} Checking block ${i}`))
    let total = 0
    let spam = 0
    const spammersInBlock = {}

    // get block with all transactions
    const block = await provider.getBlockWithTransactions(i)

    // find unique "to" addresses
    const txTos = compact(block.transactions.map(tx => tx.to))

    // for each "to" address, determine whether it is spam or not
    for (const address of uniq(txTos)) {
      const aboveCutoff = filter(block.transactions, t => t.to === address).length >= SPAM_CUTOFF && !OK_LIST.includes(address)

      if (aboveCutoff) {
        const verified = await contractVerified(address)
        if (verified) continue
        spammersInBlock[address] = true
        console.log(chalk.red(`found block spammer ${address}`))
      }
    }

    // for each tx in the block, we can now mark it as spam / not spam
    for (const tx of block.transactions) {
      if (!eoas[tx.from]) eoas[tx.from] = { address: tx.from, spamCount: 0, txCount: 0 }
      eoas[tx.from].txCount++

      total += 1
      if (tx.to && spammersInBlock[tx.to]) {
        eoas[tx.from].spamCount++
        if (!totalSpamCounts[tx.to]) totalSpamCounts[tx.to] = { to: tx.to, count: 0 }
        totalSpamCounts[tx.to].count += 1
        spam += 1
      }
    }

    // assemble a spamrate and save the block data
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

  // save the blocks data
  const blocksCsv = [
    'block,rate,spam,total',
    ...spamRates.map(s => `${s.block},${s.rate},${s.spam},${s.total}`)
  ].join('\n')
  fs.writeFileSync(path.join(OUTPUT_PATH, 'blocks.csv'), blocksCsv, 'utf-8')

  // save the spammers data
  const sortedSpamCounts = Object.values(totalSpamCounts).sort((a, b) => a.count > b.count ? -1 : 1)
  const spammersCsv = [
    'contract,numTransactions',
    ...sortedSpamCounts.map(c => `${c.to},${c.count}`)
  ].join('\n')
  fs.writeFileSync(path.join(OUTPUT_PATH, 'spammers.csv'), spammersCsv, 'utf-8')

  // save the EOAs
  const sortedEoas = Object.values(eoas).sort((a, b) => a.spamCount > b.spamCount ? -1 : 1)
  const eoasCsv = [
    'address,spamcount,txcount',
    ...sortedEoas.map(e => `${e.address},${e.spamCount},${e.txCount}`)
  ].join('\n')
  fs.writeFileSync(path.join(OUTPUT_PATH, 'eoas.csv'), eoasCsv, 'utf-8')

  // cache the verified contracts for next time
  saveVerifiedCache()
}

main()
