import rules from '../data/rules.json'
import type { Rng } from './rng.ts'

/** 한 경기에서 내가 이길 확률: 1 / (1 + 10^((R_opp − R_me) / 250)) */
export function winProbability(powerMe: number, powerOpp: number): number {
  return 1 / (1 + 10 ** ((powerOpp - powerMe) / rules.match.eloScale))
}

/** 결승·승급전 같은 큰 경기의 멘탈 보정: R' = R + 0.1 × (멘탈 − 500) */
export function mentalAdjusted(power: number, mental: number): number {
  return power + rules.match.mentalFactor * (mental - rules.match.mentalBase)
}

function binomial(n: number, k: number): number {
  let result = 1
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i
  return result
}

/** 한 판 승률이 p일 때 bestOf(홀수) 시리즈를 이길 확률 */
export function seriesWinProbability(p: number, bestOf: number): number {
  const need = (bestOf + 1) / 2
  let total = 0
  for (let lost = 0; lost < need; lost++) {
    total += binomial(need - 1 + lost, lost) * p ** need * (1 - p) ** lost
  }
  return total
}

/** 시리즈 한 번을 치른다. 이기면 true. */
export function playSeries(rng: Rng, powerMe: number, powerOpp: number, bestOf: number): boolean {
  return rng() < seriesWinProbability(winProbability(powerMe, powerOpp), bestOf)
}
