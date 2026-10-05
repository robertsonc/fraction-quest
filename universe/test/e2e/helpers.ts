import { expect, type Page, test as base } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type Answer = { kind: 'int'; value: number } | { kind: 'frac'; n: number; d: number } | { kind: 'bool'; value: boolean };
interface Item { id: string; kind: string; rep: string; skillId: string; templateId: string; answer: Answer }

declare global {
  interface Window {
    __fqu: {
      current(): Item | null;
      advance(ms: number): void;
      plainWrong(): Answer | null;
      misconceptionAnswer(id: string): Answer | null;
      repo: unknown;
      app: { profile: { id: string } | null };
    };
  }
}

/** Fails the test on any console error, page error or failed request (DESIGN.md 10.4). */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()} ${r.failure()?.errorText ?? ''}`));
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
    await use(errors);
    expect(errors, 'zero console errors and failed requests').toEqual([]);
  },
});

export { expect };

export async function freshLearner(page: Page, seed: number, name = 'Maya'): Promise<void> {
  await page.goto(`?test=1&seed=${seed}#/profiles`);
  await page.waitForSelector('#nick');
  await page.fill('#nick', name);
  await page.click('[data-action="create"]');
  await page.waitForSelector('.map');
}

export async function currentItem(page: Page): Promise<Item> {
  const item = await page.evaluate(() => window.__fqu.current());
  if (!item) throw new Error('no item on screen');
  return item;
}

/** Clicks Next through any walkthrough until an item (or the given selector) is on screen. */
export async function clickThrough(page: Page, until = '.item', max = 40): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await page.locator(until).count()) return;
    const skip = page.locator('.hook button:has-text("Skip")');
    if (await skip.count()) { await skip.click(); await page.waitForTimeout(150); continue; }
    const next = page.locator('.wt-next');
    if (await next.count()) { await next.click({ force: true }); await page.waitForTimeout(250); continue; }
    const cont = page.locator('[data-action="next"]');
    if (await cont.count()) { await cont.first().click(); await page.waitForTimeout(150); continue; }
    await page.waitForTimeout(200);
  }
  await expect(page.locator(until)).toBeVisible();
}

export async function typeAnswer(page: Page, a: Answer): Promise<void> {
  if (a.kind === 'int') await page.fill('input[data-k="v"]', String(a.value));
  if (a.kind === 'frac') { await page.fill('input[data-k="n"]', String(a.n)); await page.fill('input[data-k="d"]', String(a.d)); }
  if (a.kind === 'bool') await page.click(`.opt[data-v="${a.value ? 'yes' : 'no'}"]`);
}

export type How = 'right' | 'wrong' | 'guess' | { misconception: string };

/**
 * Answers the item on screen. 'right' and 'wrong' advance the clock past the 3.5 s guess threshold first;
 * 'guess' answers wrong without advancing it.
 */
export async function answer(page: Page, how: How): Promise<{ item: Item; answer: Answer }> {
  const item = await currentItem(page);
  let a: Answer | null;
  if (how === 'right') a = item.answer;
  else if (how === 'wrong' || how === 'guess') a = await page.evaluate(() => window.__fqu.plainWrong());
  else a = await page.evaluate((id) => window.__fqu.misconceptionAnswer(id), how.misconception);
  if (!a) throw new Error(`no ${JSON.stringify(how)} answer available for ${item.kind}`);
  if (how !== 'guess') await page.evaluate(() => window.__fqu.advance(4000));
  await typeAnswer(page, a);
  // Typed answers submit with Enter (keyboard path); yes or no uses the Check button (pointer path).
  if (a.kind === 'bool') await page.click('[data-action="check"]');
  else await page.keyboard.press('Enter');
  await expect(page.locator('.item .note:not([hidden])').last()).toBeVisible();
  return { item, answer: a };
}

/** Answers items right until the one on screen satisfies the predicate (for example, not a yes-or-no item). */
export async function skipUntil(page: Page, pred: (item: Item) => boolean, max = 8): Promise<Item> {
  for (let i = 0; i < max; i++) {
    const item = await currentItem(page);
    if (pred(item)) return item;
    await answer(page, 'right');
    await proceed(page);
    await clickThrough(page);
  }
  throw new Error('no matching item');
}

/** Presses Continue when the flow shows it. */
export async function proceed(page: Page): Promise<void> {
  const cont = page.locator('[data-action="next"]');
  await expect(cont.first()).toBeVisible();
  await cont.first().click();
}

export async function axeClean(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), `axe on ${label}`).toEqual([]);
}

export async function noHorizontalScroll(page: Page): Promise<void> {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over, 'no horizontal page scroll').toBeLessThanOrEqual(0);
}

export async function skillState(page: Page, skillId: string): Promise<{ status: string; window: unknown[]; reviewDueSession: number | null; coachFlags: number; reviewStage: number }> {
  return page.evaluate(async (id) => {
    const w = window.__fqu as unknown as { repo: { skillState(p: string, s: string): Promise<never> }; app: { profile: { id: string } } };
    return w.repo.skillState(w.app.profile.id, id);
  }, skillId);
}
