import { test, expect } from '@playwright/test';
import { GamePage } from './page-objects/GamePage';

test.describe('이동 & 짐 밀기', () => {
  test('SC-MOVE-01 · 키보드 방향키 이동', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    await g.canvas.click({ position: { x: 5, y: 5 } }); // focus body (closes nothing)
    await page.locator('body').click();

    // perform a guaranteed-valid move via a known-empty direction using tryMove for determinism,
    // but here exercise the real keydown path; count valid moves.
    const before = Number(await g.moveCountText());
    // press all four arrows; at least some are valid -> moveCount increases
    for (const k of ['ArrowRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft']) {
      await page.keyboard.press(k);
    }
    const after = Number(await g.moveCountText());
    expect(after).toBeGreaterThan(before);
  });

  test('SC-MOVE-02 · WASD 이동', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    const before = Number(await g.moveCountText());
    for (const k of ['d', 's', 'a', 'w']) {
      await page.keyboard.press(k);
    }
    expect(Number(await g.moveCountText())).toBeGreaterThan(before);
  });

  test('SC-MOVE-03 · tryMove API로 이동 (0→2)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    // Relocate the player to an open floor cell that has two empty walkable
    // neighbors, guaranteeing two consecutive plain walks (deterministic 0->2).
    await g.run(`
      const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
      function emptyWalk(x,y){ return isWalkable(x,y) && !boxAt(x,y); }
      outer: for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
        if(emptyWalk(x,y)){
          const free=DIRS.filter(([dx,dy])=>emptyWalk(x+dx,y+dy));
          if(free.length>=2 && !boxes.some(b=>b.x===x&&b.y===y)){
            player.x=x; player.y=y; afterMove(true); break outer;
          }
        }
      }
    `);
    const moved = await g.makeMoves(2);
    expect(moved).toBe(2);
    await expect(g.moveCount).toHaveText('2');
  });

  test('SC-MOVE-04 · 벽으로 막힌 이동은 무효', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    const res = await g.run<{ before: number; after: number; same: boolean }>(`
      // place player adjacent to outer wall, push into the wall
      // find a floor cell whose neighbor in some dir is a wall
      const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
      for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
        if(isWalkable(x,y) && !boxAt(x,y)){
          for(const [dx,dy] of DIRS){
            if(!isFloor(x+dx,y+dy)){ // wall ahead
              player.x=x; player.y=y; afterMove(true);
              const before=moves; const px=player.x, py=player.y;
              tryMove(dx,dy);
              return { before, after: moves, same: player.x===px && player.y===py };
            }
          }
        }
      }
      throw new Error('no wall-adjacent cell');
    `);
    expect(res.same).toBe(true);
    expect(res.after).toBe(res.before);
  });

  test('SC-MOVE-05 · 짐 밀기 (밀 수만 있고 당길 수 없음)', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    const res = await g.run<{ pushed: boolean; pullBlocked: boolean }>(`
      const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
      function emptyWalk(x,y){ return isWalkable(x,y) && !boxAt(x,y); }
      const b = boxes.find(b=>!b.decoy);
      // find dir where box can be pushed (cell behind box walkable for player, cell ahead walkable & empty)
      for(const [dx,dy] of DIRS){
        const px=b.x-dx, py=b.y-dy;      // player stands behind
        const ax=b.x+dx, ay=b.y+dy;      // box destination
        if(emptyWalk(px,py) && emptyWalk(ax,ay)){
          player.x=px; player.y=py; afterMove(true);
          const bx0=b.x, by0=b.y;
          tryMove(dx,dy);
          const pushed = (b.x===bx0+dx && b.y===by0+dy && player.x===bx0 && player.y===by0);
          // now try to "pull": move away from box; box must NOT follow
          const bxNow=b.x, byNow=b.y;
          tryMove(-dx,-dy);
          const pullBlocked = (b.x===bxNow && b.y===byNow); // box stayed
          return { pushed, pullBlocked };
        }
      }
      throw new Error('no pushable box setup');
    `);
    expect(res.pushed).toBe(true);
    expect(res.pullBlocked).toBe(true);
  });

  test('SC-MOVE-06 · 짐 뒤가 막히면 밀리지 않음', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    const res = await g.run<{ blocked: boolean }>(`
      const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
      function emptyWalk(x,y){ return isWalkable(x,y) && !boxAt(x,y); }
      const b = boxes.find(b=>!b.decoy);
      // Construct a blocked scenario deterministically: find a floor cell B whose
      // neighbor in (dx,dy) is a wall, and whose opposite neighbor is empty floor
      // (player stand). Relocate box -> B, player -> behind, then push into wall.
      function park(box){
        outer: for(let yy=ROWS-1;yy>=0;yy--)for(let xx=COLS-1;xx>=0;xx--){
          if(emptyWalk(xx,yy) && !boxes.some(z=>z!==box&&z.x===xx&&z.y===yy)){ box.x=xx; box.y=yy; return; }
        }
      }
      for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
        if(!isWalkable(x,y) || boxAt(x,y)) continue;
        for(const [dx,dy] of DIRS){
          const ax=x+dx, ay=y+dy;       // cell ahead (must be wall/blocked)
          const px=x-dx, py=y-dy;       // player stands here
          if(!isWalkable(ax,ay) && isFloor(px,py) && !isObstacle(px,py)){
            // clear any boxes occupying B or player cell
            const occB=boxes.find(z=>z!==b && z.x===x && z.y===y); if(occB) park(occB);
            const occP=boxes.find(z=>z!==b && z.x===px && z.y===py); if(occP) park(occP);
            b.x=x; b.y=y; player.x=px; player.y=py; afterMove(true);
            const bx0=b.x, by0=b.y, px0=player.x, py0=player.y;
            tryMove(dx,dy); // push box into wall -> must be rejected
            const blocked = (b.x===bx0 && b.y===by0 && player.x===px0 && player.y===py0);
            return { blocked };
          }
        }
      }
      throw new Error('no blocked-box setup');
    `);
    expect(res.blocked).toBe(true);
  });

  test('SC-MOVE-07 · 올바른 목표 배치 시 정리 수 증가', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    const { dx, dy } = await g.setupOnePush();
    // capture placed AFTER the setup relocation (setupOnePush may move a box that
    // was already on a target), so the delta measures only the push itself.
    const before = await g.placedCountVal();
    await g.tryMove(dx, dy);
    expect(await g.placedCountVal()).toBe(before + 1);
    // DOM stat reflects it
    const placedText = await g.placedText();
    expect(placedText.startsWith(`${before + 1}/`)).toBe(true);
  });

  test('SC-MOVE-08 · 잘못된 목표 배치는 인정 안 됨', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    const res = await g.run<{ delta: number; landed: boolean }>(`
      function emptyWalk(x,y){ return isWalkable(x,y) && !boxAt(x,y); }
      const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
      const before = placedCount();
      // pick a real box and a target whose itemId differs from the box id
      const b = boxes.find(b=>!b.decoy);
      const wrong = targets.find(t=>t.itemId!==b.id);
      for(const [dx,dy] of DIRS){
        const bx=wrong.x-dx, by=wrong.y-dy, px=bx-dx, py=by-dy;
        if(isWalkable(wrong.x,wrong.y) && emptyWalk(bx,by) && emptyWalk(px,py)){
          [[bx,by],[px,py],[wrong.x,wrong.y]].forEach(([cx,cy])=>{
            const o=boxes.find(z=>z!==b && z.x===cx && z.y===cy);
            if(o){ outer: for(let yy=ROWS-1;yy>=0;yy--)for(let xx=COLS-1;xx>=0;xx--){
              if(emptyWalk(xx,yy)&&!boxes.some(z=>z.x===xx&&z.y===yy)){o.x=xx;o.y=yy;break outer;} } }
          });
          b.x=bx; b.y=by; player.x=px; player.y=py; afterMove(true);
          tryMove(dx,dy);
          const landed=(b.x===wrong.x && b.y===wrong.y);
          return { delta: placedCount()-before, landed };
        }
      }
      throw new Error('no wrong-target setup');
    `);
    expect(res.landed).toBe(true);   // box reached the (wrong) target cell
    expect(res.delta).toBe(0);        // not counted
  });

  test('SC-MOVE-09 · 목표에서 다시 빼면 정리 수 감소', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    const { dx, dy } = await g.setupOnePush();
    await g.tryMove(dx, dy);
    const placed = await g.placedCountVal();
    expect(placed).toBeGreaterThanOrEqual(1);

    // continue pushing the same box off the target (player keeps following same dir)
    const removed = await g.run<number>(`
      const before = placedCount();
      // the just-placed box is where the player just stepped from; push once more same dir if possible
      const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
      function emptyWalk(x,y){ return isWalkable(x,y) && !boxAt(x,y); }
      // identify a box currently on its correct target
      const b = boxes.find(b=>boxOnRightTarget(b));
      for(const [dx,dy] of DIRS){
        const px=b.x-dx, py=b.y-dy, ax=b.x+dx, ay=b.y+dy;
        if(emptyWalk(px,py) && emptyWalk(ax,ay)){
          player.x=px; player.y=py; afterMove(true);
          tryMove(dx,dy); // push off target
          return before - placedCount();
        }
      }
      return -999;
    `);
    expect(removed).toBe(1);
  });

  test('SC-MOVE-10 · (엣지) 빠른 연속 입력 안정성', async ({ page }) => {
    const g = new GamePage(page);
    await g.goto();
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press(['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'][i % 4]);
    }
    // player must remain in bounds and on a floor cell; move count is a valid number
    const ok = await g.run<boolean>(
      `return inBounds(player.x,player.y) && isFloor(player.x,player.y) && typeof moves==='number' && moves>=0;`,
    );
    expect(ok).toBe(true);
    expect(Number(await g.moveCountText())).toBeGreaterThanOrEqual(0);
  });
});
