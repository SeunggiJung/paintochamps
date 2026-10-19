import { describe, expect, it } from 'vitest'
import { autoTurn, DEFAULT_PLAN, planChoice, planOf, PRESETS, presetDef, setSeasonPlan, type PresetId } from './plan.ts'
import { bestGainKeys } from './turn.ts'
import { createInitialState, type GameState } from './state.ts'
import type { Stats } from './types.ts'

const stats = (v: number): Stats => ({ reaction: v, accuracy: v, focus: v, judgment: v, mental: v, teamwork: v })
const TEAM = { id: 'org_0', name: '나이트호크' }

function make(o: Partial<GameState> = {}): GameState {
  const base = createInitialState({
    name: '테스트',
    genre: 'fps',
    mode: 'standard',
    seed: 5,
    gacha: { stats: stats(300), trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power: 300 },
  })
  return { ...base, age: 21, condition: 80, money: 1000, seasonTraining: 'aim_lab', plan: { preset: 'balanced', lesson: false }, ...o }
}

const ids = (s: GameState) => planChoice(s).map((x) => x.id)
const withPreset = (preset: PresetId, o: Partial<GameState> = {}, lesson = false) => make({ plan: { preset, lesson }, ...o })

describe('개인 레슨', () => {
  it('핵심 능력치가 이미 높으면 낮은 능력치를 올린다', () => {
    const s = make()
    const low = bestGainKeys(s, 3, 70)
    const high = bestGainKeys({ ...s, stats: { ...s.stats, reaction: 990, accuracy: 990, focus: 990 } }, 3, 70)
    expect(low).toContain('accuracy')
    expect(high).not.toContain('accuracy')
  })
})

describe('시즌 계획 (자동 진행)', () => {
  it('방침이 4가지 있고 모든 방침의 마지막 단계는 컨디션 0 이상이라 어떤 컨디션에서도 행동이 정해진다', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['focus', 'balanced', 'care', 'money'])
    for (const p of PRESETS) expect(p.tiers[p.tiers.length - 1].min, p.id).toBe(0)
  })

  it('계획이 없으면(옛 세이브·새 판) 기본 계획(균형)을 쓴다', () => {
    expect(planOf({ plan: null })).toEqual(DEFAULT_PLAN)
    expect(planOf({ plan: { preset: 'care', lesson: true } }).preset).toBe('care')
  })

  it('균형: 컨디션이 좋으면 훈련 두 번, 보통이면 훈련+휴식, 나쁘면 휴식', () => {
    expect(ids(withPreset('balanced', { condition: 80 }))).toEqual(['aim_lab', 'aim_lab'])
    expect(ids(withPreset('balanced', { condition: 55 }))).toEqual(['aim_lab', 'rest'])
    expect(ids(withPreset('balanced', { condition: 20 }))).toEqual(['rest', 'rest'])
  })

  it('훈련 집중은 같은 컨디션에서 균형보다 훈련을 더 많이 한다', () => {
    expect(ids(withPreset('focus', { condition: 55 }))).toEqual(['aim_lab', 'aim_lab'])
    expect(ids(withPreset('balanced', { condition: 55 }))).toEqual(['aim_lab', 'rest'])
  })

  it('컨디션 관리는 컨디션이 최상일 때만 훈련을 두 번 하고 그 외에는 더 많이 쉰다', () => {
    expect(ids(withPreset('care', { condition: 90 }))).toEqual(['aim_lab', 'aim_lab'])
    expect(ids(withPreset('care', { condition: 70 }))).toEqual(['aim_lab', 'rest'])
    // 같은 컨디션 70에서 균형은 훈련을 두 번 한다
    expect(ids(withPreset('balanced', { condition: 70 }))).toEqual(['aim_lab', 'aim_lab'])
    expect(ids(withPreset('care', { condition: 50 }))).toEqual(['rest', 'rest'])
  })

  it('돈벌이 병행: 팀이 없으면 아르바이트, 팀에 소속되면 명성이 되는 경우에만 방송, 안 되면 훈련', () => {
    expect(ids(withPreset('money', { condition: 80 }))).toEqual(['aim_lab', 'part_time'])
    expect(ids(withPreset('money', { condition: 80, team: TEAM, fame: 30 }))).toEqual(['aim_lab', 'broadcast'])
    expect(ids(withPreset('money', { condition: 80, team: TEAM, fame: 0 }))).toEqual(['aim_lab', 'aim_lab'])
  })

  it('부상 중이면 계획과 상관없이 쉬면서 재활한다', () => {
    expect(ids(withPreset('focus', { injuredMonths: 6 }))).toEqual(['rest', 'rehab'])
    // 재활 치료는 돈이 필요해서, 돈이 없으면 쉬기만 한다
    expect(ids(withPreset('focus', { injuredMonths: 6, money: 0 }))).toEqual(['rest', 'rest'])
  })

  it('슬럼프면 쉬는 칸이 상담으로 바뀐다 (돈이 있을 때)', () => {
    expect(ids(withPreset('balanced', { slumpMonths: 6, condition: 50 }))).toEqual(['aim_lab', 'counseling'])
    expect(ids(withPreset('balanced', { slumpMonths: 6, condition: 50, money: 0 }))).toEqual(['aim_lab', 'rest'])
  })

  it('개인 레슨을 켜면 컨디션이 좋고 돈이 있을 때 훈련 한 칸이 레슨으로 바뀐다', () => {
    expect(ids(withPreset('balanced', { condition: 80 }, true))).toEqual(['aim_lab', 'private_lesson'])
    expect(ids(withPreset('balanced', { condition: 80, money: 0 }, true))).toEqual(['aim_lab', 'aim_lab'])
    expect(ids(withPreset('balanced', { condition: 30 }, true))).toEqual(['rest', 'rest'])
    // 레슨은 컨디션이 어느 정도 있어야 받는다 (컨디션 40은 훈련 한 번+휴식이라 레슨 없음)
    expect(ids(withPreset('balanced', { condition: 42 }, true))).toEqual(['aim_lab', 'rest'])
    expect(ids(withPreset('balanced', { condition: 80 }, false))).toEqual(['aim_lab', 'aim_lab'])
  })

  it('시즌 훈련을 아직 안 정했으면 훈련 칸은 쉬는 것이 된다', () => {
    expect(ids(withPreset('focus', { seasonTraining: null }))).toEqual(['rest', 'rest'])
  })

  it('autoTurn은 계획대로 한 턴을 진행하고, 실제로 한 행동을 돌려준다', () => {
    const s = make({ condition: 80 })
    const { result, choice } = autoTurn(s)
    expect(choice.map((c) => c.id)).toEqual(['aim_lab', 'aim_lab'])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.state.turnInSeason).toBe(s.turnInSeason + 1)
  })

  it('상태를 바꾸지 않고, 같은 상태면 같은 선택이 나온다', () => {
    const s = make()
    const before = JSON.stringify(s)
    expect(ids(s)).toEqual(ids(s))
    expect(JSON.stringify(s)).toBe(before)
  })

  it('setSeasonPlan은 계획만 바꾼 새 상태를 돌려준다', () => {
    const s = make()
    const next = setSeasonPlan(s, { preset: 'money', lesson: true })
    expect(next.plan).toEqual({ preset: 'money', lesson: true })
    expect(s.plan).toEqual({ preset: 'balanced', lesson: false })
    expect(presetDef('money').name).toBe('돈벌이 병행')
  })
})
