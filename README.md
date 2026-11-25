# Unicity Pulse

A community-run liveness & usage tracker for the Unicity alpha mainnet.

It reads straight from the public gateway (`gateway.mainnet.unicity.network`) and,
unlike a page that only shows "now", it **keeps a running history** — so the growth
over time is already there when you open it. No server, no database: a GitHub Action
samples the gateway on a schedule and commits the numbers to `data.json`, and GitHub
Pages serves the page.

```
unicity-pulse/
├─ index.html              the page (reads data.json + pings the gateway live)
├─ data.json               the recorded history (the Action appends to this)
├─ poll.mjs                the sampler (one get_block per shard, per run)
└─ .github/workflows/poll.yml   cron that runs poll.mjs and commits data.json
```

## How it works

- **Shards**: the gateway runs 4 BFT shards, addressed by the prefixes `00 01 10 11`
  (from the gateway's own config). Each produces blocks independently.
- **Each run**: `poll.mjs` POSTs `get_block` with `blockNumber: "latest"` for each shard,
  and records the block height (`index`), its timestamp, and `totalCommitments`
  (state transitions = real usage) in that block.
- **The page**: loads `data.json` for the history chart, then also pings the gateway
  live for up-to-the-second "now" numbers (falls back to the recorded values if the
  live call is blocked).

## Setup (no command line needed)

1. **Create a new _public_ repo** on GitHub — e.g. `unicity-pulse`.
2. **Upload these files**: on the repo page → **Add file ▸ Upload files** → drag in
   `index.html`, `data.json`, `poll.mjs`, and the `.github` folder (keep the folder
   structure) → **Commit**.
3. **Turn on Pages**: **Settings ▸ Pages** → *Build and deployment* → Source =
   **Deploy from a branch** → Branch = **main** / **/(root)** → **Save**.
4. **Let the Action write**: **Settings ▸ Actions ▸ General** → *Workflow permissions*
   → **Read and write permissions** → **Save**. *(The workflow also requests this, but
   setting it here avoids a first-run permission error.)*
5. **Seed it now**: **Actions** tab → if prompted, click to enable workflows → pick
   **poll-gateway** → **Run workflow**. That first run fills `data.json` so the page
   isn't empty.
6. Your tracker is live at **`https://<your-username>.github.io/unicity-pulse/`**.
   The history chart fills itself out every ~30 minutes from then on.

## Setup (git, if you prefer)

```bash
git init && git add . && git commit -m "init: unicity pulse"
git branch -M main
git remote add origin https://github.com/<your-username>/unicity-pulse.git
git push -u origin main
# then do steps 3–5 above in the GitHub UI
```

## Knobs

- **Polling cadence** — `.github/workflows/poll.yml`, the `cron` line. `*/30 * * * *`
  is every 30 min. GitHub's scheduler is best-effort and won't go below 5 min reliably.
- **Shard list** — `SHARDS` in `poll.mjs` (and the colors in `index.html`) if the
  network ever re-shards.
- **History cap** — `MAX_HISTORY` in `poll.mjs`.

> Note: GitHub disables scheduled workflows after ~60 days with no repo activity — one
> commit (or a manual run) wakes it back up.

Not affiliated with Unicity Labs. On-chain figures come from the public gateway as-is.
