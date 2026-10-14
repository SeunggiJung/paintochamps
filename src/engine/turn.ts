import actionData from '../data/actions.json'
import equipmentData from '../data/equipment.json'
import gacha from '../data/gacha.json'
import genres from '../data/genres.json'
import modes from '../data/modes.json'
import rules from '../data/rules.json'
import { equipmentEfficiency, growthDelta } from './growth.ts'
import type { ActionId, EquipmentId, GameState } from './state.ts'
import { STAT_KEYS, type StatKey, type Stats } from './types.ts'

interface ActionDef {
  name: string
  stats?: Partial<Record<StatKey, number>>
  topGenreStats?: { count: number; amount: number }
  condition?: number
  money?: number
  fame?: number
  requires?: { inTeam?: boolean; minFame?: number }
}

const ACTIONS = actionData as Record<ActionId, ActionDef>
const EQUIPMENT = equipmentData as Record<EquipmentId, { name: string; costs: number[] }>

/** 한 칸의 선택: 일반 행동, 또는 장비 구매(행동 1개를 쓴다) */
export type Slot = { id: ActionId } | { id: 'buy_equipment'; item: EquipmentId }
/** 한 턴에 행동 2개를 고른다. 같은 행동을 두 번 골라도 된다. */
export type TurnChoice = readonly [Slot, Slot]

export interface Delta {
  stats: Stats
  condition: number
  money: number
  fame: number
}

export type TurnResult =
  | { ok: true; state: GameState; delta: Delta; seasonEnded: boolean }
  | { ok: false; error: string }

/** 턴 길이 배율: 6개월 2, 3개월 1, 1개월 1/3 */
export function turnScale(mode: GameState['mode']): number {
  return modes[mode].turnMonths / rules.baseMonths
}

export function turnsPerSeason(mode: GameState['mode']): number {
  return modes[mode].turnsPerSeason
}

/** 한 턴에 이벤트가 하나 이상 일어날 확률: 1 − 0.65^(턴 길이 ÷ 3개월) */
export function eventChance(mode: GameState['mode']): number {
  return 1 - rules.eventBase ** turnScale(mode)
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** 선택 가능한지 확인한다. 가능하면 null, 아니면 이유를 돌려준다. */
export function checkSlot(state: GameState, slot: Slot): string | null {
  if (slot.id === 'buy_equipment') {
    const item = EQUIPMENT[slot.item]
    if (!item) return '알 수 없는 장비다'
    const level = state.equipment[slot.item]
    if (level >= rules.equipment.maxLevel) return `${item.name}은(는) 이미 최고 단계다`
    if (state.money < item.costs[level]) return `돈이 부족하다 (${item.costs[level]}만 원 필요)`
    return null
  }
  const action = ACTIONS[slot.id]
  if (!action) return '알 수 없는 행동이다'
  if (state.injuredMonths > 0 && slot.id !== 'rest') return '부상 중이라 휴식만 할 수 있다'
  const { inTeam, minFame } = action.requires ?? {}
  if (inTeam !== undefined && (state.team !== null) !== inTeam) {
    return inTeam ? `${action.name}은(는) 팀에 소속되어야 할 수 있다` : `${action.name}은(는) 팀에 들어가기 전에만 할 수 있다`
  }
  if (minFame !== undefined && state.fame < minFame) return `${action.name}은(는) 명성 ${minFame} 이상이어야 한다`
  return null
}

/** 선택 하나를 적용한 새 상태. 컨디션 계수는 이 행동을 하기 직전의 컨디션으로 계산한다. */
function applySlot(state: GameState, slot: Slot, scale: number): GameState {
  if (slot.id === 'buy_equipment') {
    const level = state.equipment[slot.item]
    return {
      ...state,
      money: state.money - EQUIPMENT[slot.item].costs[level],
      equipment: { ...state.equipment, [slot.item]: level + 1 },
    }
  }

  const action = ACTIONS[slot.id]
  const slumpFactor = state.slumpMonths > 0 ? rules.slumpGrowthFactor : 1
  const gains: Partial<Record<StatKey, number>> = { ...action.stats }
  if (action.topGenreStats) {
    const weights = genres[state.genre].weights
    const top = [...STAT_KEYS].sort((a, b) => weights[b] - weights[a]).slice(0, action.topGenreStats.count)
    for (const key of top) gains[key] = action.topGenreStats.amount
  }

  const efficiency = equipmentEfficiency(state.equipment)
  const stats = { ...state.stats }
  for (const key of STAT_KEYS) {
    const base = gains[key]
    if (base === undefined) continue
    const delta = growthDelta({
      base,
      scale: scale * slumpFactor,
      efficiency,
      condition: state.condition,
      traitMultiplier: state.trait.stat === key ? gacha.traitMultiplier : 1,
      current: state.stats[key],
    })
    stats[key] = clamp(state.stats[key] + delta, 0, gacha.statMax)
  }

  return {
    ...state,
    stats,
    condition: clamp(state.condition + (action.condition ?? 0) * scale, 0, 100),
    money: state.money + (action.money ?? 0) * scale,
    fame: state.fame + (action.fame ?? 0) * scale,
  }
}

function diff(before: GameState, after: GameState): Delta {
  const stats = {} as Stats
  for (const key of STAT_KEYS) stats[key] = after.stats[key] - before.stats[key]
  return {
    stats,
    condition: after.condition - before.condition,
    money: after.money - before.money,
    fame: after.fame - before.fame,
  }
}

/**
 * 한 턴을 진행한다. 행동 두 개를 차례로 적용하고, 고등학교 시기의 학교·용돈을 반영한 뒤 턴을 센다.
 * 시즌의 마지막 턴이면 seasonEnded가 true이고, 결산을 마친 뒤 startNextSeason을 부른다.
 */
export function applyTurn(state: GameState, choice: TurnChoice): TurnResult {
  if (state.finished) return { ok: false, error: '이미 끝난 커리어다' }
  if (state.pendingOffers) return { ok: false, error: '받은 제안을 먼저 정해야 한다' }
  if (state.turnInSeason >= turnsPerSeason(state.mode)) return { ok: false, error: '시즌 결산이 필요하다' }

  const scale = turnScale(state.mode)
  let next = state
  for (const slot of choice) {
    const error = checkSlot(next, slot)
    if (error) return { ok: false, error }
    next = applySlot(next, slot, scale)
  }

  if (next.age <= rules.school.untilAge) {
    next = {
      ...next,
      condition: clamp(next.condition + rules.school.conditionPerBase * scale, 0, 100),
      money: next.money + rules.school.allowancePerBase * scale,
    }
  }

  const months = modes[next.mode].turnMonths
  next = {
    ...next,
    slumpMonths: Math.max(0, next.slumpMonths - months),
    injuredMonths: Math.max(0, next.injuredMonths - months),
    turnInSeason: next.turnInSeason + 1,
    turnCount: next.turnCount + 1,
  }
  return { ok: true, state: next, delta: diff(state, next), seasonEnded: next.turnInSeason === turnsPerSeason(next.mode) }
}

/** 이번 시즌의 결산(settleSeason)을 이미 마쳤는지 */
export function isSettled(state: GameState): boolean {
  return state.history.length > 0 && state.history[state.history.length - 1].season === state.season
}

/** 시즌 결산과 제안 선택을 마친 뒤 다음 시즌으로 넘어간다. 25세부터 반응속도·정확도가 내려간다. */
export function startNextSeason(state: GameState): GameState {
  if (state.finished) throw new Error('이미 끝난 커리어다')
  if (state.turnInSeason < turnsPerSeason(state.mode)) throw new Error('시즌이 아직 끝나지 않았다')
  if (!isSettled(state)) throw new Error('시즌 결산이 필요하다')
  if (state.pendingOffers) throw new Error('받은 제안을 먼저 정해야 한다')
  const stats = { ...state.stats }
  if (state.age >= rules.ageDecline.fromAge) {
    for (const key of rules.ageDecline.stats as StatKey[]) {
      stats[key] = Math.max(0, stats[key] - rules.ageDecline.amountPerSeason)
    }
  }
  return { ...state, stats, age: state.age + 1, season: state.season + 1, turnInSeason: 0 }
}

/** 30세 시즌이 끝났으면 커리어가 끝난다. */
export function isCareerOver(state: GameState): boolean {
  return state.age >= rules.maxAge && state.turnInSeason >= turnsPerSeason(state.mode)
}
