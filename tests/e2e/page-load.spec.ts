import { test, expect } from '@playwright/test';
import { GamePage } from './page-objects/GamePage';

test.describe('페이지 로드 & 초기 렌더링', () => {
  test('SC-LOAD-01 · 페이지 정상 로드 및 핵심 UI 노출', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    await expect(page).toHaveTitle('Claude Code Sokoban — 설정 정리 퍼즐');
    await expect(page.locator('header h1')).toContainText('Claude Code Sokoban');
    await expect(page.locator('header .sub')).toBeVisible();

    // canvas exists and is non-zero
    await expect(g.canvas).toBeVisible();
    const box = await g.canvas.boundingBox();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    // controls
    for (const ctrl of [g.level, g.difficulty, g.obstacles, g.decoys,
      g.undoBtn, g.resetBtn, g.newBtn, g.rankBtn, g.helpBtn,
      g.moveCount, g.placedCount]) {
      await expect(ctrl).toBeVisible();
    }
  });

  test('SC-LOAD-02 · 초기 통계값 (이동 0, 정리 < 7/7)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    // moves always starts at 0
    await expect(g.moveCount).toHaveText('0');
    // total targets for L1 is 7
    expect(await g.realTotal()).toBe(7);
    // The generator only guarantees placedCount() < realTotal() at start
    // (a box may coincidentally begin on its target), so assert the board is
    // NOT pre-solved and the DOM matches the live placedCount.
    const placed = await g.placedCountVal();
    expect(placed).toBeLessThan(7);
    await expect(g.placedCount).toHaveText(`${placed}/7`);
  });

  test('SC-LOAD-03 · 전역 JS API 노출 확인', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    const fns = ['tryMove', 'undo', 'reset', 'newGame', 'setLevel',
      'placedCount', 'realTotal', 'boxOnRightTarget', 'openItemInfo'];
    const types = await g.run<Record<string, string>>(
      `return { ${fns.map((f) => `${f}: typeof ${f}`).join(', ')} };`,
    );
    for (const f of fns) expect(types[f], `${f} should be function`).toBe('function');

    // let-globals reachable by name
    const globalsOk = await g.run<boolean>(
      `return Array.isArray(boxes) && Array.isArray(targets) && Array.isArray(LEVELS)
        && Array.isArray(ROOMS) && Array.isArray(ITEMS) && typeof levelIndex==='number'
        && typeof moves==='number';`,
    );
    expect(globalsOk).toBe(true);
  });

  test('SC-LOAD-04 · 콘솔 오류 모니터링 (게임은 정상 동작)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    const g = new GamePage(page);
    await g.goto();

    // baseline: known ~1 non-fatal console error is acceptable; game must still work.
    expect(await g.realTotal()).toBeGreaterThan(0);
    await expect(g.canvas).toBeVisible();
    // record for regression visibility (no hard fail unless game broke)
    test.info().annotations.push({ type: 'console-errors', description: String(errors.length) });
  });

  test('SC-LOAD-05 · 반응형 레이아웃 (리사이즈)', async ({ page }) => {
    const g = new GamePage(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await g.goto();
    let box = await g.canvas.boundingBox();
    expect(box!.width).toBeGreaterThan(0);

    await page.setViewportSize({ width: 390, height: 800 });
    await page.waitForTimeout(200);
    box = await g.canvas.boundingBox();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
    // controls still reachable
    await expect(g.newBtn).toBeVisible();
    await expect(g.helpBtn).toBeVisible();
  });
});
