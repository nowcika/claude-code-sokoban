import { test, expect } from '@playwright/test';
import { GamePage } from './page-objects/GamePage';

test.describe('클리어 & 축하 연출', () => {
  test('SC-WIN-01 · 모든 짐 정리 시 승리 모달 노출', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await g.forceWin();

    expect(await g.placedCountVal()).toBe(await g.realTotal());
    await expect(g.placedCount).toHaveText('7/7');
    await expect(g.winOverlay).toHaveClass(/show/);
    await expect(g.winOverlay).toBeVisible();
  });

  test('SC-WIN-02 · 컨페티 + 축하 토스트 (마지막 짐 실제 밀기)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    // Set up: all real boxes already on targets EXCEPT one, which we push for real
    // so celebratePlacement (toast + confetti) fires for the final placement.
    const { dx, dy } = await g.run<{ dx: number; dy: number }>(`
      function emptyWalk(x,y){ return isWalkable(x,y) && !boxAt(x,y); }
      const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
      const reals = boxes.filter(b=>!b.decoy);
      // snap all but the first onto their targets
      const used=new Set();
      const first = reals[0];
      reals.slice(1).forEach(b=>{ const t=targets.find(t=>t.itemId===b.id && !used.has(t)); used.add(t); b.x=t.x;b.y=t.y; });
      // for 'first', set it one cell before its target with player behind
      const tFirst = targets.find(t=>t.itemId===first.id && !used.has(t)); used.add(tFirst);
      for(const [ddx,ddy] of DIRS){
        const bx=tFirst.x-ddx, by=tFirst.y-ddy, px=bx-ddx, py=by-ddy;
        if(isWalkable(tFirst.x,tFirst.y) && emptyWalk(bx,by) && emptyWalk(px,py)){
          [[bx,by],[px,py]].forEach(([cx,cy])=>{
            const o=boxes.find(z=>z!==first && z.x===cx && z.y===cy);
            if(o){ outer: for(let yy=ROWS-1;yy>=0;yy--)for(let xx=COLS-1;xx>=0;xx--){
              if(emptyWalk(xx,yy)&&!boxes.some(z=>z.x===xx&&z.y===yy)){o.x=xx;o.y=yy;break outer;} } }
          });
          first.x=bx; first.y=by; player.x=px; player.y=py; afterMove(true);
          return { dx:ddx, dy:ddy };
        }
      }
      throw new Error('no final-push setup');
    `);

    // push the final box -> celebratePlacement -> toast 'show', then onWin
    await g.tryMove(dx, dy);

    // toast appears (class 'show' added in celebratePlacement)
    await expect(g.toast).toHaveClass(/show/);
    // and win overlay shows since placed===total
    await expect(g.winOverlay).toHaveClass(/show/);
  });

  test('SC-WIN-03 · 개별 정확 배치 시 즉시 피드백 토스트 + 정리 수 증가', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    const { dx, dy } = await g.setupOnePush();
    const before = await g.placedCountVal(); // after setup relocation
    await g.tryMove(dx, dy);

    expect(await g.placedCountVal()).toBe(before + 1);
    await expect(g.toast).toHaveClass(/show/);
  });

  test('SC-WIN-04 · 승리 모달 "다음(#winNext)" → L2 전환', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await g.forceWin();
    await expect(g.winOverlay).toHaveClass(/show/);

    await g.winNext.click();
    await g.waitReady();
    await expect(g.winOverlay).not.toHaveClass(/show/);
    await expect(g.level).toHaveValue('1'); // L2
    await expect(g.moveCount).toHaveText('0');
  });

  test('SC-WIN-05 · 승리 모달 "새 퍼즐(#winNew)" → 같은 레벨 재시작', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await g.forceWin();
    await expect(g.winOverlay).toHaveClass(/show/);

    await g.winNew.click();
    await g.waitReady();
    await expect(g.winOverlay).not.toHaveClass(/show/);
    await expect(g.level).toHaveValue('0'); // still L1
    await expect(g.moveCount).toHaveText('0');
  });

  test('SC-WIN-06 · (엣지) 잡동사니를 목표에 넣어도 승리 안 됨', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await g.decoys.selectOption('many');
    await g.waitReady();

    const res = await g.run<{ placed: number; total: number; winShown: boolean }>(`
      // fill every target with a decoy where possible, leave real boxes unplaced
      const decoys = boxes.filter(b=>b.decoy);
      targets.forEach((t,i)=>{ if(decoys[i]){ decoys[i].x=t.x; decoys[i].y=t.y; } });
      // make sure real boxes are NOT on their targets
      boxes.filter(b=>!b.decoy).forEach((b,i)=>{ /* leave as scattered */ });
      afterMove(true);
      return { placed: placedCount(), total: realTotal(),
               winShown: document.getElementById('winOverlay').classList.contains('show') };
    `);
    expect(res.placed).toBeLessThan(res.total);
    expect(res.winShown).toBe(false);
  });

  test('SC-WIN-07 · (경계) 마지막 직전에서 짐을 빼면 승리 미발동', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    const res = await g.run<{ winShown: boolean; placed: number; total: number }>(`
      // place all real boxes on targets, then pull one off BEFORE calling afterMove
      const used=new Set();
      boxes.filter(b=>!b.decoy).forEach(b=>{ const t=targets.find(t=>t.itemId===b.id && !used.has(t)); used.add(t); b.x=t.x;b.y=t.y; });
      // move one box off to an empty cell
      const one = boxes.find(b=>!b.decoy);
      outer: for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
        if(isWalkable(x,y) && !boxAt(x,y) && !targetAt(x,y)){ one.x=x; one.y=y; break outer; }
      }
      afterMove();
      return { winShown: document.getElementById('winOverlay').classList.contains('show'),
               placed: placedCount(), total: realTotal() };
    `);
    expect(res.placed).toBeLessThan(res.total);
    expect(res.winShown).toBe(false);
  });
});
