import genres from '../data/genres.json'
import { STAT_KEYS, type GenreId, type Stats } from './types.ts'

/** 장르 실력치 R = Σ(가중치 × 능력치). 가중치는 합계 100(%)이라 100으로 나눈다. */
export function genrePower(stats: Stats, genre: GenreId): number {
  const weights = genres[genre].weights
  return STAT_KEYS.reduce((sum, key) => sum + weights[key] * stats[key], 0) / 100
}
