import facilityData from '../data/facilities.json'
import { moneyScale } from './economy.ts'
import { isOverseas } from './leagues.ts'
import type { FacilityId, GameState } from './state.ts'

export interface FacilityDef {
  name: string
  desc: string
  base: number
  factor: number
  maxLevel: number
  perLevel: number
  unit: string
  /** 해외 리그에 있을 때만 사고 쓸 수 있다 */
  onlyOverseas?: boolean
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
  if (def.onlyOverseas && !isOverseas(state)) return `${def.name}은(는) 해외 리그에 있을 때만 쓸 수 있다`
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

/** 통역·언어 코치가 더하는 시즌당 적응도 */
export function languageGain(state: GameState): number {
  return facilityLevel(state, 'language') * FACILITIES.language.perLevel
}

/** 전술 분석관이 큰 경기(플레이오프·국제전)에서 더하는 대회 전력 */
export function analystBonus(state: GameState): number {
  return facilityLevel(state, 'analyst') * FACILITIES.analyst.perLevel
}

/** 멘탈 코치가 슬럼프 발생을 막아 줄 확률 (0~1) */
export function mentalGuard(state: GameState): number {
  return facilityLevel(state, 'mental') * FACILITIES.mental.perLevel
}

/** 트레이너가 부상 발생을 막아 줄 확률 (0~1) */
export function trainerGuard(state: GameState): number {
  return facilityLevel(state, 'trainer') * FACILITIES.trainer.perLevel
}

/** 트레이너가 더하는 턴당 컨디션 회복 (3개월 기준) */
export function trainerRecovery(state: GameState): number {
  return facilityLevel(state, 'trainer') * 0.5
}

/** 스튜디오가 방송 수입에 곱하는 배율 (1이면 평소) */
export function studioBoost(state: GameState): number {
  return 1 + facilityLevel(state, 'studio') * FACILITIES.studio.perLevel
}

/** 스튜디오가 광고 해금 명성을 낮추는 값 */
export function studioFameCut(state: GameState): number {
  return facilityLevel(state, 'studio') * 5
}

/** 한 시설의 level단계 효과 문구 (0단계는 '효과 없음') */
export function facilityEffectText(id: FacilityId, level: number): string {
  const def = FACILITIES[id]
  if (level <= 0) return '효과 없음'
  const v = def.perLevel * level
  switch (id) {
    case 'housing': return `턴마다 컨디션 회복 +${v}`
    case 'coach': return `훈련 효율 +${(v * 100).toFixed(1)}%`
    case 'medic': return `부상·슬럼프 회복 +${Math.round(v * 100)}%`
    case 'pr': return `턴마다 명성 +${v.toFixed(1)}`
    case 'language': return `시즌마다 적응도 +${v}`
    case 'analyst': return `큰 경기 대회 전력 +${v}`
    case 'mental': return `슬럼프 발생 -${Math.round(v * 100)}%`
    case 'trainer': return `부상 발생 -${Math.round(v * 100)}%, 컨디션 회복 +${(level * 0.5).toFixed(1)}`
    case 'studio': return `방송 수입 +${Math.round(v * 100)}%, 광고 해금 명성 -${level * 5}`
  }
}

/** 지금 시설들이 주고 있는 효과를 한 줄씩 (턴 결과 창에 '시설 덕분에'로 보여 준다). 시설이 없으면 빈 목록. */
export function facilityEffectLines(state: GameState): string[] {
  return FACILITY_IDS.filter((id) => facilityLevel(state, id) > 0 && (!FACILITIES[id].onlyOverseas || isOverseas(state))).map(
    (id) => `${FACILITIES[id].name} Lv${facilityLevel(state, id)}: ${facilityEffectText(id, facilityLevel(state, id))}`,
  )
}
