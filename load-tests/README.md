# Race Rewind Load Tests

This directory contains a k6 workload for estimating how many anonymous users the current production server can handle.

## Install k6

Install k6 on the machine that will generate traffic:

```bash
sudo apt update
sudo apt install gpg ca-certificates
curl https://dl.k6.io/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update
sudo apt install k6
```

## Run

Smoke test first:

```bash
PROFILE=smoke pnpm load:test
```

Then run the real ramp:

```bash
PROFILE=ramp pnpm load:test
```

For a pre-release stress pass:

```bash
PROFILE=stress pnpm load:test
```

For a viral-post simulation into tens of thousands of concurrent browsing users:

```bash
PROFILE=viral pnpm load:test
```

The default target is `https://racerewind.org`. Override it when needed:

```bash
BASE_URL=https://example.com PROFILE=smoke pnpm load:test
```

Save a machine-readable result:

```bash
PROFILE=ramp k6 run --summary-export load-tests/results-ramp.json load-tests/racerewind.k6.js
```

## Reading Results

The profiles ramp to these virtual-user levels:

- `smoke`: 5 VUs.
- `baseline`: 10 VUs.
- `ramp`: 100, 250, 500, 1000, 2500, 5000 VUs.
- `stress`: `ramp` plus 7500, 10000, 15000, 20000 VUs.
- `viral`: 1000, 5000, 10000, 20000, 30000, 50000 VUs.

At these sizes, the load generator may fail before the site does. If CPU, memory, network, or open-file limits on the machine running k6 are saturated while the VPS still looks healthy, rerun from a larger cloud VM or split the same profile across multiple generators.

Use the highest completed stage that meets these limits as the maximum sustainable concurrency:

- `http_req_failed` below 1%.
- Static page p95 below 1000 ms.
- SSR page p95 below 2000 ms.
- No repeated timeouts, connection resets, or container restarts.
- Hetzner/Coolify CPU and memory are not pinned for the full stage.

Record Coolify or Hetzner CPU and memory manually during every 5 minute hold. If latency jumps while CPU is pinned, the VPS is the likely bottleneck. If CPU is low but latency climbs, check network, proxy, database file I/O, and cache behavior.

Stop the run once any of these persist:

- `http_req_failed` above 5%.
- p95 above 5000 ms.
- repeated request timeouts.
- Coolify shows restarts or memory pressure.

The report should separate:

- Comfortable concurrency: good latency and visible headroom.
- Maximum sustainable concurrency: last stage before failure criteria.
- Failure point: first stage where response time or errors became unacceptable.
