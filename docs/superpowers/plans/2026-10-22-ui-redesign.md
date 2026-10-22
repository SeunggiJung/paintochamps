# UI 전체 리디자인 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 화면을 하단 탭·전체 화면 흐름·테마 3종·글자 3종·움직임 3단계가 있는 새 디자인으로 바꾸고, 가이드·팝업 4종류·타이틀 4장면을 넣는다. 엔진·규칙은 건드리지 않는다.

**Architecture:** 화면 코드는 지금처럼 바닐라 TS(`h()` 헬퍼)로 두고, ① 디자인 토큰(CSS 변수)과 `data-theme/font/motion` 속성으로 테마·글자·움직임을 바꾸고 ② `shell.ts`가 하단 탭 4개와 탭 바 없는 전체 화면을 오가게 하며 ③ `home.ts`의 클로저에 있던 상태·행동을 `GameSession`(컨트롤러)으로 빼서 탭 뷰들이 공유한다. 팝업은 `openSheet`의 `variant`로 4종류(결정·결과·정보·연출)로 나눈다.

**Tech Stack:** Vite 8 · TypeScript 6 · Vitest 5(+ DOM 테스트용 `happy-dom`) · 글자는 npm 패키지(`pretendard`·`@fontsource/jua`·`galmuri`)를 번들해 직접 서빙.

**Spec:** `docs/superpowers/specs/2026-10-22-ui-redesign-design.md` (결정의 원문은 `docs/handover-2026-10-22-redesign.md`, 시안은 `docs/redesign-mockups/`). 실행자는 두 문서와 `CLAUDE.md`를 먼저 읽는다.

## Global Constraints

- 규칙·수치는 `src/data/*.json`에만 둔다(`CLAUDE.md` §3). **가이드 문구도 `src/data/guides.json`에 둔다.** 엔진은 UI를 임포트하지 않는다. `src/engine`과 규칙 JSON은 수정하지 않는다.
- **외부 요청 금지**: 개인정보처리방침이 "서버로 수집·전송하지 않는다"고 말한다. 글자·이미지·소리는 모두 번들(CDN·구글 폰트 금지).
- **push는 하지 않는다**(사용자가 요청할 때만). 작업은 `master`에서 하고 작업 단위마다 커밋한다. 커밋 메시지는 한국어, `feat/fix/docs/test/refactor/chore` 접두사, 끝에 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- 매 커밋 시점에 `npx tsc --noEmit`·`npm test`(기존 440개 + 새 테스트)가 통과하고 `npm run build`가 되며, **게임이 끝까지 플레이 가능**해야 한다(중간 상태가 깨진 채 커밋하지 않는다).
- 360px 모바일 세로를 먼저 맞춘다. 가로 스크롤 금지. PC(≥900px)는 가운데 패널(폭 **800px**)에만 게임을 채우고 양옆은 배경만 둔다.
- 세이브 호환: `GameState`는 건드리지 않는다. `MetaSave`에 필드를 더하면 `emptyMeta()`와 `loadMeta()` 기본값을 함께 고친다(옛 메타에 없어도 동작).
- 저장소(`localStorage`) 접근은 항상 `try/catch`(시크릿 모드). 새 설정 키는 `paintochamps:prefs`.
- 사용자에게 보이는 변경은 `src/data/updates.json`에 **날짜별 한 항목**(해요체, 인게임 변경만)으로 추가한다. 마지막 Task에서 한 번에 넣는다.
- CellCog(AI 이미지)는 더 쓰지 않는다. 새 그림이 필요하면 기존 도트 그림 재사용 또는 CSS·SVG.
- 도트 스프라이트·장면 그림(`sprite.ts`·`endingScenes.ts`·`broadcastScene.ts`·`roomScene.ts` 등)은 수정하지 않는다.
- 이미지 변환은 Claude가 다른 도구로 하지 않는다. 사용자가 https://anypictoanypic.com/ko/ 로 변환하고, Claude는 설정을 안내한다(`CLAUDE.md` §9).

## 검증 방법 (모든 Task 공통)

- **V1**: `npx tsc --noEmit && npm test` 통과.
- **V2 (화면 확인)**: 개발 서버(`npm run dev`, `http://localhost:5173/`)를 Playwright로 열어 360×740에서 해당 화면을 캡처해 눈으로 본다. 테마는 콘솔에서 `document.documentElement.dataset.theme='light'|'cozy'|'dark'`로 바꿔 3종을 본다. 게임 상태에 들어가는 방법은 `docs/redesign-baseline.md`의 "재현 방법"을 따른다. 확인 항목: ①가로 스크롤 없음(`document.documentElement.scrollWidth <= innerWidth`) ②글자 잘림·겹침 없음 ③해당 시안(`docs/redesign-mockups/<번호>`)과 같은 구조.
- **V3**: `npm run build` 성공.

## Review Focus

설계 문서가 침묵하지만 실제로 깨지기 쉬운 것. 각 줄의 테스트는 해당 Task에 넣었다.

1. **옛 세이브·메타 호환** — 새 필드(`guidesSeen`)가 없는 옛 `MetaSave`(그리고 `guideDone: true`)를 불러와도 첫 접속 가이드가 다시 뜨지 않고, 상황별 가이드는 처음 한 번씩 뜬다. (Task 2, `storage.test.ts`)
2. **저장소 불가·깨진 설정** — `localStorage`가 막혔거나 `paintochamps:prefs`가 깨졌거나 모르는 테마 값이 들어 있어도 기본값으로 동작하고 화면이 죽지 않는다. (Task 1, `prefs.test.ts`)
3. **결산의 필수 제안 우회** — 입단·콜업 제안이 남아 있으면 어느 탭에서도 '다음 시즌 시작'이 막히고, 제안을 고르면 풀린다. 이적·해외·백지수표 제안은 거절할 수 있다. (Task 16, `seasonFlow.test.ts`)
4. **가이드 중복·겹침** — 같은 상황이 한 판에서 여러 번 나와도, 가이드를 닫지 않고 새로고침해도 한 번만 뜨고, 이미 본 가이드를 `?`로 다시 열어도 '본 기록'이 바뀌지 않는다. (Task 20, `guides.test.ts`)
5. **가로 스크롤·대비** — 테마 3종 모두에서 360px 폭 가로 스크롤이 없고, 글자·강조색 대비가 읽을 만하다(주요 쌍 ≥ 3:1, 본문 ≥ 4.5:1). (Task 3 `theme.contrast.test.ts` + Task 24 V2 전수 점검)

---

## 파일 구조

**새 파일**
- `src/ui/prefs.ts` — 테마·글자·움직임·도감 보기 설정의 타입·저장·해석·적용(순수 + 얇은 DOM)
- `src/ui/fonts.ts` — 글자 3종의 스택과 지연 로드
- `src/ui/theme.css` — 디자인 토큰(테마 3종), 글자·움직임 변수, PC 패널
- `src/ui/shell.ts` — 오른쪽 위 ⚙, 하단 탭 바, 전체 화면/탭 화면 전환
- `src/ui/settingsSheet.ts` — 설정 시트(테마·글자·움직임·소리·업데이트·가이드 모아 보기·타이틀로)
- `src/ui/components.ts` — 세그먼트·점 단계·칩 등 공통 작은 부품
- `src/ui/session.ts` — `GameSession`: 육성 상태와 행동(턴 진행·협상·이적 요청·상점·경력)
- `src/ui/tabs/homeTab.ts` · `seasonTab.ts` · `playerTab.ts` · `recordTab.ts` — 탭 4개 뷰
- `src/ui/planFlow.ts` — 시즌 계획 전체 화면(① 계획 → ② 지출 계획)
- `src/ui/seasonEnd.ts` — 결산 직전 '시즌 종료' 단계(시험 준비 + 결산 보기)
- `src/ui/seasonFlow.ts` — 결산 흐름의 순수 로직(시작 가능 여부·탭 알림 점)
- `src/ui/guides.ts` + `src/data/guides.json` — 상황별 가이드 레지스트리·표시·`?` 버튼
- 테스트: `prefs.test.ts` · `fonts.test.ts` · `theme.contrast.test.ts` · `sheet.test.ts` · `shell.test.ts` · `settingsSheet.test.ts` · `session.test.ts` · `seasonFlow.test.ts` · `guides.test.ts` · `tabs.test.ts` (모두 `src/ui/` 아래, DOM이 필요한 것은 파일 맨 위에 `// @vitest-environment happy-dom`)

**수정 파일**: `src/main.ts` · `src/ui/app.ts`(Ctx 확장) · `src/ui/style.css`(토큰 이전) · `src/ui/sheet.ts` · `src/ui/home.ts`(→ 점차 삭제) · `src/ui/planScreen.ts` · `src/ui/seasonScreen.ts` · `src/ui/ending.ts` · `src/ui/codex.ts` · `src/ui/title.ts` · `src/ui/titleScene.ts` · `src/ui/create.ts` · `src/ui/gachaScreen.ts` · `src/ui/guide.ts` · `src/ui/updateLog.ts` · `src/ui/sound.ts` · 팝업을 쓰는 파일들(Task 18) · `src/save/storage.ts` · `package.json` · `CLAUDE.md` · `src/data/updates.json`

---

### Task 1: 설정(prefs) 순수 로직과 테스트 환경

**Files:**
- Create: `src/ui/prefs.ts`, `src/ui/prefs.test.ts`
- Modify: `package.json`(devDependency `happy-dom`)
- Test: `src/ui/prefs.test.ts`

**Interfaces:**
- Produces:
  - `type ThemeId = 'light' | 'cozy' | 'dark'` (A·B·C) · `type ThemePref = ThemeId | 'auto'` · `type FontId = 'pretendard' | 'jua' | 'galmuri'` · `type MotionId = 'calm' | 'normal' | 'lively'` · `type MotionPref = MotionId | 'auto'` · `type CodexView = 'tile' | 'list'`
  - `interface Prefs { theme: ThemePref; font: FontId; motion: MotionPref; codexView: CodexView }`
  - `const PREFS_KEY = 'paintochamps:prefs'` · `const defaultPrefs: Prefs` = `{ theme:'auto', font:'pretendard', motion:'auto', codexView:'tile' }`
  - `loadPrefs(storage: KeyValueStorage): Prefs` · `savePrefs(storage: KeyValueStorage, prefs: Prefs): boolean`
  - `resolveTheme(pref: ThemePref, prefersDark: boolean): ThemeId` (`auto` → 다크면 `'dark'`, 아니면 `'light'`) · `resolveMotion(pref: MotionPref, reducedMotion: boolean): MotionId` (`auto` → 동작 줄이기면 `'calm'`, 아니면 `'normal'`)
  - `interface Env { prefersDark: boolean; reducedMotion: boolean }` · `readEnv(): Env`(`matchMedia`가 없으면 둘 다 false) · `applyPrefs(prefs: Prefs, env: Env, root?: HTMLElement): void`(`root.dataset.theme/font/motion` 설정, 기본 `document.documentElement`)

- [ ] **Step 1: `happy-dom` 설치와 환경 확인** — `npm i -D happy-dom`. `src/ui/prefs.test.ts` 맨 위에 `// @vitest-environment happy-dom`를 쓰고 `it('DOM 환경이 켜져 있다', () => expect(typeof document.createElement).toBe('function'))`를 먼저 돌려 통과하는지 본다(`npx vitest run src/ui/prefs.test.ts`). 호환 문제가 있으면 `jsdom`으로 바꾼다.
- [ ] **Step 2: 실패하는 테스트를 쓴다** — 메모리 저장소(`Map` 기반 `KeyValueStorage`)로:
  - `loadPrefs`는 저장이 없으면 `defaultPrefs`.
  - `savePrefs` 후 `loadPrefs`가 같은 값을 돌려준다.
  - **(Review Focus 2)** 저장값이 깨진 JSON(`'{oops'`)이거나, `theme: 'neon'`·`font: 'comic'`·`motion: 5`처럼 모르는 값이면 해당 필드만 기본값으로 대체하고 나머지는 유지한다.
  - **(Review Focus 2)** `setItem`이 예외를 던지는 저장소에서 `savePrefs`는 `false`를 돌려주고 예외를 밖으로 내지 않는다. `getItem`이 던져도 `loadPrefs`는 기본값.
  - `resolveTheme('auto', true)==='dark'`, `('auto', false)==='light'`, `('cozy', true)==='cozy'`(직접 고른 값이 우선).
  - `resolveMotion('auto', true)==='calm'`, `('auto', false)==='normal'`, `('lively', true)==='lively'`.
  - `applyPrefs`가 `root.dataset.theme/font/motion`을 해석된 값으로 쓴다(`happy-dom`의 `document.createElement('div')`를 root로).
- [ ] **Step 3: 실패 확인** — `npx vitest run src/ui/prefs.test.ts` → `prefs.ts` 없음으로 FAIL.
- [ ] **Step 4: `src/ui/prefs.ts`를 구현한다** — 위 시그니처대로. 필드별 검증은 허용 값 배열(`THEMES`, `FONTS`, `MOTIONS`, `CODEX_VIEWS`)로 한다. 저장 키·허용 값 배열 외의 매직 값은 만들지 않는다.
- [ ] **Step 5: 통과 확인** — V1.
- [ ] **Step 6: Commit** — `git add package.json package-lock.json src/ui/prefs.ts src/ui/prefs.test.ts && git commit -m "feat: 설정(테마·글자·움직임·도감 보기) 순수 로직과 DOM 테스트 환경"`

### Task 2: 가이드 본 기록(MetaSave 확장)

**Files:**
- Modify: `src/save/storage.ts`(`MetaSave`, `emptyMeta`, `loadMeta`)
- Test: `src/save/storage.test.ts`(있으면 추가, 없으면 생성)

**Interfaces:**
- Consumes: `KeyValueStorage`, `loadMeta`, `markGuideDone`(기존, 그대로 둔다)
- Produces:
  - `type GuideId = 'start' | 'plan' | 'spend' | 'contract' | 'offers' | 'event' | 'injury' | 'prep' | 'turnResult' | 'midOffer' | 'ads' | 'house' | 'shop' | 'tokenShop' | 'broadcast' | 'minigame'` (export는 `src/save/storage.ts`)
  - `MetaSave.guidesSeen: Partial<Record<GuideId, true>>`
  - `hasSeenGuide(meta: MetaSave, id: GuideId): boolean` — `id === 'start'`이면 `meta.guideDone`도 본 것으로 친다.
  - `markGuideSeen(storage: KeyValueStorage, id: GuideId): MetaSave` — 저장하고 새 메타를 돌려준다. `'start'`는 `guideDone`도 `true`로 함께 올린다.

- [ ] **Step 1: 실패하는 테스트** (메모리 저장소):
  - **(Review Focus 1)** `guidesSeen`이 없는 옛 메타 JSON(`{version:1, tutorialDone:true, guideDone:true, endings:{}, ...}`)을 `setItem`해 두고 `loadMeta` → `guidesSeen`은 `{}`, `hasSeenGuide(meta,'start')===true`, `hasSeenGuide(meta,'plan')===false`.
  - `guideDone:false` 옛 메타에서는 `'start'`도 false.
  - `markGuideSeen(storage,'plan')` 후 `loadMeta`에서 `hasSeenGuide(...,'plan')===true`이고 다른 가이드는 false. 같은 호출을 두 번 해도 결과가 같다(멱등).
  - `markGuideSeen(storage,'start')`는 `guideDone===true`로도 남긴다.
  - `setItem`이 던지는 저장소에서도 예외 없이 새 메타 객체를 돌려준다.
- [ ] **Step 2: 실패 확인** → FAIL.
- [ ] **Step 3: 구현** — `emptyMeta()`에 `guidesSeen: {}`를 더하고 `loadMeta`의 병합이 기본값을 채우게 한다. 기존 `safe()` 헬퍼를 재사용한다.
- [ ] **Step 4: V1·V3**.
- [ ] **Step 5: Commit** — `git commit -m "feat: 상황별 가이드 본 기록(MetaSave.guidesSeen)"`

### Task 3: 디자인 토큰과 테마 3종 (style.css 이전)

**Files:**
- Create: `src/ui/theme.css`, `src/ui/theme.contrast.test.ts`
- Modify: `src/ui/style.css`(하드코딩 색 → 토큰), `src/main.ts`(`import './ui/theme.css'`를 `style.css`보다 먼저)

**Interfaces:**
- Produces: 토큰(CSS 변수, 세 테마 모두 정의): `--bg --panel --panel-2 --line --text --muted --accent --accent-text --accent-soft --track --danger --up --warn-bg --warn-text --gold --overlay --tab-bg`, 모양 토큰 `--radius --radius-sm --border --shadow`, 등급색 `--grade-N/R/SR/SSR/UR`(기존 값 유지). 테마 선택자는 `:root[data-theme='light']`·`[data-theme='cozy']`·`[data-theme='dark']`. `data-theme`가 없을 때를 위해 `:root` 기본값은 `dark`(지금과 같은 모습).

**테마 값(시안 `01`·`08`·`25`에서)**
- light(A): `--bg:#f2f4f6 --panel:#fff --panel-2:#eef0f3 --line:#e5e8eb --text:#191f28 --muted:#8b95a1 --accent:#3182f6 --accent-text:#fff --accent-soft:#e8f3ff --track:#e5e8eb --danger:#f04452 --up:#1ba34a --warn-bg:#ffe1e4 --warn-text:#d6293a --gold:#d6870a --radius:16px --border:1px solid var(--line) --shadow:none`
- cozy(B): `--bg:#fff1d6 --panel:#fffdf4 --panel-2:#f7e4bd --line:#e6cfa8 --text:#3b2a20 --muted:#8a6a55 --accent:#ff8a3d --accent-text:#fff --accent-soft:#ffd45e --track:#f0dcc0 --danger:#d9480f --up:#2f8a3a --warn-bg:#ffd9c9 --warn-text:#b83a14 --gold:#a47500 --radius:10px --border:3px solid #5b3a29 --shadow:0 4px 0 #5b3a29`
- dark(C): `--bg:#14172f --panel:rgba(36,42,92,.72) --panel-2:#232a5c --line:#3b4490 --text:#eef0ff --muted:#9aa3d6 --accent:#6c8cff --accent-text:#fff --accent-soft:#2f3a85 --track:#10132b --danger:#ff6b7a --up:#4cd18a --warn-bg:rgba(240,68,82,.22) --warn-text:#ff8a9a --gold:#ffcf5a --radius:16px --border:1px solid var(--line) --shadow:none`, 배경은 `radial-gradient(120% 60% at 50% 0%, #2b2f6b 0%, #14172f 60%)`.

- [ ] **Step 1: 실패하는 대비 테스트** — `theme.contrast.test.ts`(노드 환경): `fs.readFileSync('src/ui/theme.css')`에서 테마 블록별 `--변수: #hex` 값을 정규식으로 뽑아 WCAG 대비 비를 계산하는 순수 함수 `contrast(a, b)`를 테스트 파일 안에 두고, 세 테마 각각에서 `--text`/`--bg` ≥ 4.5, `--muted`/`--bg` ≥ 3, `--accent-text`/`--accent` ≥ 3, `--up`/`--bg` ≥ 3, `--danger`/`--bg` ≥ 3(`rgba(...)` 값인 `--panel`은 건너뛰고 `--bg`로 비교)을 단언한다. **(Review Focus 5)**
- [ ] **Step 2: 실패 확인** → `theme.css` 없음으로 FAIL.
- [ ] **Step 3: `theme.css` 작성** — 위 토큰 세 벌. 대비 기준을 못 넘는 값이 나오면 같은 색상 계열에서 명도를 조정하고 시안과 달라지는 값은 파일 주석에 적는다.
- [ ] **Step 4: `style.css` 이전** — 아래 대응으로 하드코딩 색을 토큰으로 바꾸고, 카드·시트·선택지 같은 "카드 모양" 규칙은 `border: var(--border); border-radius: var(--radius); box-shadow: var(--shadow)`를 쓰게 한다. 대응: `#12141c`·`#0d1018`(막대 트랙·어두운 칸) → `--track` / `#232a47`·`#36407a`(선택·도움말·강조 배경) → `--accent-soft` / `#2a2f48`(칩) → `--panel-2` / `#4a2430`(경고 배경) → `--warn-bg` / `#ffb3bd`·`#ffd1d6`(경고 글자) → `--warn-text` / `#4cd18a`·`#4cc38a`(증가) → `--up` / `#f5c542`·`#e6b422`·`#ffd34d`(강조 금색) → `--gold` / `#000a`(뒷배경) → `--overlay` / 기존 `--accent`·`--danger`·`--panel`·`--line`·`--text`·`--muted`는 이름 유지. SVG 장면 안의 색(`.bs`·`.contract-svg`·도트 그림)은 건드리지 않는다. `.sound-toggle`의 `#232a47`도 토큰으로.
- [ ] **Step 5: 통과 확인** — V1·V3. V2: 타이틀·캐릭터 만들기·홈 화면을 세 테마로 캡처해 ①`dark`가 이전 모습과 거의 같고 ②`light`·`cozy`에서 글자가 읽히는지 본다.
- [ ] **Step 6: Commit** — `git commit -m "feat: 디자인 토큰과 테마 3종(밝은 카드·크림+도트·다크), 하드코딩 색을 토큰으로 이전"`

### Task 4: 설정 적용과 글자 3종 서빙

**Files:**
- Create: `src/ui/fonts.ts`, `src/ui/fonts.test.ts`
- Modify: `src/main.ts`, `src/ui/theme.css`(`[data-font]` 변수), `src/ui/app.ts`(`Ctx.prefs`, `Ctx.updatePrefs`), `package.json`(글자 패키지)

**Interfaces:**
- Produces:
  - `fonts.ts`: `FONT_STACK: Record<FontId, string>`(각 값 끝에 시스템 글자 대체 `system-ui, 'Malgun Gothic', sans-serif` 포함) · `loadFont(id: FontId): Promise<void>`(해당 글자 CSS를 **동적 import**로 한 번만 불러온다. 실패해도 reject하지 않고 시스템 글자로 남는다)
  - `Ctx.prefs: Prefs` · `Ctx.updatePrefs(patch: Partial<Prefs>): void` — 값을 병합해 `savePrefs`, `applyPrefs(readEnv())`, 글자가 바뀌면 `loadFont`를 호출한다.
  - `theme.css`: `[data-font='pretendard'|'jua'|'galmuri'] { --font-body: ... }`, `body { font-family: var(--font-body) }`.

- [ ] **Step 1: 패키지 확인과 설치** — `npm view pretendard version`·`@fontsource/jua`·`galmuri`가 존재함을 확인했다. `npm i pretendard @fontsource/jua galmuri`. 설치된 CSS 경로를 `ls node_modules/pretendard/dist/web/variable`·`node_modules/@fontsource/jua`·`node_modules/galmuri/dist`로 확인하고 실제 파일 경로를 `fonts.ts`의 동적 import에 쓴다(Pretendard는 `dynamic-subset` 변형, Jua는 한글 subset 포함 CSS, Galmuri는 전체 CSS 중 `Galmuri11` 계열). 세 글자의 라이선스(OFL 등)를 각 패키지 `LICENSE`로 확인하고 `docs/`에 출처 한 줄을 남긴다.
- [ ] **Step 2: 실패하는 테스트** — `FONT_STACK`에 세 id가 모두 있고 각 값이 대체 글자로 끝난다. `loadFont`를 두 번 불러도 같은 Promise를 돌려준다(캐시). (`happy-dom`에서 동적 import는 모킹: `vi.mock`으로 각 CSS 경로를 빈 모듈로.)
- [ ] **Step 3: 구현** — `fonts.ts`와 `theme.css`의 글자 변수. `main.ts`에서 `loadPrefs` → `applyPrefs` → `loadFont(prefs.font)`를 **화면을 그리기 전에** 하고, `prefers-color-scheme`·`prefers-reduced-motion` 변경 이벤트(`matchMedia(...).addEventListener('change')`)에서 `applyPrefs`를 다시 부른다(자동 설정을 따르는 중일 때만 결과가 바뀐다). `app.ts`의 `Ctx`에 `prefs`·`updatePrefs`를 더한다.
- [ ] **Step 4: 검증** — V1·V3. 빌드 후 `dist/`에 글자 파일이 들어갔는지(`ls dist/assets | grep -i woff2`)와 `dist/` 전체 용량을 확인해 기록한다. V2: 콘솔에서 `document.documentElement.dataset.font='jua'`로 바꿔 글자가 바뀌는지, 네트워크 탭에 외부 도메인 요청이 없는지(`browser_network_requests`) 확인한다.
- [ ] **Step 5: Commit** — `git commit -m "feat: 설정 적용(테마·글자·움직임)과 글자 3종 번들 서빙"`

### Task 5: 팝업 종류(variant)와 연출 틀 CSS

**Files:**
- Modify: `src/ui/sheet.ts`, `src/ui/style.css`
- Test: `src/ui/sheet.test.ts`

**Interfaces:**
- Produces: `type SheetVariant = 'decision' | 'result' | 'info' | 'center' | 'cinema'` · `interface SheetOptions { variant?: SheetVariant; center?: boolean; autofocus?: boolean; title?: string }` · `openSheet<T>(build, options?)`. **이 Task에서는 기존 호출이 그대로 동작해야 한다**: `variant`가 없으면 `center === false ? 'decision' : 'center'`(옛 규칙)로 해석한다. (Task 18에서 `variant`를 필수로 바꾼다.)
- 동작: `decision`·`result` = 아래 시트, **바깥을 눌러도 안 닫힘**. `info` = 큰 아래 시트(최대 높이 92dvh, 위에 ✕ 버튼과 손잡이), **✕·바깥 누르기·손잡이를 아래로 끌기로 닫힘**(닫으면 `build`의 `close`를 `undefined as T`로 resolve가 아니라 별도 `onDismiss`: info의 반환형은 `void`로 한정). `center` = 가운데 카드. `cinema` = 전체 화면(`position:fixed; inset:0`), `options.title`이 있으면 왼쪽 위 칩으로 보이고, 내용 안의 `.skip-btn`은 CSS로 오른쪽 위에 고정된다.

- [ ] **Step 1: 실패하는 테스트**(`happy-dom`):
  - `variant` 없이 `openSheet(build)`는 `.overlay.center`를 만든다(기존 동작 유지), `{ center:false }`는 `.overlay.decision`.
  - `decision`에서 오버레이(바깥)를 클릭해도 닫히지 않고 `close(값)`으로만 resolve된다.
  - `info`는 `.sheet-close` 버튼 클릭으로 닫히고 Promise가 resolve된다.
  - `cinema`에 `title:'MSI'`를 주면 `.cin-chip` 텍스트가 `MSI`.
  - 닫은 뒤 `.overlay`가 DOM에서 사라지고 이전 포커스가 복원된다.
- [ ] **Step 2: 실패 확인**.
- [ ] **Step 3: 구현** — `overlay`에 `class="overlay <variant>"`. `info`의 끌어서 닫기는 손잡이(`.sheet-grab`)의 `pointerdown/move/up`에서 아래로 80px 이상 끌면 닫는 최소 구현(터치·마우스 공통). CSS: `.overlay.decision/.result/.info`는 아래 정렬, `.overlay.cinema .sheet`는 전체 화면·모서리 없음·`overflow:auto`·안쪽 세로 가운데, `.cin-top`(칩 + 스킵 자리). 시트 배경·테두리는 `var(--bg)`·`var(--border)`.
- [ ] **Step 4: 검증** — V1·V3, V2: 기존 팝업들이 그대로 가운데 카드로 뜨는지(회귀 없음) 확인.
- [ ] **Step 5: Commit** — `git commit -m "feat: 팝업 종류(결정·결과·정보·가운데·연출)와 정보 시트 닫기"`

### Task 6: 공통 부품과 PC 가운데 패널

**Files:**
- Create: `src/ui/components.ts`
- Modify: `src/ui/theme.css`(패널), `src/ui/style.css`(`#app`·`.screen` 폭)
- Test: `src/ui/components.test.ts`

**Interfaces:**
- Produces(`components.ts`):
  - `segmented<T extends string>(items: { id: T; label: string; dot?: boolean }[], active: T, onChange: (id: T) => void): HTMLElement` — `role="tablist"`, 활성 항목 `aria-selected="true"`, `dot`이면 빨간 점.
  - `stepDots(total: number, active: number): HTMLElement`
  - `chip(text: string, tone?: 'default' | 'alert' | 'award'): HTMLElement`
  - `sectionHeader(title: string, aside?: string | Node): HTMLElement`
- 패널: `@media (min-width: 900px)`에서 `body` 배경은 양옆 비움(`--bg`보다 약간 어둡거나 밝은 `--page-bg` 토큰을 `theme.css`에 추가), `#app`은 `max-width: 800px; margin: 0 auto; min-height: 100dvh; box-shadow`. 모바일(<900px)은 지금처럼 전체 폭(최대 480).

- [ ] **Step 1: 테스트**(`happy-dom`): `segmented`가 항목 수만큼 버튼을 만들고, 클릭하면 `onChange`가 그 `id`로 호출되고, `aria-selected`가 활성 항목에만 있고, `dot: true`면 `.dot`이 있다. `stepDots(4, 2)`는 `.on`이 2개.
- [ ] **Step 2: 실패 확인 → Step 3: 구현**(CSS는 시안 `08`·`25`의 `.seg`·`.chip`을 토큰으로 옮긴다) **→ Step 4: V1·V2**(PC 폭 1280×800에서 가운데 패널, 양옆 배경만). **Step 5: Commit** — `git commit -m "feat: 공통 부품(세그먼트·점 단계·칩)과 PC 가운데 패널"`

### Task 7: 셸 — 오른쪽 위 ⚙와 하단 탭 바

**Files:**
- Create: `src/ui/shell.ts`, `src/ui/shell.test.ts`
- Modify: `src/ui/app.ts`(`startApp`을 셸 기반으로), `src/ui/sound.ts`(`soundToggle` 사용 중단 — 함수는 Task 8에서 설정 시트가 재사용하므로 남긴다), `src/ui/style.css`
- Test: `src/ui/shell.test.ts`

**Interfaces:**
- Produces:
  - `type TabId = 'home' | 'season' | 'player' | 'record'`
  - `interface Shell { readonly root: HTMLElement; showFull(el: HTMLElement): void; showTab(tab: TabId, el: HTMLElement): void; readonly currentTab: TabId | null; setBadge(tab: TabId, on: boolean): void }`
  - `createShell(host: HTMLElement, hooks: { onTab(tab: TabId): void; onSettings(): void }): Shell`
  - 구조: `host` 안에 `[data-shell]`: 화면 영역(`.shell-body`) + 항상 오른쪽 위에 있는 `⚙`(`button.gear`, `aria-label="설정"`) + `showTab`일 때만 보이는 하단 탭 바(`nav.tabbar`, 탭 4개: `🏠 홈`·`📅 시즌`·`🧑 선수`·`🏆 기록`, 활성 `aria-current="page"`).
- `Ctx` 확장(`app.ts`): `showTab(tab: TabId): void`(현재 세션의 그 탭을 그린다) — 구현은 Task 8·9에서 채우고, 이 Task에서는 셸만 연결하고 모든 기존 화면은 `showFull`로 보여 준다.

- [ ] **Step 1: 실패하는 테스트**(`happy-dom`): `showFull`이면 `.tabbar`가 숨겨지고(또는 없음), `showTab('season', el)`이면 탭 바가 보이고 `season`이 `aria-current`, 같은 탭을 다시 눌러도 `onTab`이 호출되며, `setBadge('player', true)`면 선수 탭에 점, ⚙ 클릭이 `onSettings`를 부른다, `currentTab`이 맞게 바뀐다.
- [ ] **Step 2: 실패 확인 → Step 3: 구현** — `app.ts`의 `show(el)`을 `shell.showFull(el)`로 바꾸고 `document.body.append(soundToggle())`를 제거한다(소리 버튼은 Task 8의 설정 시트로 이동). ⚙는 이 Task에서는 `onSettings`로 임시 `console.info`만 부른다.
- [ ] **Step 4: V1·V2·V3** — 모든 기존 화면에 ⚙가 오른쪽 위에 보이고 소리 둥근 버튼이 사라졌는지.
- [ ] **Step 5: Commit** — `git commit -m "feat: 셸(⚙와 하단 탭 바)과 전체 화면/탭 화면 전환"`

### Task 8: 설정 시트

**Files:**
- Create: `src/ui/settingsSheet.ts`, `src/ui/settingsSheet.test.ts`
- Modify: `src/ui/app.ts`(`onSettings` 연결), `src/ui/sound.ts`(필요하면 `soundEnabled`·`setSoundEnabled` 그대로 사용)

**Interfaces:**
- Consumes: `Ctx.prefs/updatePrefs`, `soundEnabled/setSoundEnabled/onSoundChange`, `openUpdateLog`(Task 21까지는 기존 것), `openSheet({ variant: 'info' })`
- Produces: `openSettings(ctx: Ctx, opts?: { inGame: boolean }): Promise<void>` — 정보 시트. 항목: **테마** `자동·밝은 카드·크림+도트·다크`(세그먼트), **글자** `Pretendard·주아·갈무리`, **움직임** `자동·차분·보통·화려`, **소리** 스위치, **업데이트 로그** 행(›), **가이드 모아 보기** 행(›, Task 20까지는 비활성 안내), **타이틀로**(`inGame`일 때만, `ctx.toTitle()`). 고른 즉시 `ctx.updatePrefs`로 적용된다(시트를 닫지 않아도 배경 화면이 바뀜).

- [ ] **Step 1: 테스트**(`happy-dom`, 가짜 `ctx`): 테마 세그먼트에서 '크림+도트'를 누르면 `ctx.updatePrefs({ theme: 'cozy' })`, 글자 '갈무리' → `{ font: 'galmuri' }`, 움직임 '차분' → `{ motion: 'calm' }`, '자동'은 각각 `'auto'`. 소리 스위치가 `setSoundEnabled`를 부른다. `inGame: false`면 '타이틀로' 행이 없다.
- [ ] **Step 2~3: 실패 확인 → 구현**. **Step 4: V1·V2**(세 테마·글자가 실제로 바뀌고 새로고침해도 유지되는지). **Step 5: Commit** — `git commit -m "feat: 설정 시트(테마·글자·움직임·소리·업데이트·타이틀로)"`

### Task 9: GameSession 추출 (동작 보존 리팩터)

**Files:**
- Create: `src/ui/session.ts`, `src/ui/session.test.ts`
- Modify: `src/ui/home.ts`(세션을 쓰도록), `src/ui/app.ts`(`ctx.session`)

**Interfaces:**
- Produces:
  ```ts
  export class GameSession {
    state: GameState
    busy: boolean
    shown: { money: number; fame: number; power: number; stats: Record<StatKey, number> } // countUp 기준값
    constructor(readonly ctx: Ctx, initial: GameState)
    subscribe(fn: () => void): () => void      // 구독 해제 함수를 돌려준다
    commit(next: GameState): void              // state 교체 + saveGame + 구독자 통지 + shown 갱신
    seasonOver(): boolean                       // state.turnInSeason >= turnsPerSeason(state.mode)
    playTurn(): Promise<void>                   // home.ts의 playTurn 그대로 (autoTurn·타임라인·턴 결과·코치·이벤트·광고 촬영·승급·이적 제안·미니게임)
    negotiate(): Promise<void>                  // negotiateNow
    requestMidTransfer(): Promise<void>         // requestMidTransfer
    openShop(): Promise<void>                   // openShopFlow
    showCareer(): Promise<void>                 // openCareer(buildCareer(state))
    askTeamName(): Promise<void>
  }
  ```
  `home.ts`의 `askCoachSwap`·`askPromotion`·`askMidSeasonOffer`·`runAdShoots`는 `session.ts`의 비공개 메서드로 옮긴다.
- 이 Task는 **화면이 달라지지 않는다**. `homeScreen(ctx, initial)`은 `new GameSession(ctx, initial)`을 만들어 같은 레이아웃을 그리고, 버튼 핸들러만 세션 메서드로 바꾼다.

- [ ] **Step 1: 실패하는 테스트**(노드/happy-dom): `commit()`이 구독자를 부르고 `saveGame`(메모리 저장소의 `SAVE_KEY`)에 반영되며, `subscribe`의 반환 함수로 해제하면 더 이상 안 불린다. `seasonOver()`가 `turnsPerSeason(mode)` 경계(마지막 턴 직전 false / 마지막 턴 후 true)에서 맞다. `busy` 중에 `playTurn()`을 다시 부르면 아무 일도 하지 않는다(상태 불변). (`createInitialState`로 만든 상태 + `rollGacha` 사용)
- [ ] **Step 2~3: 실패 확인 → 구현** — `home.ts`의 클로저 로직을 옮기되 **동작을 바꾸지 않는다**. `render()` 호출은 `notify()`로 바뀌고, `home.ts`가 `session.subscribe(render)`로 다시 그린다.
- [ ] **Step 4: 검증** — V1(440개 + 새 테스트), V3. V2: 새 게임 → 뽑기 → 홈에서 **턴 한 번 진행**(타임라인·턴 결과 시트·이벤트가 뜨는 경우 선택)해 예전과 똑같이 동작하는지, 이어하기로 돌아오는지 확인한다.
- [ ] **Step 5: Commit** — `git commit -m "refactor: 육성 상태와 행동을 GameSession으로 추출(동작 보존)"`

### Task 10: 홈 탭

**Files:**
- Create: `src/ui/tabs/homeTab.ts`
- Modify: `src/ui/app.ts`(`toHome`이 셸의 홈 탭을 보여 줌, `Ctx.showTab`), `src/ui/style.css`
- Test: `src/ui/tabs.test.ts`(홈 탭 부분)

**Interfaces:**
- Consumes: `GameSession`, `Shell.showTab`, `components.ts`
- Produces: `homeTab(session: GameSession): HTMLElement` — 시안 `25`의 홈: 상단 이름·나이·시즌·턴, 팀 칩과 구단 등급(`teamMarketText`), 컨디션 막대(도움말 `conditionHelp`)·돈·명성(`countUp`), 상태 칩(부상·슬럼프·중독), **내 방 그림 카드**(`roomSceneSvg`, 안에 `상점·꾸미기 ›` → `session.openShop()`), 이번 시즌 일정 요약(`scheduleBar`), 방침·훈련 칩과 **`연봉 협상 가능` 칩**(`canNegotiate(state)`일 때), 광고 계약 카드(`adCard`), 하단 고정 큰 버튼 **`다음 턴 진행`**(`session.playTurn()`, 탭 바 바로 위). `data-guide` 속성: 상태 카드 `status`, 큰 버튼 `go`.
- `ctx.toHome(state)` 새 동작: `session`을 만들고 → 시즌이 끝났으면 `ctx.toSeasonEnd`(Task 14), 계획이 없으면 `ctx.toPlan`(Task 13), 아니면 `shell.showTab('home', homeTab(session))`. 다른 탭은 이 Task에서 임시로 "준비 중" 문구(Task 11~12에서 교체). 탭 전환은 세션 구독으로 현재 탭을 다시 그린다.
- 지금의 홈에 있던 `능력치 카드`·`내 경력`·`연봉 협상`·`이적 요청`·`타이틀로` 버튼은 이 Task에서 홈에서 **빼고**, 다음 Task들에서 옮긴 곳에 다시 생긴다(설계 §6 대응표). 이 사이 커밋에서 협상·이적 요청이 일시적으로 접근 불가가 되지 않게, 이 Task와 Task 11을 **연속해서** 하고 Task 11 끝에서 접근 가능해야 한다.

- [ ] **Step 1: 테스트**(`happy-dom`, 세션 + 홈 탭): `다음 턴 진행` 버튼이 있고 `session.busy`일 때 비활성, 연봉 협상 가능 상태에서만 `연봉 협상 가능` 칩이 있다(협상이 불가능한 상태에서는 없다), `상점·꾸미기 ›` 클릭이 `openShop`을 부른다(세션 메서드를 스파이로 대체).
- [ ] **Step 2~3: 실패 확인 → 구현**. **Step 4: V1·V2** — 시안 `25` 홈과 같은 구조, 360px에서 큰 버튼이 탭 바와 겹치지 않고 내용이 가려지지 않는지, 세 테마. **Step 5: Commit** — `git commit -m "feat: 홈 탭(상태·내 방·일정·다음 턴 진행)과 탭 셸 연결"`

### Task 11: 선수 탭과 시즌 탭

**Files:**
- Create: `src/ui/tabs/playerTab.ts`, `src/ui/tabs/seasonTab.ts`
- Modify: `src/ui/app.ts`(탭 연결), `src/ui/style.css`
- Test: `src/ui/tabs.test.ts`

**Interfaces:**
- Produces:
  - `playerTab(session: GameSession): HTMLElement` — 능력치 6개(막대·`statName` 도움말·`countUp`)와 실력치, **계약 카드**(월급, `연봉 협상`·`이적 요청` 버튼: `canNegotiate`·`!transferBlocker(state,'mid')`일 때만 활성, `session.negotiate()`·`session.requestMidTransfer()`), **장비·시설 현황**(보기 전용: 장비 단계·시설 단계 목록, 구매 버튼 없음, 안내 문구 "구매는 시즌 시작 때 지출 계획에서 해요"), **내 경력** 행(›, `session.showCareer()`).
  - `seasonTab(session: GameSession): HTMLElement` — 세로 타임라인(`scheduleBar`의 데이터를 완료·진행 중·예정으로), 이번 시즌 계획 요약(방침·훈련·레슨, **보기만**), 다른 팀 성적 행(›, `openStandings`, `state.seasonRun`이 있을 때).
- 홈의 `상태 ⚠ 시즌 계획 없음` 같은 비정상 상태에서도 두 탭이 죽지 않게 `state.seasonTraining === null`이면 계획 요약에 "아직 정하지 않았어요"를 보여 준다.

- [ ] **Step 1: 테스트**: 선수 탭에 `계약` 카드가 있고 협상이 불가능한 상태(`canNegotiate` false)에서는 `연봉 협상` 버튼이 비활성, 장비·시설 영역에 구매 버튼(`.btn`로 `buyEquipment`를 부르는 것)이 없다, 시즌 탭이 `seasonRun`이 없으면 '다른 팀 성적' 행을 숨긴다, `seasonTraining`이 `null`일 때 시즌 탭이 예외 없이 그려진다.
- [ ] **Step 2~3~4: 실패 확인 → 구현 → V1·V2**(시안 `25`의 선수·시즌 탭, 세 테마). **Step 5: Commit** — `git commit -m "feat: 선수 탭(능력치·계약·장비/시설 현황·내 경력)과 시즌 탭(일정·계획 요약)"`

### Task 12: 기록 탭, 도감, 명예의 전당

**Files:**
- Create: `src/ui/tabs/recordTab.ts`
- Modify: `src/ui/codex.ts`(전체 재작성), `src/ui/shopScreen.ts`(뒤로 가기 대상), `src/ui/app.ts`, `src/ui/title.ts`(도감·상점 호출 시그니처)
- Test: `src/ui/tabs.test.ts`

**Interfaces:**
- Produces:
  - `Ctx.toCodex(back?: () => void): void` · `Ctx.toShop(back?: () => void): void` — 전체 화면(탭 바 없음) + 왼쪽 위 ‹ 뒤로(`back`이 없으면 `ctx.toTitle`).
  - `recordTab(session: GameSession): HTMLElement` — 도감 행(`엔딩 a/12 · 업적 b/27`) · 업적 상점 행(`🪙 tokens`) · 명예의 전당 행(`지난 판 n개`) · "지금까지"(완주·최고 단계·월드 우승 횟수). 도감·상점 행은 `ctx.toCodex(() => ctx.showTab('record'))`·`ctx.toShop(...)`.
  - `codexScreen(ctx: Ctx, back: () => void): HTMLElement` — 위에 `발견 n / 12`와 진행 막대, 세그먼트 `엔딩 / 업적 a/27 / 명예의 전당`. **엔딩·업적 탭은 타일(2열)·리스트(1열) 두 보기**, 전환 버튼 `▦ ☰`는 ⚙ 바로 아래(오른쪽 위 영역, 명예의 전당 탭에서는 숨김), 고른 값은 `ctx.updatePrefs({ codexView })`로 저장. 타일을 누르면 `info` 시트(큰 그림·이름·설명·횟수·최근 판 요약). **못 본 엔딩·업적은 `???`와 '직접 플레이하며 찾아보세요'만**(조건 숨김, 지금 동작 유지). 명예의 전당은 지금처럼 `ctx.meta.careers` 목록과 `경력 보기`(`openCareer`).

- [ ] **Step 1: 테스트**: 기본 보기가 `tile`이고 전환 버튼을 누르면 `ctx.updatePrefs({ codexView: 'list' })`가 불리며 리스트로 바뀐다, 못 본 엔딩 카드는 이름 대신 `???`이고 `endingDef`의 설명 문자열이 DOM에 없다(조건 노출 금지), 명예의 전당 탭에서는 전환 버튼이 없다, 엔딩 카드의 발견 수가 `ctx.meta.endings`와 같다.
- [ ] **Step 2~3~4: 실패 확인 → 구현 → V1·V2**(시안 `09`·`10`·`25`, 타이틀에서 도감 → 뒤로, 기록 탭에서 도감 → 뒤로가 각각 올바른 곳으로). **Step 5: Commit** — `git commit -m "feat: 기록 탭과 도감 재구성(엔딩/업적/명예의 전당, 타일·리스트 전환)"`

### Task 13: 시즌 계획 전체 화면 (① 계획 → ② 지출 계획)

**Files:**
- Create: `src/ui/planFlow.ts`
- Modify: `src/ui/planScreen.ts`(시트 → 단계 컴포넌트로 분해, 구매·계약 로직은 그대로 재사용), `src/ui/app.ts`(`ctx.toPlan`), `src/ui/session.ts`, `src/ui/home.ts` 잔재 제거
- Test: `src/ui/tabs.test.ts`(계획 흐름 부분)

**Interfaces:**
- Produces: `Ctx.toPlan(state: GameState): void` · `planFlow(ctx: Ctx, initial: GameState): HTMLElement` — 탭 바 없는 전체 화면, 위에 점 단계 2개.
  - **① 계획**: 방침 4종 2×2 카드(`PRESETS`), 훈련 후보 4개(`trainingMenuOf`, `★ 추천`은 `bestTraining`, 후보 다시 뽑기는 시즌 1회 `canRerollTraining`/`rerollTrainingMenu`, 항목 옆 `?`는 `trainingListHelp`), 개인 레슨 스위치. **훈련을 고르기 전에는 `다음 · 지출 계획` 버튼이 비활성**(문구 '이번 시즌 훈련을 골라 주세요').
  - **② 지출 계획**: 세그먼트 `장비 / 시설 n / 광고 n / 집`(광고·집이 해당 없으면 그 세그먼트를 숨긴다), 항목은 기존 `choice with-art` 행 + `openUpgrade` 팝업(구매 로직 `buyEquipment`/`buyFacility`/`signAd`/`buyHome`은 그대로), 상단 `지출 계획 · 보유 돈`, 하단 `이전` / `이 계획으로 시즌 시작`. 시작하면 `setSeasonPlan` + `chooseSeasonTraining` + `finishAdOffers`(기존 `openPlanSheet` 종료 처리와 같은 순서)를 적용하고 `saveGame` 후 `ctx.toHome(state)`.
- 호출 지점: 새 시즌이 시작될 때(`seasonScreen`의 `startNextSeason` 직후)와 이어하기로 들어왔는데 `seasonTraining`이 없을 때(`ctx.toHome`이 `toPlan`으로 보냄).

- [ ] **Step 1: 테스트**: ① 단계에서 훈련을 고르기 전 `다음` 버튼이 비활성이고, 고르면 활성. ② 단계의 `이 계획으로 시즌 시작`을 누르면 반환된 상태에 `seasonTraining`이 설정되고 `ctx.toHome`이 호출된다(스파이). 광고 제안이 없을 때 `광고` 세그먼트가 없다. 장비를 사면 돈이 줄고 단계가 오른다(기존 엔진 함수 사용, 세션 상태로 검증).
- [ ] **Step 2~3: 실패 확인 → 구현**. 기존 `openPlanSheet`는 더 이상 쓰는 곳이 없으면 삭제한다(`grep`으로 확인).
- [ ] **Step 4: V1·V2·V3** — 새 게임 첫 시즌 시작, 시즌 2 시작(결산 뒤), 이어하기에서 모두 계획 화면이 뜨고, 360px에서 스크롤 없이 ①이 한눈에 보이는지(시안 `11`), 세 테마.
- [ ] **Step 5: Commit** — `git commit -m "feat: 시즌 계획 전체 화면(① 계획 → ② 지출 계획)"`

### Task 14: '시즌 종료' 단계와 결산 직전 흐름

**Files:**
- Create: `src/ui/seasonEnd.ts`
- Modify: `src/ui/session.ts`, `src/ui/app.ts`(`ctx.toSeasonEnd`), `src/ui/home.ts` 잔재 삭제(이 Task 후 `home.ts` 파일 자체를 삭제한다)

**Interfaces:**
- Produces: `Ctx.toSeasonEnd(state: GameState): void` · `seasonEnd(ctx: Ctx, state: GameState): HTMLElement` — 탭 바 없는 전체 화면: 제목 `{season}시즌 종료`, `이름 · 나이`, 시즌 요약 한 줄(`seasonLine`을 쓸 수 없으면(결산 전이라 report가 없음) "이번 시즌의 모든 턴을 마쳤어요" 문구), **시험 카드**(`upcomingTest(state)`가 있을 때: 항목별 달성도 막대·예상 점수, 준비 선택 `PREP` — 지금의 `prepCard`), 큰 버튼 `시즌 결산 보기`. 준비를 안 고르고 누르면 기존 확인 시트(`confirmSheet`)를 그대로 띄운다. PC방 대회 팀 이름 정하기(`askTeamName`)도 결산 전에 기존처럼 처리한다.
- `ctx.toHome(state)`가 `session.seasonOver()`이면 `ctx.toSeasonEnd(state)`로 간다. 홈 탭에서 마지막 턴을 마친 뒤 `playTurn`이 끝날 때도 같다.

- [ ] **Step 1: 테스트**: 시험 대상이 아닌 상태에서는 시험 카드가 없고 버튼만 있다, 시험이 있고 `testPrep`이 없을 때 `시즌 결산 보기`를 누르면 확인 시트가 뜬다(`openSheet` 스파이), `testPrep`이 있으면 바로 `ctx.toSeason`이 호출된다.
- [ ] **Step 2~3~4: 구현 → V1·V2·V3** — 튜토리얼 시즌 끝(턴 2번), 입단 시험이 있는 초반 시즌 두 경우. **Step 5: Commit** — `git commit -m "feat: 시즌 종료 단계(시험 준비 + 결산 보기)로 홈 중간 화면 대체, home.ts 삭제"`

### Task 15: 결산 흐름 순수 로직

**Files:**
- Create: `src/ui/seasonFlow.ts`, `src/ui/seasonFlow.test.ts`

**Interfaces:**
- Produces:
  - `type SettleTab = 'result' | 'growth' | 'money' | 'offers'`
  - `canStartNextSeason(state: GameState): { ok: boolean; reason: string | null }` — **지금의 `seasonScreen`과 같은 규칙**: `state.pendingOffers`가 있으면(종류가 입단·콜업·이적·해외·백지수표 중 무엇이든) `ok:false, reason:'제안을 골라 주세요'`, 없으면 `ok:true, reason:null`. 이적·해외·백지수표·콜업은 제안 카드의 거절 버튼(`acceptOffer(state, null)`)으로 `pendingOffers`를 비울 수 있어서 결과적으로 거절 가능하고, 입단 제안(`scout`)은 거절 버튼이 없어 반드시 하나를 골라야 한다.
  - `settleAlerts(state: GameState): { offers: boolean }` — `offers`는 `!!state.pendingOffers`(제안 탭 빨간 점).
  - `startLabel(state: GameState, season: number): string` — 끝났으면 `'커리어 마무리'`, 제안이 남았으면 `'제안을 골라 주세요'`, 아니면 `` `${season + 1}시즌 시작` ``.

- [ ] **Step 1: 테스트**(**Review Focus 3**): `pendingOffers: { kind:'scout', offers:[...] }`면 `ok:false`·`offers:true`, `kind:'callup'`·`'transfer'`·`'overseas'`도 `ok:false`, `pendingOffers:null`이면 `ok:true`·`offers:false`. `acceptOffer(state, index)`나 `acceptOffer(state, null)`(거절) 뒤에는 `ok:true`가 된다(엔진 함수로 실제 상태를 만들어 검증). `state.finished`가 있으면 `startLabel`이 `'커리어 마무리'`.
- [ ] **Step 2~3~4: 실패 확인 → 구현 → V1**. **Step 5: Commit** — `git commit -m "feat: 결산 흐름 순수 로직(시작 가능 여부·알림 점·버튼 문구)"`

### Task 16: 시즌 결산 화면 (한 화면 + 탭)

**Files:**
- Modify: `src/ui/seasonScreen.ts`(`render`를 탭 구조로 재작성, 계산·진행 로직은 그대로)
- Test: `src/ui/tabs.test.ts`(결산 부분)

**Interfaces:**
- Consumes: `seasonFlow.ts`, `segmented`, 기존 카드 함수들(`highlightsCard`·`leagueCard`·`adReportCard`·`negotiateCard`·`transferCard`·`offersCard`)
- Produces: 탭 바 없는 전체 화면(`showFull`). 맨 위 큰 결과 카드(`headline`)는 고정, 아래 `segmented`(성적 / 성장 / 정산 / 제안, **제안 탭에 `settleAlerts(state).offers`면 빨간 점**), 하단 고정 큰 버튼(`startLabel`, `canStartNextSeason(state).ok`가 아니면 비활성). 탭별 내용: **성적** = 진로 문구·시험 결과 카드·대회 성적·라이벌전·다른 팀 성적 보기·이번 시즌 합계 / **성장** = 능력치 변동(`statChangeBars`)·시즌 활약(`highlightsCard`) / **정산** = 광고 정산·리그 파워 랭킹 / **제안** = `offersCard`·`negotiateCard`·`transferCard`·`기록`(커리어 종료 시)·`여기서 은퇴하기`(`canRetire()`일 때, 맨 아래 '커리어 마무리' 항목). 결산에 들어오면 제안이 있으면 **제안 탭이 아니라 성적 탭**부터 보여 주되 빨간 점으로 알린다(시안 `12`). 제안을 고르면(`choose`) 점이 사라지고 버튼이 활성화된다. 콜업 알림 시트(`콜업 알림`)는 그대로(결정 시트로).

- [ ] **Step 1: 테스트**: 제안이 있는 상태에서 하단 버튼이 비활성이고 `제안을 골라 주세요`, **어느 탭으로 바꿔도** 버튼이 비활성(탭 전환이 게이트를 풀지 않음), 제안 탭 세그먼트에 `.dot`, 제안을 하나 고르면(또는 거절) 버튼이 활성이고 점이 사라진다(**Review Focus 3**), 커리어가 끝나는 시즌은 버튼이 `커리어 마무리`.
- [ ] **Step 2~3~4: 실패 확인 → 구현 → V1·V2·V3** — 초반(입단 제안 3팀), 프로 2부 콜업, 프로 1부 시즌, 마지막 시즌(구단 인수·엔딩) 4가지 결산, 세 테마(시안 `12`). **Step 5: Commit** — `git commit -m "feat: 시즌 결산 한 화면+탭(성적·성장·정산·제안)과 필수 제안 게이트"`

### Task 17: 엔딩 화면

**Files:**
- Modify: `src/ui/ending.ts`(재작성), `src/ui/careerView.ts`(탭용 섹션 분리)
- Test: `src/ui/tabs.test.ts`(엔딩 부분)

**Interfaces:**
- Produces: `endingScreen(ctx, state, info)`(시그니처 유지) — 한 화면 + 접이식(시안 `07`·`08`): 맨 위 엔딩 그림(`endingArt` hero)·이름·문구(`epilogue`, `homeEpilogue`)·`도감에 새로 기록!` 칩 / **업적·토큰 한 줄 요약**(`🏅 업적 n개 · 🪙 +t`, `전체 보기`로 `info` 시트에 업적 카드 전체) / 기록 `segmented`(요약 · 수상 · 구단 · 시즌별): 요약=커리어 요약 행들, 수상·구단=`careerSections` 중 해당 부분, 시즌별=한 줄 타임라인(오래된 시즌은 `더 보기`로 접기: 최근 6시즌만 먼저) / 하단 고정 `결과 카드 만들기`·`엔딩 도감 보기`·`타이틀로`. 폭죽 조건은 지금과 같다.
- `careerSections`는 `{ summary, awards, clubs }`로 나눠서 돌려주는 `careerParts(career: Career): { awards: HTMLElement; clubs: HTMLElement; totals: HTMLElement }`를 추가하고, 기존 `careerSections`·`openCareer`는 이를 이용해 그대로 동작하게 둔다.

- [ ] **Step 1: 테스트**: 기록 세그먼트가 4개이고 기본이 `요약`, `시즌별`로 바꾸면 `state.history` 개수만큼(최근 6 + `더 보기`) 행이 있다, 업적이 0개면 업적 요약 줄이 없다, `info.isNew`면 새 기록 칩이 보인다.
- [ ] **Step 2~3~4: 구현 → V1·V2** — 8,479px이던 화면이 화면 약 2장 이내인지(`document.documentElement.scrollHeight`를 기록), 세 테마. **Step 5: Commit** — `git commit -m "feat: 엔딩 화면을 한 화면+접이식으로 재구성"`

### Task 18: 시작 흐름 — 타이틀·캐릭터 만들기·뽑기

**Files:**
- Modify: `src/ui/title.ts`, `src/ui/create.ts`, `src/ui/gachaScreen.ts`, `src/ui/style.css`
- Test: `src/ui/tabs.test.ts`(시작 흐름 부분)

**Interfaces:**
- 타이틀(시안 `16`): 큰 버튼 `새로 시작`(저장이 있으면 `이어하기 · 이름 (나이, 모드)`가 큰 버튼이고 `새로 시작`은 보조), 타일 3개(`📖 엔딩 도감 a/12`·`🪙 업적 상점 n`·`📝 업데이트`), `support` 칩(왼쪽 위), 약관 링크·권리 고지 작게(`infoFooter`). 중앙 그림은 Task 22가 바꾼다.
- 캐릭터 만들기: **한 화면**(이름 입력 · 장르 · 모드) + 하단 `능력치 뽑기` + 왼쪽 위 `‹`(타이틀로). 잠긴 모드는 이유(`튜토리얼을 한 번 끝내면 열린다.`)를 보여 준다.
- 뽑기: 하단 `다시 뽑기`(보조)·`이 캐릭터로 시작`(주) 둘뿐, 다시 뽑은 횟수는 카드 아래 안내 줄(`N번 다시 뽑았어요`, 뽑는 중에는 `카드를 누르면 건너뛰어요`), `원하는 등급까지 뽑기 ›` 링크가 `decision` 시트(등급 세그먼트 `R/SR/SSR/UR 이상` + `뽑기 시작`)를 열고 자동 뽑기가 도는 동안 같은 버튼이 `멈추기`. `처음부터` 버튼은 `‹ 뒤로`(`ctx.toCreate`)로 대체. SR 보장권 버튼은 그대로(조건부). 등급·특성 카드는 맨 위에 두고 연출 순서·시간은 그대로(`STEP_MS 130`·`SUSPENSE_MS 350`·`AUTO_SPEED 2`).

- [ ] **Step 1: 테스트**: 저장이 있을 때 큰 버튼 문구가 `이어하기`로 시작하고 `새로 시작`이 보조 스타일, 뽑기 화면 하단 버튼이 정확히 2개(보장권 제외), 다시 뽑기를 누르면 안내 줄이 `1번 다시 뽑았어요`, 이름이 비면 만들기에서 에러 문구.
- [ ] **Step 2~3~4: 구현 → V1·V2** — 시안 `16`·`17`과 비교, 뽑기 연출이 그대로 도는지(폭죽·건너뛰기·자동 뽑기), 세 테마. **Step 5: Commit** — `git commit -m "feat: 시작 흐름(타이틀·캐릭터 만들기 한 화면·뽑기 버튼 정리)"`

### Task 19: 팝업 종류별 분류 (variant 필수화)

**Files:**
- Modify: `src/ui/sheet.ts`(`variant` 필수, `center` 옵션 삭제), 아래 호출처 전부
- Test: `src/ui/sheet.test.ts`(옛 규칙 테스트를 새 규칙으로)

**분류표 (설계 §3.3)** — 각 호출에 `variant`를 명시한다:

| 호출처 | variant |
|---|---|
| `eventFlow.runEvent` 선택 시트 | `decision` |
| `eventFlow.runEvent` 결과 시트 | `result` |
| `session`(구 home) `askCoachSwap`·`askPromotion`·`askMidSeasonOffer`·`askTeamName` | `decision` |
| 턴 결과 시트(`turnChangeGraph`) | `result` |
| `confirm.confirmSheet` | `decision` |
| `negotiationView`(요구 고르기·결과) | `decision`·`result` |
| `upgradeSheet.openUpgrade` | `decision` |
| `seasonScreen`의 `askRetire`·콜업 알림 | `decision` |
| `calendarUi.showBeat`(대회 결과·중간 순위) | `center`(가운데 카드 유지, 사용자 결정) |
| `careerView.openCareer`·`standingsView.openStandings`·`shopSheet.openShop`·`support`(밥사주기)·`resultCard.openResultCard`·업데이트 로그 | `info` |
| `calendarUi.playTimeline`·`broadcast.playBroadcast`·`contractScene.showContract`·`adShoot.playAdShoot`·`miniGame`의 모든 시트 | `cinema` |

- [ ] **Step 1: 실패하는 테스트** — `openSheet`의 `variant`가 필수라 `variant` 없는 호출은 **타입 오류**여야 한다(`// @ts-expect-error`로 한 줄 검증), 각 variant의 오버레이 클래스.
- [ ] **Step 2: 구현** — 표대로 호출을 바꾸고 `SheetOptions.center`를 삭제한다. `cinema` 호출에는 `title`을 준다(`playTimeline`: `` `${before.season}시즌 · ${대회명 또는 '시즌 진행'}` ``, `playBroadcast`: 대회명 + `결승`, `showContract`: `계약`, `playAdShoot`: `광고 촬영`, 미니게임: `쉬는 시간 · ${종류}`). 각 연출 안의 기존 `스킵하기 ⏩`/`건너뛰기` 버튼은 유지하되 CSS가 오른쪽 위로 옮긴다.
- [ ] **Step 3: 검증** — V1·V3. V2: 팝업 11종을 하나씩 띄워(턴 진행으로 대부분 확인, 미니게임·계약·광고는 상태를 만들어서) 모양이 표대로인지, **결정 시트가 바깥을 눌러도 안 닫히는지**, 연출이 전체 화면이고 스킵이 오른쪽 위인지, 세 테마.
- [ ] **Step 4: Commit** — `git commit -m "feat: 팝업을 결정·결과·정보·가운데·연출로 분류(variant 필수)"`

### Task 20: 가이드 시스템

**Files:**
- Create: `src/ui/guides.ts`, `src/data/guides.json`, `src/ui/guides.test.ts`
- Modify: `src/ui/guide.ts`(첫 접속 5단계로 교체), `src/ui/settingsSheet.ts`(가이드 모아 보기), 각 화면(아래 호출 지점), `src/ui/tabs/homeTab.ts`

**Interfaces:**
- Consumes: `GuideId`·`hasSeenGuide`·`markGuideSeen`(Task 2), `openSheet`, `Ctx.meta`
- Produces:
  - `src/data/guides.json`: `{ "<GuideId>": { "title": string, "lines": string[], "where": string } }` — 시안 `22`의 문구(시즌 계획·지출 계획·연봉 협상/이적 요청·입단/이적 제안)를 그대로 옮기고, 나머지 12개(`start`는 5단계라 제외, `event`·`injury`·`prep`·`turnResult`·`midOffer`·`ads`·`house`·`shop`·`tokenShop`·`broadcast`·`minigame`)는 **게임 규칙을 `CLAUDE.md`에서 확인해** 3~4줄로 쓴다(숫자는 지어내지 않는다).
  - `guides.ts`: `showGuideOnce(ctx: Ctx, id: GuideId): Promise<void>` — 이미 봤으면 즉시 resolve, 아니면 **먼저 본 기록을 남기고**(`ctx.meta = markGuideSeen(...)`) `decision` 시트로 보여 준 뒤 `알겠어요`에서 resolve(**Review Focus 4**: 보여 주기 전에 기록하므로 닫지 않고 새로고침해도 다시 뜨지 않는다) · `showGuide(ctx, id): Promise<void>`(본 기록을 바꾸지 않고 다시 보기, `?` 버튼과 모아 보기용) · `guideHelp(ctx: Ctx, id: GuideId): HTMLElement`(`?` 버튼) · `listGuides(ctx: Ctx): { id: GuideId; title: string; where: string; seen: boolean }[]`.
  - 첫 접속 가이드(`start`): `guide.ts`의 `STEPS`를 `소개(중앙) → status → go → tabs → gear` 5단계로 교체(`data-guide` 대상: 홈 탭 상태 카드 `status`, 큰 버튼 `go`, 탭 바 `tabs`, ⚙ `gear`). 시즌 1 첫 턴(`state.season === 1 && state.turnInSeason === 0`)에 자동, 끝나면 `markGuideSeen(storage,'start')`. 설정의 모아 보기에서 다시 볼 수 있다.
- **호출 지점**: `plan`·`spend`·`ads`·`house` = `planFlow`(① 진입, ② 진입, `광고`/`집` 세그먼트를 처음 열 때) · `contract` = 선수 탭을 팀 소속으로 처음 열 때 · `offers` = 결산 제안 탭 첫 진입(제안이 있을 때) · `event` = `runEvent` 시작 전 · `injury` = 홈에서 `injuredMonths>0 || slumpMonths>0`을 처음 볼 때 · `prep` = `seasonEnd`에서 시험 카드가 있을 때 · `turnResult` = 첫 턴 결과 시트 전 · `midOffer` = `askPromotion`/`askMidSeasonOffer` 시작 전 · `shop` = `openShop` 전 · `tokenShop` = `shopScreen` 첫 진입 · `broadcast` = `playBroadcast` 전 · `minigame` = `offerMiniGame` 전. 항목 옆 `?`(`guideHelp`)는 계획·지출·계약·제안 화면의 해당 제목 옆.

- [ ] **Step 1: 테스트**(`happy-dom`, 메모리 저장소 + 가짜 `ctx`): **(Review Focus 4)** `showGuideOnce`를 같은 id로 두 번 부르면 시트는 한 번만 뜨고(두 번째는 바로 resolve), 시트를 열자마자(닫기 전) `hasSeenGuide`가 true, `showGuide`(다시 보기)는 이미 본 가이드를 다시 열되 `guidesSeen` 객체가 변하지 않는다, `listGuides`가 16개를 돌려주고 본 것만 `seen:true`, `guides.json`에 모든 `GuideId`의 키가 있고 `lines`가 비어 있지 않다(누락 방지), 옛 메타(`guideDone:true`)에서 `showGuideOnce(ctx,'start')`는 아무것도 띄우지 않는다.
- [ ] **Step 2~3: 실패 확인 → 구현** (`guide.ts`의 스포트라이트 로직은 단계 데이터만 바꿔 재사용). 설정의 `가이드 모아 보기` 행을 활성화한다.
- [ ] **Step 4: V1·V2** — 새 판 하나를 하며 계획·지출·이벤트·턴 결과 가이드가 각각 **처음에만** 뜨는지, 다음 시즌에는 안 뜨는지, 모아 보기에서 ✓ 표시와 다시 열기가 되는지(시안 `21`·`22`). **Step 5: Commit** — `git commit -m "feat: 상황별 가이드(처음 한 번만)와 첫 접속 가이드 5단계, 가이드 모아 보기"`

### Task 21: 업데이트 로그 시트

**Files:**
- Modify: `src/ui/updateLog.ts`, `src/ui/style.css`, `src/ui/settingsSheet.ts`, `src/ui/updateLog.test.ts`

**Interfaces:**
- `openUpdateLog()`는 `info` 시트로 바꾼다: 시트 **하나만** 스크롤(`.update-items`의 `max-height`·`overflow` 제거), 날짜는 `details` 접이식으로 **최신만 펼침**(하나를 열면 나머지 접힘 — 기존 로직 유지), 하단 `닫기`·`오늘 하루 안 보기`(기존 `hideToday`). 타이틀의 `업데이트` 타일과 설정에서 연다. 접속 직후 자동 팝업(`maybeShowUpdateLog`)은 그대로.

- [ ] **Step 1: 테스트**(기존 `updateLog.test.ts` 확장): 시트 안에 `overflow:auto`/`max-height`를 가진 중첩 스크롤 요소가 없다(`.update-items`에 해당 스타일 없음 — `getComputedStyle`이 happy-dom에서 제한적이면 클래스 규칙 부재를 CSS 파일 텍스트로 검증), 두 번째 항목을 열면 첫 항목이 닫힌다, `오늘 하루 안 보기`가 `hiddenToday()`를 true로 만든다.
- [ ] **Step 2~3~4: 구현 → V1·V2** (시안 `21`). **Step 5: Commit** — `git commit -m "feat: 업데이트 로그를 큰 아래 시트 하나로(이중 스크롤 해소)"`

### Task 22: 타이틀 4장면 이미지

**Files:**
- Modify: `src/ui/titleScene.ts`(이미지 슬라이드 + 효과, 기존 도트 장면은 `legacyHero`로 보관), `src/ui/title.ts`
- Create: `src/assets/title/`(사용자가 변환한 WebP 4장이 들어갈 폴더, `README.md`에 파일명·변환 설정)
- Test: `src/ui/titleScene.test.ts`

**Interfaces:**
- Produces: `titleHero(): HTMLElement` — `import.meta.glob('../assets/title/scene-*.webp', { eager: true, query: '?url', import: 'default' })`로 **있는 이미지만** 찾아, 4장(`scene-1-room`·`scene-2-train`·`scene-3-match`·`scene-4-win`)이 모두 있으면 슬라이드, **하나라도 없으면 기존 도트 `legacyHero()`**로 대체한다(파일이 없어도 빌드가 깨지지 않는다). 순서: 방구석 → 훈련 → 대회 → 우승, **16초 주기**(장면당 4초, 앞뒤 2%에서 부드럽게 전환)·천천히 다가가는 줌(8초 `alternate`, 1 → 1.06). 자막 4줄: `방구석에서 열심히 게임하던 겜돌이가` → `코치·팀원과 연습해서 실력을 키워` → `대회에서 다 같이 겨루고` → `월드 챔피언을 향해!`. 장면별 효과(시안 `20`의 좌표·키프레임 그대로, 퍼센트 좌표): 방구석 = LED 색 변화·모니터 불빛·컵라면 김·별 반짝임·노을빛 · 훈련 = 모니터 불빛 4곳·창밖 노을 · 대회 = 조명 빔 3개·야광봉 26개 깜빡임 · 우승 = 폭죽 불꽃 2개·종이 34조각. `prefers-reduced-motion` 또는 `data-motion='calm'`이면 효과·줌을 끄고 4번째(우승) 장면만 고정.
- 이미지 확보: **사용자에게 요청한다.** 원본은 `docs/redesign-mockups/title-cellcog-1.png`·`-2-train.png`·`-3-match-v2.png`·`-4-win.png`. https://anypictoanypic.com/ko/ 에서 **출력 형식 WebP, 크기 '직접 지정' 가로 900 × 세로 598(원본 2048×1360의 비율을 유지), 품질 82**로 4장을 같은 설정으로 일괄 변환해, 파일명을 `scene-1-room.webp`·`scene-2-train.webp`·`scene-3-match.webp`·`scene-4-win.webp`로 `src/assets/title/`에 넣어 달라고 요청한다.

- [ ] **Step 1: 테스트**(`happy-dom`): 이미지가 없으면(`glob` 결과 비어 있음) `titleHero()`가 도트 장면(`svg`)을 돌려준다, 4장이 모두 있으면 `.hero-scene`이 4개이고 자막 span이 4개이며 문구가 위 순서, `prefers-reduced-motion`이면 `.hero-fx`가 렌더링되지 않는다(모킹으로 `import.meta.glob` 결과 주입이 어려우면 `buildHero(urls: string[] | null)`를 순수 분리해서 테스트).
- [ ] **Step 2~3: 실패 확인 → 구현**. **Step 4: V1·V3**. **Step 5: 사용자에게 변환·배치를 요청**하고(이 요청은 사용자가 끝낼 때까지 기다리지 말고 **구현을 계속 이어간다**), 파일이 들어오면 V2(타이틀 4장면이 순서대로 돌고 효과가 그림 위에 맞는지, 360px에서 그림 비율 3:2가 깨지지 않는지)를 한다. **Step 6: Commit** — `git commit -m "feat: 타이틀 4장면(방구석→훈련→대회→우승)과 장면별 효과"` (이미지 파일이 없으면 코드·README만 커밋하고, 이미지가 들어오면 `feat: 타이틀 이미지 4장 추가`로 별도 커밋).

### Task 23: 움직임 3단계

**Files:**
- Modify: `src/ui/theme.css`·`src/ui/style.css`(애니메이션을 `data-motion`에 연결), `src/ui/confetti.ts`, `src/ui/sound.ts`(`vibrate`)
- Test: `src/ui/motion.test.ts`

**Interfaces:**
- 정의(시안 `04`): **차분** = 150ms 페이드와 버튼 눌림만(지금의 `prefers-reduced-motion`과 같음: 화면 전환·막대 채움 전환·장식 애니메이션·폭죽·진동 끔) / **보통** = 지금의 동작(카드 순서 떠오름, 시트 슬라이드, 막대 채움, 숫자 올라감, 폭죽) / **화려** = 보통 + 시트 바운스·버튼 반짝임·증가 숫자 튀어나옴·화면 전환 슬라이드 크게.
- 구현 방식: CSS는 `@media (prefers-reduced-motion: reduce)` 대신 `:root[data-motion='calm'] ...` 선택자로 통일해 모든 기존 `@media (prefers-reduced-motion)` 블록을 `data-motion='calm'` 규칙으로 옮긴다(자동 설정이 `calm`으로 해석되므로 결과가 같다). `confetti.celebrate`·`vibrate`는 `document.documentElement.dataset.motion === 'calm'`이면 아무것도 하지 않는다. `lively`는 `--bounce`·`--glow` 변수와 몇 개의 `@keyframes`(시트 바운스, 버튼 반짝임)를 추가한다.
- Test(`happy-dom`): `data-motion='calm'`일 때 `celebrate('UR')`이 `canvas.confetti`를 만들지 않고 `normal`에서는 만든다. `vibrate`가 `calm`에서 `navigator.vibrate`를 부르지 않는다(스파이).

- [ ] **Step 1~3: 테스트 → 구현**. 남아 있는 `@media (prefers-reduced-motion: reduce)` 규칙이 `style.css`에 없는지 `grep`으로 확인. **Step 4: V1·V2**(설정에서 세 단계를 바꿔 뽑기 폭죽·턴 결과·탭 전환이 단계별로 다른지, 시안 `04`와 비교). **Step 5: Commit** — `git commit -m "feat: 움직임 3단계(차분·보통·화려)를 data-motion으로 통일"`

### Task 24: 마감 — 전수 점검·문서·업데이트 로그

**Files:**
- Modify: `src/data/updates.json`, `CLAUDE.md`, `docs/redesign-baseline.md`(새 구조 기준선 추가), `docs/handover-2026-10-22-redesign.md`
- Test: 전체

- [ ] **Step 1: 전수 화면 점검(V2)** — 아래 화면 × 테마 3종(light·cozy·dark) × 폭 2종(360×740, 1280×800)을 캡처한다: 타이틀, 캐릭터 만들기, 뽑기, 시즌 계획 ①·②, 홈·시즌·선수·기록 탭, 턴 진행 연출, 턴 결과 시트, 이벤트 시트, 대회 결과 카드, 시즌 종료 단계, 결산 4탭, 엔딩, 도감 3탭(타일·리스트), 설정 시트, 업데이트 로그, 가이드 말풍선. 각각 **가로 스크롤 없음**(`scrollWidth <= innerWidth`), 글자 잘림 없음, 시안과 같은 구조를 확인하고 문제는 그 자리에서 고친다. 결과를 `docs/redesign-baseline.md` 하단 "새 구조 기준선" 표(화면·페이지 높이)로 남긴다(엔딩 8,479px → ?, 도감 4,775px → ?, 시즌 계획 3,893px → ?, 결산 3,329px → ? 비교).
- [ ] **Step 2: 기능 퇴행 점검** — 설계 §6 대응표의 모든 행을 하나씩 눌러 새 위치에서 동작하는지 체크리스트로 확인한다(다음 턴 진행, 상점·꾸미기, 연봉 협상, 이적 요청, 내 경력, 타이틀로, 장비·시설 구매, 광고, 집, 도감, 업적 상점, 정보 페이지, 밥사주기, 결과 카드 저장).
- [ ] **Step 3: 한 판 끝까지 플레이** — 봇이 아니라 직접(또는 `src/sim`의 시드 상태로 시즌을 빠르게 돌려) 튜토리얼 한 판을 끝까지(뽑기 → 시즌 여러 번 → 엔딩 → 도감)하며 콘솔 에러가 없는지(`browser_console_messages`)를 본다.
- [ ] **Step 4: 문서 갱신** — `CLAUDE.md` §1(현재 단계·지금 화면)·§4 코드 지도(`shell`·`session`·`tabs/*`·`planFlow`·`seasonEnd`·`seasonFlow`·`guides`·`prefs`·`fonts`·`settingsSheet`·`components`·`theme.css` 추가, `home.ts` 삭제 반영)·§6(UI 결정 요약: 탭 구조·팝업 4종류·테마·가이드·타이틀)를 새 구조에 맞게 고친다. `src/data/updates.json` 맨 위에 새 날짜 항목을 **한 번에** 넣는다(제목 `화면을 새로 만들었어요`, 항목: 하단 탭 4개와 시즌 계획·결산 구조, 테마 3종·글자 3종·움직임 설정, 상황별 가이드, 타이틀 새 장면, 도감 보기 전환, 업데이트 로그 시트 — 해요체). `docs/handover-2026-10-22-redesign.md` §1에 "구현 완료, 사용자 직접 플레이 확인 대기"를 쓴다.
- [ ] **Step 5: 최종 검증** — V1·V3. `dist/` 용량과 글자·이미지 파일 목록을 기록한다. `git status`로 의도치 않은 파일(`.playwright-mcp/` 등)이 없는지 확인한다.
- [ ] **Step 6: Commit** — `git commit -m "docs: UI 리디자인 마감 — 문서·업데이트 로그·새 구조 기준선"`
- [ ] **Step 7: 노션 기록** — 작업일지 DB에 이번 작업(리디자인 구현)을 한 줄 요약으로 남긴다(`CLAUDE.md` §10). 푸시는 사용자가 요청할 때만.

---

## 자체 점검 결과

**설계 커버리지**: 테마·글자·움직임·설정(T1·3·4·8·23), 탭 4개와 전체 화면(T7·10·11·12), 시즌 계획 2단계(T13), 결산(T14~16), 엔딩(T17), 도감(T12), 시작 흐름과 뽑기 연출(T18), 팝업 4종류와 연출 틀(T5·19), 가이드와 로그(T20·21), 타이틀 4장면(T22), PC 패널(T6), 퇴행 방지 대응표(T24) 모두 대응하는 Task가 있다.
**주의한 점**: 설계의 "입단 테스트 준비를 제안 탭에" 오류를 정정해(`7f9a90d`) 결산 직전 '시즌 종료' 단계(T14)로 옮겼다. T10~T11은 연속으로 해야 협상·이적 요청이 중간에 접근 불가가 되지 않는다.
**실행자가 정할 것**: 글자 패키지의 실제 CSS 경로(T4), 대비 기준을 못 넘는 색의 미세 조정(T3), 가이드 12개의 문구(T20, `CLAUDE.md` 규칙에서 확인해서 작성), 타이틀 효과의 퍼센트 좌표 미세 조정(T22).
