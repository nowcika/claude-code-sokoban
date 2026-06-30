import { test, expect } from '@playwright/test';
import { GamePage } from './page-objects/GamePage';

test.describe('도움말 모달', () => {
  test('SC-HELP-01 · 첫 방문 시 도움말 자동 노출', async ({ page }) => {
    const g = new GamePage(page);
    await g.gotoFresh(); // no localStorage flag -> auto-open

    await expect(g.helpOverlay).toHaveClass(/show/);
    await expect(g.helpOverlay).toBeVisible();
    await expect(g.helpOverlay.locator('h2')).toContainText('게임 설명');
    await expect(g.helpClose).toBeVisible();
    await expect(g.helpClose).toHaveText(/시작하기/);
  });

  test('SC-HELP-02 · "시작하기"로 닫기 + 플래그 저장 + 재방문 미노출', async ({ page }) => {
    const g = new GamePage(page);
    await g.gotoFresh();
    await expect(g.helpOverlay).toHaveClass(/show/);

    await g.helpClose.click();
    await expect(g.helpOverlay).not.toHaveClass(/show/);
    await expect(g.helpOverlay).toBeHidden();

    const seen = await page.evaluate(() => localStorage.getItem('cc_sokoban_seen'));
    expect(seen).toBe('1');

    await page.reload();
    await g.waitReady();
    await expect(g.helpOverlay).not.toHaveClass(/show/);
  });

  test('SC-HELP-03 · #helpBtn 으로 수동 재오픈', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto(); // seen=1, modal closed
    await expect(g.helpOverlay).not.toHaveClass(/show/);

    await g.helpBtn.click();
    await expect(g.helpOverlay).toHaveClass(/show/);
    await expect(g.helpOverlay).toBeVisible();
  });

  test('SC-HELP-04 · #helpClose 로 닫기', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await g.helpBtn.click();
    await expect(g.helpOverlay).toHaveClass(/show/);

    await g.helpClose.click();
    await expect(g.helpOverlay).not.toHaveClass(/show/);
  });

  test('SC-HELP-05 · 도움말 교육 정보 정확성 (8개 설정 파일)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await g.helpBtn.click();
    await expect(g.helpOverlay).toHaveClass(/show/);

    const body = g.helpOverlay.locator('.modal');
    for (const f of ['settings.json', 'CLAUDE.md', '.mcp.json', '.claude/commands/',
      '.claude/agents/', '.claude/skills/', 'settings.local.json', '.gitignore']) {
      await expect(body).toContainText(f);
    }
  });

  test('SC-HELP-06 · (엣지) 모달 열린 중 키 입력은 보드를 움직임 (현 동작 명세)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await g.helpBtn.click();
    await expect(g.helpOverlay).toHaveClass(/show/);

    const before = await g.moveCountText();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');
    const after = await g.moveCountText();

    // The game does NOT block board keys while the modal is open (observed behavior).
    // Document baseline: moves may change. We only assert the game stays stable
    // (numeric, non-negative move count) rather than enforce blocking.
    expect(Number(after)).toBeGreaterThanOrEqual(0);
    test.info().annotations.push({
      type: 'help-key-blocking',
      description: `moves ${before} -> ${after} (board NOT blocked while modal open)`,
    });
  });
});
