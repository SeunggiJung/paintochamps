import { describe, expect, it } from 'vitest'
import rules from '../data/rules.json'
import { ageGrowthFactor } from './growth.ts'

describe('나이에 따른 훈련 효율', () => {
  it('24세까지는 그대로, 25세부터 해마다 줄고 최저값에서 멈춘다', () => {
    expect(ageGrowthFactor(24, 'accuracy')).toBe(1)
    expect(ageGrowthFactor(25, 'accuracy')).toBeCloseTo(0.94)
    expect(ageGrowthFactor(28, 'accuracy')).toBeCloseTo(0.76)
    expect(ageGrowthFactor(30, 'accuracy')).toBeCloseTo(0.64)
    expect(ageGrowthFactor(40, 'accuracy')).toBe(rules.ageGrowth.min)
  })
  it('경험 능력치(판단력·멘탈·팀워크)는 천천히 줄어든다', () => {
    for (const k of ['judgment', 'mental', 'teamwork'] as const) {
      expect(ageGrowthFactor(28, k)).toBeGreaterThan(ageGrowthFactor(28, 'reaction'))
    }
    expect(ageGrowthFactor(30, 'mental')).toBeCloseTo(1 - 0.06 * 6 * 0.4)
  })
})
