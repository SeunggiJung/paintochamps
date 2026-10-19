import { describe, expect, it } from 'vitest'
import rules from '../data/rules.json'
import { applyEffects, slumpDurationFactor } from './effects.ts'
import { applyEventChoice, availableChoices, checkChance, choiceOutcomes, EVENTS, isEligible } from './events.ts'
import { createRng } from './rng.ts'
import { createInitialState, type GameState } from './state.ts'
import type { Stats } from './types.ts'

// 이벤트가 직접 바꾸는 능력치는 훈련과 같은 성장 속도를 곱해서 반영된다
const RATE = rules.growthRate

const TEAM = { id: 'org_0', name: '나이트호크' }

function stats(mental: number): Stats {
  return { reaction: 400, accuracy: 400, focus: 400, judgment: 400, mental, teamwork: 400 }
}

function make(mental: number, o: Partial<GameState> = {}): GameState {
  return {
    ...createInitialState({
      name: '테스트',
      genre: 'fps',
      mode: 'standard',
      seed: 9,
      gacha: { stats: stats(mental), trait: { id: 'grit', name: '끈기', stat: 'focus' }, grade: 'R', power: 400 },
    }),
    age: 22,
    money: 100,
    condition: 20,
    ...o,
  }
}

const byId = (id: string) => EVENTS.find((e) => e.id === id)!

describe('멘탈이 슬럼프 기간을 바꾼다', () => {
  it('멘탈이 높을수록 같은 슬럼프도 빨리 끝난다', () => {
    expect(slumpDurationFactor(0)).toBeCloseTo(1.4)
    expect(slumpDurationFactor(500)).toBeCloseTo(1.0)
    expect(slumpDurationFactor(1000)).toBeCloseTo(0.6)
    const low = applyEffects(make(100), { slumpMonths: 6 })
    const high = applyEffects(make(900), { slumpMonths: 6 })
    expect(high.slumpMonths).toBeLessThan(low.slumpMonths)
    expect(low.slumpMonths).toBeCloseTo(6 * 1.32)
    expect(high.slumpMonths).toBeCloseTo(6 * 0.68)
  })

  it('이미 슬럼프라면 더 긴 쪽이 유지된다 (겹쳐도 합쳐지지 않는다)', () => {
    const s = applyEffects(make(500, { slumpMonths: 5 }), { slumpMonths: 3 })
    expect(s.slumpMonths).toBe(5)
  })
})

describe('능력치 판정: 실력이 대처 성공을 좌우한다', () => {
  const grit = byId('slump').choices[1] // 이를 악물고 버틴다 (멘탈 판정)

  it('성공 확률은 능력치 ÷ 1000이고 5~95%로 제한된다', () => {
    expect(checkChance(make(700), grit)).toBeCloseTo(0.7)
    expect(checkChance(make(10), grit)).toBeCloseTo(0.05)
    expect(checkChance(make(1000), grit)).toBeCloseTo(0.95)
  })

  it('결과 두 가지와 확률을 미리 볼 수 있다', () => {
    const out = choiceOutcomes(make(600), byId('slump'), 1)
    expect(out).toHaveLength(2)
    expect(out[0].chance + out[1].chance).toBeCloseTo(1)
    expect(out[0].chance).toBeCloseTo(0.6)
  })

  it('멘탈이 높은 선수는 버티기에 자주 성공해 슬럼프가 짧아지고, 낮은 선수는 길어진다', () => {
    const avgSlump = (mental: number) => {
      const rng = createRng(21)
      let total = 0
      const N = 4000
      for (let i = 0; i < N; i++) total += applyEventChoice(make(mental), byId('slump'), 1, rng).slumpMonths
      return total / N
    }
    expect(avgSlump(850)).toBeLessThan(avgSlump(150) - 2)
  })

  it('실패하면 멘탈이 깎이고, 성공하면 멘탈이 오른다', () => {
    const win = applyEventChoice(make(500), byId('slump'), 1, () => 0)
    const lose = applyEventChoice(make(500), byId('slump'), 1, () => 0.99)
    expect(win.stats.mental).toBeCloseTo(500 + 30 * RATE)
    expect(lose.stats.mental).toBeCloseTo(500 - 20 * RATE)
    expect(win.slumpMonths).toBeLessThan(lose.slumpMonths)
  })

  it('난수를 안 넘겨도 같은 상태면 같은 결과다', () => {
    const s = make(500)
    expect(applyEventChoice(s, byId('slump'), 1)).toEqual(applyEventChoice(s, byId('slump'), 1))
  })
})

describe('선택지 조건: 팀·돈이 대처 수단이 된다', () => {
  it('팀원에게 털어놓기는 팀 소속일 때만, 상담은 돈이 있을 때만 고를 수 있다', () => {
    const e = byId('slump')
    expect(availableChoices(make(300, { team: null, money: 0 }), e)).toEqual([0, 1])
    expect(availableChoices(make(300, { team: TEAM, money: 0 }), e)).toEqual([0, 1, 2])
    expect(availableChoices(make(300, { team: null, money: 50 }), e)).toEqual([0, 1, 3])
    expect(availableChoices(make(300, { team: TEAM, money: 50 }), e)).toEqual([0, 1, 2, 3])
  })

  it('고를 수 없는 선택지를 적용하려 하면 거부한다', () => {
    expect(() => applyEventChoice(make(300, { team: null }), byId('slump'), 2)).toThrow()
  })

  it('돈이 있어 전문가 상담을 받으면, 혼자 쉬는 것보다 슬럼프가 훨씬 짧다', () => {
    const alone = applyEventChoice(make(300), byId('slump'), 0)
    const counsel = applyEventChoice(make(300), byId('slump'), 3)
    expect(counsel.slumpMonths).toBeLessThan(alone.slumpMonths)
    expect(counsel.money).toBe(90)
  })
})

describe('부상: 대처에 따라 실력이 영구히 달라진다', () => {
  const injury = byId('injury')

  it('참고 계속하면 부상이 길어지고 반응속도·정확도가 영구히 깎인다', () => {
    const s = make(500)
    const ignore = applyEventChoice(s, injury, 2)
    expect(ignore.injuredMonths).toBe(6)
    expect(ignore.stats.reaction).toBeCloseTo(s.stats.reaction - 30 * RATE)
    expect(ignore.stats.accuracy).toBeCloseTo(s.stats.accuracy - 30 * RATE)
  })

  it('병원 치료는 돈이 들지만 실력 손실이 없고 가장 빨리 낫는다', () => {
    const s = make(500)
    const hospital = applyEventChoice(s, injury, 0)
    expect(hospital.money).toBe(s.money - 10)
    expect(hospital.injuredMonths).toBe(3)
    expect(hospital.stats.reaction).toBe(s.stats.reaction)
  })

  it('돈이 없으면 병원 치료를 고를 수 없다', () => {
    expect(availableChoices(make(500, { money: 5 }), injury)).toEqual([1, 2])
  })

  it('재활 운동은 멘탈 판정이다: 성공하면 3개월, 실패하면 5개월에 능력치 손실', () => {
    const s = make(500)
    const win = applyEventChoice(s, injury, 1, () => 0)
    const lose = applyEventChoice(s, injury, 1, () => 0.99)
    expect(win.injuredMonths).toBe(3)
    expect(win.stats.reaction).toBe(s.stats.reaction)
    expect(lose.injuredMonths).toBe(5)
    expect(lose.stats.reaction).toBeCloseTo(s.stats.reaction - 15 * RATE)
  })

  it('대처를 잘하는 선수와 못하는 선수의 장기 실력 차이가 난다 (코호트 비교)', () => {
    // 같은 부상 이벤트를 100번씩: 병원(돈 있음) 선택 vs 참고 계속 선택
    const total = (choice: number) => {
      let sum = 0
      for (let i = 0; i < 100; i++) {
        const after = applyEventChoice(make(500), injury, choice, createRng(i))
        sum += after.stats.reaction + after.stats.accuracy - after.injuredMonths * 5
      }
      return sum / 100
    }
    expect(total(0)).toBeGreaterThan(total(2) + 25)
  })
})

describe('방탕 중독 이벤트', () => {
  const e = byId('addiction_warning')

  it('방탕 게이지가 3 이상일 때만 나온다', () => {
    expect(isEligible(make(500, { vice: 2.9 }), e)).toBe(false)
    expect(isEligible(make(500, { vice: 3 }), e)).toBe(true)
  })

  it('끊는 데 성공하면 게이지가 0으로, 실패하면 거의 그대로이고 몸이 상한다', () => {
    const s = make(500, { vice: 4, condition: 60 })
    const win = applyEventChoice(s, e, 0, () => 0)
    const lose = applyEventChoice(s, e, 0, () => 0.99)
    expect(win.vice).toBe(0)
    expect(lose.vice).toBeCloseTo(3.5)
    expect(lose.condition).toBe(50)
  })

  it('전문가의 도움은 멘탈과 상관없이 게이지를 확실히 낮춘다', () => {
    const s = make(100, { vice: 4 })
    expect(applyEventChoice(s, e, 1).vice).toBeCloseTo(1)
  })
})

describe('기부 이벤트', () => {
  it('명성 15, 돈 20 이상이면 나오고, 크게 후원하려면 돈 50이 필요하다', () => {
    const e = byId('charity_event')
    expect(isEligible(make(500, { fame: 10, money: 100 }), e)).toBe(false)
    expect(isEligible(make(500, { fame: 20, money: 100 }), e)).toBe(true)
    expect(availableChoices(make(500, { fame: 20, money: 30 }), e)).toEqual([1, 2])
    const donated = applyEventChoice(make(500, { fame: 20, money: 100 }), e, 0)
    expect(donated.money).toBe(50)
    expect(donated.fame).toBe(30)
  })
})

describe('유혹 이벤트는 2회차부터', () => {
  it('튜토리얼에서는 술자리·도박·중독 이벤트가 나오지 않고, 표준·정밀에서는 나온다', () => {
    const base = { age: 22, money: 100, vice: 4 }
    for (const id of ['party_invite', 'gambling_tip', 'addiction_warning']) {
      expect(isEligible({ ...make(500, base), mode: 'tutorial' }, byId(id))).toBe(false)
      expect(isEligible({ ...make(500, base), mode: 'standard' }, byId(id))).toBe(true)
    }
  })
})

describe('유혹 이벤트', () => {
  it('술자리: 멘탈이 높으면 절제에 성공해 팀워크만 얻고, 낮으면 실수한다', () => {
    const e = byId('party_invite')
    const s = make(500, { condition: 60, vice: 0 })
    const win = applyEventChoice(s, e, 1, () => 0)
    const lose = applyEventChoice(s, e, 1, () => 0.99)
    expect(win.vice).toBe(0)
    expect(lose.vice).toBe(1)
    expect(win.condition).toBeGreaterThan(lose.condition)
  })

  it('도박 제안: 거절하면 아무 손해가 없고, 응하면 대개 잃는다', () => {
    const e = byId('gambling_tip')
    const s = make(500, { money: 100 })
    expect(applyEventChoice(s, e, 1).money).toBe(100)
    let sum = 0
    const rng = createRng(2)
    for (let i = 0; i < 4000; i++) sum += applyEventChoice(s, e, 0, rng).money - 100
    expect(sum / 4000).toBeLessThan(0)
  })
})
