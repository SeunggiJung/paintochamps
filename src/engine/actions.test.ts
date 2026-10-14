import { describe, expect, it } from 'vitest'
import { createRng } from './rng.ts'
import { createInitialState, type GameState, type ModeId } from './state.ts'
import { applyTurn, checkSlot, type Slot, type TurnChoice } from './turn.ts'
import type { GenreId, Stats } from './types.ts'

const FLAT: Stats = { reaction: 300, accuracy: 300, focus: 300, judgment: 300, mental: 300, teamwork: 300 }

function make(o: Partial<GameState> = {}, mode: ModeId = 'standard', genre: GenreId = 'fps'): GameState {
  const base = createInitialState({
    name: '테스트',
    genre,
    mode,
    seed: 3,
    gacha: { stats: FLAT, trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power: 300 },
  })
  return { ...base, age: 21, condition: 60, money: 500, ...o }
}

const REST: Slot = { id: 'rest' }
function run(s: GameState, a: Slot, b: Slot = REST, rng?: () => number) {
  const r = applyTurn(s, [a, b], rng)
  if (!r.ok) throw new Error(r.error)
  return r
}
/** 항상 같은 값을 돌려주는 난수 (결과를 강제할 때 쓴다) */
const always = (v: number) => () => v

describe('스트레스 해소: 돈을 쓰고 회복한다', () => {
  it('친목 모임: 돈 10만 원으로 컨디션·멘탈·팀워크가 오르고 부작용은 없다', () => {
    const s = make({ condition: 40 })
    const r = run(s, { id: 'hangout' }, REST, always(0))
    expect(r.delta.money).toBeCloseTo(-10)
    expect(r.delta.stats.teamwork).toBeGreaterThan(0)
    expect(r.notes).toEqual([])
  })

  it('술자리는 휴식보다 컨디션이 더 오르지만 숙취 위험이 있고 방탕 게이지가 오른다', () => {
    const s = make({ condition: 30, fame: 10 })
    const lucky = run(s, { id: 'drink' }, { id: 'drink' }, always(0.99))
    const rest = run(s, REST, REST)
    expect(lucky.state.condition).toBeGreaterThan(rest.state.condition)
    expect(lucky.state.vice).toBeCloseTo(2)
    expect(lucky.notes).toEqual([])
    const unlucky = run(s, { id: 'drink' }, REST, always(0))
    expect(unlucky.notes[0]).toContain('숙취')
    expect(unlucky.state.fame).toBeLessThan(s.fame)
  })

  it('유흥은 비싸고 명성을 깎는 구설수 위험이 있다', () => {
    const s = make({ fame: 30 })
    const r = run(s, { id: 'nightlife' }, REST, always(0))
    expect(r.delta.money).toBeCloseTo(-40) // 30 + 구설수 10
    expect(r.state.fame).toBeCloseTo(22)
    expect(r.notes[0]).toContain('퍼졌다')
  })

  it('도박은 장기적으로 손해다 (기댓값이 음수)', () => {
    let total = 0
    const N = 20000
    const rng = createRng(5)
    for (let i = 0; i < N; i++) total += run(make({ money: 1000 }), { id: 'gamble' }, REST, rng).delta.money
    expect(total / N).toBeLessThan(-2)
  })

  it('도박은 크게 따는 날도 있다', () => {
    const r = run(make({ money: 100 }), { id: 'gamble' }, REST, always(0))
    expect(r.delta.money).toBeCloseTo(35) // -20 + 55
    expect(r.notes[0]).toContain('땄다')
  })

  it('돈이 모자라면 할 수 없다', () => {
    expect(checkSlot(make({ money: 5 }), { id: 'hangout' })).toContain('돈이 부족')
    expect(checkSlot(make({ money: 5 }), { id: 'donate' })).toContain('돈이 부족')
    expect(checkSlot(make({ money: 500 }), { id: 'hangout' })).toBeNull()
  })

  it('6개월 턴은 비용도 2배, 1개월 턴은 1/3배다', () => {
    expect(run(make({}, 'tutorial'), { id: 'hangout' }, REST, always(0)).delta.money).toBeCloseTo(-20)
    expect(run(make({}, 'precise'), { id: 'hangout' }, REST, always(0)).delta.money).toBeCloseTo(-10 / 3)
  })
})

describe('방탕 게이지(중독)', () => {
  it('술·유흥·도박을 안 하면 시간이 지나며 내려간다', () => {
    const r = run(make({ vice: 2 }), REST, REST)
    expect(r.state.vice).toBeCloseTo(1.5)
    expect(run(make({ vice: 0.2 }), REST, REST).state.vice).toBe(0)
  })

  it('게이지가 높을수록 숙취·구설수 확률이 올라간다', () => {
    const hits = (vice: number) => {
      let n = 0
      const rng = createRng(11)
      for (let i = 0; i < 8000; i++) if (run(make({ vice }), { id: 'drink' }, REST, rng).notes.some((x) => x.includes('숙취'))) n++
      return n / 8000
    }
    expect(hits(0)).toBeCloseTo(0.25, 1)
    expect(hits(3)).toBeCloseTo(0.25 + 0.24, 1)
  })

  it('한계(4)를 넘으면 중독 패널티가 붙는다', () => {
    const s = make({ vice: 5, condition: 70 })
    const r = run(s, REST, REST)
    expect(r.notes.some((n) => n.includes('중독'))).toBe(true)
    const clean = run(make({ vice: 0, condition: 70 }), REST, REST)
    expect(r.state.condition).toBeLessThan(clean.state.condition)
    expect(r.state.stats.mental).toBeLessThan(clean.state.stats.mental)
  })

  it('방탕 행동을 계속하면 게이지가 쌓여 중독에 이른다', () => {
    let s = make({ money: 5000, condition: 100 })
    for (let i = 0; i < 4; i++) s = run(s, { id: 'nightlife' }, { id: 'drink' }, always(0.99)).state
    expect(s.vice).toBeGreaterThanOrEqual(4)
  })
})

describe('기부·봉사', () => {
  it('돈 60만 원으로 명성 +8 (3개월 기준)', () => {
    const r = run(make({ fame: 10 }), { id: 'donate' })
    expect(r.delta.money).toBeCloseTo(-60)
    expect(r.delta.fame).toBeCloseTo(8)
  })

  it('돈이 없으면 기부할 수 없다', () => {
    expect(applyTurn(make({ money: 20 }), [{ id: 'donate' }, REST]).ok).toBe(false)
  })
})

describe('부상·슬럼프 대처 행동', () => {
  it('부상 중에는 휴식과 재활만 할 수 있다', () => {
    const hurt = make({ injuredMonths: 6 })
    expect(checkSlot(hurt, { id: 'basics' })).toContain('부상')
    expect(checkSlot(hurt, { id: 'gamble' })).toContain('부상')
    expect(checkSlot(hurt, { id: 'rest' })).toBeNull()
    expect(checkSlot(hurt, { id: 'rehab' })).toBeNull()
  })

  it('재활 치료는 부상 중에만 가능하고, 회복을 앞당긴다', () => {
    expect(checkSlot(make({ injuredMonths: 0 }), { id: 'rehab' })).toContain('부상 중에만')
    const hurt = make({ injuredMonths: 6 })
    const withRehab = run(hurt, { id: 'rehab' }, REST)
    const restOnly = run(hurt, REST, REST)
    expect(withRehab.state.injuredMonths).toBeLessThan(restOnly.state.injuredMonths)
    expect(withRehab.state.injuredMonths).toBeCloseTo(0) // 6 − 재활 3 − 한 턴(3개월)
    expect(restOnly.state.injuredMonths).toBeCloseTo(3)
  })

  it('멘탈 상담은 슬럼프 중에만 가능하고, 회복을 앞당긴다', () => {
    expect(checkSlot(make({ slumpMonths: 0 }), { id: 'counseling' })).toContain('슬럼프 중에만')
    const slump = make({ slumpMonths: 6 })
    const withCounsel = run(slump, { id: 'counseling' }, REST)
    const restOnly = run(slump, REST, REST)
    expect(withCounsel.state.slumpMonths).toBeLessThan(restOnly.state.slumpMonths)
    expect(withCounsel.state.stats.mental).toBeGreaterThan(restOnly.state.stats.mental)
  })
})

describe('정밀 모드 전용 행동 (선택지가 더 많고 함정도 많다)', () => {
  const only = ['overtrain', 'meditation', 'impulse_shopping', 'community_flame', 'all_night_gaming'] as const

  it('정밀 모드에서만 할 수 있다', () => {
    for (const id of only) {
      expect(checkSlot(make({}, 'precise'), { id })).toBeNull()
      expect(checkSlot(make({}, 'standard'), { id })).toContain('정밀 모드')
      expect(checkSlot(make({}, 'tutorial'), { id })).toContain('정밀 모드')
    }
  })

  it('강행군 훈련은 일반 훈련보다 많이 오르지만 부상 위험이 있다', () => {
    const s = make({ condition: 100 }, 'precise')
    const hard = run(s, { id: 'overtrain' }, REST, always(0.99))
    const normal = run(s, { id: 'rank_practice' }, REST, always(0.99))
    expect(hard.delta.stats.accuracy).toBeGreaterThan(normal.delta.stats.accuracy)
    const hurt = run(s, { id: 'overtrain' }, REST, always(0))
    expect(hurt.state.injuredMonths).toBeGreaterThan(0)
  })

  it('함정 행동은 얻는 것이 거의 없다 (같은 칸에 훈련을 하는 쪽이 낫다)', () => {
    const s = make({ condition: 100 }, 'precise')
    const train = run(s, { id: 'basics' }, REST, always(0.99))
    for (const id of ['impulse_shopping', 'community_flame', 'all_night_gaming'] as const) {
      const trap = run(s, { id }, REST, always(0.99))
      expect(trap.state.stats.reaction + trap.state.stats.accuracy).toBeLessThan(train.state.stats.reaction + train.state.stats.accuracy)
    }
  })
})

describe('결과 재현성', () => {
  it('난수를 넘기지 않으면 같은 상태·같은 선택에서 항상 같은 결과가 나온다', () => {
    const s = make({ vice: 1 })
    const a = applyTurn(s, [{ id: 'gamble' }, { id: 'drink' }])
    const b = applyTurn(s, [{ id: 'gamble' }, { id: 'drink' }])
    expect(a).toEqual(b)
  })

  it('실패한 선택은 상태를 바꾸지 않는다', () => {
    const s = make({ money: 3 })
    const copy = structuredClone(s)
    applyTurn(s, [{ id: 'donate' }, REST])
    expect(s).toEqual(copy)
  })
})

describe('TurnChoice 타입', () => {
  it('같은 행동을 두 번 골라도 된다', () => {
    const c: TurnChoice = [{ id: 'hangout' }, { id: 'hangout' }]
    expect(applyTurn(make(), c).ok).toBe(true)
  })
})
