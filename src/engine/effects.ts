import gacha from '../data/gacha.json'
import rules from '../data/rules.json'
import { moneyScale } from './economy.ts'
import type { GameState } from './state.ts'
import { STAT_KEYS, type Stats } from './types.ts'

/** 이벤트 선택지와 행동의 부작용이 함께 쓰는 효과 묶음 */
export interface Effects {
  /** 능력치 직접 증감. 성장 공식(컨디션·장비)은 거치지 않지만 성장 속도(rules.growthRate)는 훈련과 똑같이 곱한다. */
  stats?: Partial<Stats>
  condition?: number
  money?: number
  fame?: number
  /** 양수면 슬럼프에 빠진다(멘탈이 높을수록 짧아진다), 음수면 회복을 앞당긴다 */
  slumpMonths?: number
  /** 양수면 부상을 입는다, 음수면 회복을 앞당긴다 */
  injuredMonths?: number
  /** 방탕 게이지 증감 */
  vice?: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** 슬럼프 기간 배율: 멘탈 0이면 1.4배, 500이면 1.0배, 1000이면 0.6배 (0.5~1.5로 제한) */
export function slumpDurationFactor(mental: number): number {
  const f = rules.slumpMentalFactor
  return clamp(f.base - f.perMental * mental, f.min, f.max)
}

/**
 * 효과를 반영한 새 상태. 능력치는 0~1000, 컨디션은 0~100, 돈·명성·방탕 게이지는 0 이상으로 제한한다.
 * scale은 턴 길이 배율이고, 기간(개월)이 아닌 수치에만 곱한다.
 */
export function applyEffects(state: GameState, fx: Effects, scale = 1): GameState {
  const stats = { ...state.stats }
  for (const key of STAT_KEYS) {
    const d = fx.stats?.[key]
    if (d !== undefined) stats[key] = clamp(stats[key] + d * scale * rules.growthRate, 0, gacha.statMax)
  }

  let slump = state.slumpMonths
  if (fx.slumpMonths !== undefined) {
    slump = fx.slumpMonths > 0 ? Math.max(slump, fx.slumpMonths * slumpDurationFactor(state.stats.mental)) : Math.max(0, slump + fx.slumpMonths * scale)
  }
  let injured = state.injuredMonths
  if (fx.injuredMonths !== undefined) {
    injured = fx.injuredMonths > 0 ? Math.max(injured, fx.injuredMonths) : Math.max(0, injured + fx.injuredMonths * scale)
  }

  return {
    ...state,
    stats,
    condition: clamp(state.condition + (fx.condition ?? 0) * scale, 0, 100),
    // 돈은 소속 단계의 규모(moneyScale)를 곱한다: 프로가 될수록 쓰고 버는 금액이 커진다
    money: Math.max(0, state.money + (fx.money ?? 0) * scale * moneyScale(state.stage)),
    fame: Math.max(0, state.fame + (fx.fame ?? 0) * scale),
    vice: Math.max(0, state.vice + (fx.vice ?? 0) * scale),
    slumpMonths: slump,
    injuredMonths: injured,
  }
}
