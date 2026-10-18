import actionData from '../data/actions.json'
import genres from '../data/genres.json'
import rules from '../data/rules.json'
import type { CalendarBeat } from './calendar.ts'
import { createRng, mixSeed, shuffled } from './rng.ts'
import type { ActionId, GameState } from './state.ts'
import { STAT_KEYS, type StatKey } from './types.ts'

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

/** 이번 시즌에 훈련 후보를 아직 다시 뽑지 않았는가 (시즌당 한 번) */
export function canRerollTraining(state: Pick<GameState, 'season' | 'trainingRerollSeason'>): boolean {
  return (state.trainingRerollSeason ?? 0) !== state.season
}

/**
 * 이번 시즌 훈련 후보를 다시 뽑는다. 지금 후보는 빼고 뽑으며, 시즌당 한 번만 된다.
 * 이미 고른 훈련이 새 후보에 없으면 선택은 비워진다.
 */
export function rerollTrainingMenu(state: GameState): GameState {
  if (!canRerollTraining(state)) throw new Error('이번 시즌에는 이미 훈련 후보를 다시 뽑았다')
  const current = trainingMenuOf(state)
  const fresh = candidates(state.team !== null).filter((id) => !current.includes(id))
  const menu = shuffled(createRng(mixSeed(state.seed, state.season, 0x2e11)), fresh).slice(0, rules.trainingMenuSize)
  return { ...state, trainingMenu: menu, seasonTraining: null, trainingRerollSeason: state.season }
}

/** 리그 중간 순위가 기대 순위보다 이만큼 이상 낮으면 부진으로 본다 (리그 크기에 비례, 최소 minGap) */
export function slumpGap(size: number): number {
  return Math.max(rules.coachSwap.minGap, Math.round(size * rules.coachSwap.gapRatio))
}

/**
 * 이 훈련이 선수의 부족한 능력치를 얼마나 채워 주는가.
 * 능력치별 (가장 높은 능력치와의 차이 × 장르 비중) × 훈련이 올리는 양을 더한다.
 */
function fillScore(state: GameState, id: ActionId): number {
  const def = (actionData as Record<string, { stats?: Partial<Record<StatKey, number>>; topGenreStats?: { count: number; amount: number } }>)[id]
  const weights = genres[state.genre].weights
  const gains: Partial<Record<StatKey, number>> = { ...def.stats }
  if (def.topGenreStats) {
    const top = [...STAT_KEYS].sort((a, b) => weights[b] - weights[a]).slice(0, def.topGenreStats.count)
    for (const key of top) gains[key] = def.topGenreStats.amount
  }
  const best = Math.max(...STAT_KEYS.map((k) => state.stats[k]))
  return STAT_KEYS.reduce((sum, k) => sum + (gains[k] ?? 0) * weights[k] * (best - state.stats[k]), 0)
}

export interface CoachOffer {
  eventName: string
  /** 지금 순위와 코치가 잡은 목표 순위 */
  rank: number
  expected: number
  size: number
  /** 교체 후보 (지금 훈련 제외, 부족한 능력치를 잘 채우는 순) */
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
  // 같은 점수끼리는 시드로 섞은 순서를 따른다
  const shuffledPool = shuffled(createRng(mixSeed(state.seed, state.season, 0xc0ac)), pool)
  const score = new Map(shuffledPool.map((id) => [id, fillScore(state, id)]))
  const options = [...shuffledPool].sort((a, b) => score.get(b)! - score.get(a)!).slice(0, rules.coachSwap.options)
  if (options.length === 0) return null
  return { eventName: bad.name, rank: bad.rank, expected: bad.expected, size: bad.size, options }
}

/** 코치의 제안에 답한다. id를 주면 그 훈련으로 바꾸고, null이면 그대로 둔다. 어느 쪽이든 이번 시즌의 제안은 끝난 것이다. */
export function applyCoachSwap(state: GameState, id: ActionId | null): GameState {
  return { ...state, trainingSwapSeason: state.season, seasonTraining: id ?? state.seasonTraining }
}
