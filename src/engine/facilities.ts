import facilityData from '../data/facilities.json'
import { moneyScale } from './economy.ts'
import type { FacilityId, GameState } from './state.ts'

export interface FacilityDef {
  name: string
  desc: string
  base: number
  factor: number
  maxLevel: number
  perLevel: number
  unit: string
}

export const FACILITIES = facilityData as Record<FacilityId, FacilityDef>
export const FACILITY_IDS = Object.keys(FACILITIES) as FacilityId[]

/** 시설 단계 (옛 세이브에는 없을 수 있어 0으로 본다) */
export function facilityLevel(state: GameState, id: FacilityId): number {
  return state.facilities?.[id] ?? 0
}

/** 시설을 level단계에서 level+1단계로 올리는 가격: 기본가 × 소속 단계의 돈 규모 × 배수^단계. 돈 규모를 따라가서 후반에도 소비처가 된다. */
export function facilityCost(state: GameState, id: FacilityId): number {
  const def = FACILITIES[id]
  return Math.round(def.base * moneyScale(state.stage) * def.factor ** facilityLevel(state, id))
}

/** 시설을 살 수 있는지 확인한다. 가능하면 null. */
export function checkFacility(state: GameState, id: FacilityId): string | null {
  const def = FACILITIES[id]
  if (!def) return '알 수 없는 시설이다'
  if (state.finished) return '이미 끝난 커리어다'
  if (facilityLevel(state, id) >= def.maxLevel) return `${def.name}은(는) 이미 최고 단계다`
  if (state.money < facilityCost(state, id)) return '돈이 부족하다'
  return null
}

/** 시설을 산다(시즌 시작 계획 때, 턴을 쓰지 않는다). */
export function buyFacility(state: GameState, id: FacilityId): { ok: true; state: GameState } | { ok: false; error: string } {
  const error = checkFacility(state, id)
  if (error) return { ok: false, error }
  return {
    ok: true,
    state: { ...state, money: state.money - facilityCost(state, id), facilities: { ...state.facilities, [id]: facilityLevel(state, id) + 1 } },
  }
}

/** 개인 코치가 더하는 훈련 효율 배율 (1 + 단계 × 단계당 효율) */
export function coachEfficiency(state: GameState): number {
  return 1 + facilityLevel(state, 'coach') * FACILITIES.coach.perLevel
}

/** 숙소가 더하는 턴당 컨디션 회복 (3개월 기준) */
export function housingRecovery(state: GameState): number {
  return facilityLevel(state, 'housing') * FACILITIES.housing.perLevel
}

/** 재활 트레이너가 앞당기는 부상·슬럼프 회복 배율 (1이면 평소) */
export function medicSpeed(state: GameState): number {
  return 1 + facilityLevel(state, 'medic') * FACILITIES.medic.perLevel
}

/** 홍보 에이전시가 더하는 턴당 명성 (3개월 기준) */
export function prFame(state: GameState): number {
  return facilityLevel(state, 'pr') * FACILITIES.pr.perLevel
}
