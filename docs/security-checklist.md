# Bodyn web app: security checklist

Bodyn runs as a public website on GitHub Pages: **https://bodyn-app.github.io/Bodyn/** (repo `bodyn-app/Bodyn`,
in its own free organization so no other site shares its browser origin). Each person imports their own Apple Health export on their own
phone. The data is parsed and kept **only in that phone's browser storage** and is never uploaded.

The code already enforces what it can. The settings below live in GitHub and on the iPhone, so they have to be
switched on by hand, once.

## What the code enforces (no action needed)

| Risk | Protection | Where |
| --- | --- | --- |
| Health data bundled into the public site | The app never imports data files: an ESLint rule and a test block it, and CI checks the built site and refuses to deploy if it contains date-keyed records or data files | `eslint.config.js`, `scripts/no-fixtures.test.mts`, `scripts/web-postexport.mjs` |
| Built on a PC that has the data | Deploys only come from GitHub Actions on a clean checkout. There is no local deploy script | `.github/workflows/deploy.yml` |
| Malicious code sending data out | A Content-Security-Policy blocks network requests, images and scripts from any other server, plus `eval` | injected by `scripts/web-postexport.mjs` |
| Tampered dependencies | `npm ci` from the lockfile, `npm audit signatures`, and the build fails on critical advisories. Actions are pinned to commit SHAs | `deploy.yml` |
| Malicious or huge zip | Only `export.xml` is read. Size caps apply (4 GB zip / 6 GB XML), there is no XML entity expansion, and the result is validated before saving | `src/health/import/` |
| Lost data | `navigator.storage.persist()` after import. "Health data" page shows the last import and lets you re-import | `src/health/storage.ts`, `src/app/health-data.tsx` |
| Leftover data | **Delete all data** wipes every `bodyn.*` key on the device | Account → Health data |

## One-time setup: GitHub

- [x] **Fresh public repo instead of making the old one public.** The old history (Gmail address, design reference
      image) stays in the private archive `mohamedyounes95/Bodyn-private`. The public `bodyn-app/Bodyn` starts from one
      clean commit. Keep the repo name `Bodyn`: the site is served from `/Bodyn/` (`app.json` → `experiments.baseUrl`, `public/`).
- [ ] **Hide your email in commits.** (This project's repo is already set to the noreply address; do it globally too.)
  - `git config --global user.email "331589508+mohamedyounes95@users.noreply.github.com"`
  - GitHub → Settings → Emails → tick **Keep my email addresses private** and
    **Block command line pushes that expose my email**.
- [x] **Two-factor authentication**: GitHub → Settings → Password and authentication → enable 2FA (passkey or
      authenticator app).
- [x] **Protect `main`**: repo → Settings → Rules → Rulesets → New branch ruleset → target `main` →
      tick *Restrict deletions*, *Block force pushes*, *Require a pull request before merging*. Org admins (you)
      are on the bypass list, so your own pushes still go straight to `main`.
- [x] **Pages from Actions only**: repo → Settings → Pages → Source: **GitHub Actions**.
- [x] **Org 2FA**: org `bodyn-app` → Settings → Authentication security → *Require two-factor authentication*.
- [x] **Deploys only from main**: repo → Settings → Environments → `github-pages` → Deployment branches →
      *Selected branches* → `main`.
- [x] **Security alerts**: repo → Settings → Security → enable **Dependabot alerts**, **Secret scanning**
      and **Push protection**.
- [x] **Actions can't be hijacked by forks**: repo → Settings → Actions → General → *Fork pull request workflows*
      → require approval for all outside collaborators.
- [ ] **Keep `bodyn-app` for Bodyn only.** Every Pages site under `bodyn-app.github.io/*` shares one browser origin
      and could read Bodyn's storage, so never add another Pages site to this organization. (Your personal
      `mohamedyounes95.github.io/weight-tracker` is a different origin and can't see Bodyn's data.)

## One-time setup: iPhone

- [ ] Passcode + Face ID on, Auto-Lock short (Settings → Display & Brightness → Auto-Lock).
- [ ] When exporting from Health, save `export.zip` to **On My iPhone**, not iCloud Drive.
- [ ] After importing, delete `export.zip` from Files (and from *Recently Deleted*).
- [ ] Open Bodyn in **Safari** (not Private Browsing) → Share → **Add to Home Screen**, and always launch it from
      the icon. The home-screen app has its own storage, separate from Safari tabs.

## Before every release

- [ ] `npm test` and `npm run build:web` pass locally. The build prints `✓ … no health data found`.
- [ ] No new third-party scripts, fonts, analytics or CDNs. The CSP would block them, and they'd break the "nothing
      leaves the phone" promise.
- [ ] No new `fetch`/network code that sends anything about the user.
- [ ] After deploy: open the site on a second device. It must show the empty **Welcome** screen.

## Known limits (accepted)

- Data on the phone is not encrypted by Bodyn itself. It relies on iOS device encryption and your passcode. A Face ID
  lock with encryption at rest (WebAuthn PRF) is a planned later step.
- No notifications and no live HealthKit on the web. Data is as fresh as the last import.
- Removing the home-screen icon or clearing Safari website data deletes the data. Re-import to restore.
