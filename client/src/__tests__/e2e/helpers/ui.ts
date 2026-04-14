/**
 * UI helpers for Playwright E2E specs. Keep selectors stable: prefer
 * data-testid over text matchers so locale changes don't break tests.
 */
import type { Page } from '@playwright/test';

/**
 * Click through every onboarding card. No-op if the overlay never appears
 * (e.g. for a player whose onboarding_done was already set on the server).
 */
export async function dismissOnboarding(page: Page): Promise<void> {
  const overlay = page.getByTestId('onboarding-overlay');
  try {
    await overlay.waitFor({ state: 'visible', timeout: 5_000 });
  } catch {
    return; // Overlay never appeared — fine.
  }

  const nextBtn = page.getByTestId('onboarding-next');
  // Click until the overlay is gone. The final card's button calls handleDone
  // (start sprint), after which the button enters a `disabled={finishing}`
  // state for a moment before the overlay unmounts — skip clicks while the
  // button is disabled so we don't deadlock.
  for (let i = 0; i < 10; i++) {
    if (!(await overlay.isVisible({ timeout: 250 }).catch(() => false))) return;
    if (await nextBtn.isDisabled().catch(() => true)) {
      // Already in flight — wait for the overlay to detach instead of clicking.
      await overlay.waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {});
      return;
    }
    await nextBtn.click();
    await page.waitForTimeout(150);
  }
}

/**
 * Solve the currently displayed problem with the correct answer (a×b),
 * read directly from the data attributes on `[data-testid=current-problem]`.
 *
 * Works for keyboard input mode. For tap/numpad mode, the test should pick
 * the matching option from `TapLayout` instead — we don't simulate touch here.
 *
 * Returns true if a problem was solved, false if the sprint ended (URL left
 * /sprint) before another problem appeared. Callers can use the boolean to
 * exit their loop without polling URL separately.
 */
export async function solveOneProblem(page: Page): Promise<boolean> {
  const problem = page.getByTestId('current-problem');
  // Race the next problem against the sprint ending (URL leaves /sprint, e.g.
  // to /results or a tier-unlock celebration that lives on ResultsPage).
  const ended = await Promise.race([
    problem.waitFor({ state: 'visible', timeout: 10_000 }).then(() => false),
    page.waitForURL(u => !u.pathname.startsWith('/sprint'), { timeout: 10_000 })
      .then(() => true),
  ]).catch(() => false);
  if (ended) return false;

  const a = Number(await problem.getAttribute('data-problem-a'));
  const b = Number(await problem.getAttribute('data-problem-b'));
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error(`current-problem missing data-problem-a/b (got a=${a}, b=${b})`);
  }
  const answer = String(a * b);

  const input = page.getByTestId('answer-input');
  if (await input.isVisible({ timeout: 500 }).catch(() => false)) {
    await input.fill(answer);
    await page.getByTestId('answer-submit').click();
    return true;
  }

  // Tap mode: click the option whose text === answer.
  await page.getByRole('button', { name: answer, exact: true }).first().click();
  return true;
}
