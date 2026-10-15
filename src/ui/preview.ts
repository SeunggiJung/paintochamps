import genres from '../data/genres.json'
import modes from '../data/modes.json'
import { ACTIONS, applyTurn, turnScale, type Slot, type TurnChoice } from '../engine/turn.ts'
import type { GameState } from '../engine/state.ts'
import { STAT_KEYS } from '../engine/types.ts'
import { STAT_LABEL } from './labels.ts'

/** exact: 숫자로 보여 준다 / hint: 방향(↑↓)만 보여 준다 (정밀 모드의 함정용) */
export type PreviewDetail = 'exact' | 'hint'

export function previewDetail(mode: GameState['mode']): PreviewDetail {
  return modes[mode].preview as PreviewDetail
}

/** 소수점 이하를 버리고 부호를 붙인다. 0이면 null. */
function signed(n: number): string | null {
  const r = Math.round(n)
  return r === 0 ? null : r > 0 ? `+${r}` : String(r)
}

function arrow(n: number): string | null {
  return Math.abs(n) < 0.5 ? null : n > 0 ? '↑' : '↓'
}

/** before → after에서 달라진 것을 짧은 문구 목록으로 만든다. (능력치, 컨디션, 돈, 명성, 부상·슬럼프) */
export function describeChange(before: GameState, after: GameState, detail: PreviewDetail = 'exact'): string[] {
  const out: string[] = []
  const put = (label: string, delta: number, unit = '') => {
    const text = detail === 'exact' ? signed(delta) : arrow(delta)
    if (text) out.push(`${label} ${text}${detail === 'exact' ? unit : ''}`)
  }
  for (const k of STAT_KEYS) put(STAT_LABEL[k], after.stats[k] - before.stats[k])
  put('컨디션', after.condition - before.condition)
  put('돈', after.money - before.money, '만')
  put('명성', after.fame - before.fame)
  if (after.injuredMonths > before.injuredMonths) out.push('부상')
  if (after.slumpMonths > before.slumpMonths) out.push('슬럼프')
  return out
}

export type TurnPreview = { ok: true; lines: string[] } | { ok: false; error: string }

/**
 * 고른 행동 두 개의 예상 효과. 확률로 일어나는 부작용은 빼고(rng가 늘 1이면 어떤 결과도 나오지 않는다)
 * 확정 효과만 계산하므로 실제 결과와 다를 수 있다.
 */
export function previewTurn(state: GameState, choice: TurnChoice): TurnPreview {
  const r = applyTurn(state, choice, () => 1, false)
  if (!r.ok) return r
  return { ok: true, lines: describeChange(state, r.state, previewDetail(state.mode)) }
}

/** 행동 하나가 건드리는 것을 숫자 없이 요약한다. (목록에서 뭘 하는 행동인지 알려 주는 용도) */
export function actionTags(slot: Slot, state: GameState): string[] {
  const a = ACTIONS[slot.id]
  const tags: string[] = []
  const statKeys = new Set(Object.keys(a.stats ?? {}))
  if (a.topGenreStats) {
    const w = Object.entries(genres[state.genre].weights).sort((x, y) => y[1] - x[1])
    for (const [k] of w.slice(0, a.topGenreStats.count)) statKeys.add(k)
  }
  for (const k of STAT_KEYS) {
    if (!statKeys.has(k)) continue
    const v = a.stats?.[k] ?? 1
    tags.push(`${STAT_LABEL[k]}${v < 0 ? '↓' : '↑'}`)
  }
  const flag = (label: string, v: number | undefined) => {
    if (v) tags.push(`${label}${v > 0 ? '↑' : '↓'}`)
  }
  flag('컨디션', a.condition)
  flag('돈', a.money)
  flag('명성', a.fame)
  if (a.injuredMonths && a.injuredMonths < 0) tags.push('부상 회복')
  if (a.slumpMonths && a.slumpMonths < 0) tags.push('슬럼프 회복')
  return tags
}

/** 행동에 붙은 확률 부작용 설명. hint면 숫자 없이 "위험 있음"만 알려 준다. */
export function actionRisks(slot: Slot, state: GameState): string[] {
  const outcomes = ACTIONS[slot.id].outcomes ?? []
  if (outcomes.length === 0) return []
  if (previewDetail(state.mode) === 'hint') return ['위험 있음']
  return outcomes.map((o) => `${Math.round(o.chance * 100)}% ${o.label}`)
}

/** 행동 하나의 돈 비용(만 원, 올림). 벌기만 하는 행동이면 0. */
export function actionCost(slot: Slot, state: GameState): number {
  return Math.ceil(Math.max(0, -(ACTIONS[slot.id].money ?? 0)) * turnScale(state.mode))
}
