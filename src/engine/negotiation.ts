import contracts from '../data/contracts.json'
import { applyEffects } from './effects.ts'
import { mixSeed, createRng } from './rng.ts'
import { hasSettledIn } from './career.ts'
import { pathOf } from './routes.ts'
import type { GameState } from './state.ts'
import { salaryOf } from './teams.ts'

export interface Ask {
  id: string
  name: string
  /** 월급을 몇 % 올려 달라고 하는가 (0.15 = +15%) */
  raise: number
  /** 기본 성공 확률 (명성이 높을수록 오른다) */
  chance: number
  /** 실패했을 때 멘탈 변화 (협상이 틀어져 의기소침해진다) */
  failMental?: number
}

export const ASKS = contracts.negotiation.asks as Ask[]

/** 협상은 팀에 소속된 선수만 할 수 있다. 연습생은 월급을 협상하지 않는다. */
function isTrainee(state: GameState): boolean {
  return state.stage === 'amateur_team' && pathOf(state) === 'academy'
}

/** 지금 월급 협상을 할 수 있는지: 팀 소속이고, 새 팀에 합류하고 한 턴이 지났고, 이번 시즌에 아직 협상하지 않았다 */
export function canNegotiate(state: GameState): boolean {
  return !!state.team && !isTrainee(state) && !state.finished && (state.negotiatedSeason ?? 0) !== state.season && hasSettledIn(state)
}

/** 요구에 성공할 확률: 기본 확률 + 명성 보너스(상한 있음), 5~95%로 제한 */
export function negotiationChance(state: GameState, ask: Ask): number {
  const n = contracts.negotiation
  const bonus = Math.min(n.maxFameChance, Math.max(0, state.fame) * n.fameChance)
  return Math.min(0.95, Math.max(0.05, ask.chance + bonus + (state.perks?.negotiation ?? 0)))
}

export interface NegotiationResult {
  state: GameState
  success: boolean
  /** 협상 뒤 월급(3개월 기준) */
  salary: number
}

/**
 * 월급 협상: 올려 달라고 요구하면 확률로 성공해 월급 배율이 오른다. 실패하면 그대로이고, 크게 요구했다가 실패하면 멘탈이 흔들린다.
 * 어느 쪽이든 이번 시즌의 협상 기회는 쓴 것이다. askId가 null이면 협상하지 않고 넘어간다(기회도 쓰지 않는다).
 */
export function negotiateSalary(state: GameState, askId: string | null): NegotiationResult {
  if (askId === null) return { state, success: false, salary: salaryOf(state) }
  if (!canNegotiate(state)) throw new Error('지금은 협상할 수 없다')
  const ask = ASKS.find((a) => a.id === askId)
  if (!ask) throw new Error('없는 요구다')
  const rng = createRng(mixSeed(state.seed, state.season, state.turnCount, 0x5a1a, ASKS.indexOf(ask)))
  const success = rng() < negotiationChance(state, ask)
  let next: GameState = { ...state, negotiatedSeason: state.season }
  if (success) next = { ...next, salaryMult: (state.salaryMult ?? 1) * (1 + ask.raise) }
  else if (ask.failMental) next = applyEffects(next, { stats: { mental: ask.failMental } })
  return { state: next, success, salary: salaryOf(next) }
}
