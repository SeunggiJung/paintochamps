import { describe, expect, it } from 'vitest'
import { analystBonus, buyFacility, checkFacility, facilityCost, facilityEffectLines, facilityEffectText, FACILITY_IDS, mentalGuard, studioBoost, trainerGuard, trainerRecovery } from './facilities.ts'
import { createInitialState, type GameState } from './state.ts'
import { applyTurn } from './turn.ts'
import { acquireTeam, assetGrade, buyHome, homeBlocker, homeSlumpFactor, netWorth, ownerBlocker, HOMES } from './life.ts'
import { applyEffects } from './effects.ts'
import { earnedAchievements } from './achievements.ts'
import { isEligible, EVENTS } from './events.ts'
import { endingDef, evaluateEnding } from './endings.ts'
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

describe('집과 자산', () => {
  it('프로 2부 이상에서 돈이 되면 3단계까지 집을 살 수 있다', () => {
    expect(homeBlocker(proState('fps', { stage: 'amateur_team' }))).not.toBeNull()
    expect(homeBlocker(proState('fps', { money: 100 }))).not.toBeNull()
    let s = proState('fps', { money: 10_000_000 })
    for (let i = 0; i < 3; i++) {
      const r = buyHome(s)
      expect(r.ok).toBe(true)
      if (r.ok) s = r.state
    }
    expect(s.home).toBe(3)
    expect(s.money).toBe(10_000_000 - HOMES.reduce((a, h) => a + h.price, 0))
    expect(homeBlocker(s)).not.toBeNull()
  })

  it('집이 있으면 슬럼프가 짧아진다', () => {
    const slump = (home: number) => applyEffects(proState('fps', { home }), { slumpMonths: 6 }).slumpMonths
    expect(slump(3)).toBeCloseTo(slump(0) * 0.7)
    expect(homeSlumpFactor(proState())).toBe(1)
  })

  it('순자산 등급은 돈과 집 가치로 정한다', () => {
    expect(assetGrade(proState('fps', { money: 100 }))).toBe('평범한 살림')
    expect(assetGrade(proState('fps', { money: 60_000 }))).toBe('부자')
    expect(assetGrade(proState('fps', { money: 210_000 }))).toBe('갑부')
    expect(assetGrade(proState('fps', { money: 600_000 }))).toBe('재벌')
    expect(netWorth(proState('fps', { money: 1000, home: 2 }))).toBe(1000 + (10_000 + 40_000) * 0.5)
  })

  it('집 3단계는 업적 효도, 가족 이벤트는 집이 있을 때만 나온다', () => {
    const done = { ...proState(), finished: 'legend' as const, home: 3, history: [] }
    expect(earnedAchievements(done)).toContain('filial')
    expect(earnedAchievements({ ...done, home: 2 })).not.toContain('filial')
    const family = EVENTS.filter((e) => e.when.home !== undefined && e.id !== 'family_slump_home')
    expect(family.length).toBeGreaterThanOrEqual(4)
    const base = proState('fps', { condition: 80, fame: 50 })
    for (const e of family) expect(isEligible({ ...base, home: 0 }, e)).toBe(false)
    expect(isEligible({ ...base, home: 3, team: { id: 'fps_pro1_t1', name: 'T1' } }, EVENTS.find((e) => e.id === 'family_housewarming')!)).toBe(true)
  })

  it('재산이 충분하면 끝난 커리어에서 구단을 인수해 구단주 엔딩을 본다', () => {
    const over = proState('fps', { money: 600_000, finished: 'legend', everPro: true })
    expect(ownerBlocker(over)).toBeNull()
    const owned = acquireTeam(over)
    expect(owned.finished).toBe('owner')
    expect(owned.owner).toBe(true)
    expect(owned.money).toBe(400_000)
    expect(endingDef('owner').name).toBe('구단주')
    expect(ownerBlocker(proState('fps', { money: 600_000, finished: null }))).not.toBeNull()
    expect(ownerBlocker({ ...over, money: 250_000 })).not.toBeNull()
    expect(evaluateEnding(proState('fps', { money: 600_000 }))).not.toBe('owner')
  })
})
