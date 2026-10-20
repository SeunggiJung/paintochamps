import eventData from '../data/events.json'
import { applyEffects, type Effects } from './effects.ts'
import { moneyScale } from './economy.ts'
import { adaptationOf, isOverseas } from './leagues.ts'
import { homeLevel } from './life.ts'
import { pathOf } from './routes.ts'
import { createRng, mixSeed, type Rng } from './rng.ts'
import type { GameState, PathId, StageId } from './state.ts'
import { eventChance } from './turn.ts'
import { STAT_KEYS, type StatKey } from './types.ts'

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
  vice?: Range
  /** 이 모드에서만 나온다. 없으면 모든 모드. (튜토리얼에서는 위험한 유혹 이벤트를 막는다) */
  modes?: GameState['mode'][]
  /** true면 팀 소속일 때만, false면 무소속일 때만 */
  team?: boolean
  /** 초반 루트(rookie 갈림길 전, academy 정석, open 우회) */
  path?: PathId[]
  /** true면 아카데미 입단 테스트 초대를 받은 상태일 때만 */
  invited?: boolean
  /** PC방 대회에 나간 횟수 */
  cafeAttempts?: Range
  /** 아카데미 입단 테스트 재도전 횟수 */
  academyRetries?: Range
  /** 마련한 집 단계 범위 (가족 이벤트용) */
  home?: Range
  /** true면 해외 리그 소속일 때만, false면 국내 소속일 때만 */
  overseas?: boolean
  /** 해외 적응도 범위 (해외 리그일 때만 본다) */
  adaptation?: Range
}

export type EventEffects = Effects

export interface EventChoice {
  label: string
  /** 확정 결과. check가 있으면 쓰지 않는다. */
  effects?: Effects
  /**
   * 판정: stat을 주면 성공 확률 = 능력치 ÷ 1000 (5~95%), chance를 주면 그 확률 고정(운).
   * 성공과 실패 결과가 다르다.
   */
  check?: { stat?: StatKey; chance?: number; success: Effects; failure: Effects }
  /** 이 조건을 만족해야 고를 수 있다 */
  requires?: { team?: boolean; minMoney?: number }
}

export interface GameEvent {
  id: string
  when: EventWhen
  weight: number
  text: string
  choices: EventChoice[]
}

export const EVENTS = eventData as GameEvent[]

const inRange = (v: number, r: Range | undefined) => !r || ((r.min === undefined || v >= r.min) && (r.max === undefined || v <= r.max))

export function isEligible(state: GameState, e: GameEvent): boolean {
  const w = e.when
  if (w.stages && !w.stages.includes(state.stage)) return false
  if (w.modes && !w.modes.includes(state.mode)) return false
  if (w.ageMin !== undefined && state.age < w.ageMin) return false
  if (w.ageMax !== undefined && state.age > w.ageMax) return false
  if (w.team !== undefined && (state.team !== null) !== w.team) return false
  if (w.path && !w.path.includes(pathOf(state))) return false
  if (w.home && !inRange(homeLevel(state), w.home)) return false
  if (w.overseas !== undefined && isOverseas(state) !== w.overseas) return false
  if (w.adaptation && !inRange(adaptationOf(state), w.adaptation)) return false
  if (w.invited !== undefined && !!state.academyInvite !== w.invited) return false
  if (!inRange(state.cafeAttempts ?? 0, w.cafeAttempts) || !inRange(state.academyRetries ?? 0, w.academyRetries)) return false
  if (!inRange(state.condition, w.condition) || !inRange(state.fame, w.fame) || !inRange(state.money / moneyScale(state.stage), w.money) || !inRange(state.vice, w.vice)) return false
  for (const key of STAT_KEYS) if (!inRange(state.stats[key], w.stat?.[key])) return false
  return true
}

/** 이 턴의 이벤트용 난수. 같은 게임·같은 턴이면 같은 이벤트가 나온다. */
export function turnRng(state: GameState): Rng {
  return createRng(mixSeed(state.seed, state.turnCount, 0xe7e47))
}

/** 턴 길이에 맞는 확률로 이벤트 하나를 뽑는다. 없으면 null. */
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

/** 지금 고를 수 있는 선택지 번호 (팀 소속·보유 금액 조건을 만족하는 것) */
export function availableChoices(state: GameState, event: GameEvent): number[] {
  return event.choices.flatMap((c, i) => {
    const r = c.requires
    if (r?.team !== undefined && (state.team !== null) !== r.team) return []
    if (r?.minMoney !== undefined && state.money < r.minMoney * moneyScale(state.stage)) return []
    return [i]
  })
}

/** 판정 성공 확률. 판정이 없으면 1. */
export function checkChance(state: GameState, choice: EventChoice): number {
  const check = choice.check
  if (!check) return 1
  if (check.chance !== undefined) return check.chance
  return Math.min(0.95, Math.max(0.05, state.stats[check.stat!] / 1000))
}

/** 선택했을 때 일어날 수 있는 결과와 그 확률. (플레이어에게 보여 주거나 AI가 비교할 때 쓴다) */
export function choiceOutcomes(state: GameState, event: GameEvent, index: number): { chance: number; state: GameState }[] {
  const choice = event.choices[index]
  if (!choice) throw new Error('없는 선택지다')
  if (!availableChoices(state, event).includes(index)) throw new Error('지금은 고를 수 없는 선택지다')
  if (!choice.check) return [{ chance: 1, state: applyEffects(state, choice.effects ?? {}) }]
  const p = checkChance(state, choice)
  return [
    { chance: p, state: applyEffects(state, choice.check.success) },
    { chance: 1 - p, state: applyEffects(state, choice.check.failure) },
  ]
}

/**
 * 이벤트 선택지의 결과를 반영한다. 능력치 판정이 있으면 해당 능력치가 높을수록 성공하기 쉽다.
 * rng를 넘기지 않으면 상태에서 정해진 난수를 쓴다.
 */
export function applyEventChoice(state: GameState, event: GameEvent, index: number, rng: Rng = createRng(mixSeed(state.seed, state.turnCount, 0xc4ec, index))): GameState {
  const outcomes = choiceOutcomes(state, event, index)
  if (outcomes.length === 1) return outcomes[0].state
  return rng() < outcomes[0].chance ? outcomes[0].state : outcomes[1].state
}
