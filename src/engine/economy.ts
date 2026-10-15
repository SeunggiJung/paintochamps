import contracts from '../data/contracts.json'
import equipmentData from '../data/equipment.json'
import rules from '../data/rules.json'
import type { EquipmentId, StageId } from './state.ts'

/**
 * 돈의 규모. 돈이 오가는 모든 것(훈련·친목·기부·이벤트·상금·계약금)은 3개월 기준 기본 금액에 소속 단계의 배율을 곱한다.
 * 방구석·지역 대회는 용돈 규모(×1)이고 아마추어 팀 ×2, 프로 2부 ×8, 프로 1부 ×30으로 커진다(월급도 실제 연봉에 맞춰 같이 커진다).
 */
export function moneyScale(stage: StageId): number {
  return (contracts.moneyScale as Record<StageId, number>)[stage] ?? 1
}

/** 명성이 높을수록 월급이 오른다: 1 + 명성 × perFame (최대 1 + max) */
export function salaryFameMultiplier(fame: number): number {
  return 1 + Math.min(contracts.fameBonus.max, Math.max(0, fame) * contracts.fameBonus.perFame)
}

const EQUIPMENT = equipmentData as Record<EquipmentId, { name: string; base: number }>

/** 장비를 level단계에서 level+1단계로 올리는 가격(만 원): 기본가 × 2^level */
export function equipmentCost(item: EquipmentId, level: number): number {
  return Math.round(EQUIPMENT[item].base * rules.equipment.costFactor ** level)
}
