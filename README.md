# Fraction Quest

A static web app (no server code, no database, no outside requests) for practicing fractions. It installs on an
iPad like an app and works offline. Live at <https://fraction-quest-606.pages.dev/>, hosted on Cloudflare Pages.

## Layout

| Path | What it is |
| --- | --- |
| `src/` | App sources: `body.html`, `style.css`, `glass.css`, and the script parts `core.js`, `st_a.js` … `st_d.js` |
| `fonts.css`, `sw.template.js` | Font-face declarations and the service-worker template that the build stamps with a version |
| `build_cf.py` | Turns `src/` into `public/` (`index.html`, `app.js`, `app.css`, `sw.js`). Runs `node --check` on the bundle and refuses inline event handlers that the CSP would block |
| `public/` | Exactly what gets deployed. Icons, fonts, `_headers`, and `manifest.webmanifest` are committed; the four generated files are not (see `.gitignore`) and are rebuilt on every deploy |
| `wrangler.toml` | Pages project name and output directory. Single source of truth for the project name |
| `package.json` | Pins the wrangler version used by CI and `deploy.sh` |
| `.github/workflows/deploy.yml` | Build and deploy automation |

## How deployment works

The Pages project was created with wrangler direct upload, so deployments are pushed from GitHub Actions
(not the Pages Git integration, which cannot be enabled on a direct-upload project).

- **Push to `main`** builds `public/` and deploys it as the production branch. Live within about a minute.
- **Pull request** from this repository builds and deploys a preview at `https://<branch>.fraction-quest-606.pages.dev`.
  The workflow comments the preview URL on the PR and keeps that one comment updated.
- **Pull request from a fork** is built only (forks cannot see the Cloudflare secrets).
- **Manual run** via the Actions tab (`workflow_dispatch`) deploys the selected branch.

One deployment runs per branch at a time; a newer push cancels an in-flight run for the same branch.

Each build hashes the sources into a version string that is appended to `app.js` and `app.css` and used as the
service-worker cache name, so an installed iPad app picks up a new build the next time it opens with a connection
and discards the old cache.

### One-time setup (repository secrets)

In GitHub: Settings > Secrets and variables > Actions > New repository secret.

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token with **Account > Cloudflare Pages > Edit** on the account that owns the project. Nothing else. |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID from the Cloudflare dashboard (Workers & Pages overview, right-hand column). |

Never commit either value. The workflow fails fast with a clear message if they are missing.

The Pages project's production branch must be `main` (that is how `deploy.sh` created it). If it was renamed,
either rename it back in the Cloudflare dashboard or change the `branches:` filter in the workflow to match.

### Dependency updates

Dependabot opens weekly PRs for the GitHub Actions and for wrangler. wrangler is pinned exactly in
`package.json`, so each bump is a reviewed PR with a preview deploy rather than an implicit upgrade.

## Working locally

Needs Python 3.11+ and Node.js 22+.

```bash
npm ci                     # installs the pinned wrangler
python3 build_cf.py        # builds public/
npx wrangler pages dev public   # serves the built site on http://localhost:8788
```

Edit files in `src/`, rebuild, and reload. The service worker only registers on https or localhost.

### Manual deploy from a workstation

CI is the normal path. For an emergency or a one-off preview:

```bash
npx wrangler login                  # once, browser OAuth; or export CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
./deploy.sh                         # build + deploy as production (main)
BRANCH=my-feature ./deploy.sh       # build + deploy as a preview
```

## Put it on the iPad

1. Open the address in Safari.
2. Share > Add to Home Screen.
3. Always launch it from the Home Screen icon. It opens full screen, and after the first launch it works offline.

## Good to know

- **Progress lives on the iPad only**, saved per web address. The Home Screen app keeps its own storage, separate
  from a Safari tab, and a preview deployment is a different address with its own empty progress.
- **Privacy:** fonts are self-hosted, and `public/_headers` sets a Content-Security-Policy that blocks any request
  to another site. Nothing about the student leaves the device.
- **Fonts:** Lexend and Patrick Hand, both under the SIL Open Font License (texts in `public/fonts/`).
