import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object for the Claude Code Sokoban game.
 *
 * The board is drawn on <canvas id="game"> so there are no DOM selectors for
 * board contents. Verification happens through three channels:
 *   (a) DOM controls / modals / stats,
 *   (b) module-scope JS globals reachable BY NAME inside page.evaluate
 *       (boxes, targets, player, moves, levelIndex, ROOMS, ITEMS, LEVELS,
 *        obstacles) and function-scope functions (tryMove, undo, reset,
 *        newGame, setLevel, placedCount, realTotal, boxOnRightTarget,
 *        openItemInfo, afterMove),
 *   (c) screenshots.
 *
 * NOTE: those names are NOT on `window` (classic <script>, `let`/`function`).
 * We therefore pass raw source strings to page.evaluate so the identifiers
 * resolve against the page's global lexical scope.
 */
export class GamePage {
  readonly page: Page;

  // controls
  readonly level: Locator;
  readonly difficulty: Locator;
  readonly obstacles: Locator;
  readonly decoys: Locator;
  readonly undoBtn: Locator;
  readonly resetBtn: Locator;
  readonly newBtn: Locator;
  readonly rankBtn: Locator;
  readonly helpBtn: Locator;

  // stats
  readonly moveCount: Locator;
  readonly placedCount: Locator;

  // panels
  readonly legend: Locator;
  readonly rankBody: Locator;
  readonly toast: Locator;
  readonly canvas: Locator;

  // modals
  readonly helpOverlay: Locator;
  readonly helpClose: Locator;
  readonly infoOverlay: Locator;
  readonly infoClose: Locator;
  readonly winOverlay: Locator;
  readonly winNext: Locator;
  readonly winNew: Locator;
  readonly saveScore: Locator;
  readonly playerName: Locator;

  constructor(page: Page) {
    this.page = page;
    this.level = page.locator('#level');
    this.difficulty = page.locator('#difficulty');
    this.obstacles = page.locator('#obstacles');
    this.decoys = page.locator('#decoys');
    this.undoBtn = page.locator('#undoBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.newBtn = page.locator('#newBtn');
    this.rankBtn = page.locator('#rankBtn');
    this.helpBtn = page.locator('#helpBtn');
    this.moveCount = page.locator('#moveCount');
    this.placedCount = page.locator('#placedCount');
    this.legend = page.locator('#legend');
    this.rankBody = page.locator('#rankBody');
    this.toast = page.locator('#toast');
    this.canvas = page.locator('#game');
    this.helpOverlay = page.locator('#helpOverlay');
    this.helpClose = page.locator('#helpClose');
    this.infoOverlay = page.locator('#infoOverlay');
    this.infoClose = page.locator('#infoClose');
    this.winOverlay = page.locator('#winOverlay');
    this.winNext = page.locator('#winNext');
    this.winNew = page.locator('#winNew');
    this.saveScore = page.locator('#saveScore');
    this.playerName = page.locator('#playerName');
  }

  /**
   * Navigate with a deterministic baseline: mark help as seen so the
   * first-visit modal does NOT auto-open, and start from an empty ranking.
   * Tests that specifically need the first-visit modal call `gotoFresh()`.
   *
   * IMPORTANT: the init script only sets the "seen" flag (it must survive
   * reloads). Ranking is cleared once, AFTER load, so scores saved during the
   * test persist across page.reload().
   */
  async goto() {
    await this.page.addInitScript(() => {
      try {
        localStorage.setItem('cc_sokoban_seen', '1');
      } catch {}
    });
    await this.page.goto('/index.html');
    await this.page.waitForLoadState('load');
    // clear any pre-existing ranking exactly once, then re-render
    await this.page.evaluate(() => {
      try { localStorage.removeItem('sokoban_cc_scores_v1'); } catch {}
    });
    await this.run('renderRanking();');
    await this.waitReady();
  }

  /** Navigate as a brand-new visitor (no localStorage). */
  async gotoFresh() {
    await this.page.goto('/index.html');
    await this.page.waitForLoadState('load');
    await this.waitReady();
  }

  /** Wait until the game has booted (globals + canvas sized). */
  async waitReady() {
    await expect(this.canvas).toBeVisible();
    await this.page.waitForFunction(
      () => typeof (window as any).eval('typeof realTotal') === 'string' &&
            (window as any).eval('typeof realTotal') === 'function',
    );
    await this.page.waitForFunction(() => (window as any).eval('realTotal()') > 0);
  }

  // ---- global-state accessors (resolve identifiers in page scope) ----

  /** Evaluate a JS body string in page scope. Body should `return ...`. */
  async run<T = unknown>(body: string): Promise<T> {
    return this.page.evaluate(`(function(){ ${body} })()`) as Promise<T>;
  }

  realTotal(): Promise<number> {
    return this.run<number>('return realTotal();');
  }
  placedCountVal(): Promise<number> {
    return this.run<number>('return placedCount();');
  }
  levelIndex(): Promise<number> {
    return this.run<number>('return levelIndex;');
  }
  moves(): Promise<number> {
    return this.run<number>('return moves;');
  }

  async moveCountText(): Promise<string> {
    return (await this.moveCount.textContent()) ?? '';
  }
  async placedText(): Promise<string> {
    return (await this.placedCount.textContent()) ?? '';
  }

  /** Call tryMove(dx,dy) in page scope. */
  async tryMove(dx: number, dy: number) {
    await this.run(`tryMove(${dx}, ${dy});`);
  }

  async setLevel(i: number) {
    await this.run(`setLevel(${i}); newGame();`);
  }

  async newGame() {
    await this.run('newGame();');
  }
  async reset() {
    await this.run('reset();');
  }
  async undo() {
    await this.run('undo();');
  }

  /**
   * Make exactly one valid move (a plain walk if available, otherwise a valid
   * push), incrementing `moves` by 1. Returns true if a move was made.
   * Robust against the player starting boxed-in (a common generated layout).
   */
  async makeOneMove(): Promise<boolean> {
    return this.run<boolean>(`
      const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
      // prefer a plain walk
      for(const [dx,dy] of DIRS){
        const nx=player.x+dx, ny=player.y+dy;
        if(isWalkable(nx,ny) && !boxAt(nx,ny)){ tryMove(dx,dy); return true; }
      }
      // otherwise a valid push (box ahead, cell beyond it walkable & empty, not landing
      // a real box onto its own correct target so placedCount stays predictable-ish)
      for(const [dx,dy] of DIRS){
        const nx=player.x+dx, ny=player.y+dy;
        const b=boxAt(nx,ny);
        if(b){ const bx=nx+dx, by=ny+dy; if(isWalkable(bx,by) && !boxAt(bx,by)){ tryMove(dx,dy); return true; } }
      }
      return false;
    `);
  }

  /** Make up to n valid moves; returns the number actually made. */
  async makeMoves(n: number): Promise<number> {
    let made = 0;
    for (let i = 0; i < n; i++) {
      if (await this.makeOneMove()) made++;
      else break;
    }
    return made;
  }

  /** Serialize the current board (boxes + player) for comparison. */
  boardSignature(): Promise<string> {
    return this.run<string>(
      `return JSON.stringify({p:player, b:boxes.map(b=>[b.x,b.y,b.id||'',b.decoy?1:0])});`,
    );
  }

  /** Count fixed obstacles currently on the board. */
  obstacleCountVal(): Promise<number> {
    return this.run<number>('return obstacles.length;');
  }

  /** Count decoy (pushable fake) boxes currently on the board. */
  decoyCountVal(): Promise<number> {
    return this.run<number>('return boxes.filter(b=>b.decoy).length;');
  }

  /**
   * Force a win: snap every real box onto a distinct matching target, then
   * call afterMove() which triggers onWin() when placed===total.
   * Works on any level (handles duplicate itemIds across rooms).
   */
  async forceWin() {
    await this.run(`
      const used = new Set();
      boxes.filter(b=>!b.decoy).forEach(b => {
        const t = targets.find(t => t.itemId===b.id && !used.has(t));
        if(t){ used.add(t); b.x=t.x; b.y=t.y; }
      });
      afterMove();
    `);
  }

  /**
   * Set up a deterministic single-push: take one real box, place it one cell
   * away from its correct target with the player directly behind it, then
   * return the (dx,dy) needed to push it onto the target. After calling this,
   * call tryMove(dx,dy) to land it. This exercises the real push + placement
   * + celebration code path (not just direct state assignment).
   */
  async setupOnePush(): Promise<{ dx: number; dy: number }> {
    return this.run<{ dx: number; dy: number }>(`
      // pick a real box and its target
      const used = new Set();
      const b = boxes.find(b=>!b.decoy);
      const t = targets.find(t => t.itemId===b.id);
      // choose a push direction whose approach cells are walkable & empty
      const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
      function emptyWalk(x,y){ return isWalkable(x,y) && !boxAt(x,y); }
      for (const [dx,dy] of DIRS){
        const bx = t.x - dx, by = t.y - dy;       // box one cell before target
        const px = bx - dx, py = by - dy;         // player behind box
        if (isWalkable(t.x,t.y) && emptyWalk(bx,by) && emptyWalk(px,py)){
          // clear any other box currently occupying these cells by moving them aside is risky;
          // instead just relocate our box & player, and ensure target/box/player cells are unique
          // Move any box that sits on bx,by/px,py/t.x,t.y out of the way first.
          [[bx,by],[px,py],[t.x,t.y]].forEach(([cx,cy])=>{
            const other = boxes.find(o=>o!==b && o.x===cx && o.y===cy);
            if(other){
              // park it on any far walkable empty cell
              outer: for(let yy=ROWS-1; yy>=0; yy--) for(let xx=COLS-1; xx>=0; xx--){
                if(emptyWalk(xx,yy) && !(xx===bx&&yy===by) && !(xx===px&&yy===py) && !(xx===t.x&&yy===t.y)
                   && !boxes.some(z=>z.x===xx&&z.y===yy)){ other.x=xx; other.y=yy; break outer; }
              }
            }
          });
          b.x = bx; b.y = by;
          player.x = px; player.y = py;
          afterMove(true);
          return { dx, dy };
        }
      }
      throw new Error('no valid one-push setup found');
    `);
  }

  /** Open the item-info modal for the first real box (educational modal). */
  async openInfoForFirstRealBox(): Promise<{ id: string; file: string }> {
    return this.run<{ id: string; file: string }>(`
      const b = boxes.find(b=>!b.decoy);
      const meta = ITEMS.find(i=>i.id===b.id);
      openItemInfo(b);
      return { id: b.id, file: meta.file };
    `);
  }

  async isShown(overlay: 'helpOverlay' | 'infoOverlay' | 'winOverlay'): Promise<boolean> {
    return this.page.locator(`#${overlay}`).evaluate((el) => el.classList.contains('show'));
  }
}
