import { marketContext, marketOf, marketTrend, type TeamMarket } from '../engine/teamMarket.ts'
import type { GameState, TeamRef } from '../engine/state.ts'

/** 1~5 등급을 별로 */
export function stars(v: number): string {
  const n = Math.min(5, Math.max(1, Math.round(v)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

const TREND_MARK = { 1: ' ▲ 상승세', 0: '', [-1]: ' ▼ 하락세' } as const

/** "재정 ★★★☆☆ · 인기 ★★☆☆☆ · 명성 ★★★★☆ ▲ 상승세" */
export function marketText(m: TeamMarket, trend: -1 | 0 | 1): string {
  return `재정 ${stars(m.finance)} · 인기 ${stars(m.popularity)} · 명성 ${stars(m.prestige)}${TREND_MARK[trend]}`
}

/** 이 판의 지금 시점에서 본 구단의 시장 문구 */
export function teamMarketText(state: GameState, team: TeamRef): string {
  const ctx = marketContext(state)
  return marketText(marketOf(team, ctx), marketTrend(team, ctx))
}
