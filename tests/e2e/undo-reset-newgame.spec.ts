import { test, expect } from '@playwright/test';
import { GamePage } from './page-objects/GamePage';

test.describe('되돌리기 · 리셋 · 새 퍼즐', () => {
  test('SC-CTRL-01 · 되돌리기 (한 수 취소)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    const sig0 = await g.boardSignature();
    expect(await g.makeOneMove()).toBe(true);
    await expect(g.moveCount).toHaveText('1');

    await g.undoBtn.click();
    await expect(g.moveCount).toHaveText('0');
    expect(await g.boardSignature()).toBe(sig0);
  });

  test('SC-CTRL-02 · 짐 밀기 되돌리기 (정리 수 복원)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    const { dx, dy } = await g.setupOnePush();
    const sigBeforePush = await g.boardSignature();
    const placedBeforePush = await g.placedCountVal();
    await g.tryMove(dx, dy);
    // the push lands one box on its target -> placed increases by exactly 1
    expect(await g.placedCountVal()).toBe(placedBeforePush + 1);

    await g.undo();
    // undo restores both the box position and the placed count
    expect(await g.placedCountVal()).toBe(placedBeforePush);
    expect(await g.boardSignature()).toBe(sigBeforePush);
  });

  test('SC-CTRL-03 · 다단계 되돌리기 (5수)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    const sig0 = await g.boardSignature();

    const made = await g.makeMoves(5);
    expect(made).toBe(5);
    await expect(g.moveCount).toHaveText('5');

    for (let i = 0; i < 5; i++) await g.undo();
    await expect(g.moveCount).toHaveText('0');
    expect(await g.boardSignature()).toBe(sig0);
  });

  test('SC-CTRL-04 · (경계) 초기 상태 되돌리기 무해', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await expect(g.moveCount).toHaveText('0');
    await g.undoBtn.click();
    await expect(g.moveCount).toHaveText('0');
    expect(await g.realTotal()).toBeGreaterThan(0); // game intact
  });

  test('SC-CTRL-05 · 리셋 (현재 퍼즐 초기화)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    // capture the genuine start state (before any moves) for comparison
    const startSig = await g.boardSignature();
    const startPlaced = await g.placedCountVal();

    expect(await g.makeMoves(4)).toBeGreaterThan(0);
    expect(Number(await g.moveCountText())).toBeGreaterThan(0);

    await g.resetBtn.click();
    await expect(g.moveCount).toHaveText('0');
    // reset returns to the SAME puzzle's start layout (not a new puzzle)
    expect(await g.boardSignature()).toBe(startSig);
    expect(await g.placedCountVal()).toBe(startPlaced);
    await expect(g.placedCount).toHaveText(`${startPlaced}/7`);
  });

  test('SC-CTRL-06 · 새 퍼즐 (랜덤 재생성)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    const sigBefore = await g.boardSignature();

    // try a few times to get a different layout (random)
    let sigAfter = sigBefore;
    for (let i = 0; i < 5 && sigAfter === sigBefore; i++) {
      await g.newBtn.click();
      await g.waitReady();
      sigAfter = await g.boardSignature();
    }
    await expect(g.moveCount).toHaveText('0');
    expect(await g.realTotal()).toBe(7);
    expect(sigAfter).not.toBe(sigBefore);
  });

  test('SC-CTRL-07 · 단축키 U / R / N', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    // U: move then undo
    expect(await g.makeOneMove()).toBe(true);
    await expect(g.moveCount).toHaveText('1');
    await page.keyboard.press('u');
    await expect(g.moveCount).toHaveText('0');

    // R: move a couple then reset
    expect(await g.makeMoves(2)).toBeGreaterThan(0);
    expect(Number(await g.moveCountText())).toBeGreaterThan(0);
    await page.keyboard.press('r');
    await expect(g.moveCount).toHaveText('0');

    // N: new puzzle -> different layout
    const sig = await g.boardSignature();
    let sig2 = sig;
    for (let i = 0; i < 5 && sig2 === sig; i++) {
      await page.keyboard.press('n');
      await g.waitReady();
      sig2 = await g.boardSignature();
    }
    expect(sig2).not.toBe(sig);
  });

  test('SC-CTRL-08 · 리셋 후 되돌리기는 리셋 이전으로 가지 않음', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    expect(await g.makeMoves(5)).toBeGreaterThan(0);
    expect(Number(await g.moveCountText())).toBeGreaterThan(0);

    await g.reset();
    await expect(g.moveCount).toHaveText('0');
    const sigAfterReset = await g.boardSignature();

    await g.undo(); // history cleared by reset -> no-op
    await expect(g.moveCount).toHaveText('0');
    expect(await g.boardSignature()).toBe(sigAfterReset);
  });
});
