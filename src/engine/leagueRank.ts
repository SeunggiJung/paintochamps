import { leagueOfTeam } from './field.ts'
import { domesticLeagueId, leagueDef, leagueIdOf, leaguesOf, OVERSEAS_RULES, type LeagueId } from './leagues.ts'
import type { EventDef } from './competitions.ts'
import type { GameState, SeasonRecord, SeasonRun } from './state.ts'

/**
 * 리그 파워 랭킹. 국제전(MSI·월드·마스터즈 등)에 나온 팀의 최종 순위를 리그별로 모아 평균을 낸다.
 * 순위는 이미 대회 기록(RunRecord.order)에 있으므로 새로 시뮬레이션하지 않는다.
 * 국제전 상대에는 내 리그 팀이 없으므로 내 팀이 내 리그의 유일한 대표다 (국제전에 못 나가면 0점 한 번으로 센다).
 */

/** 이번 시즌 국제전 성적: 리그마다 [점수 합, 출전 팀 수]. 팀 하나의 점수는 1위 1.0 ~ 꼴찌 0에 가깝게 순위에 비례한다. */
export function intlPointsOf(state: GameState, run: SeasonRun, events: readonly EventDef[]): Record<LeagueId, [number, number]> {
  const out: Record<LeagueId, [number, number]> = {}
  const add = (league: LeagueId, points: number) => {
    const cur = out[league] ?? [0, 0]
    out[league] = [cur[0] + points, cur[1] + 1]
  }
  for (const rec of run.runs) {
    const ev = events.find((e) => e.id === rec.id)
    if (!ev || ev.field?.names !== 'intl' || rec.revealed === 'none') continue
    const n = rec.order.length
    rec.order.forEach((t, i) => {
      const league = t.isPlayer ? leagueIdOf(state) : leagueOfTeam(t.id)
      if (league) add(league, (n - i) / n)
    })
  }
  if (!out[leagueIdOf(state)]) out[leagueIdOf(state)] = [0, 1]
  return out
}

export interface LeagueStanding {
  id: LeagueId
  name: string
  region: string
  /** 팀당 평균 점수 (0~1). 집계가 없으면 null */
  score: number | null
  rank: number
}

/** 최근 몇 시즌의 국제전 성적으로 만든 리그 순위 (collected에는 지금 막 끝난 시즌 기록을 따로 넘길 수 있다) */
export function leagueRanking(state: Pick<GameState, 'genre'>, history: readonly SeasonRecord[], extra?: Record<LeagueId, [number, number]>): LeagueStanding[] {
  const recent = history.slice(-OVERSEAS_RULES.rankSeasons)
  const sums = new Map<LeagueId, [number, number]>()
  const take = (points?: Record<LeagueId, [number, number]>) => {
    for (const [id, [s, n]] of Object.entries(points ?? {})) {
      const cur = sums.get(id) ?? [0, 0]
      sums.set(id, [cur[0] + s, cur[1] + n])
    }
  }
  recent.forEach((r) => take(r.intlPoints))
  take(extra)
  const rows = leaguesOf(state.genre).map((l) => {
    const got = sums.get(l.id)
    return { id: l.id, name: l.name, region: l.region, score: got && got[1] > 0 ? got[0] / got[1] : null }
  })
  rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (a.id === domesticLeagueId(state.genre) ? -1 : 0))
  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}

/** 직전 시즌까지의 기록으로 본 한 리그의 순위 (집계가 없으면 null) */
export function leagueRankOf(state: GameState, id: LeagueId): { rank: number; size: number } | null {
  const rows = leagueRanking(state, state.history)
  const row = rows.find((r) => r.id === id)
  return row && row.score !== null ? { rank: row.rank, size: rows.length } : null
}

export const leagueName = (id: LeagueId): string => leagueDef(id).name
