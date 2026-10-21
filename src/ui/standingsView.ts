import type { GameState, RunRecord } from '../engine/state.ts'
import { h } from './dom.ts'
import { openSheet } from './sheet.ts'

/** 토너먼트·플레이오프는 상위 몇 팀까지 보여 줄지 */
const ORDER_SHOWN = 8

const rank = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}위`)

/** 대회 하나의 최종 결과: 리그는 순위표(승패), 토너먼트는 최종 순서 */
function runCard(run: RunRecord): HTMLElement {
  const mine = run.placement > 0 ? `내 순위 ${run.placement}위 / ${run.fieldSize}팀` : ''
  const rows = run.table
    ? run.table.map((r, i) => h('div', { class: `kv-row${r.isPlayer ? ' me' : ''}` }, h('span', {}, `${i + 1}위 ${r.name}${r.isPlayer ? ' (나)' : ''}`), h('b', {}, `${r.wins}승 ${r.losses}패`)))
    : run.order.slice(0, ORDER_SHOWN).map((t, i) => h('div', { class: `kv-row${t.isPlayer ? ' me' : ''}` }, h('span', {}, `${rank(i)} ${t.name}${t.isPlayer ? ' (나)' : ''}`)))
  // 내가 순서 밖(하위)이면 아래에 내 순위를 따로 적는다
  const more = !run.table && run.order.length > ORDER_SHOWN ? h('p', { class: 'muted small' }, `외 ${run.order.length - ORDER_SHOWN}팀${run.placement > ORDER_SHOWN ? ` · ${mine}` : ''}`) : null
  return h('section', { class: 'card' }, h('div', { class: 'row' }, h('h3', {}, run.name), h('span', { class: 'chip' }, mine)), ...rows, more)
}

/** 이번 시즌 공개된 대회들의 다른 팀 성적. 시즌 결산 화면에서 연다. */
export function openStandings(state: GameState): Promise<void> {
  const run = state.seasonRun
  const runs = run && run.season === state.season ? run.runs.filter((r) => r.revealed !== 'none') : []
  return openSheet<void>((close) =>
    h(
      'div',
      { class: 'stack-tight standings-sheet' },
      h('h3', {}, '이번 시즌 다른 팀 성적'),
      runs.length === 0 ? h('p', { class: 'muted small' }, '이번 시즌에 공개된 대회 기록이 없어요.') : h('div', { class: 'stack-tight' }, ...runs.map(runCard)),
      h('button', { class: 'btn', onclick: () => close() }, '닫기'),
    ),
  )
}
