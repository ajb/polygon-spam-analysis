Polygon spam analysis
====

Read more about my thoughts on Polygon MEV spam here: https://github.com/maticnetwork/bor/pull/292

## To run the analysis

- `npm install`
- `START_BLOCK=XXXXXXXXX END_BLOCK=XXXXXXX node index.js`

Files will be written to the `out/` directory.

## Heuristics

Currently marking as spam any contract with an unverified source (on Polygonscan) that receives >= 5 calls within the same block. I have annotated some of the biggest spammers in the `data/` directory, so that you can assess the accuracy of this automated labeling.

