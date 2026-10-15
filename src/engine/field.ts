import competitions from '../data/competitions.json'
import teamData from '../data/teams.json'
import { createRng, gaussian, mixSeed, shuffled, type Rng } from './rng.ts'
import type { TeamRef } from './state.ts'
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

const ORG_REFS: TeamRef[] = teamData.orgs.map((name, i) => ({ id: `org_${i}`, name }))
const AMATEUR_REFS: TeamRef[] = teamData.amateur.map((name, i) => ({ id: `am_${i}`, name }))
const CAFE_REFS: TeamRef[] = teamData.cafe.map((name, i) => ({ id: `cafe_${i}`, name }))
const INTL_REFS: TeamRef[] = teamData.intl.map((name, i) => ({ id: `intl_${i}`, name }))

function pool(kind: NamePool): TeamRef[] {
  if (kind === 'amateur') return AMATEUR_REFS
  if (kind === 'cafe') return CAFE_REFS
  if (kind === 'intl') return INTL_REFS
  return ORG_REFS
}

/** 구단(프로 팀) 목록. 스카우트·이적 제안에 쓴다. */
export function proOrgs(): TeamRef[] {
  return ORG_REFS
}
export function amateurTeams(): TeamRef[] {
  return AMATEUR_REFS
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
/** 시드마다 구단들을 섞어서 등급별 팀 수만큼 강호·중위권·약팀으로 나눈다 */
function gradeOf(seed: number, teamId: string, grades: Grade[]): Grade {
  const key = `${seed}:${grades.length}`
  if (!gradedSeeds.has(key)) {
    gradedSeeds.add(key)
    const order = [...ORG_REFS].sort((a, b) => hashId(`${seed}:${a.id}`) - hashId(`${seed}:${b.id}`))
    const slots = grades.flatMap((g) => Array<Grade>(g.count).fill(g))
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
  profile?: { seed: number; season: number },
): Team[] {
  const candidates = shuffled(rng, pool(names).filter((t) => !exclude.has(t.id))).slice(0, count)
  return candidates.map((t) => ({
    id: t.id,
    name: names === 'academy' ? academyName(t) : t.name,
    power: profile ? teamPower(profile.seed, profile.season, t.id, tier) : rollPower(rng, tier),
  }))
}

export { TIERS }

/** 제안으로 보여 줄 팀 후보 count개 (현재 팀 제외) */
export function pickTeams(rng: Rng, kind: 'amateur' | 'pro', count: number, exclude: ReadonlySet<string>): TeamRef[] {
  return shuffled(rng, (kind === 'amateur' ? AMATEUR_REFS : ORG_REFS).filter((t) => !exclude.has(t.id))).slice(0, count)
}
