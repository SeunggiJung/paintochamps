import market from '../data/market.json'
import { isWorldEvent } from './competitions.ts'
import { hashId, leagueOfTeam, leagueTeams, marketSlugOf, parentOrgOf, teamPower } from './field.ts'
import { createRng, gaussian, mixSeed } from './rng.ts'
import type { GameState, SeasonRecord, TeamRef } from './state.ts'
import type { GenreId } from './types.ts'

/**
 * 구단의 시장 정보(1.0~5.0). 재정은 줄 수 있는 월급의 크기, 인기도는 활동하면서 얻는 명성, 명성은 입단했을 때의 후광이다.
 * 시작 등급은 실존 구단이면 market.json의 추정 등급, 그 밖의 팀(해외·아마추어·가상)이면 팀 id로 정해지는 평범한 등급(2~4)이다.
 * 시즌이 지나며 변한다: 리그에서 좋은 성적을 내는 구단은 재정·인기·명성이 오르고, 몇 해째 부진하면 내려간다.
 * 플레이어가 소속된 시즌의 성적(우승·월드 우승)도 그 구단의 시장에 반영돼서, 약소 구단을 키우면 그 구단이 커진다.
 */
export interface TeamMarket {
  finance: number
  popularity: number
  prestige: number
}

/** 시장을 계산할 때 필요한 판의 정보. 없으면 시작 등급 그대로다 (시즌이 지나도 변하지 않는 값). */
export interface MarketContext {
  seed: number
  /** 지금 시즌: 지난 시즌까지의 결과가 쌓인 값이다 */
  season: number
  genre: GenreId
  history: readonly SeasonRecord[]
}

export const marketContext = (s: Pick<GameState, 'seed' | 'season' | 'genre' | 'history'>): MarketContext => ({ seed: s.seed, season: s.season, genre: s.genre, history: s.history })

const E = market.effects
const D = market.drift
const TEAMS = market.teams as Record<string, { finance: number; popularity: number; prestige: number }>

const clamp5 = (v: number) => Math.min(5, Math.max(1, v))
const pick = (id: string, salt: number): number => 2 + ((hashId(id) >>> salt) % 3)

/** 시작 등급 */
function baseMarket(team: TeamRef): TeamMarket {
  const slug = marketSlugOf(team.id)
  const known = slug ? TEAMS[slug] : undefined
  return known ? { ...known } : { finance: pick(team.id, 0), popularity: pick(team.id, 5), prestige: pick(team.id, 10) }
}

/** 등급(1~5, 소수 가능)에 맞춰 배열 값 사이를 이어 읽는다 */
function lerp(values: number[], grade: number): number {
  const x = clamp5(grade) - 1
  const i = Math.min(values.length - 2, Math.floor(x))
  return values[i] + (values[i + 1] - values[i]) * (x - i)
}

/** 한 시즌의 AI 성적(−1~1): 같은 리그 구단들을 그 시즌 전력으로 줄 세운 순위(1위 = 1)에 운을 더한다. 판과 구단·시즌으로 정해지고 플레이어와 무관하다. */
const perfCache = new Map<string, number>()
function leaguePerf(ctx: MarketContext, canon: TeamRef, season: number): number {
  const key = `${ctx.seed}|${canon.id}|${season}`
  const hit = perfCache.get(key)
  if (hit !== undefined) return hit
  const league = leagueOfTeam(canon.id)
  const pool = league ? leagueTeams(league) : []
  let perf = 0
  if (pool.length > 1) {
    const mine = teamPower(ctx.seed, season, canon.id, 'pro1')
    const above = pool.filter((t) => t.id !== canon.id && teamPower(ctx.seed, season, t.id, 'pro1') > mine).length
    const pct = 1 - above / (pool.length - 1)
    perf = 2 * pct - 1 + D.luck * gaussian(createRng(mixSeed(ctx.seed, hashId(canon.id), season, 0x6d61)))
  }
  perf = Math.max(-1.5, Math.min(1.5, perf))
  perfCache.set(key, perf)
  return perf
}

/** 플레이어가 그 시즌 이 구단에서 뛰며 낸 성적이 구단 시장에 주는 보너스 */
function playerBonus(record: SeasonRecord, slug: string): number {
  if (!record.teamId || marketSlugOf(record.teamId) !== slug) return 0
  let bonus = 0
  for (const e of record.events) {
    if (e.fieldSize <= 1) continue
    if (e.placement === 1) bonus += isWorldEvent(e.id) ? D.worldTitle : D.title
    else if (e.placement <= 3) bonus += D.podium
  }
  return Math.min(D.maxBonus, bonus)
}

/** 구단의 시장 등급. ctx가 있으면 지난 시즌까지의 성적을 반영해 변한 값이고, 없으면 시작 등급이다. */
export function marketOf(team: TeamRef, ctx?: MarketContext): TeamMarket {
  const base = baseMarket(team)
  if (!ctx) return base
  // 2군·챌린저스 팀은 모 구단의 시장을 따른다
  const canon = parentOrgOf(team, ctx.genre) ?? team
  const slug = marketSlugOf(canon.id)
  let m = base
  for (let s = 1; s < ctx.season; s++) {
    const record = ctx.history.find((r) => r.season === s)
    const perf = leaguePerf(ctx, canon, s) + (record && slug ? playerBonus(record, slug) : 0)
    m = {
      finance: clamp5(m.finance + D.finance * perf),
      popularity: clamp5(m.popularity + D.popularity * perf),
      prestige: clamp5(m.prestige + D.prestige * perf),
    }
  }
  return m
}

/** 두 시즌 전과 비교한 흐름: 오르면 1, 내리면 −1, 비슷하면 0 (재정·인기·명성의 합으로 본다) */
export function marketTrend(team: TeamRef, ctx: MarketContext): -1 | 0 | 1 {
  if (ctx.season <= 2) return 0
  const now = marketOf(team, ctx)
  const before = marketOf(team, { ...ctx, season: ctx.season - 2 })
  const delta = now.finance + now.popularity + now.prestige - (before.finance + before.popularity + before.prestige)
  return delta > D.trendBand ? 1 : delta < -D.trendBand ? -1 : 0
}

/** 구단 재정이 월급 수준에 곱해지는 배율 */
export const financeSalary = (m: TeamMarket): number => lerp(E.financeSalary, m.finance)

/**
 * 이적 제안의 월급. 시장 기준 월급(market)에 더해 지금 월급(current)을 존중한다:
 * 재정이 넉넉한 구단일수록 지금 월급 이상으로 사 오고, 빠듯한 구단은 지금 월급에 못 미치거나 감당할 수 있는 한도(재정 상한)에서 멈춘다.
 * 지금 월급이 없으면(무소속·입단 제안) 시장 기준 월급 그대로다.
 */
export function offerSalary(m: TeamMarket, marketSalary: number, current: number): number {
  if (current <= 0) return marketSalary
  const bid = current * lerp(E.financeBid, m.finance)
  const cap = marketSalary * lerp(E.financeCap, m.finance)
  return Math.round(Math.max(marketSalary, Math.min(bid, cap)))
}

/** 이 구단에서 뛰는 동안 턴마다 더해지는 명성 (3개월 기준) */
export function popularityFame(state: Pick<GameState, 'team' | 'seed' | 'season' | 'genre' | 'history'>): number {
  return state.team ? lerp(E.popularityFame, marketOf(state.team, marketContext(state)).popularity) : 0
}

/** 이 구단에 새로 입단·이적했을 때 한 번 받는 명성 */
export function prestigeFame(team: TeamRef, ctx?: MarketContext): number {
  return lerp(E.prestigeFame, marketOf(team, ctx).prestige)
}
