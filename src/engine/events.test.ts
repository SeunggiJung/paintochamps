import { describe, expect, it } from 'vitest'
import rules from '../data/rules.json'
import { slumpDurationFactor } from './effects.ts'
import { applyEventChoice, EVENTS, isEligible, rollEvent, turnRng } from './events.ts'
import { createRng } from './rng.ts'
import { createInitialState, type GameState, type ModeId } from './state.ts'
import { applyTurn } from './turn.ts'
import { TRAINING_POOL } from './training.ts'
import type { Stats } from './types.ts'

const FLAT: Stats = { reaction: 100, accuracy: 100, focus: 100, judgment: 100, mental: 100, teamwork: 100 }
const TEAM = { id: 'org_0', name: '나이트호크' }

function make(o: Partial<GameState> = {}, mode: ModeId = 'standard'): GameState {
  const base = createInitialState({
    name: '테스트',
    genre: 'fps',
    mode,
    seed: 5,
    gacha: { stats: FLAT, trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power: 100 },
  })
  return { ...base, trainingMenu: TRAINING_POOL, ...o }
}

const byId = (id: string) => EVENTS.find((e) => e.id === id)!

describe('이벤트 데이터', () => {
  it('id가 겹치지 않고, 모든 이벤트에 선택지가 2개 이상 있다', () => {
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length)
    for (const e of EVENTS) {
      expect(e.choices.length).toBeGreaterThanOrEqual(2)
      expect(e.weight).toBeGreaterThan(0)
    }
  })
})

describe('발생 조건', () => {
  it('고등학교 이벤트는 18세까지만, 멘탈 케어는 멘탈이 낮을 때만 나온다', () => {
    const care = byId('parents_mental_care')
    expect(isEligible(make({ age: 17, stats: { ...FLAT, mental: 200 } }), care)).toBe(true)
    expect(isEligible(make({ age: 19, stats: { ...FLAT, mental: 200 } }), care)).toBe(false)
    expect(isEligible(make({ age: 17, stats: { ...FLAT, mental: 600 } }), care)).toBe(false)
  })

  it('슬럼프는 컨디션 30 미만, 팀 갈등은 팀 소속이고 팀워크가 낮을 때', () => {
    expect(isEligible(make({ condition: 29 }), byId('slump'))).toBe(true)
    expect(isEligible(make({ condition: 30 }), byId('slump'))).toBe(false)
    const conflict = byId('team_conflict')
    expect(isEligible(make({ team: TEAM, stats: { ...FLAT, teamwork: 300 } }), conflict)).toBe(true)
    expect(isEligible(make({ team: null, stats: { ...FLAT, teamwork: 300 } }), conflict)).toBe(false)
    expect(isEligible(make({ team: TEAM, stats: { ...FLAT, teamwork: 800 } }), conflict)).toBe(false)
  })

  it('스폰서 제안은 명성이 있어야 한다', () => {
    expect(isEligible(make({ fame: 0 }), byId('small_sponsor'))).toBe(false)
    expect(isEligible(make({ fame: 30 }), byId('small_sponsor'))).toBe(true)
  })
})

describe('rollEvent', () => {
  it('발생 확률이 턴 길이에 맞다 (6개월 약 58%, 3개월 35%, 1개월 약 13%)', () => {
    const rate = (mode: ModeId) => {
      let hit = 0
      const N = 20000
      const rng = createRng(11)
      for (let i = 0; i < N; i++) if (rollEvent(make({ age: 17 }, mode), rng)) hit++
      return hit / N
    }
    expect(Math.abs(rate('tutorial') - 0.5775)).toBeLessThan(0.02)
    expect(Math.abs(rate('standard') - 0.35)).toBeLessThan(0.02)
    expect(Math.abs(rate('precise') - 0.1338)).toBeLessThan(0.02)
  })

  it('컨디션이 낮으면 슬럼프·부상이 자주 나온다', () => {
    let bad = 0
    let total = 0
    const rng = createRng(3)
    for (let i = 0; i < 5000; i++) {
      const e = rollEvent(make({ age: 22, condition: 10 }, 'tutorial'), rng)
      if (e) {
        total++
        if (e.id.startsWith('slump') || e.id === 'injury') bad++
      }
    }
    expect(bad / total).toBeGreaterThan(0.5)
  })

  it('같은 게임·같은 턴이면 같은 결과', () => {
    const s = make({ age: 17, turnCount: 4 }, 'tutorial')
    expect(rollEvent(s, turnRng(s))?.id).toBe(rollEvent(s, turnRng(s))?.id)
  })

  it('끝난 판에서는 이벤트가 나오지 않는다', () => {
    expect(rollEvent(make({ finished: 'hobbyist' }), () => 0)).toBeNull()
  })
})

describe('applyEventChoice', () => {
  it('기획서 예시: 속마음을 털어놓으면 멘탈 +150(성장 속도 반영), 컨디션 +10, 돈 +5', () => {
    const s = make({ age: 17, condition: 50, money: 0, stats: { ...FLAT, mental: 200 } })
    const after = applyEventChoice(s, byId('parents_mental_care'), 0)
    expect(after.stats.mental).toBeCloseTo(200 + 150 * rules.growthRate)
    expect(after.condition).toBe(60)
    expect(after.money).toBe(5)
  })

  it('범위를 넘지 않는다 (능력치 0~1000, 컨디션 0~100, 돈·명성 0 이상)', () => {
    const s = make({ condition: 98, money: 3, stats: { ...FLAT, accuracy: 0.5, mental: 995 } })
    expect(applyEventChoice(s, byId('power_outage'), 0).condition).toBe(100)
    expect(applyEventChoice(s, byId('equipment_broken'), 0).money).toBe(0)
    expect(applyEventChoice(s, byId('equipment_broken'), 1).stats.accuracy).toBe(0)
    expect(applyEventChoice(s, byId('fan_letter'), 0).stats.mental).toBeCloseTo(1000, 0)
  })

  it('없는 선택지는 거부한다', () => {
    expect(() => applyEventChoice(make(), byId('slump'), 5)).toThrow()
  })

  it('슬럼프: 성장이 절반이 되고 턴이 지나면 줄어든다', () => {
    const slumped = applyEventChoice(make({ age: 20, condition: 20 }), byId('slump'), 0)
    expect(slumped.slumpMonths).toBeCloseTo(3 * slumpDurationFactor(100))
    const base = make({ age: 20, condition: 100, seasonTraining: 'video_review' })
    const normal = applyTurn(base, [{ id: 'video_review' }, { id: 'rest' }])
    const slump = applyTurn({ ...base, slumpMonths: 6 }, [{ id: 'video_review' }, { id: 'rest' }])
    if (!normal.ok || !slump.ok) throw new Error('turn failed')
    expect(slump.delta.stats.judgment).toBeCloseTo(normal.delta.stats.judgment / 2)
    expect(slump.state.slumpMonths).toBe(3)
  })

  it('부상: 휴식만 할 수 있고, 시간이 지나면 풀린다', () => {
    const hurt = applyEventChoice(make({ age: 20, condition: 20 }), byId('injury'), 0)
    expect(hurt.injuredMonths).toBe(3)
    expect(applyTurn(hurt, [{ id: 'basics' }, { id: 'rest' }]).ok).toBe(false)
    const r = applyTurn(hurt, [{ id: 'rest' }, { id: 'rest' }])
    if (!r.ok) throw new Error(r.error)
    expect(r.state.injuredMonths).toBe(0)
  })
})
