# Briefing: Reactivate E2E Tests

## Problem

All 7 Playwright E2E tests are currently skipped. The pre-push hook (`npm run test:e2e:ci`) runs them but they all pass vacuously. We have zero E2E coverage.

## Why they broke

The registration page was refactored from a 3-path flow (Teacher / Student / Solo) to a single-step gamertag flow. The old tests looked for buttons like "Teacher", "Student", "Practice on your own" that no longer exist. The new RegisterPage shows:

1. A pre-filled gamertag input (auto-generated via `generateGamertag()`)
2. A single "Join" submit button
3. A "Restore account" link that leads to recovery code or email restore

There is no teacher flow, no student flow, no class code input, no email input, no GDPR checkboxes on the registration page anymore.

## Current test files

All in `client/src/__tests__/e2e/`:

| File | Tests | Status | What needs to happen |
|------|-------|--------|---------------------|
| `auth.spec.ts` | 3 tests (Solo, Student, Teacher) | `describe.skip` | Rewrite: Solo flow only, delete Student/Teacher |
| `mail.spec.ts` | 2 tests (teacher verif, account recovery email) | Both `test.skip` | Delete teacher test, rewrite or keep-skip account recovery |
| `restore.spec.ts` | 1 test (email restore flow) | `test.skip` | Rewrite to match new restore UI |
| `sprint.spec.ts` | 1 test (solo sprint loads) | `describe.skip` | Rewrite registration preamble, rest should still work |

## New registration flow (what tests should do)

```
page.goto('/')
  -> RegisterPage renders
  -> input[type="text"] is pre-filled with a gamertag like "TurboDino42"
  -> One submit button with text matching t('register.joinSprint') = "Join Sprint" (en)
  -> Click submit (or press Enter)
  -> Player registers as Solo, auto-generates recovery key
  -> Redirects to /lobby after ~300ms
```

Key selectors on the new RegisterPage:
- Username input: `input[type="text"][maxLength="24"]` (only text input, pre-filled)
- Submit button: `button[type="submit"]` containing "Join Sprint" text
- Restore link: button containing "↺" that toggles restore panel
- Restore mode selector: two cards — one with "12-digit code" text, one with "I know my email"
- Recovery code input: `input[type="text"][maxLength="12"]` (uppercase, tracking-wide)
- Email input: `input[type="email"]`
- 6-digit verify input: `input[type="text"][maxLength="6"][autocomplete="one-time-code"]`

## What to rewrite

### 1. `auth.spec.ts` — Registration + Lobby arrival

Remove `describe.skip`. Delete Student and Teacher tests entirely. Rewrite Solo test:

```ts
test('Registration with gamertag drops into Lobby', async ({ page }) => {
  await page.goto('/');

  // Pre-filled gamertag input should be visible
  const nameInput = page.locator('input[type="text"]');
  await nameInput.waitFor({ state: 'visible', timeout: 10000 });

  // Should be pre-filled with a generated gamertag
  const prefilled = await nameInput.inputValue();
  expect(prefilled.length).toBeGreaterThan(0);

  // Optionally change the name
  await nameInput.fill('E2E Tester');

  // Submit
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();

  // Should arrive at lobby
  await expect(page).toHaveURL(/.*lobby/, { timeout: 15000 });
});
```

### 2. `sprint.spec.ts` — Sprint loads after registration

Remove `describe.skip`. Fix the registration preamble (same pattern as above — fill input, click submit, wait for lobby). Then the existing sprint-start logic should mostly work, but update the selectors:
- No more onboarding overlay with "→" buttons
- Lobby has a "Start Sprint" button

### 3. `restore.spec.ts` — Email restore flow

Rewrite to match new UI. The flow is now:
```
RegisterPage -> click "↺" restore link -> select "I know my email" card
-> fill email input -> submit -> mock API returns signature
-> 6-digit code input appears -> fill code -> submit
-> (expect backend validation error since signature is mocked)
```

Key change: there's no "Already have an account" button anymore. It's the "↺" restore link at the bottom of the registration card.

### 4. `mail.spec.ts` — Delete or gut

- **Teacher verification test**: DELETE entirely. Teacher verification moved to post-registration TeacherUpgradeForm, not accessible from RegisterPage.
- **Account recovery email test**: Can stay skipped for now (it requires a registered+logged-in user navigating to /account, which is complex to set up in E2E).

## Important notes

- The app connects to **live SpaceTimeDB** (`wss://maincloud.spacetimedb.com`). Registration creates real player rows. Use unique names with random suffixes to avoid collisions.
- `waitForFunction(() => localStorage.getItem('spacetimemath_credentials') !== null)` is still needed — the SpaceTimeDB SDK sets this on connect, and reducers will fail without it.
- The pre-push hook runs `concurrently "vite --mode test" "wait-on http://localhost:5173/ && playwright test"` — the dev server starts automatically, you don't need webServer config in playwright.config.ts.
- After registration, `App.tsx` has a 3-second sync timeout before showing content. Tests should wait for lobby URL with sufficient timeout (15s).
- Run tests locally with: `cd client && npx playwright test` (needs dev server running separately) or `npm run test:e2e:ci` (starts its own dev server).

## Definition of done

- `npm run test:e2e:ci` runs with **at least 2 tests not skipped and passing**:
  1. Registration -> Lobby arrival
  2. Sprint loads after registration
- No `describe.skip` on any test file (individual `test.skip` is OK for tests that need backend state we can't mock)
- Pre-push hook passes
