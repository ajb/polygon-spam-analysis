const fs = require('fs')
const path = require('path')
const delay = require('delay')
const axios = require('axios')
const chalk = require('chalk')

const polygonscan = axios.create({
  baseURL: 'https://api.polygonscan.com/',
  timeout: 5000,
  params: { apikey: process.env.POLYGONSCAN_API_KEY }
})

const verifiedCachePath = path.join(__dirname, './out/verifiedCache.json')
let verifiedCache

if (fs.existsSync(verifiedCachePath)) {
  verifiedCache = JSON.parse(fs.readFileSync(verifiedCachePath, 'utf-8'))
} else {
  verifiedCache = {}
}

function saveVerifiedCache () {
  fs.writeFileSync(verifiedCachePath, JSON.stringify(verifiedCache), 'utf-8')
}

async function contractVerified (address, tryCount) {
  if (typeof verifiedCache[address] !== 'undefined') return verifiedCache[address]
  if (!tryCount) tryCount = 0
  tryCount++

  process.stdout.write(chalk.dim(`Checking to see if ${address} has a verified source...`))

  await delay(400)
  let resp
  try {
    resp = await polygonscan.get('/api', {
      params: {
        module: 'contract',
        action: 'getabi',
        address: address
      }
    })
  } catch (err) {
    console.error(chalk.red('polygonscan API error'))
    if (tryCount < 5) {
      await delay(2000)
      return contractVerified(address, tryCount) // retry after delay
    } else {
      saveVerifiedCache()
      throw new Error('cannot continue without polygonscan')
    }
  }

  verifiedCache[address] = resp.data && resp.data.status === '1'
  console.log(chalk.dim(verifiedCache[address]))
  return verifiedCache[address]
}

module.exports = {
  contractVerified,
  saveVerifiedCache
}
