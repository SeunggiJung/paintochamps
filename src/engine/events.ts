import eventData from '../data/events.json'
import gacha from '../data/gacha.json'
import { createRng, mixSeed, type Rng } from './rng.ts'
import type { GameState, StageId } from './state.ts'
import { eventChance } from './turn.ts'
import { STAT_KEYS, type StatKey, type Stats } from './types.ts'

interface Range {
  min?: number
  max?: number
}

export interface EventWhen {
  stages?: StageId[]
  ageMin?: number
  ageMax?: number
  stat?: Partial<Record<StatKey, Range>>
  condition?: Range
  fame?: Range
  money?: Range
  /** true면 팀 소속일 때만, false면 무소속일 때만 */
  team?: boolean
}

export interface EventEffects {
  stats?: Partial<Stats>
  condition?: number
  money?: number
  fame?: number
  slumpMonths?: number
  injuredMonths?: number
}

export interface GameEvent {
  id: string
  when: EventWhen
  weight: number
  text: string
  choices: { label: string; effects: EventEffects }[]
}

export const EVENTS = eventData as GameEvent[]

const inRange = (v: number, r: Range | undefined) => !r || ((r.min === undefined || v >= r.min) && (r.max === undefined || v <= r.max))

export function isEligible(state: GameState, e: GameEvent): boolean {
  const w = e.when
  if (w.stages && !w.stages.includes(state.stage)) return false
  if (w.ageMin !== undefined && state.age < w.ageMin) return false
  if (w.ageMax !== undefined && state.age > w.ageMax) return false
  if (w.team !== undefined && (state.team !== null) !== w.team) return false
  if (!inRange(state.condition, w.condition) || !inRange(state.fame, w.fame) || !inRange(state.money, w.money)) return false
  for (const key of STAT_KEYS) if (!inRange(state.stats[key], w.stat?.[key])) return false
  return true
}

/** 이 턴의 이벤트용 난수. 같은 게임·같은 턴이면 같은 이벤트가 나온다. */
export function turnRng(state: GameState): Rng {
  return createRng(mixSeed(state.seed, state.turnCount, 0xe7e47))
}

/** 턴 길이에 맞는 확률로 이벤트 하나를 뽑는다. 없으면 null. (이벤트가 이미 있으면 새로 뽑지 않는다) */
export function rollEvent(state: GameState, rng: Rng): GameEvent | null {
  if (state.finished || state.pendingOffers) return null
  if (rng() >= eventChance(state.mode)) return null
  const pool = EVENTS.filter((e) => isEligible(state, e))
  const total = pool.reduce((s, e) => s + e.weight, 0)
  if (total === 0) return null
  let roll = rng() * total
  for (const e of pool) {
    roll -= e.weight
    if (roll < 0) return e
  }
  return pool[pool.length - 1]
}

/** 이벤트 선택지의 효과를 반영한다. 능력치는 0~1000, 컨디션은 0~100, 돈·명성은 0 이상으로 제한한다. */
export function applyEventChoice(state: GameState, event: GameEvent, choiceIndex: number): GameState {
  const choice = event.choices[choiceIndex]
  if (!choice) throw new Error('없는 선택지다')
  const fx = choice.effects
  const stats = { ...state.stats }
  for (const key of STAT_KEYS) {
    const d = fx.stats?.[key]
    if (d !== undefined) stats[key] = Math.min(gacha.statMax, Math.max(0, stats[key] + d))
  }
  return {
    ...state,
    stats,
    condition: Math.min(100, Math.max(0, state.condition + (fx.condition ?? 0))),
    money: Math.max(0, state.money + (fx.money ?? 0)),
    fame: Math.max(0, state.fame + (fx.fame ?? 0)),
    slumpMonths: Math.max(state.slumpMonths, fx.slumpMonths ?? 0),
    injuredMonths: Math.max(state.injuredMonths, fx.injuredMonths ?? 0),
  }
}
