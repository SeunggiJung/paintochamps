import contracts from '../data/contracts.json'
import { amateurTeams, proOrgs, teamPower, TIERS } from './field.ts'
import { salaryFameMultiplier } from './economy.ts'
import { genrePower } from './power.ts'
import { pathOf } from './routes.ts'
import type { GameState, Offer, StageId, TeamRef } from './state.ts'

/** 팀이 속한 리그의 실력 등급 (competitions.json의 tiers 키) */
const TIER_OF_STAGE: Partial<Record<StageId, string>> = { amateur_team: 'amateur', pro2: 'pro2', pro1: 'pro1' }

type Contracted = 'amateur_team' | 'pro2' | 'pro1'
const SALARY = contracts.salaryPerBase as Record<Contracted, number>
const LEAGUE_SIZE = contracts.leagueSize as Record<Contracted, number>

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export interface TeamProfile {
  team: TeamRef
  stage: StageId
  /** 이번 시즌 팀 전력 (리그에서 맞붙을 때의 실력치와 같은 값) */
  power: number
  /** 지난 시즌 순위와 리그 팀 수 */
  lastRank: number
  leagueSize: number
  /** 3개월당 월급(만 원) */
  salary: number
}

/** 이 단계에서 팀이 속할 풀: 아마추어 팀 단계는 아마추어 팀, 프로 2부 이상은 구단 */
function poolOf(stage: StageId): TeamRef[] {
  return stage === 'amateur_team' ? amateurTeams() : proOrgs()
}

/** 팀 전력이 같은 리그 평균에서 얼마나 위인지에 따른 월급 배율 (약한 팀 0.8 ~ 강한 팀 1.4) */
function salaryFor(stage: Contracted, power: number): number {
  const { mean, sd } = TIERS[TIER_OF_STAGE[stage]!]
  const { min, max } = contracts.strengthSpread
  const strength = clamp01((power - (mean - sd)) / (2 * sd))
  return Math.round(SALARY[stage] * (min + (max - min) * strength))
}

/** 팀의 이번 시즌 정보: 전력, 지난 시즌 순위, 제시하는 월급. 시드로 정해져서 어느 화면에서 봐도 같다. */
export function teamProfile(seed: number, season: number, team: TeamRef, stage: StageId, fame = 0): TeamProfile | null {
  const tier = TIER_OF_STAGE[stage]
  if (!tier) return null
  const contracted = stage as Contracted
  const power = teamPower(seed, season, team.id, tier)
  // 지난 시즌 순위: 같은 풀의 팀들을 지난 시즌 전력으로 줄 세우고, 리그 팀 수에 맞춰 환산한다
  const pool = poolOf(stage)
  const last = Math.max(1, season - 1)
  const order = pool.map((t) => ({ id: t.id, p: teamPower(seed, last, t.id, tier) })).sort((a, b) => b.p - a.p)
  const index = Math.max(0, order.findIndex((t) => t.id === team.id))
  const leagueSize = LEAGUE_SIZE[contracted]
  return { team, stage, power, lastRank: 1 + Math.floor((index * leagueSize) / order.length), leagueSize, salary: Math.round(salaryFor(contracted, power) * salaryFameMultiplier(fame)) }
}

/** 정석 루트의 연습생은 팀 전력과 상관없이 훈련비 정도만 받는다 */
function isTrainee(state: Pick<GameState, 'stage' | 'path'>): boolean {
  return state.stage === 'amateur_team' && pathOf(state) === 'academy'
}

/** 지금 소속 팀에서 3개월마다 받는 월급(만 원). 무소속이면 0. */
export function salaryOf(state: GameState): number {
  if (!state.team) return 0
  if (isTrainee(state)) return contracts.traineeSalary
  const profile = teamProfile(state.seed, state.season, state.team, state.stage, state.fame)
  return Math.round((profile?.salary ?? 0) * (state.salaryMult ?? 1))
}

/** 리그 평균 대비 팀 강도: 평균보다 표준편차의 반 이상 위면 강팀, 반 이상 아래면 약팀 */
export type Strength = 'strong' | 'average' | 'weak'

export function strengthOf(stage: StageId, power: number): Strength {
  const tier = TIER_OF_STAGE[stage]
  if (!tier) return 'average'
  const { mean, sd } = TIERS[tier]
  return power >= mean + sd / 2 ? 'strong' : power <= mean - sd / 2 ? 'weak' : 'average'
}

/**
 * 대회에서 소속 팀이 내 전력에 더해 주는 값: 팀 전력이 리그 평균보다 높으면 +, 낮으면 −.
 * 평균적인 팀이면 0이라 전체 난이도는 그대로고, 팀 선택이 성적에 영향을 준다. 연습생·무소속은 0.
 */
export function teamBoost(state: GameState): number {
  if (!state.team || isTrainee(state)) return 0
  const tier = TIER_OF_STAGE[state.stage]
  if (!tier) return 0
  return contracts.teamWeight * (teamPower(state.seed, state.season, state.team.id, tier) - TIERS[tier].mean)
}

export interface OfferTerms {
  profile: TeamProfile
  /** 내 장르 실력치 */
  myPower: number
  /** 팀 전력 − 내 실력치. 양수면 나보다 강한 팀 */
  gap: number
  /** 지금 받는 월급과의 차이 (무소속이면 전액) */
  salaryDelta: number
  strength: Strength
  /** 이 팀에 들어가면 대회 전력에 붙는 값 */
  boost: number
}

/** 제안을 받은 팀의 조건 요약. 이적·입단 결정에 쓰는 정보다. */
export function offerTerms(state: GameState, offer: Offer, stage: StageId = state.stage): OfferTerms | null {
  const profile = teamProfile(state.seed, state.season, offer.team, stage, state.fame)
  if (!profile) return null
  const myPower = genrePower(state.stats, state.genre)
  const gap = profile.power - myPower
  const tier = TIER_OF_STAGE[stage]!
  return {
    profile,
    myPower,
    gap,
    salaryDelta: profile.salary - salaryOf(state),
    strength: strengthOf(stage, profile.power),
    boost: contracts.teamWeight * (profile.power - TIERS[tier].mean),
  }
}
