import { isWorldEvent } from './competitions.ts'
import { leagueIdOf } from './leagues.ts'
import type { GameState, SeasonRecord, Stint, TeamRef } from './state.ts'

/**
 * 소속 팀을 바꾼다. 거쳐 간 구단 기록(stints)을 이어 붙이고, 합류 시점을 남긴다(연봉 협상은 한 턴이 지난 뒤부터).
 * state의 stage는 이미 새 팀 기준으로 맞춰진 상태에서 부른다. team이 null이면 무소속이 된다.
 * 시즌 결산 중(다음 시즌 팀을 정할 때)에는 upcoming을 켜서 합류 시즌·나이를 다음 시즌으로 적는다.
 */
export function changeTeam(state: GameState, team: TeamRef | null, upcoming = false): GameState {
  const prev = state.stints ?? []
  const open = prev[prev.length - 1]
  const closed = open && open.toSeason === undefined ? [...prev.slice(0, -1), { ...open, toSeason: state.season, toAge: state.age }] : prev
  const stints = team ? [...closed, { team, stage: state.stage, fromSeason: state.season + (upcoming ? 1 : 0), fromAge: state.age + (upcoming ? 1 : 0), league: leagueIdOf(state) } satisfies Stint] : closed
  return { ...state, team, stints, teamSinceTurn: state.turnCount }
}

/** 합류하고 한 턴이라도 지났는가 (새 계약 직후에는 연봉 협상을 할 수 없다) */
export function hasSettledIn(state: GameState): boolean {
  return state.turnCount > (state.teamSinceTurn ?? -1)
}

export interface CareerHonor {
  /** 시즌 번호와 나이 */
  season: number
  age: number
  title: string
  /** 정렬·강조용: 3 = 월드 우승, 2 = 대회 우승, 1 = 개인 수상 */
  rank: 1 | 2 | 3
}

export interface CareerStint {
  teamName: string
  stage: GameState['stage']
  fromAge: number
  toAge: number
  seasons: number
  league?: string
  current: boolean
}

export interface Career {
  stints: CareerStint[]
  honors: CareerHonor[]
  totals: { seasons: number; titles: number; worldTitles: number; worldAppearances: number; teams: number; awards: number; bestRating: number | null }
}

/** 시즌 기록 하나에서 우승한 대회 이름 (1위만) */
function titlesOf(r: SeasonRecord): { name: string; world: boolean }[] {
  return r.events.filter((e) => e.placement === 1 && e.fieldSize > 1).map((e) => ({ name: e.name, world: isWorldEvent(e.id) }))
}

/** 경력 화면용 정리: 거쳐 간 구단, 수상 경력, 통산 숫자 */
export function buildCareer(state: GameState): Career {
  const stints: CareerStint[] = (state.stints ?? []).map((s) => {
    const to = s.toSeason ?? state.season
    return { teamName: s.team.name, stage: s.stage, fromAge: s.fromAge, toAge: s.toAge ?? state.age, seasons: Math.max(1, to - s.fromSeason + 1), league: s.league, current: s.toSeason === undefined }
  })
  const honors: CareerHonor[] = []
  for (const r of state.history) {
    for (const t of titlesOf(r)) honors.push({ season: r.season, age: r.age, title: `${t.name} 우승`, rank: t.world ? 3 : 2 })
    for (const a of r.highlights?.awards ?? []) honors.push({ season: r.season, age: r.age, title: a, rank: 1 })
  }
  const ratings = state.history.flatMap((r) => (r.highlights ? [r.highlights.rating] : []))
  return {
    stints,
    honors,
    totals: {
      seasons: state.history.length,
      titles: honors.filter((h) => h.rank >= 2).length,
      worldTitles: state.worldTitles,
      worldAppearances: state.worldAppearances,
      teams: new Set((state.stints ?? []).map((s) => s.team.id)).size,
      awards: honors.filter((h) => h.rank === 1).length,
      bestRating: ratings.length ? Math.max(...ratings) : null,
    },
  }
}
