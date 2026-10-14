import gacha from '../data/gacha.json'
import rules from '../data/rules.json'
import type { EquipmentId } from './state.ts'

/** 컨디션 계수 c: 80 이상 1.0, 40 이하 0.5, 그 사이는 직선으로 잇는다. */
export function conditionCoef(condition: number): number {
  const { full, floor, min } = rules.conditionCoef
  if (condition >= full) return 1
  if (condition <= floor) return min
  return min + ((1 - min) * (condition - floor)) / (full - floor)
}

/** 장비 효율 e: 12단계(4종 × 3단계)를 모두 채우면 1.2 */
export function equipmentEfficiency(equipment: Record<EquipmentId, number>): number {
  const levels = Object.values(equipment)
  const max = levels.length * rules.equipment.maxLevel
  return 1 + (rules.equipment.maxEfficiencyBonus * levels.reduce((a, b) => a + b, 0)) / max
}

export interface GrowthInput {
  /** 행동의 기본 상승치 b (3개월 기준) */
  base: number
  /** 턴 길이 배율 (6개월 2, 3개월 1, 1개월 1/3) */
  scale: number
  efficiency: number
  condition: number
  traitMultiplier: number
  /** 지금 능력치 값 s */
  current: number
}

/** 훈련 한 번의 능력치 상승폭 Δs = b × e × c × t × (1 − s/1000) (턴 길이 배율을 곱한다) */
export function growthDelta(i: GrowthInput): number {
  return i.base * i.scale * i.efficiency * conditionCoef(i.condition) * i.traitMultiplier * (1 - i.current / gacha.statMax)
}
