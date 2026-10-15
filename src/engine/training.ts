import actionData from '../data/actions.json'
import rules from '../data/rules.json'
import { createRng, mixSeed, shuffled } from './rng.ts'
import type { ActionId } from './state.ts'

type PoolDef = { pool?: boolean; requires?: { inTeam?: boolean } }

/** 매 턴 무작위로 나오는 훈련 후보 전체 (actions.json의 pool: true) */
export const TRAINING_POOL = (Object.entries(actionData as Record<string, PoolDef>)
  .filter(([, a]) => a.pool)
  .map(([id]) => id)) as ActionId[]

/**
 * 이번 턴에 고를 수 있는 훈련 목록. 시드와 턴 번호로 정해져서 같은 판·같은 턴이면 늘 같다.
 * 팀이 없으면 팀 전용 훈련은 후보에서 뺀다.
 */
export function drawTrainingMenu(seed: number, turnCount: number, inTeam: boolean): ActionId[] {
  const defs = actionData as Record<string, PoolDef>
  const candidates = TRAINING_POOL.filter((id) => inTeam || !defs[id].requires?.inTeam)
  return shuffled(createRng(mixSeed(seed, turnCount, 0x7a1)), candidates).slice(0, rules.trainingMenuSize)
}

/** 지금 상태의 훈련 후보. 옛 세이브에는 필드가 없어서 그때는 시드로 뽑는다. */
export function trainingMenuOf(state: { seed: number; turnCount: number; team: unknown; trainingMenu?: ActionId[] }): ActionId[] {
  return state.trainingMenu ?? drawTrainingMenu(state.seed, state.turnCount, state.team !== null)
}
