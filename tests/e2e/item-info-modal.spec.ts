import { test, expect } from '@playwright/test';
import { GamePage } from './page-objects/GamePage';

test.describe('짐 정보(교육) 모달', () => {
  test('SC-INFO-01 · 짐 클릭/openItemInfo 시 정보 모달 노출', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    const { file } = await g.openInfoForFirstRealBox();
    await expect(g.infoOverlay).toHaveClass(/show/);
    await expect(g.infoOverlay).toBeVisible();
    // body mentions the target settings file for that item
    await expect(page.locator('#infoBody')).toContainText(file);
    await expect(page.locator('#infoTitle')).not.toBeEmpty();
  });

  test('SC-INFO-01b · 실제 캔버스 클릭으로도 모달 노출', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    // compute screen coords of a real box center and click the canvas there
    const pos = await g.run<{ x: number; y: number }>(`
      const canvas=document.getElementById('game');
      const rect=canvas.getBoundingClientRect();
      const cell=canvas.width/COLS;
      const b=boxes.find(x=>!x.decoy);
      const sx=(b.x+0.5)*cell*(rect.width/canvas.width);
      const sy=(b.y+0.5)*cell*(rect.height/canvas.height);
      return { x: sx, y: sy };
    `);
    await g.canvas.click({ position: { x: pos.x, y: pos.y } });
    await expect(g.infoOverlay).toHaveClass(/show/);
  });

  test('SC-INFO-02 · 정보 모달 닫기 (#infoClose)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await g.openInfoForFirstRealBox();
    await expect(g.infoOverlay).toHaveClass(/show/);

    await g.infoClose.click();
    await expect(g.infoOverlay).not.toHaveClass(/show/);
  });

  test('SC-INFO-03 · 짐 종류별 설명 내용 상이', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    const texts = await g.run<{ a: string; b: string; fileA: string; fileB: string }>(`
      const reals = boxes.filter(b=>!b.decoy);
      const ids = [...new Set(reals.map(b=>b.id))];
      const b1 = reals.find(b=>b.id===ids[0]);
      const b2 = reals.find(b=>b.id===ids[1]);
      openItemInfo(b1);
      const a = document.getElementById('infoBody').textContent;
      const fileA = ITEMS.find(i=>i.id===b1.id).file;
      hide('infoOverlay');
      openItemInfo(b2);
      const bb = document.getElementById('infoBody').textContent;
      const fileB = ITEMS.find(i=>i.id===b2.id).file;
      return { a, b: bb, fileA, fileB };
    `);
    expect(texts.a).not.toBe(texts.b);
    expect(texts.a).toContain(texts.fileA);
    expect(texts.b).toContain(texts.fileB);
  });

  test('SC-INFO-04 · 정보 모달은 게임 상태에 영향 없음', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    const sig = await g.boardSignature();
    const mv = await g.moveCountText();
    const placed = await g.placedText();

    await g.openInfoForFirstRealBox();
    await expect(g.infoOverlay).toHaveClass(/show/);
    await g.infoClose.click();
    await expect(g.infoOverlay).not.toHaveClass(/show/);

    expect(await g.moveCountText()).toBe(mv);
    expect(await g.placedText()).toBe(placed);
    expect(await g.boardSignature()).toBe(sig);
  });

  test('SC-INFO-05 · (엣지) 잡동사니(📦) 클릭 시 안내 모달', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await g.decoys.selectOption('many');
    await g.waitReady();

    const pos = await g.run<{ x: number; y: number }>(`
      const canvas=document.getElementById('game');
      const rect=canvas.getBoundingClientRect();
      const cell=canvas.width/COLS;
      const d=boxes.find(b=>b.decoy);
      return { x:(d.x+0.5)*cell*(rect.width/canvas.width), y:(d.y+0.5)*cell*(rect.height/canvas.height) };
    `);
    await g.canvas.click({ position: { x: pos.x, y: pos.y } });
    // observed behavior: decoy click shows a simple info modal (잡동사니 안내)
    await expect(g.infoOverlay).toHaveClass(/show/);
    await expect(page.locator('#infoTitle')).toContainText('잡동사니');
  });

  test('SC-INFO-06 · (엣지) 빈 칸 클릭은 무반응', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    const pos = await g.run<{ x: number; y: number } | null>(`
      const canvas=document.getElementById('game');
      const rect=canvas.getBoundingClientRect();
      const cell=canvas.width/COLS;
      // find a floor cell with no box and no obstacle
      for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
        if(isWalkable(x,y) && !boxAt(x,y) && !(player.x===x&&player.y===y)){
          return { x:(x+0.5)*cell*(rect.width/canvas.width), y:(y+0.5)*cell*(rect.height/canvas.height) };
        }
      }
      return null;
    `);
    expect(pos).not.toBeNull();
    await g.canvas.click({ position: { x: pos!.x, y: pos!.y } });
    await expect(g.infoOverlay).not.toHaveClass(/show/);
  });
});
