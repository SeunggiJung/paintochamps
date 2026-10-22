import type { AchievementId } from '../engine/achievements.ts'
import type { GameState } from '../engine/state.ts'
import { loadGame, loadMeta, type KeyValueStorage } from '../save/storage.ts'
import { codexScreen } from './codex.ts'
import { endingScreen } from './ending.ts'
import { createScreen, type NewGameDraft } from './create.ts'
import { gachaScreen } from './gachaScreen.ts'
import { homeScreen } from './home.ts'
import { infoScreen, isInfoPageId, type InfoPageId } from './infoPages.ts'
import { seasonScreen } from './seasonScreen.ts'
import { shopScreen } from './shopScreen.ts'
import { createShell, type TabId } from './shell.ts'
import { loadFont } from './fonts.ts'
import { applyPrefs, loadPrefs, readEnv, savePrefs, type Prefs } from './prefs.ts'
import { titleScreen } from './title.ts'

/** 엔딩 화면에 넘기는 기록 정보 */
export interface EndingInfo {
  /** 도감에 처음 기록되는 엔딩인지 */
  isNew: boolean
  /** 이번 판에서 달성한 업적 (isNew: 처음 달성한 업적) */
  achievements: { id: AchievementId; isNew: boolean }[]
  /** 이번 판에서 업적으로 받은 토큰 */
  tokens: number
}

/** 화면들이 공유하는 것: 저장소와 화면 전환 */
export interface Ctx {
  storage: KeyValueStorage
  meta: ReturnType<typeof loadMeta>
  /** 테마·글자·움직임·도감 보기 설정 */
  prefs: Prefs
  /** 설정을 바꿔 저장하고 화면에 적용한다 */
  updatePrefs(patch: Partial<Prefs>): void
  toTitle(): void
  toCreate(): void
  toGacha(draft: NewGameDraft): void
  toHome(state: GameState): void
  toSeason(state: GameState): void
  /** 커리어가 끝난 뒤의 엔딩 화면 */
  toEnding(state: GameState, info: EndingInfo): void
  /** 하단 탭 화면으로 이동 (탭 뷰는 이후 작업에서 연결) */
  showTab(tab: TabId): void
  toCodex(): void
  /** 업적 상점 */
  toShop(): void
  /** 서비스 소개·게임 가이드·개인정보처리방침·이용약관·문의 */
  toInfo(page: InfoPageId): void
}

/** 주소창의 #해시만 바꾼다 (기록에 쌓이지 않게 replace) */
function setHash(hash: string): void {
  try {
    history.replaceState(null, '', hash ? `#${hash}` : location.pathname + location.search)
  } catch {
    // 주소를 바꿀 수 없는 환경이면 무시한다
  }
}

const pageFromHash = (): string => location.hash.replace(/^#\/?/, '')

export function startApp(root: HTMLElement, storage: KeyValueStorage): void {
  const shell = createShell(root, {
    onTab: (tab) => ctx.showTab(tab),
    onSettings: () => console.info('설정 시트는 다음 작업에서 연결한다'),
  })
  const show = (el: HTMLElement) => shell.showFull(el)
  const ctx: Ctx = {
    storage,
    meta: loadMeta(storage),
    prefs: loadPrefs(storage),
    updatePrefs(patch) {
      ctx.prefs = { ...ctx.prefs, ...patch }
      savePrefs(storage, ctx.prefs)
      applyPrefs(ctx.prefs, readEnv())
      void loadFont(ctx.prefs.font)
    },
    toTitle() {
      ctx.meta = loadMeta(storage)
      setHash('')
      show(titleScreen(ctx, loadGame(storage)))
    },
    toCreate: () => show(createScreen(ctx)),
    toGacha: (draft) => show(gachaScreen(ctx, draft)),
    toHome: (state) => show(homeScreen(ctx, state)),
    toSeason: (state) => show(seasonScreen(ctx, state)),
    toEnding: (state, info) => show(endingScreen(ctx, state, info)),
    showTab: () => {},
    toCodex: () => show(codexScreen(ctx)),
    toShop: () => show(shopScreen(ctx)),
    toInfo(page) {
      setHash(`/${page}`)
      show(infoScreen(ctx, page))
      scrollTo(0, 0)
    },
  }
  // 주소 뒤에 #/terms 처럼 붙이면 정보 페이지를 바로 열 수 있다 (링크 공유용)
  const first = pageFromHash()
  if (isInfoPageId(first)) ctx.toInfo(first)
  else ctx.toTitle()
  window.addEventListener('hashchange', () => {
    const page = pageFromHash()
    if (isInfoPageId(page)) show(infoScreen(ctx, page))
  })
}
