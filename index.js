const fs = require('fs')
const path = require('path')
const delay = require('delay')
const axios = require('axios')
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
  '0xF715bEb51EC8F63317d66f491E37e7BB048fCc2d', // 0x something
  '0x2953399124F0cBB46d2CbACD8A89cF0599974963', // opensea
  '0xdf9B4b57865B403e08c85568442f95c26b7896b0', // sunflower
  '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // qs router
  '0x58a15701ED1aD95BBa625A05f41e50dCE62aA14e', // microbuddies
  '0x1a1ec25DC08e98e5E93F1104B5e5cdD298707d31', // metamask router
  '0xDef1C0ded9bec7F1a1670819833240f027b25EfF', // 0x
  '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // wmatic
  '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' // weth
]

const polygonscan = axios.create({
  baseURL: 'https://api.polygonscan.com/',
  timeout: 5000,
  params: { apikey: process.env.POLYGONSCAN_API_KEY }
})

const verifiedCache = {}
async function contractVerified (address) {
  if (typeof verifiedCache[address] !== 'undefined') return verifiedCache[address]

  process.stdout.write(chalk.dim(`Checking to see if ${address} has a verified source...`))

  await delay(200)
  const resp = await polygonscan.get('/api', {
    params: {
      module: 'contract',
      action: 'getabi',
      address: address
    }
  })

  verifiedCache[address] = resp.data && resp.data.status === '1'
  console.log(chalk.dim(verifiedCache[address]))
  return verifiedCache[address]
}

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
        const verified = await contractVerified(address)
        if (verified) continue
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
