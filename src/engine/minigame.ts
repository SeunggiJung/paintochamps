import data from '../data/minigame.json'
import type { GameState } from './state.ts'

export type MiniGameId = 'shooting' | 'puzzle'
export type WarmupTier = 'miss' | 'good' | 'great'

export const MINIGAME = data

/** 턴 끝 미니게임 종류: 턴마다 번갈아 나온다 */
export function miniGameFor(state: GameState): MiniGameId {
  return state.turnCount % 2 === 0 ? 'shooting' : 'puzzle'
}

/** 사격: 맞힌 표적 수로 등급을 매긴다 */
export function shootingTier(hits: number): WarmupTier {
  return hits >= data.shooting.great ? 'great' : hits >= data.shooting.good ? 'good' : 'miss'
}

/** 퍼즐: 카드를 뒤집은 횟수(짝 시도 수)가 적을수록 좋다. 끝까지 못 풀면 miss */
export function puzzleTier(moves: number, solved: boolean): WarmupTier {
  if (!solved) return 'miss'
  return moves <= data.puzzle.greatMoves ? 'great' : moves <= data.puzzle.goodMoves ? 'good' : 'miss'
}

/** 다음 턴 훈련 효율에 더해지는 비율 (0이면 보너스 없음). 스킵하거나 못 맞혀도 손해는 없다. */
export function warmupBonus(state: GameState): number {
  return state.warmup ?? 0
}

/** 미니게임 결과를 다음 턴 훈련 효율 보너스로 쌓는다. 턴이 지나면 사라진다. */
export function applyWarmup(state: GameState, tier: WarmupTier): GameState {
  return { ...state, warmup: tier === 'miss' ? 0 : data.bonus[tier] }
}
