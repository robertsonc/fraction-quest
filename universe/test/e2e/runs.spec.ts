import { test, expect, freshLearner, clickThrough, answer, proceed, axeClean, noHorizontalScroll, skillState, currentItem, skipUntil } from './helpers';

test.describe('learner runs', () => {
  test('perfect run: lesson to mastery, meter fills, review scheduled', async ({ page, errors }) => {
    await freshLearner(page, 101);
    await axeClean(page, 'map');
    await noHorizontalScroll(page);
    await page.click('[data-skill="nf.equiv"]');
    await expect(page.locator('[data-status="fresh"]')).toBeVisible();
    await page.click('[data-action="lesson"]');
    await expect(page.locator('.hook')).toBeVisible();
    await axeClean(page, 'hook');
    await clickThrough(page);
    await axeClean(page, 'guided item');
    await noHorizontalScroll(page);

    // Guided (3), independent (4), check (4): every answer right and unhurried.
    for (let i = 0; i < 11; i++) {
      await answer(page, 'right');
      await expect(page.locator('.note.good').last()).toContainText('Yes');
      if (i < 10) { await proceed(page); await clickThrough(page); }
    }
    await proceed(page);
    await expect(page.locator('[data-stage="summary"]')).toBeVisible();
    await expect(page.locator('.result-big')).toContainText('4 of 4');
    await expect(page.locator('.bubble')).toContainText('mastered');
    const st = await skillState(page, 'nf.equiv');
    expect(st.status).toBe('mastered');
    expect(st.reviewDueSession).not.toBeNull();
    expect(st.window.length).toBe(5);

    await page.click('[data-action="map"]');
    await expect(page.locator('.node.mastered[data-skill="nf.equiv"]')).toBeVisible();
    await page.click('[data-skill="nf.equiv"]');
    await expect(page.locator('.meter i.on')).toHaveCount(5);
    expect(errors).toEqual([]);
  });

  test('guessing run: fast wrong answers are never praised and route to a guided replay', async ({ page }) => {
    await freshLearner(page, 202);
    await page.goto('?test=1&seed=202#/practice/nf.equiv');
    await clickThrough(page);
    const { item } = await answer(page, 'guess');
    await expect(page.locator('.note.bad').last()).toContainText('That was quick');
    await expect(page.locator('.note.good')).toHaveCount(0);
    await proceed(page);
    await expect(page.locator('[data-stage="micro"]')).toBeVisible();
    await expect(page.locator('[data-stage="micro"] h2')).toContainText('quick look');
    // Quick check: three items, two right passes.
    await clickThrough(page);
    await expect(page.locator('.item[data-mode="quick"]')).toBeVisible();
    await answer(page, 'right');
    await proceed(page);
    await clickThrough(page);
    await answer(page, 'right');
    await proceed(page);
    // Return item: same template, fresh numbers.
    await clickThrough(page);
    await expect(page.locator('.item[data-mode="return"]')).toBeVisible();
    const back = await currentItem(page);
    expect(back.templateId).toBe(item.templateId);
    expect(back.id).not.toBe(item.id);
    await answer(page, 'right');
    await proceed(page);
    await clickThrough(page);
    await expect(page.locator('.item[data-mode="practice"]')).toBeVisible();
    const guesses = await page.evaluate(async () => {
      const w = window.__fqu as unknown as { repo: { attempts(p: string): Promise<{ guess: boolean }[]> }; app: { profile: { id: string } } };
      return (await w.repo.attempts(w.app.profile.id)).filter((a) => a.guess).length;
    });
    expect(guesses).toBe(1);
  });

  test('misconception run: a classified wrong answer plays its targeted micro-lesson and the coach sees it', async ({ page }) => {
    await freshLearner(page, 303);
    await page.goto('?test=1&seed=303#/practice/nf.equiv');
    await clickThrough(page);
    // Find an item where "adds to both" applies (missing-part or find-pair).
    let misId = 'adds-to-both';
    for (let i = 0; i < 6; i++) {
      const item = await currentItem(page);
      const has = await page.evaluate((id) => window.__fqu.misconceptionAnswer(id) !== null, misId);
      if (has && item.kind !== 'is-equivalent') break;
      await answer(page, 'right');
      await proceed(page);
      await clickThrough(page);
    }
    await answer(page, { misconception: misId });
    await expect(page.locator('.note.bad').last()).toContainText('Multiply instead');
    await proceed(page);
    await expect(page.locator('[data-stage="micro"] h2')).toContainText('why we multiply, not add');
    await clickThrough(page);
    await expect(page.locator('.item[data-mode="quick"]')).toBeVisible();
    await answer(page, 'right');
    await proceed(page);
    await clickThrough(page);
    await answer(page, 'right');
    await proceed(page);
    await clickThrough(page);
    await expect(page.locator('.item[data-mode="return"]')).toBeVisible();

    // Coach view, behind the 3 second hold.
    await page.goto('?test=1&seed=303#/map');
    const hold = page.locator('[data-action="coach"]');
    const box = await hold.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1200);
    await expect(page.locator('.coach')).toHaveCount(0); // not yet
    await page.waitForTimeout(2200);
    await page.mouse.up();
    await expect(page.locator('.coach')).toBeVisible();
    await expect(page.locator('tr[data-skill="nf.equiv"]')).toContainText('Adds to the top and bottom');
    await expect(page.locator('tr[data-skill="nf.equiv"]')).toContainText('Example:');
    await axeClean(page, 'coach');
  });

  test('depth-2 remediation run: two prerequisite drops, then a coach flag and an easy win, never stuck', async ({ page }) => {
    await freshLearner(page, 404);
    await page.goto('?test=1&seed=404#/practice/nf.equiv');
    await clickThrough(page);
    // Two plain misses on a typed item (a yes-or-no miss is always a classified misconception): hint, then the skill micro-lesson.
    await skipUntil(page, (i) => i.kind !== 'is-equivalent');
    await answer(page, 'wrong');
    await expect(page.locator('.hintbox')).toBeVisible();
    await expect(page.locator('.hintbox')).not.toContainText(/Multiply by \d/);
    await answer(page, 'wrong');
    await proceed(page);
    await expect(page.locator('[data-stage="micro"]')).toBeVisible();
    const failQuick = async () => {
      await clickThrough(page);
      await expect(page.locator('.item[data-mode="quick"]')).toBeVisible();
      await answer(page, 'wrong');
      await proceed(page);
      await clickThrough(page);
      await answer(page, 'wrong');
      await proceed(page);
    };
    await failQuick(); // depth 0 fails -> prerequisite 1
    await expect(page.locator('[data-stage="micro"] h2')).toContainText('What a fraction means');
    await expect(page.locator('.rail .crumb')).toContainText('What a fraction means');
    await failQuick(); // depth 1 fails -> prerequisite 2
    await expect(page.locator('[data-stage="micro"] h2')).toContainText('Multiplication facts');
    await failQuick(); // depth 2 fails -> coach flag
    await expect(page.locator('[data-stage="coachflag"]')).toBeVisible();
    await page.click('[data-action="easywin"]');
    await expect(page.locator('.item[data-mode="easywin"]')).toBeVisible();
    await answer(page, 'right');
    await proceed(page);
    await expect(page.locator('.map')).toBeVisible();
    const st = await skillState(page, 'nf.equiv');
    expect(st.coachFlags).toBe(1);
    expect(st.status).not.toBe('fresh');
    const rems = await page.evaluate(async () => {
      const w = window.__fqu as unknown as { repo: { remediations(p: string): Promise<{ outcome: string; path: string[] }[]> }; app: { profile: { id: string } } };
      return w.repo.remediations(w.app.profile.id);
    });
    expect(rems.at(-1)).toMatchObject({ outcome: 'coach-flag', path: ['nf.meaning', 'ops.multfacts'] });
  });

  test('spaced review demotion: a failed review goes back to practice, not to the start', async ({ page }) => {
    await freshLearner(page, 505);
    // Mastered earlier, review due now.
    await page.evaluate(async () => {
      const w = window.__fqu as unknown as { repo: { skillState(p: string, s: string): Promise<Record<string, unknown>>; putSkillState(s: unknown): Promise<void>; currentSession(p: string): Promise<{ dayIndex: number }>; reviewIndex(s: unknown): number }; app: { profile: { id: string } } };
      const pid = w.app.profile.id;
      const s = await w.repo.skillState(pid, 'nf.equiv');
      const session = await w.repo.currentSession(pid);
      const idx = w.repo.reviewIndex(session);
      const win = Array.from({ length: 5 }, (_, i) => ({ correct: true, aided: false, guess: false, rep: i % 2 ? 'bar' : 'area' }));
      await w.repo.putSkillState({ ...s, status: 'mastered', window: win, masteredAtSession: idx - 1, reviewDueSession: idx, reviewStage: 0, lessonSeen: true });
    });
    await page.reload();
    await expect(page.locator('[data-review-due]')).toBeVisible();
    await expect(page.locator('.node.review[data-skill="nf.equiv"]')).toBeVisible();
    await page.click('[data-skill="nf.equiv"]');
    await expect(page.locator('.item[data-mode="review"]')).toBeVisible();
    await expect(page.locator('[data-action="hint"]')).toHaveCount(0);
    await answer(page, 'wrong');
    await proceed(page);
    await answer(page, 'wrong');
    await proceed(page);
    await expect(page.locator('[data-stage="review-done"][data-passed="false"]')).toBeVisible();
    await expect(page.locator('.result-big')).toContainText('back in practice');
    const st = await skillState(page, 'nf.equiv');
    expect(st.status).toBe('practice');
    expect(st.window).toEqual([]);
    expect(st.reviewStage).toBe(0);
    await page.click('text=Map');
    await expect(page.locator('.node.open[data-skill="nf.equiv"]')).toBeVisible();
  });

  test('spaced review pass: moves to the next stage', async ({ page }) => {
    await freshLearner(page, 606);
    await page.evaluate(async () => {
      const w = window.__fqu as unknown as { repo: { skillState(p: string, s: string): Promise<Record<string, unknown>>; putSkillState(s: unknown): Promise<void>; currentSession(p: string): Promise<unknown>; reviewIndex(s: unknown): number }; app: { profile: { id: string } } };
      const pid = w.app.profile.id;
      const s = await w.repo.skillState(pid, 'nf.equiv');
      const idx = w.repo.reviewIndex(await w.repo.currentSession(pid));
      await w.repo.putSkillState({ ...s, status: 'mastered', masteredAtSession: idx - 1, reviewDueSession: idx, reviewStage: 0 });
    });
    await page.goto('?test=1&seed=606#/review/nf.equiv');
    await expect(page.locator('.item[data-mode="review"]')).toBeVisible();
    await answer(page, 'wrong');
    await proceed(page);
    await answer(page, 'right');
    await proceed(page);
    await answer(page, 'right');
    await proceed(page);
    await expect(page.locator('[data-stage="review-done"][data-passed="true"]')).toBeVisible();
    const st = await skillState(page, 'nf.equiv');
    expect(st.status).toBe('review');
    expect(st.reviewStage).toBe(1);
  });
});
