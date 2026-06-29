# Claude Code Sokoban 🧑‍💻📦

설정 항목(짐)을 알맞은 **설정 파일(방)** 으로 밀어 넣으며 **Claude Code의 설정 구조**를 배우는 교육용 소코반(창고지기) 퍼즐 게임입니다.

설치·빌드 없이 `index.html` 하나로 동작합니다.

## 🎮 플레이

```bash
# 저장소 클론 후
python3 -m http.server 8765
# 브라우저에서 http://localhost:8765/index.html 열기
```

또는 `index.html`을 브라우저로 바로 열어도 됩니다.

- 이동: `↑ ↓ ← →` 또는 `W A S D`
- 되돌리기: `U` · 리셋: `R` · 새 퍼즐: `N`
- 짐은 **밀 수만** 있고 당길 수 없습니다(소코반 규칙). 막히면 `U`로 되돌리세요.

## 🧩 게임 규칙

각 **방**은 Claude Code가 실제로 사용하는 **설정 파일/디렉토리**이고, 바닥에 흩어진 **짐**은 그 설정에 들어가는 **항목**입니다. 모든 짐을 자기 방의 **목표 칸(점선)** 으로 **최소 이동**으로 밀어 넣으면 클리어!

예) 훅 🪝 짐은 반드시 `settings.json` 방의 목표 칸으로 가야 합니다.

## 📚 다루는 Claude Code 구조

| 방 (파일/디렉토리) | 들어갈 설정 항목 |
|---|---|
| `settings.json` | 🪝 훅 · 🔐 권한 · 🌱 환경변수 · 🧠 모델 |
| `settings.local.json` | 🔒 개인 로컬 권한 |
| `~/.claude/settings.json` | 🧠 전역 모델 · 🌱 전역 환경변수 |
| `CLAUDE.md` | 📌 프로젝트 메모리 · 📐 코딩 규칙 |
| `.mcp.json` | 🔌 MCP 서버 |
| `.claude/commands/` | ⚡ 슬래시 명령 |
| `.claude/agents/` | 🤖 서브에이전트 |
| `.claude/skills/` | 🎯 스킬(SKILL.md) |
| `.claude/hooks/` | 📜 훅 스크립트 |
| `.claude/output-styles/` | 🎨 출력 스타일 |
| `.claude/plugins/` | 🧩 플러그인 |
| `.gitignore` | 🚫 무시 규칙 |

## 🏆 특징

- **레벨 3종** — L1 설정 첫걸음(방 6) · L2 설정 심화(방 8) · L3 전체 생태계(방 12)
- **난이도 3종** — 쉬움/보통/어려움 (짐이 흩어지는 정도)
- **항상 풀 수 있는 퍼즐** — 완성 상태에서 거꾸로 짐을 끌어내는 *역생성* 방식이라 데드락 없이 반드시 해법이 존재
- **되돌리기 / 리셋 / 새 퍼즐**
- **랭킹** — 이름·이동 수를 `localStorage`에 저장, 레벨·난이도별 Top 10

## 🛠️ 기술

순수 HTML/CSS/JavaScript (Canvas) 단일 파일. 외부 의존성 없음.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
