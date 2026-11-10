# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Derivatives Trading Platform - Architecture Guide

A comprehensive TypeScript/React-based derivatives trading platform built with MobX state management, React Router navigation, and WebSocket-based real-time API integration.

## Project Overview

**Repository:** Monorepo with 9 NPM packages using npm workspaces
**Main Tech Stack:** React 18, MobX 6, TypeScript 5, Webpack 5, Jest 29
**Build System:** Webpack with separate configs per package
**Architecture Pattern:** Multi-store reactive state management + component-driven UI
**Node Version:** 24.x by default (use the repository `.nvmrc`); Node 22.23.4+ (22.x) is also supported; minimum patched versions are 22.23.4 / 24.22.1 (CVE-2026-111497)

## Common Commands

### Development

```bash
# Install dependencies
npm run bootstrap

# Start development server for core package
npm run serve core
# Runs at https://localhost:8443

# Start specific package
npm run serve trader
npm run serve reports

# Build all packages
npm run build:all

# Build specific package
npm run build --workspace=@deriv/core
```

### Testing

```bash
# Run all tests (stylelint + eslint + jest)
npm run test

# Run only Jest tests
npm run test:jest

# Run single test file
npm run test:jest -- path/to/test.spec.ts

# Run ESLint on all packages
npm run test:eslint-all

# Run Stylelint on all SCSS files
npm run test:stylelint

# Fix style issues automatically
npm run stylelint:fix

# Format code with Prettier
npm run prettify
```

### Utilities

```bash
# Generate color tokens (run after editing brand.config.json colors)
npm run generate:colors

# Validate white-label configuration
npm run verify:whitelabel

# Clean all node_modules (interactive)
npm run clean
```

---

## White-Label Configuration

This is a white-label template. All branding is driven by **`brand.config.json`** in the repo root — no source code changes needed for rebranding.

### White-label workflow

1. Edit `brand.config.json` (brand name, colors, API endpoints, hostnames, app IDs)
2. Replace SVG logo files in `assets/brand/` (`brand-logo.svg`, `brand-logo-dark.svg`, `platform-logo.svg`)
3. Run `npm run generate:colors` — regenerates SCSS tokens in `packages/shared/src/styles/`
4. Run `npm run verify:whitelabel` — validates config and logo files
5. Run `npm run build:all`

**Never edit the generated SCSS files directly** — they are overwritten by `generate:colors`:

- `packages/shared/src/styles/constants/colors.scss`
- `packages/shared/src/styles/tokens/brand.scss`
- `packages/shared/src/styles/tokens/semantic.scss`
- `packages/shared/src/styles/tokens/components.scss`

### Key config fields

| Field                               | Purpose                                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `brand_domain`                      | Single production domain string (e.g. `"yourdomain.com"`). Used for environment detection and security checks. |
| `brand_hostname.staging/production` | Platform hostname for each environment. Also used as the canonical URL and OAuth redirect URI base.            |
| `platform.home_url`                 | URL the sidebar Home button navigates to.                                                                      |
| `platform.help_centre_url`          | URL the sidebar Help button opens.                                                                             |
| `signup_url.staging/production`     | Signup page URLs — used by the signup button when enabled.                                                     |
| `derivws.staging/production`        | DerivWS WebSocket API base URL.                                                                                |
| `features.dark_mode`                | Show/hide the dark mode toggle in the sidebar and mobile menu. Default: `false`.                               |
| `features.language_switcher`        | Show/hide the language switcher in the sidebar and mobile menu. Default: `false`.                              |

### App ID

The platform connects to the Deriv WebSocket API (v3). Register your own App ID at [https://developers.deriv.com](https://developers.deriv.com) and set it in `brand.config.json` under `app_id.staging` and `app_id.production`.

For full details, see [WHITE_LABEL.md](docs/WHITE_LABEL.md).

---

## 1. State Management Architecture (MobX Stores)

### Overall Pattern

The platform uses a **root store + modular stores** architecture with MobX as the state management library:

- **Root Store** (`RootStore`): Central state container instantiated once per app
- **Base Store**: Abstract parent class for all stores providing persistence and lifecycle management
- **Modular Stores**: Specialized stores for different domains (Trading, Portfolio, Contracts, etc.)

### Key Stores in Core Package (`packages/core/src/Stores/`)

```
RootStore (root)
├── client: ClientStore          # Auth, user profile, accounts
├── common: CommonStore          # Platform config, language, theme
├── ui: UIStore                  # Modal states, notifications, UI toggles
├── modules: ModulesStore        # Feature-specific stores (Trading, Reports)
├── notifications: NotificationStore  # Toast/notification queue
├── portfolio: PortfolioStore    # Open positions, balance
├── contract_trade: ContractTradeStore  # Contract state
├── contract_replay: ContractReplayStore # Replay functionality
├── chart_barrier_store: ChartBarrierStore  # Chart barrier management
└── traders_hub: TradersHubStore # Hub/dashboard state
```

### Base Store Pattern

All stores extend `BaseStore` which provides:

```typescript
// packages/trader/src/Stores/base-store.ts
export default class BaseStore {
    static STORAGES = {
        LOCAL_STORAGE: Symbol('LOCAL_STORAGE'),
        SESSION_STORAGE: Symbol('SESSION_STORAGE'),
    };

    constructor(options: TBaseStoreOptions) {
        makeObservable(this, {
            validation_errors: observable,
            validateProperty: action,
            // ... more observable/action decorators
        });
        // Auto-persists to localStorage/sessionStorage based on config
    }
}
```

**Key features:**

- Automatic localStorage/sessionStorage sync via `mobx-persist-store`
- Validation error handling built-in
- Lifecycle hooks: `onLogout()`, `onClientInit()`, `onNetworkStatusChange()`
- Disposal pattern for cleanup

### Trader Store Hierarchy

The trading module extends base patterns with specialized stores:

```
TraderStoreProvider
├── Modules Store
│   ├── Trading Store (trade-store.ts)
│   │   ├── Barriers, Duration validation
│   │   ├── Price proposals
│   │   ├── Contract purchase logic
│   │   └── Chart barrier management
│   ├── Markets Store
│   ├── Positions Store
│   └── [Other module stores]
```

### Provider Pattern

Stores are made available through React Context:

```typescript
// packages/stores/src/storeProvider.tsx
const StoreProvider = ({ children, store }: TStores) => {
    return <StoreContext.Provider value={memoizedValue}>{children}</StoreContext.Provider>;
};

// Usage in components
const { trading, client } = useStore();  // MobX observer hook
```

**Key points:**

- Context provides root store + feature stores
- `useStore()` hook throws if called outside provider
- Memoization prevents unnecessary re-renders
- Stores auto-cleanup on unmount via disposal pattern

---

## 2. API Integration & WebSocket Management

### Architecture Overview

The platform uses a multi-layered API integration:

```
React Components
    ↓
useQuery/useMutation/useSubscription hooks
    ↓
APIProvider (manages DerivAPI connection + TanStack React Query)
    ↓
DerivAPIBasic (WebSocket wrapper from @deriv/deriv-api)
    ↓
WebSocket connection (v3 API endpoint)
```

### APIProvider (`packages/api/src/APIProvider.tsx`)

**Manages:**

- WebSocket lifecycle (connect/reconnect/close)
- Single QueryClient for data caching across packages
- Subscription lifecycle management
- Environment switching (real/demo/custom)

**Key implementation details:**

```typescript
// Standalone mode: creates its own WebSocket
const APIProvider = ({ children, standalone = false }: TAPIProviderProps) => {
    const standaloneDerivAPI = useRef(standalone ? initializeDerivAPI(() => setReconnect(true)) : null);

    const send: TSendFunction = (name, payload) => {
        return standaloneDerivAPI.current?.send({ [name]: 1, ...payload });
    };

    const subscribe: TSubscribeFunction = async (name, payload) => {
        const id = await hashObject({ name, payload });
        // Reuse existing subscriptions to avoid duplicates
        const matchingSubscription = subscriptions.current?.[id];
        if (matchingSubscription) return { id, subscription: matchingSubscription };
        // ... create new subscription
    };
};
```

**WebSocket Connection Strategy:**

```typescript
const getWebsocketInstance = (wss_url: string, onWSClose: () => void) => {
    if (!window.WSConnections) window.WSConnections = {};

    const existing = window.WSConnections[wss_url];
    // Reuse if alive (readyState 0=connecting, 1=open)
    if (existing && [0, 1].includes(existing.readyState)) {
        return existing;
    }

    // Create new connection
    window.WSConnections[wss_url] = new WebSocket(wss_url);
    return window.WSConnections[wss_url];
};
```

**Reconnection Logic:**

- 30-second keep-alive ping: `send({ time: 1 })`
- On close event: exponential backoff retry (500ms initial)
- Auto-switch environments on loginid change

### Query Hooks

**useQuery** - Fetch data once:

```typescript
const { data, isLoading, error } = useQuery(name, { payload });
```

**useSubscription** - Stream updates:

```typescript
const { subscribe, unsubscribe, isLoading, data, error } = useSubscription(name);
subscribe({ payload }); // Start stream
```

**useMutation** - Send requests:

```typescript
const { mutate, isLoading } = useMutation(name);
mutate({ payload });
```

**useInvalidateQuery** - Trigger cache invalidation:

```typescript
const invalidateQuery = useInvalidateQuery();
invalidateQuery([name]);
```

### QueryClient Sharing

Shared across packages via window global:

```typescript
const getSharedQueryClientContext = (): QueryClient => {
    if (!window.ReactQueryClient) {
        window.ReactQueryClient = new QueryClient();
    }
    return window.ReactQueryClient;
};
```

This allows trader, reports, and components packages to share cached data.

### Error Handling

Socket errors follow TypeScript pattern:

```typescript
type TSocketError<T extends TSocketEndpointNames> = {
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
};

// Usage
const { data, error } = useQuery(endpoint, { payload });
if (error?.code === 'InvalidToken') {
    // Handle token expiry
}
```

---

## 3. Core Features by Package

### **@deriv/core** - Main Application Entry Point

**Purpose:** Platform shell, routing, global stores, initialization  
**Responsibilities:**

- Bootstrap stores and WebSocket connection
- Route configuration + lazy-loaded modules
- Global UI layout (header, footer, notifications)
- Service worker registration for PWA

**Structure:**

```
src/
├── App/
│   ├── app.jsx                  # Root component with providers
│   ├── AppContent.tsx           # Layout wrapper
│   ├── initStore.js             # Store initialization + lifecycle
│   ├── Containers/
│   │   ├── app-notification-messages.jsx  # Toast queue management
│   │   └── Routes/
│   │       └── routes.jsx       # Render route modules
│   └── Components/
│       └── Routes/
│           ├── route-with-sub-routes.jsx  # Route renderer HOC
│           └── binary-routes.jsx
├── Stores/                      # Root stores (client, common, ui, etc.)
├── Services/
│   ├── ws-methods.js            # WebSocket wrapper
│   └── network-monitor.ts       # Connectivity tracking
├── Constants/
│   ├── form-error-messages.js
│   └── routes-config.js
└── Utils/
    └── PWA.ts                   # Service worker setup
```

**Bootstrap Flow:**

```javascript
// index.tsx entry point
const initApp = async () => {
    const root_store = initStore(AppNotificationMessages);
    ReactDOM.render(<App root_store={root_store} />, document.getElementById('derivatives_trader'));
};
```

### **@deriv/trader** - Trading Engine & UI

**Purpose:** Main trader interface, contract trading, chart integration  
**Responsibilities:**

- Trading form (trade parameters, contract selection)
- Smart chart integration with barriers
- Contract lifecycle management
- Mobile-specific variant (AppV2)

**Structure:**

```
src/
├── Modules/
│   ├── Trading/
│   │   ├── Components/
│   │   │   └── Form/           # Trade form (responsive)
│   │   │       ├── TradeParams/  # Duration, barrier, stake
│   │   │       ├── ContractType/ # Trade type selector
│   │   │       ├── Purchase/     # Buy button + confirmation
│   │   │       └── screen-large.tsx / screen-small.tsx
│   │   └── Helpers/
│   │       ├── contract-type.ts
│   │       ├── process.ts       # Trade param processing
│   │       └── proposal.ts      # Price proposal creation
│   ├── Contract/               # Contract details view
│   ├── SmartChart/             # Chart with barriers
│   └── Page404/
├── Stores/
│   ├── base-store.ts           # Trader-specific BaseStore
│   └── Modules/
│       ├── Trading/
│       │   ├── trade-store.ts   # Main trading state
│       │   ├── Actions/
│       │   │   └── purchase.ts  # Buy contract logic
│       │   ├── Helpers/
│       │   │   ├── proposal.ts  # Price proposal builder
│       │   │   ├── process.ts   # Param processing
│       │   │   └── chart.ts     # Chart state helpers
│       │   └── Constants/
│       │       └── validation-rules.ts
│       ├── Markets/
│       └── Positions/
├── App/
│   ├── index.tsx               # Lazy load App/AppV2
│   └── Constants/routes-config.ts
└── Types/
    └── index.ts
```

**Key Store: TradeStore**

Central state machine for trading logic (103KB file):

```typescript
export class TradeStore extends BaseStore {
    // Observable state
    symbol: string = 'frxEURUSD';
    contract_type: string = 'CALL';
    amount: number = 1;
    duration: number = 5;
    duration_unit: string = 'm';
    barrier: string | null = null;

    // Computed properties
    @computed get barriers(): TBarrier[] {
        /* derives barriers from spot */
    }
    @computed get is_market_closed(): boolean {
        /* checks trading hours */
    }
    @computed get price_proposal(): TPriceProposal {
        /* cached proposal */
    }

    // Actions
    @action setSymbol(symbol: string) {
        /* ... */
    }
    @action processTrade(params: any) {
        /* validate + update */
    }

    // Proposal logic
    async createProposal() {
        const proposals = await this.root_store.client.queryAPI('proposal', this.buildProposalPayload());
    }
}
```

**Form Handling Pattern:**

Trading form is **not** built with Formik - instead uses MobX for state:

```typescript
// Component directly accesses + mutates store
const TradeForm = observer(({ trade_store }) => {
    return (
        <input
            value={trade_store.amount}
            onChange={(e) => trade_store.setAmount(Number(e.target.value))}
        />
    );
});
```

**Validation is built-in:**

```typescript
// trade-store.ts validation
const validation_rules = getValidationRules(trade_store);
// Rules are MobX observable, trigger re-render on change
trade_store.validateProperty('amount', new_value);
```

### **@deriv/reports** - Portfolio & Analytics

**Purpose:** Trade history, positions, statements, analytics  
**Responsibilities:**

- Open/closed positions table
- Trade table with P&L
- Statement view
- Data export

**Structure:**

```
src/
├── Modules/
│   ├── ReportPage/
│   ├── Statement/
│   ├── Profit/               # Trade table
│   └── Portfolio/            # Open positions
└── Stores/                   # Report-specific stores
```

### **@deriv/components** - Shared UI Library

**Purpose:** Reusable React components  
**Responsibilities:**

- Form inputs (dropdowns, date pickers, inputs)
- Tables, modals, spinners
- Charts containers
- Responsive grid system

**77 components** organized by category:

```
src/components/
├── containers/       # Layout wrappers
├── form_inputs/      # Controlled inputs
├── elements/         # Atomic UI
└── ... (23 more dirs)
```

### **@deriv/stores** - New Unified Store Package

**Purpose:** Store infrastructure (replacing individual packages' stores)  
**Provides:**

- `StoreProvider` - Context provider
- `useStore()` - Hook to access stores
- `observer` - MobX observer HOC (re-exported from `mobx-react-lite`)
- `mockStore` - Test utility for mocking store
- `StoreContext` - React context object

**Key exports (from `packages/stores/src/index.ts`):**

```typescript
export { observer } from 'mobx-react-lite';
export { default as mockStore } from './mockStore';
export { default as StoreContext } from './storeContext';
export { default as StoreProvider } from './storeProvider';
export { default as useStore } from './useStore';
```

Note: `BaseStore` and `FeatureFlagsStore` exist in `packages/stores/src/stores/` but are not exported from the package index. `BaseStore` used by trader package lives at `packages/trader/src/Stores/base-store.ts`.

### **@deriv/api** - React Query Hooks

**Purpose:** Type-safe API layer over WebSocket  
**Provides:**

- `useQuery()` - Fetch data
- `useSubscription()` - Stream updates
- `useMutation()` - Send requests
- `useInvalidateQuery()` - Cache control
- `APIProvider` - Connection manager

**Exported types** from Deriv API (100+ types):

```typescript
export type {
    TActiveSymbolsRequest,
    TActiveSymbolsResponse,
    TBuyContractRequest,
    TBuyContractResponse,
    TPriceProposalRequest,
    TPriceProposalResponse,
    // ... 90+ more trading types
};
```

### **@deriv/shared** - Utilities & Helpers

**Purpose:** Cross-package utilities  
**Provides:**

- Contract type utilities (`CONTRACT_TYPES`, `isHighLow()`, etc.)
- Validators (`Validator` class for form validation)
- Route helpers (`routes` constants, `moduleLoader`)
- Money formatting
- URL parameter handling

### **@deriv/utils** - General Utilities

**Purpose:** Standalone utilities  
**Provides:**

- `safeParse()` - Safe JSON parsing
- Crypto utilities
- Type helpers

### **@deriv/api & @deriv/api-v2** - API Hooks

**Purpose:** React Query hooks over WebSocket and REST APIs
**Provides:**

- `useQuery`, `useMutation`, `useSubscription` — typed API hooks
- `useFeatureFlags` — MobX-based feature flag access

---

## 4. Routing & Navigation

### Route Configuration Pattern

Routes are defined as config arrays (not JSX-based):

**Core Routes** (`packages/core/src/App/Constants/routes-config.js`):

```javascript
const getModules = () => [
    {
        path: '/reports',
        component: Reports,
        getTitle: () => localize('Reports'),
        icon_component: <ReportsIcon />,
        protected: true,
        routes: [
            {
                path: '/reports/positions',
                component: Reports,
                getTitle: () => localize('Open positions'),
                default: true,
                protected: true,
            },
            // ... more subroutes
        ],
    },
    {
        path: '/',
        component: Trader,
        getTitle: () => localize('Trader'),
        protected: false,
    },
];
```

**Trader Routes** (`packages/trader/src/App/Constants/routes-config.ts`):

```typescript
const initRoutesConfig = () => [
    {
        path: routes.contract, // '/contract/:id'
        component: ContractDetails,
        getTitle: () => localize('Contract Details'),
        is_authenticated: true,
    },
    { path: routes.index, component: Trade, getTitle: () => localize('Trader'), exact: true },
];
```

### Route Rendering

Routes are rendered by HOC component:

**RouteWithSubRoutes** (`binary-routes.jsx`):

```javascript
const RouteWithSubRoutes = route => (
    <Route
        path={route.path}
        exact={route.exact}
        render={props => <route.component {...props} routes={route.routes} />}
    />
);
```

**Dynamic Module Loading:**

Modules use webpack code splitting:

```javascript
const Reports = React.lazy(() => import(/* webpackChunkName: "reports" */ '@deriv/reports'));

const Trader = React.lazy(() => import(/* webpackChunkName: "trader" */ '@deriv/trader'));
```

### Key Route Constants

Located in `@deriv/shared`:

```typescript
export const routes = {
    index: '/',
    contract: '/contract/:id',
    reports: '/reports',
    positions: '/reports/positions',
    profit: '/reports/profit',
    statement: '/reports/statement',
    // ... 20+ more
};
```

### Navigation Patterns

**MobX Stores + Router History:**

```javascript
// In store
if (some_condition) {
    this.root_store.common.setMobileHistoryPush(true);
}
```

**URL State Sync:**

Trading parameters are synced to URL:

```typescript
// get params from URL
const trade_params = getTradeURLParams();

// set params to URL
setTradeURLParams({ symbol: 'frxEURUSD', duration: 5 });
```

---

## 5. Component Patterns

### Observer Pattern

All data-driven components use `observer()` HOC:

```typescript
import { observer, useStore } from '@deriv/stores';

const TradeForm = observer(({ trade_store }) => {
    const { client } = useStore();

    return (
        <form>
            <input value={trade_store.amount} onChange={...} />
            {client.is_logging_in && <Spinner />}
        </form>
    );
});
```

**When data changes in MobX store → component automatically re-renders**

### Hooks Pattern

Composition via hooks:

```typescript
const useTraderStore = () => {
    const store = useStore();
    return store.modules.trading;
};

const TradeForm = () => {
    const trade = useTraderStore();
    const { subscribe } = useSubscription('proposal');

    React.useEffect(() => {
        subscribe({ payload: trade.buildProposalPayload() });
    }, [trade.symbol, trade.duration]);
};
```

### Responsive Components

Responsive rendering via device breakpoint:

```typescript
import { useDevice } from '@deriv-com/ui';

const FormLayout = observer(({ is_market_closed, is_trade_enabled }) => {
    const { isMobile } = useDevice();

    const Screen = React.useMemo(() => {
        return Loadable({
            loader: () =>
                isMobile
                    ? import('./screen-small')
                    : import('./screen-large'),
            loading: () => null,
        });
    }, [isMobile]);

    return <Screen {...props} />;
});
```

**Code splitting ensures mobile users don't load desktop UI.**

### Lazy Component Loading

Used for code splitting:

```typescript
const ContractDetails = React.lazy(() =>
    moduleLoader(() =>
        import(/* webpackChunkName: "contract" */ 'Modules/Contract')
    )
);

// Wrapper with fallback
<React.Suspense fallback={<Loading />}>
    <ContractDetails {...props} />
</React.Suspense>
```

### Form Input Pattern

No Formik - use MobX directly + custom validation:

```typescript
// Store-side
class TradeStore {
    @observable amount = 1;
    @observable validation_errors = {};

    @action setAmount(value) {
        this.amount = value;
        this.validateProperty('amount', value);
    }

    validateProperty(property, value) {
        const rules = this.validation_rules[property];
        const errors = this.validateRules(value, rules);
        this.validation_errors[property] = errors;
    }
}

// Component-side
<input
    value={store.amount}
    onChange={(e) => store.setAmount(Number(e.target.value))}
    error={store.validation_errors.amount?.[0]}
/>
```

---

## 6. Build System (Webpack 5)

### Webpack Strategy

Each package has custom webpack config:

```
packages/core/build/webpack.config.js      # Main app
packages/trader/build/webpack.config.js    # Trader module
packages/reports/build/webpack.config.js   # Reports module
packages/components/webpack.config.js      # Component lib
```

### Core Webpack Config

**Core config structure** (`packages/core/build/config.js`):

```javascript
module.exports = function (env) {
    return {
        context: path.resolve(__dirname, '../src'),
        entry: './index.tsx',
        mode: IS_RELEASE ? 'production' : 'development',
        devServer: {
            server: 'https',
            port: 8443,
            historyApiFallback: true,
            host: 'localhost',
        },
        module: {
            rules: rules(), // SCSS, TS, JSX, images
        },
        resolve: {
            alias: ALIASES, // Path aliases (App/, Stores/, etc.)
            extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
        output: {
            filename: 'js/core.[name].[contenthash].js',
            publicPath: base,
            path: path.resolve(__dirname, '../dist'),
        },
        optimization: {
            minimize: IS_RELEASE,
            splitChunks: {
                chunks: 'all',
                minSize: 100000,
                maxSize: 2500000,
                cacheGroups: {
                    defaultVendors: {
                        test: /[\\/]node_modules[\\/]/,
                        priority: -10,
                    },
                },
            },
        },
        plugins: plugins({ base, env }),
    };
};
```

### Key Plugins

**From constants.js:**

```javascript
const plugins = ({ base, env }) => [
    new HtmlWebpackPlugin({ template: './index.html' }),
    new MiniCssExtractPlugin({
        filename: 'css/core.[name].[contenthash].css',
    }),
    new CopyPlugin({ patterns: copyConfig(base) }),
    new GitRevisionPlugin(), // Git commit hash for versioning
    new AnalyzerPlugin(), // Bundle size analysis
];
```

### Path Aliases

Configured in webpack + tsconfig:

```
App/ → src/App/
Modules/ → src/Modules/
Stores/ → src/Stores/
Components/ → src/Components/
Utils/ → src/Utils/
Types/ → src/types/
Sass/ → src/sass/
```

Enables clean imports: `import App from 'App/index'` instead of `../../../App`

### Code Splitting Strategy

**Package splits:**

- `core` (main shell)
- `trader` (trading module)
- `reports` (reports module)
- `vendors` (node_modules)

**Per-route splits:**

- Contract Details: `contract.js`
- Reports: `reports.js`
- Page404: `404.js`

**Result:** Users only download needed bundles on navigation

### Build Commands

```bash
npm run build              # Production build
npm run serve             # Dev server with HMR
npm run test              # Jest + ESLint + Stylelint
```

---

## 7. Key Architectural Decisions

### 1. MobX Over Redux

**Why MobX:**

- Simpler API (no actions/reducers boilerplate)
- Fine-grained reactivity (only affected components re-render)
- OOP-friendly (classes vs functions)
- Built-in validation + persistence support
- Better for domain modeling

**Trade-off:** Less predictable time-travel debugging

### 2. Monorepo Structure

**Rationale:**

- Core (shell) + Trader (trading) + Reports separately bundled
- Shared code in `packages/shared`, `packages/api`, `packages/components`
- Easier to maintain / deploy individual modules
- Clear separation of concerns

**Workspace packages:**

- `core` - App shell, authentication, global state
- `trader` - Trading terminal
- `reports` - Portfolio analytics
- `components` - UI library
- `stores` - Store infrastructure
- `api` - React Query + WebSocket integration
- `shared` - Utilities & validators
- `utils` - General helpers
- `api-v2` - API v2 support

### 3. WebSocket + React Query Combo

**Pattern:**

- DerivAPI Basic handles WebSocket protocol
- React Query handles caching + deduplication
- Subscriptions reused across components
- Automatic unsubscribe on component unmount

**Benefit:** Real-time + cached data without duplication

### 4. Config-Based Routing

**Why arrays instead of JSX:**

- Routes are data-driven
- Easy to generate navigation menus
- Supports nested routes elegantly
- Can be modified from stores (dynamic routes)

### 5. Provider Nesting Order

```typescript
<Router>
  <StoreProvider>
    <BreakpointProvider>
      <APIProvider>
        <TranslationProvider>
          {/* App content */}
        </TranslationProvider>
      </APIProvider>
    </BreakpointProvider>
  </StoreProvider>
</Router>
```

**Each layer:**

1. **Router** - URL state
2. **StoreProvider** - Global MobX stores
3. **BreakpointProvider** - Device detection (@deriv-com/quill-ui)
4. **APIProvider** - WebSocket + QueryClient
5. **TranslationProvider** - i18n with lazy loading

### 6. Responsive UI Strategy

**Two-component approach:**

- `screen-large.tsx` - Desktop UI (keyboard, mouse)
- `screen-small.tsx` - Mobile UI (touch-optimized)

**Selected via:**

```typescript
const Screen = isMobile ? screen - small : screen - large;
```

**Result:** Code-split mobile bundle is ~40% smaller

### 7. Form Validation Pattern

**No Formik** - MobX directly for simplicity:

```typescript
// Store
@observable errors = {};
@action validateField(name, value) {
    this.errors[name] = this.rules[name](value);
}

// Component
<Input value={amount} onChange={...} error={errors.amount} />
```

**Why:** Overkill for derivatives trading forms (mostly numeric inputs + selects)

### 8. LocalStorage for UI State

**Persisted:**

- Theme preference (dark/light)
- UI toggles (chart type, sidebar collapse)
- Trade parameters (last-used contract settings)

**Via:** `mobx-persist-store` in BaseStore

---

## 8. Testing Approach

### Jest Configuration

**Root config** (`jest.config.js`):

```javascript
module.exports = {
    clearMocks: true,
    projects: ['<rootDir>/packages/*/jest.config.js'], // Multi-project
    transform: {
        '^.+\\.jsx?$': 'babel-jest',
        '^.+\\.(ts|tsx)?$': 'ts-jest',
    },
    testRegex: '(/__tests__/.*|(\\.)(test|spec))\\.(js|jsx|tsx|ts)?$',
};
```

### Test Organization

Tests co-located with source:

```
src/
├── components/
│   ├── Form/
│   │   ├── form-layout.tsx
│   │   └── __tests__/
│   │       └── form-layout.spec.tsx
```

### Testing Patterns

**MobX store testing:**

```typescript
// src/Stores/Modules/Trading/__tests__/trade-store.spec.ts
import { reaction } from 'mobx';
import TradeStore from '../trade-store';

describe('TradeStore', () => {
    it('should update barrier when symbol changes', () => {
        const store = new TradeStore({ root_store: mockRoot });
        store.setSymbol('frxGBPUSD');

        expect(store.barrier).toBe(expectedBarrier);
    });
});
```

**Component testing with React Testing Library:**

```typescript
// src/Modules/Trading/Components/__tests__/trade-form.spec.tsx
import { render, screen } from '@testing-library/react';
import { StoreProvider } from '@deriv/stores';
import TradeForm from '../trade-form';

it('should render trade form', () => {
    const { getByRole } = render(
        <StoreProvider store={mockStore}>
            <TradeForm />
        </StoreProvider>
    );

    expect(getByRole('button', { name: /buy/i })).toBeInTheDocument();
});
```

### Test Commands

```bash
npm run test              # All tests
npm run test:jest        # Jest only
npm run test:eslint-all  # ESLint
npm run test:stylelint   # CSS linting
```

---

## 9. Development Workflow

### Local Development

```bash
# Clone & install
git clone https://github.com/deriv-com/derivatives-trader.git
cd derivatives-trader
npm run bootstrap

# Start core app
npm run serve core
# Starts webpack dev server at https://localhost:8443

# Start specific package
npm run serve trader

# Watch tests
npm run test:jest -- --watch
```

### Hot Module Replacement (HMR)

Webpack dev server supports HMR for rapid iteration:

- Edit `.tsx` file → auto-rebuild + browser refresh
- MobX stores persist state during reload

### Debugging

**Browser DevTools:**

- React DevTools - Component props/state
- MobX DevTools - Action trace
- Redux DevTools - Snapshot timeline (if configured)

**VS Code:**

- TypeScript support built-in (tsconfig.json)
- ESLint integration
- Jest runner extension

**Global Store Reference:**

```javascript
// In console
window.__deriv_store.client.email;
window.__deriv_store.client.logout();
```

---

## 10. Common Patterns & Code Organization

### Error Handling

**API Errors:**

```typescript
const { data, error } = useQuery('active_symbols', {});
if (error?.code === 'InvalidToken') {
    // Token expired - logout
    store.client.logout();
}
```

**Store Errors:**

```typescript
@observable validation_errors: Record<string, string[]> = {};

validateProperty(property, value) {
    if (!value) {
        this.validation_errors[property] = ['This field is required'];
    }
}
```

### Performance Optimization

**Memoization:**

```typescript
const Screen = React.useMemo(() => (isMobile ? SmallScreen : LargeScreen), [isMobile]);
```

**Observable Selectors:**

```typescript
@computed get is_valid() {
    return Object.keys(this.validation_errors).length === 0;
}
// Only recomputes when validation_errors changes
```

**Lazy Loading:**

```typescript
const LazyModule = React.lazy(() => import('./Module'));
<React.Suspense fallback={<Spinner />}>
    <LazyModule />
</React.Suspense>
```

### Type Safety

**TypeScript strict mode:**

```typescript
// tsconfig.json
{
    "compilerOptions": {
        "strict": true,
        "noImplicitAny": true,
        "strictNullChecks": true,
        "esModuleInterop": true,
    }
}
```

**API type exports** from @deriv/api:

```typescript
import type { TActiveSymbolsRequest, TPriceProposalResponse, TBuyContractResponse } from '@deriv/api';
```

---

## 11. Deployment & Production

### Environment Configuration

**Via .env variables:**

```
OAUTH_CLIENT_ID=your_client_id_here
TRANSLATIONS_CDN_URL=https://cdn.yourdomain.com/translations
NODE_ENV=production
```

### Build Pipeline

1. **Code splitting** - Separate bundles per module
2. **Asset hashing** - `[contenthash]` for long-term caching
3. **Source maps** - Minified with production maps
4. **CDN delivery** - Distributed charts + assets

---

## 12. Troubleshooting Guide

### Common Issues

**"useStore() must be used within StoreProvider"**

- Ensure component is wrapped in `StoreProvider`
- Check provider nesting order in app.jsx

**WebSocket connection fails**

- Check network panel - should connect to `wss://api.deriv.com/websockets/v3`
- Verify app_id in APIProvider.tsx
- Check custom server URL in localStorage: `config.server_url`

**Component not re-rendering on store change**

- Wrap component with `observer()` HOC
- Ensure you're mutating observable properties, not reassigning objects
- Check MobX enforce actions: `configure({ enforceActions: 'observed' })`

**TypeScript errors in IDE**

- Run `npm run bootstrap` to regenerate types
- Clear `.tsbuildinfo` caches
- Restart TypeScript server in VS Code

---

## Key Files to Know

| File                                                        | Purpose                          |
| ----------------------------------------------------------- | -------------------------------- |
| `packages/core/src/App/initStore.js`                        | Store initialization & setup     |
| `packages/core/src/App/app.jsx`                             | Provider nesting + root layout   |
| `packages/trader/src/Stores/Modules/Trading/trade-store.ts` | Main trading state (103KB)       |
| `packages/api/src/APIProvider.tsx`                          | WebSocket + QueryClient mgmt     |
| `packages/api/src/useSubscription.ts`                       | Real-time data subscription hook |
| `packages/shared/src/utils/contract/contract-types.ts`      | Contract type utilities          |
| `packages/core/src/App/Constants/routes-config.js`          | Main route configuration         |
| `packages/trader/src/Modules/Trading/Components/Form/`      | Trade form components            |
| `jest.config.js`                                            | Jest configuration               |
| `packages/core/build/webpack.config.js`                     | Main webpack config              |

---

## Quick Reference

### Access Store in Component

```typescript
import { observer, useStore } from '@deriv/stores';

const MyComponent = observer(() => {
    const { client, trading } = useStore();
    return <div>{client.email}</div>;
});
```

### Create API Query

```typescript
import { useQuery } from '@deriv/api';

const { data, isLoading, error } = useQuery('active_symbols', {
    payload: { active_symbols: 'brief' },
});
```

### Modify Store State

```typescript
import { action, makeObservable, observable } from 'mobx';

class MyStore {
    @observable count = 0;

    @action increment() {
        this.count++;
    }

    constructor() {
        makeObservable(this);
    }
}
```

### Create Responsive Component

```typescript
import { useDevice } from '@deriv-com/ui';

const MyComponent = () => {
    const { isMobile } = useDevice();
    return isMobile ? <MobileUI /> : <DesktopUI />;
};
```

### Subscribe to Real-Time Data

```typescript
const { subscribe, unsubscribe, data } = useSubscription('ticks');

React.useEffect(() => {
    subscribe({ payload: { symbol: 'frxEURUSD' } });
    return () => unsubscribe();
}, []);
```

---

## Resources

- **MobX Docs:** https://mobx.js.org
- **React Query Docs:** https://tanstack.com/query
- **Deriv API Docs:** https://api.deriv.com
- **TypeScript Handbook:** https://www.typescriptlang.org/docs
- **Webpack Docs:** https://webpack.js.org

---

_Last updated: 2025-12-12_
_Monorepo with 9 packages, ~210K LOC, React 18 + MobX 6 + TypeScript 5_
