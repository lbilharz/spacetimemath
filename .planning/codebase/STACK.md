# Technology Stack

**Analysis Date:** 2026-03-14

## Languages

**Primary:**
- TypeScript 5.7.2 - Client React application and serverless API endpoints
- Rust 2021 edition - SpacetimeDB server module (WASM compilation target)
- JavaScript - Build scripts and configuration

**Secondary:**
- HTML5 - Application shell and structure
- CSS3 - Application styling

## Runtime

**Environment:**
- Node.js (unspecified version, use system or .nvmrc if present)

**Package Manager:**
- npm - Lockfile: `package-lock.json` present in both root and `client/`

## Frameworks

**Core:**
- React 19.x - Client UI framework
- Vite 6.2.0 - Client build tool and dev server
- SpacetimeDB 2.0.0/2.0.3 - Realtime backend platform with WASM module deployment

**UI/Interaction:**
- React DOM 19.x - React rendering for web
- React I18Next 16.5.6 - Internationalization integration
- Capacitor 8.2.0 - iOS app wrapper and cross-platform API abstraction
- Capacitor Haptics 8.0.1 - Device vibration/feedback

**Testing:**
- Vitest 4.1.0 - Unit and integration test runner
- Vitest integration config at `client/vitest.integration.config.ts` with 30s timeout for slow tests

**Build/Dev:**
- TypeScript 5.7.2 - Type checking
- Vite React Plugin 4.3.4 - JSX support in Vite
- ESLint 9.0.0 - Code linting
- TypeScript ESLint 8.57.0 - TypeScript-aware linting
- ESLint React Hooks Plugin 7.0.1 - React Hooks best practice enforcement

## Key Dependencies

**Critical:**
- `spacetimedb` 2.0.0 - Client SDK for real-time database synchronization and reducer invocation
- `@capacitor/core` 8.2.0 - Capacitor runtime for iOS/Android features
- `@capacitor/ios` 8.2.0 - iOS-specific Capacitor plugins
- `@capacitor/cli` 8.2.0 - CLI for Capacitor builds and syncing

**UI/Styling:**
- `@fontsource-variable/dm-sans` 5.2.8 - Self-hosted variable font (GDPR compliant)
- `qrcode.react` 4.2.0 - QR code generation and rendering
- `canvas` 3.2.1 - Canvas rendering (used by dependencies like qrcode.react)

**Internationalization:**
- `i18next` 25.8.14 - i18n framework
- `react-i18next` 16.5.6 - React i18n hooks and context
- `i18next-browser-languagedetector` 8.2.1 - Auto-detect browser language

**External Services:**
- `resend` 6.9.3 - Email sending SDK for recovery key emails

**Utilities:**
- `react-icons` 5.6.0 - Icon library (from root package.json)

**Server/WASM Build:**
- `spacetimedb` 2.0.3 (server dependency) - Rust framework for WASM modules
- `log` 0.4 - Logging in Rust

## Configuration

**Environment:**
- `.env.local` - Local development overrides (git-ignored)
- `.env.production` - Production environment variables for deployed instance
- Test environment: `TEST_STDB_URI` and `TEST_STDB_DB` configured in `client/src/__tests__/global-setup.ts`
- Default test DB: `wss://maincloud.spacetimedb.com` / `spacetimemath-test`

**Key environment variables (inferred):**
- `RESEND_API_KEY` - Email service authentication
- `APP_URL` - Application URL for recovery email links (default: `https://spacetimemath.vercel.app`)
- `TEST_STDB_URI` - SpacetimeDB WebSocket endpoint for integration tests
- `TEST_STDB_DB` - Integration test database name

**Build:**
- `vite.config.ts` - Main Vite configuration for development and production builds
- `vitest.integration.config.ts` - Vitest configuration for integration tests (excludes unit tests)
- `tsconfig.json` - TypeScript project references
- `tsconfig.app.json` - Client application TypeScript config (target ES2020, strict mode)
- `tsconfig.node.json` - Build tools TypeScript config
- `tsconfig.test.json` - Test TypeScript config
- `eslint.config.ts` - ESLint configuration with React and TypeScript rules
- `vercel.json` - Vercel deployment configuration with URL rewrite rules

## Platform Requirements

**Development:**
- macOS/Linux/Windows with Node.js and npm
- Rust 1.70+ with `wasm32-unknown-unknown` target for server builds
- Capacitor CLI for iOS development
- Xcode (for iOS builds)
- SpacetimeDB CLI at `~/.local/bin/spacetime`

**Production:**
- Deployment target: Vercel (per `vercel.json` and `send-recovery-email.ts` using `@vercel/node`)
- iOS deployment via Apple App Store (built with Capacitor)
- SpacetimeDB backend deployed on maincloud.spacetimedb.com (database: `spacetimemath`)

## Build & Release Process

**WASM Server Build:**
- `cargo build --target wasm32-unknown-unknown --release` - Produces `server/target/wasm32-unknown-unknown/release/spacetimemath.wasm`
- Published to maincloud via SpacetimeDB CLI
- Make commands at `/Users/lbi/Projects/spacetimemath/Makefile`:
  - `make publish` - Publish to production database
  - `make publish-test` - Publish to integration test database
  - `make generate` - Regenerate TypeScript module bindings

**Client Build:**
- `npm run build` - TypeScript check then Vite production build
- Output: `client/dist/` (deployed to Vercel)
- `npm run dev` - Local dev server with hot reload
- `npm test` - Run Vitest unit tests
- `npm run test:integration` - Run integration tests against SpacetimeDB

---

*Stack analysis: 2026-03-14*
