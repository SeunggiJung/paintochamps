import { describe, expect, it } from 'vitest'
import { analystBonus, buyFacility, checkFacility, facilityCost, facilityEffectLines, facilityEffectText, FACILITY_IDS, mentalGuard, studioBoost, trainerGuard, trainerRecovery } from './facilities.ts'
import { createInitialState, type GameState } from './state.ts'
import { applyTurn } from './turn.ts'
import type { GenreId, Stats } from './types.ts'

const stats = (power: number): Stats => ({ reaction: power, accuracy: power, focus: power, judgment: power, mental: power, teamwork: power })

/** 프로 1부 국내 소속 상태 */
export function proState(genre: GenreId = 'fps', over: Partial<GameState> = {}): GameState {
  const base = createInitialState({ name: '테스트', genre, mode: 'standard', seed: 21, gacha: { stats: stats(700), trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power: 700 } })
  return { ...base, age: 22, stage: 'pro1', team: { id: 'fps_pro1_t1', name: 'T1' }, fame: 120, money: 10_000_000, season: 4, seasonTraining: 'basics', ...over }
}

describe('스태프 시설', () => {
  it('새 시설 4종이 있고 해외 전용이 아니며 가격은 소속 단계 배율을 따른다', () => {
    for (const id of ['analyst', 'mental', 'trainer', 'studio'] as const) {
      expect(FACILITY_IDS).toContain(id)
      expect(checkFacility(proState(), id)).toBeNull()
      expect(facilityCost(proState(), id)).toBeGreaterThan(facilityCost({ ...proState(), stage: 'pro2' }, id))
    }
  })

  it('레벨마다 효과가 커진다', () => {
    const s = (level: number, id: 'analyst' | 'mental' | 'trainer' | 'studio') => ({ ...proState(), facilities: { [id]: level } })
    expect(analystBonus(s(3, 'analyst'))).toBe(12)
    expect(mentalGuard(s(2, 'mental'))).toBeCloseTo(0.3)
    expect(trainerGuard(s(5, 'trainer'))).toBeCloseTo(0.6)
    expect(trainerRecovery(s(4, 'trainer'))).toBe(2)
    expect(studioBoost(s(5, 'studio'))).toBeCloseTo(2)
    expect(analystBonus(proState())).toBe(0)
  })

  it('시설 효과 문구와 한 줄 요약이 나온다', () => {
    expect(facilityEffectText('analyst', 2)).toContain('+8')
    expect(facilityEffectText('studio', 0)).toBe('효과 없음')
    expect(facilityEffectLines(proState())).toEqual([])
    const lines = facilityEffectLines({ ...proState(), facilities: { coach: 2, mental: 1 } })
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('개인 코치 Lv2')
  })

  it('스튜디오가 있으면 방송 수입이 늘고, 구매하면 단계가 오른다', () => {
    const base = proState()
    const gain = (s: GameState) => {
      const r = applyTurn(s, [{ id: 'broadcast' }, { id: 'rest' }])
      if (!r.ok) throw new Error(r.error)
      return r.delta.money
    }
    const plain = gain(base)
    const boosted = gain({ ...base, facilities: { studio: 5 } })
    expect(boosted).toBeGreaterThan(plain)
    const bought = buyFacility(base, 'studio')
    expect(bought.ok && bought.state.facilities.studio).toBe(1)
  })
})
