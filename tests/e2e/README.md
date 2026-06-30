# Claude Code Sokoban — E2E 테스트

[Playwright](https://playwright.dev/) 기반 End-to-End 테스트 스위트입니다. 게임의 모든 핵심 사용자 흐름(로드·레벨·이동·밀기·되돌리기·짐 설명·클리어·랭킹·설정 상속)을 자동 검증합니다.

## 실행 방법

```bash
# 1) 의존성 설치 (최초 1회)
npm install
npx playwright install chromium

# 2) 전체 테스트 실행
npm test
#   = npx playwright test

# 유용한 옵션
npx playwright test movement-and-push.spec.ts   # 특정 파일만
npx playwright test --headed                     # 브라우저 보면서
npx playwright test --ui                         # UI 모드(디버깅)
npx playwright show-report                        # 마지막 HTML 리포트 열기
```

테스트는 `playwright.config.ts`의 `webServer` 설정이 `python3 -m http.server 8765`로 게임을 자동 서빙합니다(이미 8765 포트에 서버가 떠 있으면 재사용). 별도로 서버를 띄울 필요가 없습니다. 기본 대상은 로컬 `index.html`이며, 라이브 사이트(https://nowcika.github.io/claude-code-sokoban/)와 동일합니다.

## 최종 실행 결과

```
70 passed (약 20s, chromium)
```

| 스펙 파일 | 시나리오 영역 | 테스트 수 |
|---|---|---|
| `page-load.spec.ts` | 페이지 로드·초기 렌더·전역 API·반응형 | 5 |
| `help-modal.spec.ts` | 첫 방문 도움말 모달·교육 정보 | 6 |
| `level-select.spec.ts` | 레벨 4종 전환·보드 재구성·경계 | 6 |
| `difficulty-obstacles-decoys.spec.ts` | 난이도·🚧장애물·📦잡동사니 규칙 | 7 |
| `movement-and-push.spec.ts` | 키보드/WASD 이동·밀기 규칙·엣지 | 10 |
| `undo-reset-newgame.spec.ts` | 되돌리기·리셋·새 퍼즐·단축키 | 8 |
| `item-info-modal.spec.ts` | 짐 클릭 교육 모달·종류별 내용 | 6 |
| `win-and-celebration.spec.ts` | 클리어 판정·컨페티·축하 토스트 | 7 |
| `ranking-persistence.spec.ts` | 랭킹 저장·정렬·구성별 분리·영속성 | 8 |
| `settings-inheritance.spec.ts` | 설정 상속 패널·스코프·교육 콘텐츠 | 6 |
| **합계** | | **70** |

## 캔버스 게임 검증 전략

이 게임의 보드는 `<canvas id="game">`로 그려지므로 **보드 안의 짐/방/플레이어에는 DOM 셀렉터가 없습니다.** 그래서 세 가지 채널로 검증합니다:

1. **DOM 컨트롤·모달·통계** — 셀렉트(`#level #difficulty #obstacles #decoys`), 버튼, 오버레이(`.show` 클래스 토글), `#moveCount`·`#placedCount`, `#legend`·`#rankBody`, `#toast` 등.
2. **전역 JS 상태/함수** — 게임 스크립트가 classic `<script>`라 `let`/`function` 전역(`boxes, player, targets, moves, levelIndex, ROOMS, ITEMS, LEVELS, obstacles` / `tryMove, undo, reset, newGame, setLevel, placedCount, realTotal, boxOnRightTarget, openItemInfo, afterMove`)이 `window`에는 없지만 **페이지 전역 스코프에서 이름으로 접근**할 수 있습니다. POM의 `run()`이 소스 문자열을 `page.evaluate`로 실행해 이를 활용합니다.
3. **스크린샷** — 실패 시 자동 캡처(`screenshot: 'only-on-failure'`)로 시각 디버깅.

## 결정성(non-flaky) 보장

- `GamePage.goto()`는 `addInitScript`로 첫 방문 도움말 플래그(`cc_sokoban_seen`)를 미리 세팅해 모달 자동 노출을 제거하고, 랭킹 localStorage를 초기화합니다(첫 방문 모달 자체를 테스트할 땐 `gotoFresh()` 사용).
- 무작위 생성 보드에 의존하지 않도록, 승리/배치 검증은 `forceWin()`·`setupOnePush()`로 **결정적 상태**를 구성한 뒤 실제 코드 경로(`tryMove`→배치→축하)를 태웁니다.
- 플레이어가 막힌 초기 배치에도 안전하도록 `makeOneMove()`가 걷기/밀기 중 유효한 수를 선택합니다.

## 구조

```
tests/e2e/
├── *.spec.ts               # 시나리오별 테스트
├── page-objects/
│   └── GamePage.ts         # 페이지 오브젝트(셀렉터 + 전역 상태 접근 헬퍼)
├── scenarios/              # 한국어 시나리오 문서(.md) — 테스트의 근거
└── README.md
```

## 참고

- 페이지 로드 직후 콘솔 error 1건(favicon 404)이 관찰됩니다 — 게임 동작과 무관하며, 회귀 기준선으로 `page-load.spec.ts`에 문서화되어 있습니다.
- 시나리오 문서(`scenarios/*.md`)는 비개발자도 따라 읽을 수 있는 형식(목적/전제조건/단계/예상결과/실패조건/우선순위/예상시간)으로 작성되어 있어, 수동 테스트나 추가 자동화의 기준이 됩니다.
