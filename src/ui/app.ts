import type { GameState } from '../engine/state.ts'
import { loadGame, loadMeta, type KeyValueStorage } from '../save/storage.ts'
import { createScreen, type NewGameDraft } from './create.ts'
import { gachaScreen } from './gachaScreen.ts'
import { homeScreen } from './home.ts'
import { seasonScreen } from './seasonScreen.ts'
import { titleScreen } from './title.ts'

/** 화면들이 공유하는 것: 저장소와 화면 전환 */
export interface Ctx {
  storage: KeyValueStorage
  meta: ReturnType<typeof loadMeta>
  toTitle(): void
  toCreate(): void
  toGacha(draft: NewGameDraft): void
  toHome(state: GameState): void
  toSeason(state: GameState): void
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
  }
  ctx.toTitle()
}
