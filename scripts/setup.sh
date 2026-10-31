#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
npm --cache /tmp/gkd-npm-cache ci --ignore-scripts --no-audit --no-fund
npm test
npm run sync
npm run plan
