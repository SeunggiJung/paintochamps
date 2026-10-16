import gacha from '../data/gacha.json'
import type { GameState } from '../engine/state.ts'
import { STAT_KEYS } from '../engine/types.ts'
import { h } from './dom.ts'
import { formatMoney, formatMoneyDelta } from './format.ts'
import { STAT_LABEL } from './labels.ts'

const STAT_MAX = gacha.statMax

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

/**
 * 값 하나의 변화 막대. 기존 값은 파란색, 늘어난 만큼은 초록색, 줄어든 만큼은 빨간색으로 이어 붙여
 * "얼마에서 얼마가 됐는지"를 한눈에 보여 준다.
 */
function changeRow(label: string, from: number, to: number, max: number): HTMLElement {
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`
  const kept = Math.min(from, to)
  const diff = Math.round(to) - Math.round(from)
  return h(
    'div',
    { class: 'change-row' },
    h('span', { class: 'stat-name' }, label),
    h(
      'div',
      { class: 'change-bar' },
      h('div', { class: 'seg kept', style: `width:${pct(kept)}` }),
      to > from && h('div', { class: 'seg gain', style: `width:${pct(to - from)}` }),
      to < from && h('div', { class: 'seg loss', style: `width:${pct(from - to)}` }),
    ),
    h('span', { class: 'change-vals' }, `${Math.round(from)} → `, h('b', {}, String(Math.round(to))), ' ', h('em', { class: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat' }, diff === 0 ? '±0' : signed(diff))),
  )
}

/** 숫자 한 줄: 돈·명성처럼 막대로 그리기 어려운 값 */
function changeLine(label: string, from: string, to: string, diffText: string, sign: number): HTMLElement {
  return h('div', { class: 'change-line' }, h('span', { class: 'stat-name' }, label), h('span', { class: 'change-vals' }, `${from} → `, h('b', {}, to), ' ', h('em', { class: sign > 0 ? 'up' : sign < 0 ? 'down' : 'flat' }, diffText)))
}

/** 한 턴(또는 이벤트)의 변화 그래프. 능력치·컨디션은 막대, 돈·명성·부상은 줄로 보여 준다. */
export function turnChangeGraph(before: GameState, after: GameState): HTMLElement {
  const lines: HTMLElement[] = []

  const fame = Math.round(after.fame) - Math.round(before.fame)
  if (fame !== 0) lines.push(changeLine('명성', String(Math.round(before.fame)), String(Math.round(after.fame)), signed(fame), fame))
  const money = after.money - before.money
  if (Math.round(money) !== 0) lines.push(changeLine('돈', formatMoney(before.money), formatMoney(after.money), formatMoneyDelta(money), money))

  const status: string[] = []
  if (after.injuredMonths > before.injuredMonths) status.push('부상')
  if (after.slumpMonths > before.slumpMonths) status.push('슬럼프')

  return h(
    'div',
    { class: 'change-graph' },
    h('div', { class: 'change-legend muted small' }, h('i', { class: 'seg kept' }), '기존', h('i', { class: 'seg gain' }), '증가', h('i', { class: 'seg loss' }), '감소'),
    ...STAT_KEYS.map((k) => changeRow(STAT_LABEL[k], before.stats[k], after.stats[k], STAT_MAX)),
    changeRow('컨디션', before.condition, after.condition, 100),
    ...lines,
    status.length > 0 && h('p', { class: 'risk', style: 'margin:0' }, `⚠ ${status.join(' · ')}`),
  )
}
