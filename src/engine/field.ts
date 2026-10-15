import competitions from '../data/competitions.json'
import teamData from '../data/teams.json'
import { gaussian, shuffled, type Rng } from './rng.ts'
import type { TeamRef } from './state.ts'
import type { Team } from './tournament.ts'

export type NamePool = 'amateur' | 'cafe' | 'orgs' | 'academy' | 'intl'

interface Tier {
  mean: number
  sd: number
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

/** 상대 팀 count개를 만든다. exclude에 든 팀 id는 뽑지 않는다. */
export function makeOpponents(rng: Rng, names: NamePool, tier: string, count: number, exclude: ReadonlySet<string>): Team[] {
  const candidates = shuffled(rng, pool(names).filter((t) => !exclude.has(t.id))).slice(0, count)
  return candidates.map((t) => ({
    id: t.id,
    name: names === 'academy' ? academyName(t) : t.name,
    power: rollPower(rng, tier),
  }))
}

/** 제안으로 보여 줄 팀 후보 count개 (현재 팀 제외) */
export function pickTeams(rng: Rng, kind: 'amateur' | 'pro', count: number, exclude: ReadonlySet<string>): TeamRef[] {
  return shuffled(rng, (kind === 'amateur' ? AMATEUR_REFS : ORG_REFS).filter((t) => !exclude.has(t.id))).slice(0, count)
}
