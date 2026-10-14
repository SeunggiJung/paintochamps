import genres from '../data/genres.json'
import type { GameState } from '../engine/state.ts'
import { STAT_KEYS } from '../engine/types.ts'
import type { Ctx } from './app.ts'
import { h } from './dom.ts'
import { MODE_INFO, STAT_LABEL } from './labels.ts'

/** 육성 메인 화면 자리. 다음 작업(②)에서 행동 선택·이벤트로 채운다. */
export function homeScreen(ctx: Ctx, state: GameState): HTMLElement {
  return h(
    'main',
    { class: 'screen' },
    h('h2', {}, `${state.name} · ${state.age}세`),
    h('p', { class: 'muted small' }, `${genres[state.genre].name} · ${MODE_INFO[state.mode].name} · ${state.season}시즌`),
    h(
      'ul',
      { class: 'plain' },
      ...STAT_KEYS.map((k) => h('li', {}, `${STAT_LABEL[k]} ${state.stats[k]}`)),
      h('li', {}, `컨디션 ${state.condition} · 돈 ${state.money}만 원`),
    ),
    h('p', { class: 'muted' }, '육성 화면은 준비 중입니다. (저장은 완료됨)'),
    h('button', { class: 'btn ghost', onclick: () => ctx.toTitle() }, '타이틀로'),
  )
}
