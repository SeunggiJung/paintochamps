import actionData from '../data/actions.json'
import rules from '../data/rules.json'
import type { CalendarBeat } from './calendar.ts'
import { createRng, mixSeed, shuffled } from './rng.ts'
import type { ActionId, GameState } from './state.ts'

type PoolDef = { pool?: boolean; requires?: { inTeam?: boolean } }

/** 시즌 훈련으로 고를 수 있는 후보 전체 (actions.json의 pool: true) */
export const TRAINING_POOL = (Object.entries(actionData as Record<string, PoolDef>)
  .filter(([, a]) => a.pool)
  .map(([id]) => id)) as ActionId[]

function candidates(inTeam: boolean): ActionId[] {
  const defs = actionData as Record<string, PoolDef>
  return TRAINING_POOL.filter((id) => inTeam || !defs[id].requires?.inTeam)
}

/**
 * 이번 시즌에 고를 수 있는 훈련 후보. 시드와 시즌 번호(salt)로 정해져서 같은 판·같은 시즌이면 늘 같다.
 * 팀이 없으면 팀 전용 훈련은 후보에서 뺀다.
 */
export function drawTrainingMenu(seed: number, salt: number, inTeam: boolean): ActionId[] {
  return shuffled(createRng(mixSeed(seed, salt, 0x7a1)), candidates(inTeam)).slice(0, rules.trainingMenuSize)
}

/** 지금 상태의 훈련 후보. 옛 세이브에는 필드가 없어서 그때는 시드로 뽑는다. */
export function trainingMenuOf(state: { seed: number; season: number; team: unknown; trainingMenu?: ActionId[] }): ActionId[] {
  return state.trainingMenu ?? drawTrainingMenu(state.seed, state.season, state.team !== null)
}

/** 이번 시즌 훈련을 후보 중에서 정한다. 시즌 동안 이 훈련만 할 수 있다. */
export function chooseSeasonTraining(state: GameState, id: ActionId): GameState {
  if (!trainingMenuOf(state).includes(id)) throw new Error('이번 시즌 후보에 없는 훈련이다')
  return { ...state, seasonTraining: id }
}

/** 리그 중간 순위가 기대 순위보다 이만큼 이상 낮으면 부진으로 본다 (리그 크기에 비례, 최소 minGap) */
export function slumpGap(size: number): number {
  return Math.max(rules.coachSwap.minGap, Math.round(size * rules.coachSwap.gapRatio))
}

export interface CoachOffer {
  eventName: string
  /** 지금 순위와 코치가 잡은 목표 순위 */
  rank: number
  expected: number
  size: number
  /** 교체 후보 (지금 훈련 제외, 무작위) */
  options: ActionId[]
}

/**
 * 코치의 훈련 교체 제안. 시즌 초에 팀 전력과 선수 실력으로 잡은 기대 순위보다 리그 중간 순위가 크게 낮으면,
 * 시즌당 한 번 무작위 후보 몇 개를 보여 주며 훈련을 바꿔 볼지 묻는다. (코치가 있는 팀 소속일 때만)
 * 이번 턴에 공개된 결과(beats)로만 판단한다.
 */
export function coachSwapOffer(state: GameState, beats: readonly CalendarBeat[]): CoachOffer | null {
  if (!state.team || !state.seasonTraining) return null
  if ((state.trainingSwapSeason ?? 0) === state.season) return null
  const bad = beats.find((b) => b.kind === 'mid' && b.expected !== null && b.rank - b.expected >= slumpGap(b.size))
  if (!bad || bad.kind !== 'mid' || bad.expected === null) return null

  const pool = candidates(true).filter((id) => id !== state.seasonTraining)
  const options = shuffled(createRng(mixSeed(state.seed, state.season, 0xc0ac)), pool).slice(0, rules.coachSwap.options)
  if (options.length === 0) return null
  return { eventName: bad.name, rank: bad.rank, expected: bad.expected, size: bad.size, options }
}

/** 코치의 제안에 답한다. id를 주면 그 훈련으로 바꾸고, null이면 그대로 둔다. 어느 쪽이든 이번 시즌의 제안은 끝난 것이다. */
export function applyCoachSwap(state: GameState, id: ActionId | null): GameState {
  return { ...state, trainingSwapSeason: state.season, seasonTraining: id ?? state.seasonTraining }
}
