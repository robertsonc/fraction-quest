import { test, expect, freshLearner, clickThrough, axeClean, noHorizontalScroll, answer } from './helpers';

test.describe('platform', () => {
  test('profiles: several learners on one device, settings apply to the document', async ({ page }) => {
    await freshLearner(page, 11, 'Theo');
    await page.click('[data-action="switch"]');
    await expect(page.locator('[data-profile]')).toHaveCount(1);
    await page.fill('#nick', 'Priya');
    await page.click('[data-action="create"]');
    await expect(page.locator('.who')).toContainText('Priya');
    await page.click('[data-action="settings"]');
    await page.check('#set-dyslexiaFont');
    await page.check('#set-readAloud');
    await page.selectOption('#set-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-font', 'dyslexic');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-font', 'dyslexic');
    await axeClean(page, 'map dark');
  });

  test('store recovery: a corrupted schema record starts fresh with a notice, never a crash', async ({ page }) => {
    await freshLearner(page, 12, 'Jun');
    await page.evaluate(() => new Promise<void>((resolve, reject) => {
      const r = indexedDB.open('fqu');
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction('meta', 'readwrite');
        tx.objectStore('meta').put({ key: 'schema', version: 'broken' });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      r.onerror = () => reject(r.error);
    }));
    await page.reload();
    await expect(page.locator('#toast')).toContainText('Starting fresh');
    await expect(page.locator('#nick')).toBeVisible();
    await expect(page.locator('[data-profile]')).toHaveCount(0);
  });

  test('keyboard: the item can be answered with the keyboard alone; touch targets are at least 44 px', async ({ page }) => {
    await freshLearner(page, 13, 'Rosa');
    await page.goto('?test=1&seed=13#/practice/nf.equiv');
    await clickThrough(page);
    await noHorizontalScroll(page);
    const small = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('button, a.btn, input, [role="button"]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < 44 || r.height < 44) out.push(`${el.tagName.toLowerCase()}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return out;
    });
    expect(small).toEqual([]);
    const { item } = await answer(page, 'right');
    expect(item).toBeTruthy();
    await expect(page.locator('.note.good')).toBeVisible();
    // Reduced motion: walkthrough shows stills and still ends on the answer.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('?test=1&seed=13#/lesson/nf.equiv');
    await expect(page.locator('.hook')).toBeVisible();
    await clickThrough(page, '.wt-next');
    await page.locator('.wt-dot').last().click();
    await expect(page.locator('.wt-eq .equation')).toContainText('=');
  });

  test('manifest and service worker are served; the page has no inline scripts', async ({ page, request }) => {
    const m = await request.get('manifest.webmanifest');
    expect(m.ok()).toBe(true);
    expect((await m.json()).scope).toBe('/world/');
    const sw = await request.get('sw.js');
    expect(sw.ok()).toBe(true);
    expect(await sw.text()).toContain('fqu-');
    await page.goto('?test=1#/profiles');
    const inline = await page.evaluate(() => [...document.querySelectorAll('script')].filter((s) => !s.src).length);
    expect(inline).toBe(0);
  });
});
