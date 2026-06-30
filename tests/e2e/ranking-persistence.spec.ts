import { test, expect } from '@playwright/test';
import { GamePage } from './page-objects/GamePage';

const LS_KEY = 'sokoban_cc_scores_v1';

test.describe('랭킹 & 영속성 (localStorage)', () => {
  test('SC-RANK-01 · 초기 빈 랭킹 표시', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto(); // goto() clears scores

    await expect(g.rankBody).toContainText('아직 기록이 없어요');
    await expect(page.locator('#rankDiffTag')).toContainText('L1');
    await expect(page.locator('#rankDiffTag')).toContainText('보통');
  });

  test('SC-RANK-02 · 클리어 후 점수 저장 (이름 + #saveScore)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await g.forceWin();
    await expect(g.winOverlay).toHaveClass(/show/);

    await g.playerName.fill('테스터');
    await g.saveScore.click();
    // saveScore hides win modal and starts a new game; ranking is re-rendered
    await expect(g.winOverlay).not.toHaveClass(/show/);

    await expect(g.rankBody).toContainText('테스터');

    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), LS_KEY);
    expect(stored.length).toBe(1);
    expect(stored[0].name).toBe('테스터');
    expect(stored[0].level).toBe(0);
    expect(stored[0].difficulty).toBe('normal');
  });

  test('SC-RANK-03 · 이동 수 오름차순 정렬', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    // inject two scores with different move counts directly, same config
    await page.evaluate((k) => {
      const rows = [
        { name: 'Slow', moves: 50, difficulty: 'normal', level: 0, obstacles: 'none', decoys: 'none', date: new Date().toISOString() },
        { name: 'Fast', moves: 10, difficulty: 'normal', level: 0, obstacles: 'none', decoys: 'none', date: new Date().toISOString() },
      ];
      localStorage.setItem(k, JSON.stringify(rows));
    }, LS_KEY);
    await g.run('renderRanking();');

    const names = await g.rankBody.locator('tr td:nth-child(2)').allTextContents();
    expect(names[0]).toBe('Fast');
    expect(names[1]).toBe('Slow');
  });

  test('SC-RANK-04 · 구성별 랭킹 분리 (난이도)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    await page.evaluate((k) => {
      const rows = [
        { name: 'NormalGuy', moves: 20, difficulty: 'normal', level: 0, obstacles: 'none', decoys: 'none', date: new Date().toISOString() },
        { name: 'HardGuy', moves: 30, difficulty: 'hard', level: 0, obstacles: 'none', decoys: 'none', date: new Date().toISOString() },
      ];
      localStorage.setItem(k, JSON.stringify(rows));
    }, LS_KEY);

    // normal config shows only NormalGuy
    await g.run('renderRanking();');
    await expect(g.rankBody).toContainText('NormalGuy');
    await expect(g.rankBody).not.toContainText('HardGuy');

    // switch to hard -> shows only HardGuy
    await g.difficulty.selectOption('hard');
    await g.waitReady();
    await expect(g.rankBody).toContainText('HardGuy');
    await expect(g.rankBody).not.toContainText('NormalGuy');
  });

  test('SC-RANK-05 · 새로고침 후 기록 영속', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await g.forceWin();
    await g.playerName.fill('영속이');
    await g.saveScore.click();
    await expect(g.rankBody).toContainText('영속이');

    await page.reload();
    await g.waitReady();
    await expect(g.rankBody).toContainText('영속이');
  });

  test('SC-RANK-06 · 랭킹 버튼(#rankBtn) 동작', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    // rankBtn re-renders ranking; assert no error and panel present
    await g.rankBtn.click();
    await expect(g.rankBody).toBeVisible();
    expect(await g.realTotal()).toBeGreaterThan(0);
  });

  test('SC-RANK-07 · (엣지) 빈 이름 저장 → "익명"', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await g.forceWin();
    await g.playerName.fill('');
    await g.saveScore.click();

    const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), LS_KEY);
    expect(stored.length).toBe(1);
    expect(stored[0].name).toBe('익명');
  });

  test('SC-RANK-08 · (엣지) 손상된 localStorage 내성', async ({ page }) => {
    const g = new GamePage(page);
    // inject broken JSON BEFORE load
    await page.addInitScript(() => {
      try {
        localStorage.setItem('cc_sokoban_seen', '1');
        localStorage.setItem('sokoban_cc_scores_v1', '{invalid');
      } catch {}
    });
    await page.goto('/index.html');
    await page.waitForLoadState('load');
    await g.waitReady();

    // game still boots, ranking falls back to empty
    expect(await g.realTotal()).toBeGreaterThan(0);
    await expect(g.rankBody).toContainText('아직 기록이 없어요');
  });
});
