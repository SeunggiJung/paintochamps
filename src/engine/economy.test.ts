import { describe, expect, it } from 'vitest'
import { advanceCalendar } from './calendar.ts'
import { equipmentCost, moneyScale, salaryFameMultiplier } from './economy.ts'
import { availableChoices, EVENTS } from './events.ts'
import { createInitialState, type GameState, type StageId } from './state.ts'
import { proOrgs } from './field.ts'
import { salaryOf, teamProfile } from './teams.ts'
import { applyTurn, checkSlot, moneyCostOf } from './turn.ts'
import { formatMoney, formatMoneyDelta } from '../ui/format.ts'
import type { Stats } from './types.ts'

const stats = (v: number): Stats => ({ reaction: v, accuracy: v, focus: v, judgment: v, mental: v, teamwork: v })

function make(stage: StageId, o: Partial<GameState> = {}): GameState {
  const base = createInitialState({
    name: '테스트',
    genre: 'fps',
    mode: 'standard',
    seed: 5,
    gacha: { stats: stats(600), trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power: 600 },
  })
  return { ...base, age: 24, stage, team: stage === 'basement' || stage === 'local_cup' ? null : proOrgs('fps')[0], condition: 70, money: 1_000_000, trainingMenu: ['basics', 'aim_lab', 'video_review'], ...o }
}

describe('돈의 규모 (소속 단계에 따라 커진다)', () => {
  it('단계가 오를수록 규모 배율이 커진다', () => {
    const scales = (['basement', 'local_cup', 'amateur_team', 'pro2', 'pro1'] as StageId[]).map(moneyScale)
    expect(scales).toEqual([...scales].sort((a, b) => a - b))
    expect(moneyScale('pro1')).toBeGreaterThan(moneyScale('pro2'))
    expect(moneyScale('basement')).toBe(1)
  })

  it('훈련·친목·기부 같은 돈 쓰는 행동의 비용이 소속 단계에 따라 달라진다', () => {
    const cost = (stage: StageId, id: 'private_lesson' | 'hangout' | 'donate') => moneyCostOf(make(stage), id)
    for (const id of ['private_lesson', 'hangout', 'donate'] as const) {
      expect(cost('amateur_team', id)).toBe(cost('basement', id) * moneyScale('amateur_team'))
      expect(cost('pro1', id)).toBeGreaterThan(cost('pro2', id))
      expect(cost('pro2', id)).toBeGreaterThan(cost('amateur_team', id))
    }
  })

  it('돈이 모자라면 규모가 커진 비용 기준으로 막히고, 실제로 그만큼 빠져나간다', () => {
    const pro1 = make('pro1', { money: 100 })
    expect(checkSlot(pro1, { id: 'private_lesson' })).toContain('돈이 부족')
    const rich = make('pro1', { money: 100_000 })
    const r = applyTurn(rich, [{ id: 'private_lesson' }, { id: 'rest' }], undefined, false)
    if (!r.ok) throw new Error(r.error)
    const expected = moneyCostOf(rich, 'private_lesson')
    expect(rich.money - r.state.money + salaryOf(rich)).toBeCloseTo(expected, 0)
  })

  it('이벤트의 돈 조건과 금액도 같은 규모를 따른다', () => {
    const counseling = EVENTS.find((e) => e.id === 'slump')!
    const idx = counseling.choices.findIndex((c) => c.requires?.minMoney !== undefined)
    const need = counseling.choices[idx].requires!.minMoney!
    expect(availableChoices(make('basement', { money: need }), counseling)).toContain(idx)
    expect(availableChoices(make('pro1', { money: need }), counseling)).not.toContain(idx)
    expect(availableChoices(make('pro1', { money: need * moneyScale('pro1') }), counseling)).toContain(idx)
  })

  it('대회 상금도 소속 단계의 규모로 커진다', () => {
    const prize = (stage: StageId) => advanceCalendar(make(stage, { stats: stats(900) }), 1).beats.filter((b) => b.kind === 'end').reduce((sum, b) => sum + (b.kind === 'end' ? b.money : 0), 0)
    expect(prize('pro1')).toBeGreaterThan(prize('pro2'))
  })
})

describe('장비와 월급', () => {
  it('장비 가격은 레벨마다 2배', () => {
    expect([0, 1, 2, 3, 4].map((l) => equipmentCost('mouse', l))).toEqual([5, 10, 20, 40, 80])
  })

  it('월급은 실제 프로 연봉에 가까운 규모이고(프로 1부 연 1억 이상), 명성이 높을수록 오른다', () => {
    const team = proOrgs('fps')[0]
    const amateur = teamProfile(5, 5, team, 'amateur_team')!.salary
    const pro2 = teamProfile(5, 5, team, 'pro2')!.salary
    const pro1 = teamProfile(5, 5, team, 'pro1')!.salary
    expect(amateur).toBeLessThan(pro2)
    expect(pro2).toBeLessThan(pro1)
    expect(pro1 * 4).toBeGreaterThanOrEqual(8_000) // 연 8천만 원 이상 (명성 0 약팀 기준)
    expect(salaryOf(make('pro1', { fame: 300 }))).toBeGreaterThan(salaryOf(make('pro1', { fame: 0 })))
    expect(salaryFameMultiplier(0)).toBe(1)
  })
})

describe('돈 표기', () => {
  it('만 원과 억 단위로 읽기 쉽게 보여 준다', () => {
    expect(formatMoney(320)).toBe('320만')
    expect(formatMoney(12_500)).toBe('1억 2,500만')
    expect(formatMoney(30_000)).toBe('3억')
    expect(formatMoneyDelta(-1200)).toBe('-1,200만')
    expect(formatMoneyDelta(45)).toBe('+45만')
  })
})
