# Fraction Quest

A static web app (no server code, no database, no outside requests) for practicing fractions. It installs on an
iPad like an app and works offline. Live at <https://fraction-quest-606.pages.dev/>, hosted on Cloudflare Pages.

## Layout

| Path | What it is |
| --- | --- |
| `src/` | App sources: `body.html`, `style.css`, `glass.css`, and the script parts `core.js`, `st_a.js` … `st_d.js` |
| `src/site/site.css` | Chrome shared by the side pages (tools, learn): tokens, top bar, buttons, fraction primitives, list cards |
| `src/tools/` | Printable tools: one body fragment per sheet (`what-do-i-do.html`, `factors-gcf-lcm.html`, `simplified.html`), the list page `index.html`, and their shared `tools.css` / `tools.js` |
| `src/learn/` | Concept animations: `simplify.html` (the 6/20 to 3/10 morph), the list page `index.html`, `learn.css`, and `learn.js` (tween engine and the simplify step machine) |
| `fonts.css`, `sw.template.js` | Font-face declarations and the service-worker template that the build stamps with a version |
| `build_cf.py` | Turns `src/` into `public/` (`index.html`, `app.js`, `app.css`, `sw.js`, `tools/`, `learn/`). Wraps each side-page fragment in a shared page shell (`SECTIONS`). Runs `node --check` on the scripts and refuses inline event handlers that the CSP would block |
| `public/` | Exactly what gets deployed. Icons, fonts, `_headers`, and `manifest.webmanifest` are committed; the generated files (`index.html`, `app.js`, `app.css`, `sw.js`, `tools/`, `learn/`) are not (see `.gitignore`) and are rebuilt on every deploy |
| `wrangler.toml` | Pages project name (`fraction-quest`) and output directory. Single source of truth for the project name. The hostname is `fraction-quest-606.pages.dev` because Cloudflare adds a suffix when `<name>.pages.dev` is already taken |
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

## Printable tools

`/tools/` lists one-page reference sheets, linked from the app footer. On screen they use the app's look; in print
they are black on white, one letter page each, with no grade level anywhere. Pages serves each sheet at a clean URL
(`/tools/what-do-i-do`), and the service worker caches them for offline use.

To add a sheet: write a body fragment in `src/tools/<slug>.html` (copy an existing one; use `.card`, `.callout`,
`.eq`, and `.frac` from `tools.css`), add a row to `TOOLS` in `build_cf.py`, add the slug to `_headers` as
`no-cache`, link it from `src/tools/index.html`, and rebuild. Check the print result fits one page (browser Print
preview, or Playwright `page.pdf`) before merging.

## Learn pages (concept animations)

`/learn/` holds short animations that teach one idea each, separate from the quest's eight stations. They show;
nothing is scored. Every page has presets, a form for your own numbers, Start / Next step / Play it all / Start
over, a plain-language caption per step, and the equation building underneath. Two squares sit side by side on
wide screens and stack on phones. Reduced-motion users get the end states without the flight.

| Page | What it shows |
| --- | --- |
| `/learn/simplify` | A square cut into small pieces on one side, the same amount in bigger pieces on the other. Shaded columns fly across and grow. "Small steps" divides by the smallest number that works each round and checks again; "One jump" divides once by the biggest number that goes into both. |
| `/learn/add-subtract` | Two squares. Pieces are cut smaller until both bottoms match (the first number both count to), then the right square's pieces slide into the left (add) or the left's pieces are taken away (subtract). Ends with the simplify check. |
| `/learn/multiply` | One square. The second fraction is shaded in strips, the first in rows across them; the overlap is the answer, which is why the rule is top × top, bottom × bottom. |
| `/learn/divide` | Two squares with matching pieces. Groups the size of the second fraction are counted inside the first, leftovers shown as a fraction of a group. Then keep – change – flip is shown landing on the same answer. |

`learn.js` has one `Scene` (layout, squares, grids, the fraction label, a reshaping tile flight) and one
`controller` (steps, buttons, resize) shared by all pages, plus one `init<Name>()` per page that returns early
when its root element is missing. To add a concept page: write a fragment in `src/learn/<slug>.html` (copy one;
keep the `.presets`, `.custom`, `.stage`, `.controls` hooks), add its `init`, add a row to the learn section in
`build_cf.py`, add the slug to `_headers` as `no-cache`, and link it from `src/learn/index.html`.

## Writing style

Copy is written for a student who is still learning the words. Say "top" and "bottom", "goes into", "left over",
"simplified all the way", "the biggest number that goes into both". Use a formal term only on the page that
teaches it (factors in Factor rainbows, primes in Prime trees, GCF and LCM on their tool sheet). Never name a grade.

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
