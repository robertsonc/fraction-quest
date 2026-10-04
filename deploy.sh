#!/usr/bin/env bash
# Builds (optionally) and deploys Fraction Quest to Cloudflare Pages from a workstation.
# CI uses .github/workflows/deploy.yml instead; this script is for manual or emergency deploys.
#
# Auth (pick one, never commit secrets):
#   - Interactive: run `npx wrangler login` once (browser OAuth).
#   - Headless: export CLOUDFLARE_API_TOKEN (scope: Account > Cloudflare Pages > Edit)
#     and CLOUDFLARE_ACCOUNT_ID in the environment.
#
# Usage: ./deploy.sh                       build, then deploy public/ as the production branch (main)
#        BRANCH=my-feature ./deploy.sh     deploy as a preview at https://my-feature.<project>.pages.dev
#        SKIP_BUILD=1 ./deploy.sh          deploy whatever is already in public/
#        PROJECT=other-name ./deploy.sh    target a different Pages project (default comes from wrangler.toml)
set -euo pipefail
cd "$(dirname "$0")"

# wrangler is pinned once, in package.json, and read from there so every path uses the same version.
WRANGLER_VERSION="$(node -p "require('./package.json').devDependencies.wrangler")"
WRANGLER=(npx --yes "wrangler@${WRANGLER_VERSION}")
PROJECT="${PROJECT:-$(sed -n 's/^name *= *"\(.*\)"/\1/p' wrangler.toml)}"
BRANCH="${BRANCH:-main}"

if [[ -z "$PROJECT" ]]; then
  echo "Could not determine the Pages project name (set PROJECT or fix wrangler.toml)." >&2
  exit 1
fi

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  python3 build_cf.py
fi
if [[ ! -f public/index.html ]]; then
  echo "public/index.html is missing. Run python3 build_cf.py first." >&2
  exit 1
fi

# First deploy only: create the project with main as production. On later runs this fails because the
# project exists; that is expected, so it is reported and skipped. A real problem (auth, name) still
# surfaces in the deploy step below.
log="$(mktemp)"
trap 'rm -f "$log"' EXIT
if "${WRANGLER[@]}" pages project create "$PROJECT" --production-branch main >"$log" 2>&1; then
  echo "Created Pages project: $PROJECT"
else
  echo "Skipped project create (normally because '$PROJECT' already exists):" >&2
  tail -n 3 "$log" >&2
fi

"${WRANGLER[@]}" pages deploy ./public --project-name "$PROJECT" --branch "$BRANCH" --commit-dirty=true
