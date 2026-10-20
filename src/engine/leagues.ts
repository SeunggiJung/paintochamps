import data from '../data/leagues.json'
import type { GameState } from './state.ts'
import type { GenreId } from './types.ts'

/**
 * 리그 모델. 장르군(AOS·RTS = aos, FPS·격투 = fps)마다 국내 리그 하나와 해외 리그 여럿이 있고,
 * 리그는 전력 보정(strength)·월급 배율·명성 배율·적응 난이도를 가진다.
 * 국내 리그의 팀은 teams.json의 pro1, 해외 리그의 팀은 leagues.json의 teams다.
 */
export type Family = 'aos' | 'fps'
export type LeagueId = string

export interface LeagueTeam {
  slug: string
  name: string
}

export interface LeagueDef {
  id: LeagueId
  name: string
  region: string
  /** 국내(기본) 리그인가 */
  domestic?: boolean
  /** 이 리그 팀의 전력에 더하는 값 (국내 = 0 기준) */
  strength: number
  /** 월급 배율 */
  salaryMult: number
  /** 대회 명성 보상 배율 */
  prestige: number
  /** 해외로 갔을 때 적응도 시작값 */
  adaptStart: number
  /** 적응 난이도 표시 문구 */
  adaptHard: string
  /** 이 리그가 관심을 보이려면 필요한 내 실력치 */
  minPower: number
  /** 이적 제안이 오는 리그인가 (아니면 국제전 상대로만 나온다) */
  transferable?: boolean
  teams?: LeagueTeam[]
}

interface FamilyDef {
  domestic: LeagueId
  worldHosts: LeagueId[]
  leagues: LeagueDef[]
}

export const OVERSEAS_RULES = data.rules
const FAMILIES = data.families as unknown as Record<Family, FamilyDef>

const FAMILY_OF: Record<GenreId, Family> = { aos: 'aos', rts: 'aos', fps: 'fps', fighting: 'fps' }
export const familyOf = (genre: GenreId): Family => FAMILY_OF[genre]

const BY_ID = new Map<LeagueId, LeagueDef>()
const FAMILY_BY_LEAGUE = new Map<LeagueId, Family>()
for (const family of Object.keys(FAMILIES) as Family[]) {
  for (const lg of FAMILIES[family].leagues) {
    BY_ID.set(lg.id, lg)
    FAMILY_BY_LEAGUE.set(lg.id, family)
  }
}

export const leagueDef = (id: LeagueId): LeagueDef => BY_ID.get(id) ?? FAMILIES.aos.leagues[0]
export const familyOfLeague = (id: LeagueId): Family | null => FAMILY_BY_LEAGUE.get(id) ?? null

/** 장르군의 모든 리그 (국내 리그가 맨 앞) */
export const leaguesOf = (genre: GenreId): LeagueDef[] => FAMILIES[familyOf(genre)].leagues
export const domesticLeagueId = (genre: GenreId): LeagueId => FAMILIES[familyOf(genre)].domestic
/** 해외 이적 제안이 오는 리그들 */
export const transferableLeagues = (genre: GenreId): LeagueDef[] => leaguesOf(genre).filter((l) => l.transferable)

/** 소속 리그 (옛 세이브에는 league가 없어 국내 리그로 본다) */
export const leagueIdOf = (state: Pick<GameState, 'genre'> & { league?: LeagueId }): LeagueId => state.league ?? domesticLeagueId(state.genre)
export const leagueOfState = (state: Pick<GameState, 'genre'> & { league?: LeagueId }): LeagueDef => leagueDef(leagueIdOf(state))
export const isOverseas = (state: Pick<GameState, 'genre'> & { league?: LeagueId }): boolean => leagueIdOf(state) !== domesticLeagueId(state.genre)

/** 해외 리그 팀 전체에서 팀 수를 가중한 평균 전력 보정. 국제전 상대의 보정은 이 평균을 뺀 값이라 전체 난이도가 그대로다. */
const MEAN_OVERSEAS: Record<Family, number> = { aos: 0, fps: 0 }
for (const family of Object.keys(FAMILIES) as Family[]) {
  const withTeams = FAMILIES[family].leagues.filter((l) => l.teams)
  const count = withTeams.reduce((n, l) => n + l.teams!.length, 0)
  MEAN_OVERSEAS[family] = withTeams.reduce((sum, l) => sum + l.strength * l.teams!.length, 0) / count
}

/** 국제전 상대로 나온 이 리그 팀의 전력 보정 (평균 0) */
export function intlOffset(id: LeagueId): number {
  const family = familyOfLeague(id)
  return family ? leagueDef(id).strength - MEAN_OVERSEAS[family] : 0
}

/** 적응도 (0~100). 국내 소속이거나 옛 세이브면 100 */
export function adaptationOf(state: Pick<GameState, 'genre'> & { league?: LeagueId; adaptation?: number }): number {
  return isOverseas(state) ? (state.adaptation ?? 100) : 100
}

/** 적응이 덜 됐을 때 대회 전력에서 깎이는 값 */
export function adaptationPenalty(state: Pick<GameState, 'genre'> & { league?: LeagueId; adaptation?: number }): number {
  return (OVERSEAS_RULES.maxPenalty * (100 - adaptationOf(state))) / 100
}

/** 월드 챔피언십이 열리는 리그(지역). 시즌마다 순환한다. */
export function worldHost(genre: GenreId, season: number): LeagueDef {
  const hosts = FAMILIES[familyOf(genre)].worldHosts
  return leagueDef(hosts[(Math.max(1, season) - 1) % hosts.length])
}

/** 적응이 덜 됐을 때 줄어드는 턴당 컨디션 회복 (3개월 기준) */
export function adaptationRecoveryPenalty(state: Pick<GameState, 'genre'> & { league?: LeagueId; adaptation?: number }): number {
  return (OVERSEAS_RULES.recoveryPenalty * (100 - adaptationOf(state))) / 100
}
