import type { AchievementId } from '../engine/achievements.ts'
import type { GameState } from '../engine/state.ts'
import { loadGame, loadMeta, type KeyValueStorage } from '../save/storage.ts'
import { codexScreen } from './codex.ts'
import { endingScreen } from './ending.ts'
import { createScreen, type NewGameDraft } from './create.ts'
import { gachaScreen } from './gachaScreen.ts'
import { homeScreen } from './home.ts'
import { seasonScreen } from './seasonScreen.ts'
import { titleScreen } from './title.ts'

/** 엔딩 화면에 넘기는 기록 정보 */
export interface EndingInfo {
  /** 도감에 처음 기록되는 엔딩인지 */
  isNew: boolean
  /** 이번 판에서 달성한 업적 (isNew: 처음 달성한 업적) */
  achievements: { id: AchievementId; isNew: boolean }[]
}

/** 화면들이 공유하는 것: 저장소와 화면 전환 */
export interface Ctx {
  storage: KeyValueStorage
  meta: ReturnType<typeof loadMeta>
  toTitle(): void
  toCreate(): void
  toGacha(draft: NewGameDraft): void
  toHome(state: GameState): void
  toSeason(state: GameState): void
  /** 커리어가 끝난 뒤의 엔딩 화면 */
  toEnding(state: GameState, info: EndingInfo): void
  toCodex(): void
}

export function startApp(root: HTMLElement, storage: KeyValueStorage): void {
  const show = (el: HTMLElement) => root.replaceChildren(el)
  const ctx: Ctx = {
    storage,
    meta: loadMeta(storage),
    toTitle() {
      ctx.meta = loadMeta(storage)
      show(titleScreen(ctx, loadGame(storage)))
    },
    toCreate: () => show(createScreen(ctx)),
    toGacha: (draft) => show(gachaScreen(ctx, draft)),
    toHome: (state) => show(homeScreen(ctx, state)),
    toSeason: (state) => show(seasonScreen(ctx, state)),
    toEnding: (state, info) => show(endingScreen(ctx, state, info)),
    toCodex: () => show(codexScreen(ctx)),
  }
  ctx.toTitle()
}
