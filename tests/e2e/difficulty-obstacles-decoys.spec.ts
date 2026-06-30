import { test, expect } from '@playwright/test';
import { GamePage } from './page-objects/GamePage';

test.describe('난이도 · 장애물 · 잡동사니 설정', () => {
  test('SC-CFG-01 · 세 셀렉트 옵션 구성 + 기본값', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    await expect(g.difficulty.locator('option')).toHaveCount(3);
    await expect(g.obstacles.locator('option')).toHaveCount(3);
    await expect(g.decoys.locator('option')).toHaveCount(3);

    const diffVals = await g.difficulty.locator('option').evaluateAll((els) =>
      els.map((e) => (e as HTMLOptionElement).value));
    expect(diffVals).toEqual(['easy', 'normal', 'hard']);

    await expect(g.difficulty).toHaveValue('normal');
    await expect(g.obstacles).toHaveValue('none');
    await expect(g.decoys).toHaveValue('none');
  });

  test('SC-CFG-02 · 난이도 변경 시 보드 재생성 & 목표 수 불변', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    const total = await g.realTotal();
    expect(total).toBe(7);

    expect(await g.makeMoves(1)).toBe(1); // moveCount > 0
    expect(Number(await g.moveCountText())).toBeGreaterThan(0);

    await g.difficulty.selectOption('hard');
    await g.waitReady();

    await expect(g.moveCount).toHaveText('0');
    expect(await g.realTotal()).toBe(total);
  });

  test('SC-CFG-03 · 고정 장애물(🚧) 추가', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    expect(await g.obstacleCountVal()).toBe(0);

    await g.obstacles.selectOption('many');
    await g.waitReady();

    expect(await g.obstacleCountVal()).toBeGreaterThan(0);
    expect(await g.realTotal()).toBe(7); // targets unchanged
  });

  test('SC-CFG-04 · 잡동사니(📦) 추가', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    expect(await g.decoyCountVal()).toBe(0);

    await g.decoys.selectOption('many');
    await g.waitReady();

    expect(await g.decoyCountVal()).toBeGreaterThan(0);
    expect(await g.realTotal()).toBe(7); // decoys not counted as targets
  });

  test('SC-CFG-05 · 장애물은 밀 수 없음 (불변 규칙)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await g.obstacles.selectOption('many');
    await g.waitReady();

    // place player directly facing an obstacle, then push toward it
    const result = await g.run<{ moved: boolean; movesBefore: number; movesAfter: number }>(`
      const ob = obstacles[0];
      // find a walkable neighbor of the obstacle to stand on
      const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
      for(const [dx,dy] of DIRS){
        const sx=ob.x-dx, sy=ob.y-dy; // stand so that moving (dx,dy) hits the obstacle
        if(isWalkable(sx,sy) && !boxAt(sx,sy)){
          player.x=sx; player.y=sy; afterMove(true);
          const before=moves;
          tryMove(dx,dy); // should be blocked by obstacle
          const after=moves;
          // obstacle must not have moved
          const obMoved = !(obstacles[0].x===ob.x && obstacles[0].y===ob.y);
          return { moved: obMoved, movesBefore: before, movesAfter: after };
        }
      }
      throw new Error('no standing cell next to obstacle');
    `);
    expect(result.moved).toBe(false);
    expect(result.movesAfter).toBe(result.movesBefore); // blocked move not counted
  });

  test('SC-CFG-06 · 잡동사니는 밀 수 있으나 목표로 인정 안 됨', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await g.decoys.selectOption('many');
    await g.waitReady();

    const result = await g.run<{ pushed: boolean; placedDelta: number }>(`
      const placedBefore = placedCount();
      const d = boxes.find(b=>b.decoy);
      const t = targets[0];
      // set decoy one cell before a target, player behind, push onto target
      const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
      function emptyWalk(x,y){ return isWalkable(x,y) && !boxAt(x,y); }
      for(const [dx,dy] of DIRS){
        const bx=t.x-dx, by=t.y-dy, px=bx-dx, py=by-dy;
        if(isWalkable(t.x,t.y) && emptyWalk(bx,by) && emptyWalk(px,py)){
          // clear conflicts
          [[bx,by],[px,py],[t.x,t.y]].forEach(([cx,cy])=>{
            const o=boxes.find(z=>z!==d && z.x===cx && z.y===cy);
            if(o){ outer: for(let yy=ROWS-1;yy>=0;yy--)for(let xx=COLS-1;xx>=0;xx--){
              if(emptyWalk(xx,yy)&&!boxes.some(z=>z.x===xx&&z.y===yy)){o.x=xx;o.y=yy;break outer;} } }
          });
          d.x=bx; d.y=by; player.x=px; player.y=py; afterMove(true);
          const beforePos = {x:d.x,y:d.y};
          tryMove(dx,dy);
          const pushed = (d.x!==beforePos.x || d.y!==beforePos.y);
          const onTarget = (d.x===t.x && d.y===t.y);
          return { pushed: pushed && onTarget, placedDelta: placedCount()-placedBefore };
        }
      }
      throw new Error('no decoy push setup');
    `);
    expect(result.pushed).toBe(true);       // decoy moved onto a target
    expect(result.placedDelta).toBe(0);      // but placedCount did not increase
  });

  test('SC-CFG-07 · 최대 조합(L3·어려움·장애물 많이·잡동사니 많이) 유효 보드', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();

    await g.level.selectOption('2');
    await g.difficulty.selectOption('hard');
    await g.obstacles.selectOption('many');
    await g.decoys.selectOption('many');
    await g.waitReady();

    const total = await g.realTotal();
    expect(total).toBe(14);
    expect(await g.obstacleCountVal()).toBeGreaterThan(0);
    expect(await g.decoyCountVal()).toBeGreaterThan(0);

    // board must not start already-solved; DOM denominator equals realTotal
    const placed = await g.placedCountVal();
    expect(placed).toBeLessThan(total);
    await expect(g.placedCount).toHaveText(`${placed}/${total}`);
  });
});
