#!/usr/bin/env bash
# Check actual deployed configuration; no sign-in token or API key is printed.
set -euo pipefail
studio_url="${1:-https://iksmain.gg220962.workers.dev}"
curl --fail --silent --show-error "${studio_url%/}/api/account/config" | python3 -c '
import json, sys
config = json.load(sys.stdin).get("firebase")
if not config or not all(config.get(key) for key in ("apiKey", "projectId", "authDomain")):
    sys.exit("FAIL: Firebase sign-in configuration is missing from the deployed Worker")
print("PASS: deployed Firebase sign-in configuration is available")
'
