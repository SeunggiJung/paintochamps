import competitions from '../data/competitions.json'
import teamData from '../data/teams.json'
import { createRng, gaussian, mixSeed, shuffled, type Rng } from './rng.ts'
import type { TeamRef } from './state.ts'
import type { GenreId } from './types.ts'
import type { Team } from './tournament.ts'

export type NamePool = 'amateur' | 'cafe' | 'orgs' | 'academy' | 'intl'

interface Grade {
  /** 이 등급에 속하는 팀 수 (등급 팀 수의 합 = 풀의 팀 수) */
  count: number
  mean: number
  sd: number
}
interface Tier {
  /** 리그 전체의 평균·편차 (월급·팀 강도 평가 기준) */
  mean: number
  sd: number
  /** 있으면 팀을 강호·중위권·약팀처럼 등급으로 나눠 등급별 평균으로 전력을 정한다 (시드마다 어느 팀이 어느 등급인지 다르다) */
  grades?: Grade[]
}
const TIERS = competitions.tiers as Record<string, Tier>

/** 풀에 든 팀 하나. slug는 id와 로고 파일 이름에 쓰고, parent는 2군이 속한 1군의 slug다. */
interface PoolEntry {
  slug: string
  name: string
  logo?: string
  parent?: string
}
type LeagueKey = 'aos' | 'fps'
type LeagueKind = 'pro1' | 'pro2' | 'intl'

/** 장르가 따르는 리그: AOS·RTS는 LCK 계열, FPS·격투는 VCT 퍼시픽 계열 */
const LEAGUE_OF: Record<GenreId, LeagueKey> = { aos: 'aos', rts: 'aos', fps: 'fps', fighting: 'fps' }
export const leagueOf = (genre: GenreId): LeagueKey => LEAGUE_OF[genre]

const LEAGUES = teamData.leagues as Record<LeagueKey, Record<LeagueKind, PoolEntry[]>>
const idOf = (league: LeagueKey, kind: LeagueKind, slug: string) => `${league}_${kind}_${slug}`

const REFS = new Map<string, TeamRef>()
const ENTRY_OF = new Map<string, PoolEntry>()
const POOLS = new Map<string, TeamRef[]>()
for (const league of Object.keys(LEAGUES) as LeagueKey[]) {
  for (const kind of Object.keys(LEAGUES[league]) as LeagueKind[]) {
    const refs = LEAGUES[league][kind].map((e) => {
      const ref: TeamRef = { id: idOf(league, kind, e.slug), name: e.name }
      REFS.set(ref.id, ref)
      ENTRY_OF.set(ref.id, e)
      return ref
    })
    POOLS.set(`${league}:${kind}`, refs)
  }
}
const AMATEUR_REFS: TeamRef[] = teamData.amateur.map((name, i) => ({ id: `am_${i}`, name }))
const CAFE_REFS: TeamRef[] = teamData.cafe.map((name, i) => ({ id: `cafe_${i}`, name }))

function leaguePool(genre: GenreId, kind: LeagueKind): TeamRef[] {
  return POOLS.get(`${leagueOf(genre)}:${kind}`)!
}

function pool(kind: NamePool, genre: GenreId): TeamRef[] {
  if (kind === 'amateur') return AMATEUR_REFS
  if (kind === 'cafe') return CAFE_REFS
  if (kind === 'intl') return leaguePool(genre, 'intl')
  if (kind === 'academy') return leaguePool(genre, 'pro2')
  return leaguePool(genre, 'pro1')
}

/** 1부 구단 목록. 스카우트·이적 제안에 쓴다. */
export function proOrgs(genre: GenreId): TeamRef[] {
  return leaguePool(genre, 'pro1')
}
/** 2부 팀(챌린저스) 목록 */
export function pro2Teams(genre: GenreId): TeamRef[] {
  return leaguePool(genre, 'pro2')
}
export function amateurTeams(): TeamRef[] {
  return AMATEUR_REFS
}

/** 로고 파일 이름. 풀에 없는 팀(옛 세이브·가상 팀)이면 null. */
export function logoSlugOf(teamId: string): string | null {
  const e = ENTRY_OF.get(teamId)
  return e ? (e.logo ?? e.slug) : null
}

/** 2부 팀의 모 구단(1부 팀). 연계된 1군이 없으면 null. */
export function parentOrgOf(team: TeamRef, genre: GenreId): TeamRef | null {
  const parent = ENTRY_OF.get(team.id)?.parent
  return parent ? (REFS.get(idOf(leagueOf(genre), 'pro1', parent)) ?? null) : null
}

/** 1부 구단에 연계된 2부 팀(있으면) */
export function farmTeamOf(org: TeamRef, genre: GenreId): TeamRef | null {
  const slug = ENTRY_OF.get(org.id)?.slug
  return leaguePool(genre, 'pro2').find((t) => ENTRY_OF.get(t.id)?.parent === slug) ?? null
}

/** 이 팀이 2부(챌린저스) 팀인가 */
export function isPro2Team(teamId: string): boolean {
  return /^(aos|fps)_pro2_/.test(teamId)
}

/** 같은 구단의 2군 이름 */
export function academyName(org: TeamRef): string {
  return `${org.name} 아카데미`
}

/** 티어 평균·표준편차에서 실력치를 뽑는다 */
export function rollPower(rng: Rng, tier: string): number {
  const { mean, sd } = TIERS[tier]
  return Math.min(1000, Math.max(50, mean + sd * gaussian(rng)))
}

/** 문자열을 난수 시드로 쓸 수 있는 정수로 바꾼다 */
export function hashId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * 팀의 그 시즌 전력. 팀마다 타고난 강약(대부분)에 시즌마다의 기복(일부)을 더해 시드로 정한다.
 * 같은 판에서는 같은 팀이 늘 비슷한 전력이라, 제안 화면에서 보여 준 전력이 실제 리그에서도 그대로 나온다.
 */
export function teamPower(seed: number, season: number, teamId: string, tier: string): number {
  const { mean, sd, grades } = TIERS[tier]
  const drift = gaussian(createRng(mixSeed(seed, hashId(teamId), season, 0xd71f)))
  if (grades) {
    const g = gradeOf(seed, teamId, grades)
    const base = gaussian(createRng(mixSeed(seed, hashId(teamId), 0x7e4b)))
    return Math.min(1000, Math.max(50, g.mean + g.sd * (0.7 * base + 0.7 * drift)))
  }
  const base = gaussian(createRng(mixSeed(seed, hashId(teamId), 0x7e4a)))
  return Math.min(1000, Math.max(50, mean + sd * (0.85 * base + 0.5 * drift)))
}

const gradeById = new Map<string, Grade>()
const gradedSeeds = new Set<string>()

/** 등급별 팀 수를 풀 크기에 맞춰 비례 배분한다 (12팀 기준 5·4·3을 10팀 리그면 4·3·3으로) */
function scaledCounts(grades: Grade[], size: number): number[] {
  const total = grades.reduce((sum, g) => sum + g.count, 0)
  const raw = grades.map((g) => (g.count * size) / total)
  const counts = raw.map(Math.floor)
  let rest = size - counts.reduce((a, b) => a + b, 0)
  const byRemainder = raw.map((r, i) => ({ i, r: r - Math.floor(r) })).sort((a, b) => b.r - a.r)
  for (const { i } of byRemainder) {
    if (rest <= 0) break
    counts[i]++
    rest--
  }
  return counts
}

/** 시드마다 구단들을 섞어서 등급별 팀 수만큼 강호·중위권·약팀으로 나눈다. 1부 풀은 팀 id가 가리키는 리그의 것이다. */
function gradeOf(seed: number, teamId: string, grades: Grade[]): Grade {
  const league = /^(aos|fps)_pro1_/.exec(teamId)?.[1] as LeagueKey | undefined
  if (!league) return grades[grades.length - 1]
  const key = `${seed}:${grades.length}:${league}`
  if (!gradedSeeds.has(key)) {
    gradedSeeds.add(key)
    const refs = POOLS.get(`${league}:pro1`)!
    const order = [...refs].sort((a, b) => hashId(`${seed}:${a.id}`) - hashId(`${seed}:${b.id}`))
    const counts = scaledCounts(grades, refs.length)
    const slots = grades.flatMap((g, i) => Array<Grade>(counts[i]).fill(g))
    order.forEach((t, i) => gradeById.set(`${key}:${t.id}`, slots[i] ?? grades[grades.length - 1]))
  }
  return gradeById.get(`${key}:${teamId}`) ?? grades[grades.length - 1]
}

/** 상대 팀 count개를 만든다. exclude에 든 팀 id는 뽑지 않는다. profile을 주면 팀마다 정해진 전력(teamPower)을 쓴다. */
export function makeOpponents(
  rng: Rng,
  names: NamePool,
  tier: string,
  count: number,
  exclude: ReadonlySet<string>,
  genre: GenreId,
  profile?: { seed: number; season: number },
): Team[] {
  const candidates = shuffled(rng, pool(names, genre).filter((t) => !exclude.has(t.id))).slice(0, count)
  return candidates.map((t) => ({
    id: t.id,
    name: t.name,
    power: profile ? teamPower(profile.seed, profile.season, t.id, tier) : rollPower(rng, tier),
  }))
}

export { TIERS }

/** 제안으로 보여 줄 팀 후보 count개 (현재 팀 제외). pro1·pro2는 장르가 따르는 리그의 팀이다. */
export function pickTeams(rng: Rng, kind: 'amateur' | 'pro1' | 'pro2', count: number, exclude: ReadonlySet<string>, genre: GenreId): TeamRef[] {
  const refs = kind === 'amateur' ? AMATEUR_REFS : kind === 'pro2' ? pro2Teams(genre) : proOrgs(genre)
  return shuffled(rng, refs.filter((t) => !exclude.has(t.id))).slice(0, count)
}
