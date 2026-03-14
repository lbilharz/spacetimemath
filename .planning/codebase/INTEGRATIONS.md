# External Integrations

**Analysis Date:** 2026-03-14

## APIs & External Services

**Email Service:**
- Resend - Recovery key email delivery
  - SDK/Client: `resend` npm package (v6.9.3)
  - Auth: `process.env.RESEND_API_KEY`
  - Endpoint: `/api/send-recovery-email` (Vercel serverless function at `client/api/send-recovery-email.ts`)
  - Usage: User requests recovery key be emailed to arbitrary email address
  - Email template includes recovery code and restore link
  - Reply: `from: '1UP <onboarding@resend.dev>'`

## Data Storage

**Databases:**
- SpacetimeDB (maincloud.spacetimedb.com)
  - Production database: `spacetimemath`
  - Integration test database: `spacetimemath-test`
  - Connection: WebSocket via `spacetimedb` SDK
  - Client: `spacetimedb` npm package v2.0.0 with React hooks integration
  - Auth: Identity-based (automatically generated per session)
  - Tables: Players, Sessions, Answers, ProblemStats, UnlockLogs, Classrooms, ClassroomMembers, OnlinePlayers, TransferCodes, RecoveryKeys
  - Server: Rust WASM module at `server/src/lib.rs`
  - Reducers: Transaction-like operations invoked from client (e.g., `setUsername`, `createTransferCode`, `startSoloSprint`, `recordAnswer`)

**File Storage:**
- Local filesystem only (dist/ for built assets)
- Vercel deployment handles static asset serving

**Caching:**
- Browser LocalStorage for credentials and i18n language preferences
- SpacetimeDB client-side caching of synchronized tables
- Vite dev server cache during development

## Authentication & Identity

**Auth Provider:**
- Custom via SpacetimeDB
  - Implementation: Identity-based system
  - Token storage: Browser localStorage with key `spacetimemath_credentials`
  - Session management: `capturedToken` captured in `src/auth.ts`
  - Credentials persisted and recovered across sessions
  - Recovery via recovery codes emailed to user (recovery key system)
  - Transfer codes enable account migration across devices

## Monitoring & Observability

**Error Tracking:**
- None detected - No Sentry, Rollbar, or similar

**Logs:**
- Server-side: Rust `log` crate (0.4) - Basic logging
- Client-side: Browser console and test output
- Integration tests log environment on startup: `[test] ${process.env.TEST_STDB_URI} / ${process.env.TEST_STDB_DB}`

## CI/CD & Deployment

**Hosting:**
- Vercel - Main deployment platform
  - Configuration: `client/vercel.json`
  - URL rewriting: SPA rewrite rule `/((?!assets/|api/).*)` → `/index.html`
  - API endpoints: Serverless functions at `/api/*` (e.g., `/api/send-recovery-email`)
  - App URL: `https://spacetimemath.vercel.app` (default)

**Mobile:**
- iOS deployment via Capacitor
  - Config: `client/capacitor.config.ts`
  - App ID: `com.bettermarks.oneup`
  - App name: `1UP`
  - Web assets: Served from `client/dist/` after build
  - Capacitor assets generation: `node client/scripts/gen-icon.cjs` then `npx @capacitor/assets generate --ios`

**Server Deployment:**
- SpacetimeDB maincloud (wss://maincloud.spacetimedb.com)
  - WASM binary published via SpacetimeDB CLI
  - No external CI pipeline detected (manual `make publish`)

**CI Pipeline:**
- Git hooks via `hooks/pre-commit` - Runs `npm run lint` and `npm test` in client/ before commits
- Make targets: `make publish`, `make publish-test`, `make generate`, `make deploy`

## Environment Configuration

**Required env vars (production):**
- `RESEND_API_KEY` - Email service secret
- `APP_URL` - Application root URL for email links (defaults to `https://spacetimemath.vercel.app`)

**Required env vars (integration tests):**
- `TEST_STDB_URI` - SpacetimeDB WebSocket endpoint (defaults to `wss://maincloud.spacetimedb.com`)
- `TEST_STDB_DB` - Test database name (defaults to `spacetimemath-test`)

**Optional env vars:**
- `NODE_ENV` - Environment (inferred by build tools)

**Secrets location:**
- `.env.local` - Local development (git-ignored)
- `.env.production` - Production config (git-ignored)
- Vercel secrets dashboard for deployed environment variables

## Webhooks & Callbacks

**Incoming:**
- POST `/api/send-recovery-email` - User initiates recovery email request
  - Parameters: `{ email: string, code: string }`
  - Response: `{ ok: true }` or `{ error: string }`

**Outgoing:**
- Email delivery via Resend (HTTP to Resend API, not webhooks)
- No detected outgoing webhooks

## Capacitor Plugins

**Installed:**
- LocalNotifications - Configured with `smallIcon` and `iconColor` (#FBBA00)
- Haptics - `@capacitor/haptics` for vibration feedback on iOS

**Native Features:**
- Emoji rendering fix: Detects native platform via `Capacitor.isNativePlatform()`, adds `is-native` class to `<html>` for CSS overrides
- WKWebView emoji rendering: Override system fonts to `-apple-system` on native platform (see `src/main.tsx` and `index.css`)

## Real-time Communication

**WebSocket:**
- SpacetimeDB real-time sync protocol via `spacetimedb` SDK
- Connection: `DbConnection` from module bindings
- Multiple React hooks for table subscription and reducer invocation:
  - `useTable()` - Subscribe to table changes
  - `useReducer()` - Invoke server reducers
  - Auto-reconnection on disconnect

## Internationalization

**Provider:**
- i18next with browser language detection
  - LanguageDetector plugin: Auto-detect from localStorage or browser navigator
  - Supported languages: English (en), German (de)
  - Fallback: English
  - Locale files: `src/locales/{en,de}/translation.json`

---

*Integration audit: 2026-03-14*
