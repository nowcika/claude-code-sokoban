import { test, expect } from '@playwright/test';
import { GamePage } from './page-objects/GamePage';

const REAL_TOTALS = { L1: 7, L2: 12, L3: 14, L4: 11 };

test.describe('레벨 선택', () => {
  test('SC-LVL-01 · 레벨 셀렉트 4종 옵션 + 기본 L1', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    const options = g.level.locator('option');
    await expect(options).toHaveCount(4);
    const labels = await options.allTextContents();
    expect(labels[0]).toContain('L1');
    expect(labels[1]).toContain('L2');
    expect(labels[2]).toContain('L3');
    expect(labels[3]).toContain('L4');
    await expect(g.level).toHaveValue('0');
  });

  test('SC-LVL-02 · 레벨 변경 시 보드 재구성 & 통계 리셋', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    // make moveCount > 0
    expect(await g.makeMoves(2)).toBeGreaterThan(0);
    expect(Number(await g.moveCountText())).toBeGreaterThan(0);
    const sigBefore = await g.boardSignature();

    await g.level.selectOption('2'); // L3 via dropdown change event
    await g.waitReady();

    await expect(g.moveCount).toHaveText('0');
    const placed = await g.placedCountVal();
    expect(placed).toBeLessThan(REAL_TOTALS.L3);
    await expect(g.placedCount).toHaveText(`${placed}/${REAL_TOTALS.L3}`);
    expect(await g.boardSignature()).not.toBe(sigBefore);
  });

  test('SC-LVL-03 · 각 레벨 목표 짐 수 (realTotal) 검증', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    for (const [i, total] of [REAL_TOTALS.L1, REAL_TOTALS.L2, REAL_TOTALS.L3, REAL_TOTALS.L4].entries()) {
      await g.setLevel(i);
      expect(await g.realTotal(), `L${i + 1} realTotal`).toBe(total);
      // placedCount denominator equals realTotal; numerator may be >0 (not pre-solved)
      const placed = await g.placedCountVal();
      expect(placed).toBeLessThan(total);
      await expect(g.placedCount).toHaveText(`${placed}/${total}`);
    }
  });

  test('SC-LVL-04 · L4 진입 및 상속 패널 표시', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    await g.level.selectOption('3');
    await g.waitReady();
    expect(await g.realTotal()).toBeGreaterThan(0);
    await expect(g.level).toHaveValue('3');
    await expect(page.locator('.card', { hasText: '설정 상속 (우선순위)' })).toBeVisible();
  });

  test('SC-LVL-05 · (경계) 잘못된 레벨 인덱스 호출은 클램프', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    await g.run('setLevel(-1); newGame();');
    let idx = await g.levelIndex();
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThanOrEqual(3);

    await g.run('setLevel(99); newGame();');
    idx = await g.levelIndex();
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThanOrEqual(3);

    // game still alive
    expect(await g.realTotal()).toBeGreaterThan(0);
  });

  test('SC-LVL-06 · 레벨 전환 시 진행 폐기 (재진입은 새 시작)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    // make some progress on L1 (force one placement so placedCount>0)
    const { dx, dy } = await g.setupOnePush();
    await g.tryMove(dx, dy);
    expect(await g.placedCountVal()).toBeGreaterThan(0);

    await g.setLevel(1); // L2
    await g.setLevel(0); // back to L1

    // re-entry is a fresh game, not the old progress: moves reset to 0 and the
    // board is regenerated (not pre-solved). placedCount numerator may be >0.
    await expect(g.moveCount).toHaveText('0');
    const placed = await g.placedCountVal();
    expect(placed).toBeLessThan(REAL_TOTALS.L1);
    await expect(g.placedCount).toHaveText(`${placed}/${REAL_TOTALS.L1}`);
  });
});
