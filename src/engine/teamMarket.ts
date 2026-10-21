import market from '../data/market.json'
import { hashId, marketSlugOf } from './field.ts'
import type { GameState, TeamRef } from './state.ts'

/** 1(낮음)~5(높음) 등급 */
export type Grade5 = 1 | 2 | 3 | 4 | 5

/**
 * 구단의 시장 정보. 재정은 줄 수 있는 월급의 크기, 인기도는 활동하면서 얻는 명성, 명성은 입단했을 때의 후광이다.
 * 실존 구단은 market.json의 추정 등급을 쓰고, 그 밖의 팀(해외·아마추어·가상)은 팀 id로 정해지는 평범한 등급(2~4)을 쓴다.
 */
export interface TeamMarket {
  finance: Grade5
  popularity: Grade5
  prestige: Grade5
}

const E = market.effects
const TEAMS = market.teams as Record<string, TeamMarket>

const pick = (id: string, salt: number): Grade5 => (2 + ((hashId(id) >>> salt) % 3)) as Grade5

export function marketOf(team: TeamRef): TeamMarket {
  const slug = marketSlugOf(team.id)
  const known = slug ? TEAMS[slug] : undefined
  return known ?? { finance: pick(team.id, 0), popularity: pick(team.id, 5), prestige: pick(team.id, 10) }
}

/** 구단 재정이 월급 수준에 곱해지는 배율 */
export const financeSalary = (m: TeamMarket): number => E.financeSalary[m.finance - 1]

/**
 * 이적 제안의 월급. 시장 기준 월급(market)에 더해 지금 월급(current)을 존중한다:
 * 재정이 넉넉한 구단일수록 지금 월급 이상으로 사 오고, 빠듯한 구단은 지금 월급에 못 미치거나 감당할 수 있는 한도(재정 상한)에서 멈춘다.
 * 지금 월급이 없으면(무소속·입단 제안) 시장 기준 월급 그대로다.
 */
export function offerSalary(m: TeamMarket, marketSalary: number, current: number): number {
  if (current <= 0) return marketSalary
  const bid = current * E.financeBid[m.finance - 1]
  const cap = marketSalary * E.financeCap[m.finance - 1]
  return Math.round(Math.max(marketSalary, Math.min(bid, cap)))
}

/** 이 구단에서 뛰는 동안 턴마다 더해지는 명성 (3개월 기준) */
export function popularityFame(state: Pick<GameState, 'team'>): number {
  return state.team ? E.popularityFame[marketOf(state.team).popularity - 1] : 0
}

/** 이 구단에 새로 입단·이적했을 때 한 번 받는 명성 */
export function prestigeFame(team: TeamRef): number {
  return E.prestigeFame[marketOf(team).prestige - 1]
}
