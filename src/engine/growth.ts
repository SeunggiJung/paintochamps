import gacha from '../data/gacha.json'
import rules from '../data/rules.json'
import type { EquipmentId } from './state.ts'
import type { StatKey } from './types.ts'

export interface ConditionTier {
  /** 이 단계의 컨디션 하한·상한 (정수 기준) */
  min: number
  max: number
  coef: number
  label: string
  desc: string
}

/** 컨디션 단계: 0~30 부진, 31~60 평범, 61~80 좋음, 81~100 완벽 (rules.conditionTiers). 단계마다 훈련 성과 계수가 다르다. */
export const CONDITION_TIERS: ConditionTier[] = rules.conditionTiers.map((t, i, all) => ({ ...t, min: i === 0 ? 0 : all[i - 1].max + 1 }))

export function conditionTier(condition: number): ConditionTier {
  const c = Math.round(condition)
  return CONDITION_TIERS.find((t) => c <= t.max) ?? CONDITION_TIERS[CONDITION_TIERS.length - 1]
}

/** 컨디션 계수 c: 컨디션 단계에 따른 훈련 성과 배율 */
export function conditionCoef(condition: number): number {
  return conditionTier(condition).coef
}

/** 장비 효율 e: 12단계(4종 × 3단계)를 모두 채우면 1.2 */
export function equipmentEfficiency(equipment: Record<EquipmentId, number>): number {
  const levels = Object.values(equipment)
  const max = levels.length * rules.equipment.maxLevel
  return 1 + (rules.equipment.maxEfficiencyBonus * levels.reduce((a, b) => a + b, 0)) / max
}

/**
 * 나이에 따른 훈련 효율 배율. 25세부터 해마다 lossPerYear씩 줄어 min까지 내려가고,
 * 경험으로 쌓는 능력치(판단력·멘탈·팀워크)는 줄어드는 속도가 experienceLossFactor배로 느리다.
 * 어린 선수는 빨리 크고, 베테랑은 경험으로 버티는 구도를 만든다.
 */
export function ageGrowthFactor(age: number, stat: StatKey): number {
  const g = rules.ageGrowth
  // 전성기 직전의 성장기: 이 나이 구간에는 훈련 효율이 더 높다
  if (age >= g.youth.fromAge && age <= g.youth.toAge) return 1 + g.youth.bonus
  const years = Math.max(0, age - g.fromAge + 1)
  const loss = g.lossPerYear * years * ((g.experienceStats as string[]).includes(stat) ? g.experienceLossFactor : 1)
  return Math.max(g.min, 1 - loss)
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

/** 훈련 한 번의 능력치 상승폭 Δs = b × 성장 속도(rules.growthRate) × e × c × t × (1 − s/1000)^growthExponent (턴 길이 배율을 곱한다) */
export function growthDelta(i: GrowthInput): number {
  return i.base * rules.growthRate * i.scale * i.efficiency * conditionCoef(i.condition) * i.traitMultiplier * (1 - i.current / gacha.statMax) ** rules.growthExponent
}
