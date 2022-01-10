const chalk = require('chalk')
const ethers = require('ethers')
const delay = require('delay')
const axios = require('axios')
const uniq = require('lodash.uniq')
const compact = require('lodash.compact')

const START_BLOCK = 23565146
const END_BLOCK = 23565149
const SPAM_CUTOFF = 5

async function main () {
  const polygonscan = axios.create({
    baseURL: 'https://api.polygonscan.com/',
    timeout: 5000,
    params: { apikey: process.env.POLYGONSCAN_API_KEY }
  })

  const provider = new ethers.providers.WebSocketProvider(process.env.POLYGON_RPC_WS)

  for (let i = START_BLOCK; i < END_BLOCK; i++) {
    console.log(chalk.blue.underline(`Checking block ${i}`))
    let total = 0
    let spam = 0
    const spammersInBlock = {}

    const block = await provider.getBlockWithTransactions(i)
    const txTos = compact(block.transactions.map(tx => tx.to))

    for (const address of uniq(txTos)) {
      await delay(200) // polygonscan rate limit?
      console.log(chalk.dim(`checking address ${address}`))
      const resp = await polygonscan.get('/api', {
        params: {
          module: 'account',
          action: 'txlist',
          address: address,
          startblock: i,
          endblock: i,
          page: 1,
          offset: 100
        }
      })

      if (!resp.data || resp.data.status !== '1') {
        console.log(chalk.red('unexpected response from polygonscan'))
        continue
      }

      if (resp.data.result.length > SPAM_CUTOFF) {
        spammersInBlock[address] = true
        console.log(chalk.red(`found block spammer ${address}`))
      }
    }

    for (const tx of block.transactions) {
      total += 1
      if (tx.to && spammersInBlock[tx.to]) spam += 1
    }

    console.log(chalk.bold(`Block ${i}, found ${spam} spam txs, ${total} total transactions. Spam rate ${Math.round(spam / total * 100)}%`))
    console.log('')
  }

  provider._websocket.close()
}

main()
