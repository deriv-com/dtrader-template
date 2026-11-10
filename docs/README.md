# dtrader-template

> A white-label derivatives trading platform template. Fork it, configure your brand, and deploy — **no source code changes required**.

![Node](https://img.shields.io/badge/node-22%20%7C%2024-blue.svg)
![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)

---

## What Is This?

`dtrader-template` is an open-source, production-ready trading platform you can fork and rebrand as your own. It connects to the [Deriv WebSocket API v3](https://developers.deriv.com) and supports:

- Real-time derivatives trading (options, multipliers, accumulators)
- Candlestick/line charts via SmartCharts
- Portfolio and trade history reports
- OAuth2 authentication (PKCE flow)
- PWA support (installable on mobile)
- Responsive UI — desktop and mobile layouts

All branding (name, colors, logos, URLs) is driven by a single config file: **`brand.config.json`**.

---

## Quick Start

### 1. Prerequisites

- **Node.js 24.x recommended**; Node.js 22.23.4+ (22.x) is also supported (24.22.1+ / 22.23.4+ required for CVE-2026-111497)
- A **Deriv App ID** — register at [developers.deriv.com](https://developers.deriv.com)
- A **Deriv OAuth Client ID** — contact Deriv to register your OAuth2 client

### 2. Fork and clone

```sh
git clone https://github.com/YOUR_ORG/dtrader-template.git
cd dtrader-template
npm run bootstrap
```

### 3. Configure your brand

Edit **`brand.config.json`** at the repo root:

```json
{
  "brand_name": "Your Company",
  "brand_domain": "yourdomain.com",
  "brand_hostname": {
    "staging": "staging.trader.yourdomain.com",
    "production": "trader.yourdomain.com"
  },
  "platform": {
    "name": "Your Platform Name",
    "description": "Your platform description.",
    "home_url": "https://home.yourdomain.com/dashboard",
    "help_centre_url": "https://yourdomain.com/help"
  },
  "deposit_url": {
    "staging": "https://staging.trader.yourdomain.com/transfer",
    "production": "https://trader.yourdomain.com/transfer"
  },
  "auth": {
    "staging": "https://staging-auth.deriv.com",
    "production": "https://auth.deriv.com",
    "oauth_scopes": ["trade", "account_manage"],
    "oauth_redirect_uri_staging": "https://staging.trader.yourdomain.com",
    "oauth_redirect_uri_production": "https://trader.yourdomain.com",
    "oauth_app_id": ""
  },
  "app_id": {
    "staging": YOUR_STAGING_APP_ID,
    "production": YOUR_PRODUCTION_APP_ID
  },
  "colors": {
    "primary": "#ff444f"
  }
}
```

> **`auth.oauth_app_id`** is your **Deriv API v1 app ID** (from [developers.deriv.com](https://developers.deriv.com)) — separate from the WebSocket `app_id` above. Leave it empty if you don't have one; it is optional and only appended to the login URL when set.

### 4. Set your OAuth Client ID

Create a `.env` file in the repo root (already in `.gitignore`):

```sh
OAUTH_CLIENT_ID=your_client_id_here
```

For CI/CD, add it as a GitHub Actions repository secret named `OAUTH_CLIENT_ID`.

### 5. Add your logos

Drop your SVG files into `assets/brand/`:

| File                  | Purpose                   |
| --------------------- | ------------------------- |
| `brand-logo.svg`      | Header logo — light theme |
| `brand-logo-dark.svg` | Header logo — dark theme  |
| `platform-logo.svg`   | Square platform icon      |

### 6. Generate color tokens and validate

```sh
npm run generate:colors     # regenerates SCSS tokens from brand.config.json
npm run verify:whitelabel   # validates config, logos, and required fields
```

### 7. Build and run

```sh
npm run build:all
npm run serve core          # → https://localhost:8443
```

For the full white-label walkthrough, see [WHITE_LABEL.md](./WHITE_LABEL.md).

---

## Repository Structure

This is an npm workspaces monorepo with 9 packages under `packages/`:

```
dtrader-template/
├── brand.config.json        ← Only file you need to edit for rebranding
├── assets/brand/            ← Drop your SVG logos here
├── packages/
│   ├── core/                ← App shell, routing, auth, global stores
│   ├── trader/              ← Trading interface, charts, contract logic
│   ├── reports/             ← Portfolio, trade history, statements
│   ├── components/          ← Shared UI component library (77+ components)
│   ├── api/                 ← React Query hooks over the WebSocket API
│   ├── api-v2/              ← Next-gen REST API client
│   ├── shared/              ← Utilities, validators, contract type helpers
│   ├── stores/              ← MobX store provider & hooks
│   └── utils/               ← General utility functions
├── scripts/
│   ├── generate-colors.js   ← Reads brand.config.json → writes SCSS tokens
│   └── verify-white-label.js ← Validates your white-label configuration
└── docs/                    ← Internal development guides
```

**Tech stack:** React 18 · MobX 6 · TypeScript 5 · Webpack 5 · Jest 29

---

## White-Label Configuration Reference

All branding is controlled by `brand.config.json`. The key fields:

| Field                                | Required | Description                                                                                          |
| ------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------- |
| `brand_name`                         | ✅       | Your company name — appears in page title and meta tags                                              |
| `brand_domain`                       | ✅       | Your production domain (e.g. `yourdomain.com`)                                                       |
| `brand_hostname.staging`             | ✅       | Staging hostname — also used as OAuth redirect URI                                                   |
| `brand_hostname.production`          | ✅       | Production hostname                                                                                  |
| `platform.name`                      | ✅       | Platform display name                                                                                |
| `platform.description`               | ✅       | Used in `<meta name="description">`                                                                  |
| `platform.home_url`                  | ✅       | URL the sidebar Home button navigates to                                                             |
| `platform.help_centre_url`           | ✅       | URL for your help/support page                                                                       |
| `deposit_url.staging`                | ✅       | Staging URL for the Deposit button in the account header                                             |
| `deposit_url.production`             | ✅       | Production URL for the Deposit button                                                                |
| `auth.oauth_redirect_uri_staging`    | ✅       | OAuth2 redirect URI for staging — must match your app registration exactly                           |
| `auth.oauth_redirect_uri_production` | ✅       | OAuth2 redirect URI for production — must match your app registration exactly                        |
| `auth.oauth_app_id`                  | —        | Your **Deriv API v1 app ID** — appended to the login URL when set. Leave empty if you don't have one |
| `app_id.staging`                     | ✅       | Deriv WebSocket API app ID for staging                                                               |
| `app_id.production`                  | ✅       | Deriv WebSocket API app ID for production                                                            |
| `colors.primary`                     | ✅       | Main brand color (hex)                                                                               |
| `features.dark_mode`                 | —        | Show dark mode toggle. Default: `false`                                                              |
| `features.language_switcher`         | —        | Show language switcher. Default: `false`                                                             |

> **`OAUTH_CLIENT_ID` is not in `brand.config.json`** — set it as an environment variable or CI secret. See [WHITE_LABEL.md](./WHITE_LABEL.md#getting-a-deriv-oauth-client-id).

For the full field reference and color pipeline docs, see [WHITE_LABEL.md](./WHITE_LABEL.md).

---

## Development Commands

```sh
# Install dependencies
npm run bootstrap

# Start dev server (https://localhost:8443)
npm run serve core

# Start a specific package alongside core
npm run serve trader        # Terminal 1
npm run serve core          # Terminal 2

# Build all packages
npm run build:all

# Run all tests (ESLint + Stylelint + Jest)
npm run test

# Run only Jest
npm run test:jest

# White-label tooling
npm run generate:colors     # Regenerate SCSS tokens from brand.config.json
npm run verify:whitelabel   # Validate white-label setup

```

---

## CI/CD

The repository ships with GitHub Actions workflows ready to use:

| Workflow                 | Trigger                  | What it does                                 |
| ------------------------ | ------------------------ | -------------------------------------------- |
| `test.yml`               | Pull request to `master` | Build, lint, and run tests (3 parallel jobs) |
| `release_staging.yml`    | Merge to `master`        | Auto-deploys to Cloudflare Pages (staging)   |
| `release_production.yml` | Git tag `production_*`   | Deploys to Cloudflare Pages (production)     |

**Required secrets** (GitHub → Settings → Secrets → Actions):

| Secret                  | Description                               |
| ----------------------- | ----------------------------------------- |
| `OAUTH_CLIENT_ID`       | Your Deriv OAuth2 client ID               |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token for Pages deployment |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID                |

**Required variables** (GitHub → Settings → Variables → Actions):

| Variable                  | Description                        |
| ------------------------- | ---------------------------------- |
| `CLOUDFLARE_PROJECT_NAME` | Your Cloudflare Pages project name |

**Optional variables** (Settings → Variables → Actions):

| Variable               | Description                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `TRANSLATIONS_CDN_URL` | Base URL for translation JSON files (e.g. `https://cdn.yourdomain.com/translations`) |

To trigger a production release:

```sh
git tag production_v20240101 -m 'release production'
git push origin production_v20240101
```

---

## Getting API Credentials

### Deriv App ID

1. Go to [developers.deriv.com](https://developers.deriv.com) and log in
2. Click **Register new application**
3. Set the OAuth Redirect URL to your platform hostname
4. Copy the App ID into `brand.config.json` → `app_id`

### Deriv OAuth Client ID

1. Contact Deriv to register your OAuth2 client application
2. Provide your redirect URIs — these must match `auth.oauth_redirect_uri_staging` and `auth.oauth_redirect_uri_production` in `brand.config.json` exactly
3. Set the returned `client_id` as `OAUTH_CLIENT_ID` in your `.env` or CI secrets

Never commit the client ID to git — the app will throw an explicit error at startup if it is missing.

---

## Verification Checklist

After configuring, run the automated check:

```sh
npm run verify:whitelabel
```

Then confirm in the browser at `https://localhost:8443`:

- [ ] Page `<title>` shows your platform name and brand name
- [ ] Header logo renders correctly in light and dark themes
- [ ] Brand colors match your `colors.primary`
- [ ] Login redirects to `https://auth.deriv.com/oauth2/auth?...` with `code_challenge` in the URL
- [ ] WebSocket connects to `wss://api.derivws.com/trading/v1/...`
- [ ] `https://localhost:8443/manifest.json` → `name` shows your `brand_name`

---

## What You Can Change Without Source Code Edits

Everything in `brand.config.json` and `assets/brand/`:

- Brand name, domain, hostnames
- All colors (full SCSS token pipeline regenerated automatically)
- Logos (SVG files)
- Platform name and description
- OAuth redirect URIs and optional v1 app ID (`auth.oauth_app_id`)
- Deposit/transfer page URL (`deposit_url`)
- Home and help centre URLs
- App IDs (WebSocket)
- Feature flags (`dark_mode`, `language_switcher`)
- Translation CDN URL

## What Requires Source Code Changes

| Limitation                                      | Reason                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| `@deriv/quill-icons` icon set                   | Icons referenced by component name from this library              |
| `@deriv-com/smartcharts-champion` chart library | Tightly coupled to the SmartChart module                          |
| Deriv options trading API protocol              | WebSocket v3 protocol and contract types are Deriv-specific       |
| Internal package names (`@deriv/*`)             | Monorepo workspace names — changing requires updating all imports |

---

## Additional Documentation

| Document                                                                                     | Description                                                                                                        |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [WHITE_LABEL.md](./WHITE_LABEL.md)                                                           | Full white-label guide with all config fields, logo requirements, color pipeline, OAuth setup, and troubleshooting |
| [Stylesheet Guidelines](./Stylesheet/README.md)                                              | CSS/SCSS code style guidelines                                                                                     |
| [JavaScript Guidelines](./JavaScript/README.md)                                              | JavaScript/TypeScript code style guidelines                                                                        |
| [Architecture Analysis](./architecture/architecture-analysis.md)                             | System architecture, module dependencies, and design patterns                                                      |
| [SmartCharts Champion Adapter](./charts/smartcharts-champion-adapter-comprehensive-guide.md) | SmartCharts integration guide                                                                                      |

---

## License

Apache 2.0 — see [LICENSE](../LICENSE) for details.
