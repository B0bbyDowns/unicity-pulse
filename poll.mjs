// poll.mjs — samples the Unicity mainnet gateway and appends one record to data.json.
// Runs headless in GitHub Actions. Node 20+ (uses the built-in global fetch).
//
// One request per shard per run: get_block(blockNumber:"latest", shardId:<prefix>).
// That returns the tip block for each shard — its height (index), creation time,
// root hash, and the commitment count (real usage) in that block. Cheap and
// respectful of the public gateway: 4 small POSTs per run, nothing walked.

import { readFile, writeFile } from 'node:fs/promises';

const GATEWAY = 'https://gateway.mainnet.unicity.network/';
// bftShardPrefixes, straight from the gateway's own config. If the network
// re-shards, update this list and nothing else needs to change.
const SHARDS = ['00', '01', '10', '11'];
const DATA_FILE = new URL('./data.json', import.meta.url);
const MAX_HISTORY = 40000; // keep file bounded; ~2+ years at 30-min cadence

async function getLatest(shard, id) {
  const res = await fetch(GATEWAY, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'get_block',
      params: { blockNumber: 'latest', shardId: shard },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(JSON.stringify(json.error));
  const b = (json.result && json.result.block) || {};
  return {
    shard,
    index: Number(b.index),
    createdAt: Number(b.createdAt),
    commitments: Number((json.result && json.result.totalCommitments) || 0),
    rootHash: b.rootHash || '',
  };
}

async function main() {
  const now = Date.now();
  const shards = {};
  let healthy = 0;

  for (let i = 0; i < SHARDS.length; i++) {
    const s = SHARDS[i];
    try {
      const r = await getLatest(s, i + 1);
      shards[s] = r;
      if (Number.isFinite(r.index)) healthy++;
    } catch (e) {
      shards[s] = { shard: s, error: String((e && e.message) || e) };
    }
  }

  let data;
  try {
    data = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  } catch {
    data = { history: [] };
  }
  if (!Array.isArray(data.history)) data.history = [];

  // Compact history record: { t, "<shard>": [index, commitments] | null }
  const rec = { t: now };
  for (const s of SHARDS) {
    const r = shards[s];
    rec[s] = r && Number.isFinite(r.index) ? [r.index, r.commitments] : null;
  }
  data.history.push(rec);
  if (data.history.length > MAX_HISTORY) {
    data.history = data.history.slice(-MAX_HISTORY);
  }

  data.latest = { t: now, shards, healthy, shardCount: SHARDS.length };
  data.shardOrder = SHARDS;
  data.gateway = GATEWAY;

  await writeFile(DATA_FILE, JSON.stringify(data));
  console.log(`polled ${new Date(now).toISOString()} — ${healthy}/${SHARDS.length} shards ok`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
