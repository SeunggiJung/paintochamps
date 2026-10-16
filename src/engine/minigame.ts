import data from '../data/minigame.json'
import { createRng, mixSeed } from './rng.ts'
import type { GameState } from './state.ts'

export type MiniGameId = 'shooting' | 'puzzle' | 'reaction' | 'numbers' | 'pattern'
export type WarmupTier = 'miss' | 'good' | 'great'

export const MINIGAME = data
export const MINIGAME_IDS: MiniGameId[] = ['shooting', 'puzzle', 'reaction', 'numbers', 'pattern']

/**
 * 이번 턴 끝에 미니게임이 뜨는지, 뜬다면 어떤 게임인지. 턴마다 `chance`(30%) 확률로 뜨고 종류는 무작위다.
 * 같은 게임·같은 턴이면 같은 결과다.
 */
export function rollMiniGame(state: GameState): MiniGameId | null {
  const rng = createRng(mixSeed(state.seed, state.turnCount, 0x3149a))
  if (rng() >= data.chance) return null
  return MINIGAME_IDS[Math.floor(rng() * MINIGAME_IDS.length)]
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

/** 반응속도: 평균 반응 시간(ms)이 짧을수록 좋다 */
export function reactionTier(avgMs: number): WarmupTier {
  return avgMs <= data.reaction.greatMs ? 'great' : avgMs <= data.reaction.goodMs ? 'good' : 'miss'
}

/** 숫자 순서 터치: 끝까지 누른 시간(초)이 짧을수록 좋다. 그만두면 miss */
export function numbersTier(seconds: number, solved: boolean): WarmupTier {
  if (!solved) return 'miss'
  return seconds <= data.numbers.greatSec ? 'great' : seconds <= data.numbers.goodSec ? 'good' : 'miss'
}

/** 패턴 기억: 맞힌 가장 긴 순서의 길이가 길수록 좋다 */
export function patternTier(cleared: number): WarmupTier {
  return cleared >= data.pattern.great ? 'great' : cleared >= data.pattern.good ? 'good' : 'miss'
}

/** 다음 턴 훈련 효율에 더해지는 비율 (0이면 보너스 없음). 스킵하거나 못 맞혀도 손해는 없다. */
export function warmupBonus(state: GameState): number {
  return state.warmup ?? 0
}

/** 미니게임 결과를 다음 턴 훈련 효율 보너스로 쌓는다. 턴이 지나면 사라진다. */
export function applyWarmup(state: GameState, tier: WarmupTier): GameState {
  return { ...state, warmup: tier === 'miss' ? 0 : data.bonus[tier] }
}
