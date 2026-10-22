import { turnsPerSeason } from '../engine/turn.ts'
import type { AchievementId } from '../engine/achievements.ts'
import type { GameState } from '../engine/state.ts'
import { hasSeenGuide, loadGame, loadMeta, markGuideSeen, type KeyValueStorage } from '../save/storage.ts'
import { codexScreen } from './codex.ts'
import { endingScreen } from './ending.ts'
import { createScreen, type NewGameDraft } from './create.ts'
import { seasonEnd } from './seasonEnd.ts'
import { planFlow } from './planFlow.ts'
import { runGuide } from './guide.ts'
import { gachaScreen } from './gachaScreen.ts'
import { GameSession } from './session.ts'
import { homeTab } from './tabs/homeTab.ts'
import { playerTab } from './tabs/playerTab.ts'
import { recordTab } from './tabs/recordTab.ts'
import { seasonTab } from './tabs/seasonTab.ts'
import { infoScreen, isInfoPageId, type InfoPageId } from './infoPages.ts'
import { seasonScreen } from './seasonScreen.ts'
import { shopScreen } from './shopScreen.ts'
import { openSettings } from './settingsSheet.ts'
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
  /** 엔딩·업적 도감 (back이 없으면 타이틀로 돌아간다) */
  /** 시즌 마지막 턴 뒤의 '시즌 종료' 화면 (시험 준비 + 결산 보기) */
  toSeasonEnd(state: GameState): void
  /** 시즌 계획 전체 화면 (① 계획 → ② 지출 계획) */
  toPlan(state: GameState): void
  /** 첫 접속 가이드(말풍선 5단계)를 지금 홈 화면 위에 띄운다 */
  showStartGuide(): Promise<void>
  toCodex(back?: () => void): void
  /** 업적 상점 */
  toShop(back?: () => void): void
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
    onSettings: () => void openSettings(ctx, { inGame }),
  })
  /** 육성·결산·엔딩 화면이면 설정에 '타이틀로'가 나온다 */
  let inGame = false
  const show = (el: HTMLElement, game = false) => {
    inGame = game
    unsubscribe()
    session = null
    shell.showFull(el)
  }
  let session: GameSession | null = null
  let unsubscribe = () => {}
  /** 탭 화면을 그리고, 세션이 바뀌면 그 탭을 다시 그린다 */
  const paintTab = (tab: TabId) => {
    if (!session) return
    const s = session
    unsubscribe()
    const view = { home: homeTab, season: seasonTab, player: playerTab, record: recordTab }[tab]
    shell.showTab(tab, view(s))
    unsubscribe = s.subscribe(() => {
      if (session !== s) return
      if (s.seasonOver()) ctx.toHome(s.state)
      else paintTab(tab)
    })
  }
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
    toHome(state) {
      unsubscribe()
      session = null
      // 시즌이 끝난 상태는 전체 화면(옛 홈)이 맡는다 (다음 작업에서 시즌 종료 화면으로 교체)
      if (!state.finished && state.turnInSeason < turnsPerSeason(state.mode) && !state.seasonTraining) {
        ctx.toPlan(state)
        return
      }
      if (!state.finished && state.turnInSeason >= turnsPerSeason(state.mode)) {
        ctx.toSeasonEnd(state)
        return
      }
      if (state.finished) {
        ctx.toTitle()
        return
      }
      session = new GameSession(ctx, state)
      inGame = true
      paintTab('home')
      // 첫 접속 가이드: 화면에 붙은 뒤 위치를 재야 해서 다음 프레임에 띄운다
      if (!hasSeenGuide(ctx.meta, 'start') && state.season === 1 && state.turnInSeason === 0) requestAnimationFrame(() => void ctx.showStartGuide())
    },
    toSeason: (state) => show(seasonScreen(ctx, state), true),
    toEnding: (state, info) => show(endingScreen(ctx, state, info), true),
    toSeasonEnd: (state) => show(seasonEnd(ctx, state), true),
    toPlan: (state) => show(planFlow(ctx, state), true),
    showTab: (tab) => paintTab(tab),
    async showStartGuide() {
      await runGuide(shell.root)
      ctx.meta = markGuideSeen(storage, 'start')
    },
    toCodex: (back) => show(codexScreen(ctx, back ?? (() => ctx.toTitle()))),
    toShop: (back) => show(shopScreen(ctx, back ?? (() => ctx.toTitle()))),
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
