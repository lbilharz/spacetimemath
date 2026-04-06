# Deployment and Workflow Manual

Here is a summary of our recent operations, findings, and deployment knowledge. Keep this reference handy for future App Store updates and testing!

## 1. Passing SpacetimeDB Identities (User IDs)

When working directly with identities in SpacetimeDB, ensure you pass them formatted as a hex string with a `0x` prefix.

- **String Format:** `"0xc20084a5..."`
- **Object/Serialized Definition:** `{"__identity__": "0xc20084a5..."}`

## 2. Generating Dummy Bot Usage on Production

You can generate realistic student test traffic in your classes using the `loadTestAgents.ts` script. This runs bot simulations of 10 different kids with varying speeds and error rates. 

To run against a **Production** classroom (e.g., Code `BKSSBT`):

```bash
cd client
TEST_STDB_DB=spacetimemath npx tsx scripts/loadTestAgents.ts BKSSBT
```

- When the bots join, they will wait idle.
- Open the app via a Teacher Account, navigate to that class, and click **Start Sprint**.
- The bots will instantly begin answering questions and simulating traffic!

## 3. Capacitor \u0026 Fastlane iOS Builds

`fastlane` only targets native compilation (`xcodebuild`). Because the App uses Capacitor, standard Web/JS code isn't inherently rebuilt when Xcode builds the app.

**Important:** Before you package the iOS binary for TestFlight or App Store Review, you *must* compile the React application and copy it into the iOS framework.

**Workflow in Terminal:**
```bash
npm run build
npx cap sync ios
# Now it's safe to run fastlane natively:
cd ios/App \u0026\u0026 bundle exec fastlane beta
```

*(Note: We have officially updated your Fastlane `beta` and `release` lanes so they now run `build_web` at the beginning. You no longer have to manually think about this!)*

## 4. App Store Connect Login Credentials

Since this app uses a token-based "Recovery Key" flow instead of a traditional email/password input, Apple Reviewers can easily get confused, leading to rejection.

Follow this standard structure inside Testflight/App Store connect for your login parameters:
- **Demo User Field**: `Teacher Recovery Token`
- **Demo Password Field**: `<Your Token Here>` (Reviewers usually copy/paste the Apple Review password directly).

Always provide **clear, step-by-step Apple Review instructions** mapping their expectations to the App's UI, e.g.:

> No username/email is required. To authenticate for your review:
> 1) Tap 'Account Recovery' or 'Recovery Key' on the first screen.
> 2) Paste the token from the password field.
> 3) You are now logged in as the demo teacher.
