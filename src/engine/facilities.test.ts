import { describe, expect, it } from 'vitest'
import { buyFacility, checkFacility, coachEfficiency, facilityCost, facilityLevel, FACILITIES } from './facilities.ts'
import { chooseSeasonTraining } from './training.ts'
import { createInitialState, type GameState, type StageId } from './state.ts'
import { applyTurn } from './turn.ts'
import type { Stats } from './types.ts'

const stats = (v: number): Stats => ({ reaction: v, accuracy: v, focus: v, judgment: v, mental: v, teamwork: v })

function make(stage: StageId = 'basement', o: Partial<GameState> = {}): GameState {
  const base = createInitialState({
    name: '테스트',
    genre: 'fps',
    mode: 'standard',
    seed: 5,
    gacha: { stats: stats(300), trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power: 300 },
  })
  return chooseSeasonTraining({ ...base, stage, condition: 50, money: 10_000_000, trainingMenu: ['basics', 'aim_lab', 'video_review'], ...o }, 'basics')
}

const rest = (s: GameState) => {
  const r = applyTurn(s, [{ id: 'rest' }, { id: 'rest' }], undefined, false)
  if (!r.ok) throw new Error(r.error)
  return r.state
}

describe('시설 투자 (돈 소비처)', () => {
  it('가격은 단계가 오를수록, 소속 단계의 돈 규모가 클수록 비싸다', () => {
    const s = make()
    const bought = buyFacility(s, 'housing')
    expect(bought.ok && facilityCost(bought.state, 'housing')).toBeGreaterThan(facilityCost(s, 'housing'))
    expect(facilityCost(make('pro1'), 'housing')).toBeGreaterThan(facilityCost(make('pro2'), 'housing'))
  })

  it('사면 돈이 빠지고 단계가 오르며, 돈이 모자라거나 최고 단계면 못 산다', () => {
    const s = make('basement', { money: 5 })
    expect(checkFacility(s, 'coach')).toContain('돈')
    const rich = make()
    const r = buyFacility(rich, 'coach')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(facilityLevel(r.state, 'coach')).toBe(1)
    expect(r.state.money).toBe(rich.money - facilityCost(rich, 'coach'))
    const maxed = make('basement', { facilities: { coach: FACILITIES.coach.maxLevel } })
    expect(checkFacility(maxed, 'coach')).toContain('최고')
  })

  it('옛 세이브처럼 facilities가 없어도 0단계로 본다', () => {
    const s = { ...make(), facilities: undefined } as unknown as GameState
    expect(facilityLevel(s, 'pr')).toBe(0)
    expect(coachEfficiency(s)).toBe(1)
    expect(buyFacility(s, 'pr').ok).toBe(true)
  })

  it('숙소는 컨디션 회복, 개인 코치는 훈련 성과, 홍보는 명성을 높인다', () => {
    const base = make()
    expect(rest(make('basement', { facilities: { housing: 3 } })).condition).toBeGreaterThan(rest(base).condition)
    expect(rest(make('basement', { facilities: { pr: 4 } })).fame).toBeGreaterThan(rest(base).fame)
    const train = (s: GameState) => {
      const r = applyTurn(s, [{ id: 'basics' }, { id: 'basics' }], undefined, false)
      if (!r.ok) throw new Error(r.error)
      return r.state.stats.reaction + r.state.stats.accuracy + r.state.stats.focus
    }
    expect(train(make('basement', { facilities: { coach: 5 } }))).toBeGreaterThan(train(base))
  })

  it('재활 트레이너는 부상 회복을 앞당긴다', () => {
    const hurt = (s: GameState) => rest({ ...s, injuredMonths: 6 }).injuredMonths
    expect(hurt(make('basement', { facilities: { medic: 3 } }))).toBeLessThan(hurt(make()))
  })
})
