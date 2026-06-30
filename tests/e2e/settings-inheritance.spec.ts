import { test, expect } from '@playwright/test';
import { GamePage } from './page-objects/GamePage';

test.describe('설정 상속 & 교육 패널', () => {
  test('SC-INH-01 · 설정 구조 범례 패널 표시', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    await expect(g.legend).toBeVisible();
    // L1 legend rooms
    for (const f of ['settings.json', 'CLAUDE.md', '.mcp.json',
      '.claude/commands/', '.claude/agents/', '.gitignore']) {
      await expect(g.legend).toContainText(f);
    }
    // item chips/descriptions present
    await expect(g.legend).toContainText('훅(hook)');
    await expect(g.legend).toContainText('권한(permissions)');
  });

  test('SC-INH-02 · 상속 우선순위 패널 순서 정확성', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    const panel = page.locator('.card', { hasText: '설정 상속 (우선순위)' });
    await expect(panel).toBeVisible();

    const nodes = panel.locator('.inherit .node .f');
    const order = await nodes.allTextContents();
    expect(order).toEqual([
      '~/.claude/settings.json',
      '.claude/settings.json',
      '.claude/settings.local.json',
      'managed-settings.json',
    ]);

    // overwrite arrows present (3 of them)
    await expect(panel.locator('.inherit .arrow')).toHaveCount(3);
    await expect(panel.locator('.inherit .arrow').first()).toContainText('덮어씀');
    // managed = top priority / cannot override
    await expect(panel).toContainText('최우선');
  });

  test('SC-INH-03 · 메모리 상속 안내 정확성', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    const panel = page.locator('.card', { hasText: '설정 상속 (우선순위)' });

    await expect(panel).toContainText('~/.claude/CLAUDE.md');
    await expect(panel).toContainText('./CLAUDE.md');
    await expect(panel).toContainText('가까운 파일이 우선');
  });

  test('SC-INH-04 · L4 플레이 가능성 + 클리어', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    await g.level.selectOption('3');
    await g.waitReady();
    expect(await g.realTotal()).toBe(11);
    expect(await g.placedCountVal()).toBeLessThan(11); // not pre-solved

    await g.forceWin();
    await expect(g.winOverlay).toHaveClass(/show/);
    expect(await g.placedCountVal()).toBe(11);
  });

  test('SC-INH-05 · L4 클리어 후 "다음" 동작 (마지막 레벨)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await g.setLevel(3); // L4
    await g.forceWin();
    await expect(g.winOverlay).toHaveClass(/show/);

    // On the last level, #winNext is hidden (display:none) per onWin().
    await expect(g.winNext).toBeHidden();
    // #winNew still available to restart same level
    await expect(g.winNew).toBeVisible();
  });

  test('SC-INH-06 · 교육 패널과 도움말 본문 일관성', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    // Help modal lists the same settings files as the legend (shared vocabulary)
    await g.helpBtn.click();
    await expect(g.helpOverlay).toHaveClass(/show/);
    const help = g.helpOverlay.locator('.modal');
    for (const f of ['settings.json', 'CLAUDE.md', '.mcp.json',
      '.claude/commands/', '.claude/agents/', '.gitignore']) {
      await expect(help).toContainText(f);
      await expect(g.legend).toContainText(f);
    }
  });
});
