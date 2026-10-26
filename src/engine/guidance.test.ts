import { describe, expect, it } from 'vitest'
import { conditionWarning, nextGoal, focusStat, leagueReason, offerVerdict, trainingBalance } from './guidance.ts'
import { TRAINING_POOL, trainingGains } from './training.ts'
import type { RunRecord } from './state.ts'
import { createInitialState, type GameState } from './state.ts'

const stats = { reaction: 100, accuracy: 100, focus: 100, judgment: 100, mental: 100, teamwork: 100 }
const make = (o: Partial<GameState> = {}): GameState => ({
  ...createInitialState({ name: '테스트', genre: 'fps', mode: 'standard', seed: 3, gacha: { stats, trait: { id: 'grit', name: '끈기', stat: 'focus' }, grade: 'R', power: 100 } }),
  ...o,
})

describe('nextGoal (결산의 다음 목표)', () => {
  it('끝난 판에는 목표가 없다', () => {
    expect(nextGoal(make({ finished: 'legend' }))).toBeNull()
  })
  it('단계마다 다음 목표 제목이 다르다', () => {
    const titles = (['basement', 'local_cup', 'amateur_team', 'pro2', 'pro1'] as const).map((stage) => nextGoal(make({ stage }))!.title)
    expect(new Set(titles).size).toBe(5)
  })
  it('프로 2부는 콜업 기준 실력치와 부족한 양을 알려 준다', () => {
    const low = nextGoal(make({ stage: 'pro2' }))!
    expect(low.lines[0]).toContain('250')
    expect(low.lines[0]).toContain('부족')
    const high = nextGoal(make({ stage: 'pro2', stats: { ...stats, reaction: 900, accuracy: 900, focus: 900, judgment: 900, mental: 900, teamwork: 900 } }))!
    expect(high.lines[0]).toContain('충족')
  })
  it('프로 1부는 국제전 상대와의 격차와 월드 진출 길을 알려 준다', () => {
    const fps = nextGoal(make({ stage: 'pro1' }))!
    expect(fps.lines.join(' ')).toMatch(/부족/)
    expect(fps.lines.join(' ')).toMatch(/포인트/)
    const aos = nextGoal(make({ stage: 'pro1', genre: 'aos' }))!
    expect(aos.lines.join(' ')).toMatch(/MSI/)
    expect(aos.lines.join(' ')).not.toMatch(/[{}]/)
  })
  it('25세부터는 경험 능력치로 보완하라는 안내가 붙는다', () => {
    expect(nextGoal(make({ stage: 'pro1', age: 24 }))!.lines.join(' ')).not.toContain('피지컬이 해마다')
    expect(nextGoal(make({ stage: 'pro1', age: 26 }))!.lines.join(' ')).toContain('피지컬이 해마다')
  })
  it('키울 능력치는 장르 비중이 크고 여유가 많은 것이다', () => {
    expect(focusStat(make({ genre: 'fps', stats: { ...stats, accuracy: 900 } }))).toBe('reaction')
  })
})

describe('leagueReason (리그 결과 분석)', () => {
  const run = (o: Partial<RunRecord>) => ({ id: 'x', name: '리그', placement: 4, fieldSize: 10, fame: 0, money: 0, order: [], expected: 4, strength: { mine: 600, avg: 500, top: 760 }, mid: null, table: [], advanced: [], revealed: 'end', ...o }) as RunRecord
  it('전력 정보가 없거나 리그가 아니면 null', () => {
    expect(leagueReason(run({ strength: undefined }))).toBeNull()
    expect(leagueReason(run({ table: null }))).toBeNull()
  })
  it('기대 순위보다 크게 낮으면 접전·운 탓으로 설명한다', () => {
    expect(leagueReason(run({ placement: 6 }))!.join(' ')).toMatch(/2계단 낮은 6위/)
    expect(leagueReason(run({ placement: 2 }))!.join(' ')).toMatch(/2계단 높은 2위/)
    expect(leagueReason(run({ placement: 5 }))!.join(' ')).toMatch(/비슷/)
  })
  it('팀 전력이 평균보다 낮으면 그 차이를 알려 준다', () => {
    expect(leagueReason(run({ strength: { mine: 400, avg: 500, top: 760 } }))!.join(' ')).toContain('100 낮아')
    expect(leagueReason(run({}))!.join(' ')).not.toContain('낮아 처음부터')
  })
})

describe('offerVerdict (이적 제안 추천/주의)', () => {
  it('월급이 내려가면 주의다', () => {
    const v = offerVerdict({ salaryDelta: -3000, boost: 20 })
    expect(v.level).toBe('caution')
    expect(v.salaryDrop).toBe(3000)
  })
  it('대회 전력이 크게 깎이면 월급이 올라도 주의다', () => {
    const v = offerVerdict({ salaryDelta: 500, boost: -80 })
    expect(v.level).toBe('caution')
    expect(v.weak).toBe(true)
  })
  it('월급이 오르고 대회 전력도 오르면 추천, 그 사이는 평범하다', () => {
    expect(offerVerdict({ salaryDelta: 100, boost: 30 }).level).toBe('good')
    expect(offerVerdict({ salaryDelta: 100, boost: 0 }).level).toBe('neutral')
    expect(offerVerdict({ salaryDelta: 0, boost: 0 }).salaryDrop).toBe(0)
  })
})

describe('conditionWarning (낮은 컨디션 경고)', () => {
  it('컨디션이 기준 이하이면 단계와 위험선을 알려 준다', () => {
    const w = conditionWarning({ condition: 20, injuredMonths: 0 })!
    expect(w.label).toBe('부진')
    expect(w.coef).toBe(0.5)
    expect(w.slumpAt).toBe(29)
    expect(w.injuryAt).toBe(34)
  })
  it('컨디션이 충분하거나 이미 부상 중이면 경고하지 않는다', () => {
    expect(conditionWarning({ condition: 70, injuredMonths: 0 })).toBeNull()
    expect(conditionWarning({ condition: 10, injuredMonths: 3 })).toBeNull()
  })
})

describe('trainingBalance (훈련 균형 경고)', () => {
  const lopsided = make({ stats: { reaction: 400, accuracy: 100, focus: 400, judgment: 400, mental: 400, teamwork: 400 } })
  const without = TRAINING_POOL.find((id) => !(trainingGains(lopsided, id).accuracy ?? 0))!
  const withIt = TRAINING_POOL.find((id) => (trainingGains(lopsided, id).accuracy ?? 0) > 0)!
  it('가장 뒤처진 능력치를 올려 주지 않는 훈련이면 경고하고, 올려 주는 후보를 알려 준다', () => {
    const b = trainingBalance(lopsided, without, [without, withIt])!
    expect(b.lagging).toBe('accuracy')
    expect(b.gap).toBe(300)
    expect(b.fixers).toEqual([withIt])
  })
  it('그 능력치를 올려 주는 훈련이거나 격차가 작으면 경고하지 않는다', () => {
    expect(trainingBalance(lopsided, withIt, [without, withIt])).toBeNull()
    expect(trainingBalance(make(), without, [without])).toBeNull()
  })
})
