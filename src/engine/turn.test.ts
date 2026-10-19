import { describe, expect, it } from 'vitest'
import modes from '../data/modes.json'
import rules from '../data/rules.json'
import { equipmentCost } from './economy.ts'
import { conditionCoef, conditionTier, equipmentEfficiency, growthDelta } from './growth.ts'
import { settleSeason } from './season.ts'
import { createInitialState, type GameState, type ModeId } from './state.ts'
import { applyTurn, buyEquipment, eventChance, isCareerOver, isRepeatable, startNextSeason, turnScale, turnsPerSeason, type TurnChoice } from './turn.ts'
import { chooseSeasonTraining, TRAINING_POOL } from './training.ts'
import type { GenreId, Stats } from './types.ts'

const TEAM = { id: 'org_0', name: '나이트호크' }
const FLAT: Stats = { reaction: 100, accuracy: 100, focus: 100, judgment: 100, mental: 100, teamwork: 100 }

function make(overrides: Partial<GameState> = {}, genre: GenreId = 'fps', mode: ModeId = 'standard'): GameState {
  const base = createInitialState({
    name: '테스트',
    genre,
    mode,
    seed: 1,
    gacha: { stats: FLAT, trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power: 100 },
  })
  // 훈련은 시즌 초에 후보 중 하나를 정한다. 테스트에서는 각 테스트가 seasonTraining을 직접 정하고, 후보는 전체로 둔다
  return { ...base, trainingMenu: TRAINING_POOL, ...overrides }
}

function run(state: GameState, choice: TurnChoice) {
  const result = applyTurn(state, choice)
  if (!result.ok) throw new Error(result.error)
  return result
}

describe('성장 공식', () => {
  it('기획서 예시: 정확도 400, b=80, e=1.0, c=1.0, t=1.2 → 80 × 성장 속도 × 1.2 × 0.6^감쇠 지수', () => {
    const d = growthDelta({ base: 80, scale: 1, efficiency: 1, condition: 70, traitMultiplier: 1.2, current: 400 })
    expect(d).toBeCloseTo(80 * rules.growthRate * 1.2 * 0.6 ** rules.growthExponent)
  })

  it('컨디션 단계: 0~30 부진, 31~60 평범, 61~80 좋음, 81~100 완벽', () => {
    expect([0, 30].map((c) => conditionTier(c).label)).toEqual(['부진', '부진'])
    expect([31, 60].map((c) => conditionTier(c).label)).toEqual(['평범', '평범'])
    expect([61, 80].map((c) => conditionTier(c).label)).toEqual(['좋음', '좋음'])
    expect([81, 100].map((c) => conditionTier(c).label)).toEqual(['완벽', '완벽'])
    // 단계가 오를수록 훈련 성과가 좋아진다
    expect(conditionCoef(20)).toBeLessThan(conditionCoef(50))
    expect(conditionCoef(50)).toBeLessThan(conditionCoef(70))
    expect(conditionCoef(70)).toBeLessThan(conditionCoef(90))
    expect(conditionCoef(70)).toBe(1)
  })

  it('턴마다 컨디션이 조금씩 저절로 회복되고(턴 길이에 비례), 0~100을 넘지 않는다', () => {
    const rested = run(make({ age: 20, condition: 40 }), [{ id: 'part_time' }, { id: 'part_time' }])
    const noRecoveryExpected = 40 - 20 // 아르바이트 두 번의 컨디션 비용
    expect(rested.state.condition).toBeCloseTo(noRecoveryExpected + rules.conditionRecoveryPerBase)
    expect(run(make({ age: 20, condition: 99 }), [{ id: 'rest' }, { id: 'rest' }]).state.condition).toBe(100)
  })

  it('장비를 모두 최고 단계로 올리면 효율 1.2', () => {
    expect(equipmentEfficiency({ keyboard: 0, mouse: 0, monitor: 0, pc: 0 })).toBe(1)
    const max = rules.equipment.maxLevel
    expect(equipmentEfficiency({ keyboard: max, mouse: max, monitor: max, pc: max })).toBeCloseTo(1.2)
  })

  it('장비는 최고 10단계이고, 단계마다 가격이 2배로 오른다', () => {
    expect(rules.equipment.maxLevel).toBe(10)
    expect([0, 1, 2, 3].map((l) => equipmentCost('keyboard', l))).toEqual([5, 10, 20, 40])
    expect(equipmentCost('keyboard', 9)).toBe(5 * 2 ** 9)
    // 한 종류를 끝까지 올리는 비용은 첫 단계 가격의 약 2배^10
    const total = Array.from({ length: 10 }, (_, l) => equipmentCost('pc', l)).reduce((a, b) => a + b, 0)
    expect(total).toBe(15 * (2 ** 10 - 1))
  })
})

describe('턴 길이', () => {
  it('배율은 6개월 2, 3개월 1, 1개월 1/3', () => {
    expect(turnScale('tutorial')).toBe(2)
    expect(turnScale('standard')).toBe(1)
    expect(turnScale('precise')).toBeCloseTo(1 / 3)
  })

  it('이벤트 확률은 6개월 약 58%, 3개월 35%, 1개월 약 13%', () => {
    expect(eventChance('tutorial')).toBeCloseTo(0.5775, 3)
    expect(eventChance('standard')).toBeCloseTo(0.35, 3)
    expect(eventChance('precise')).toBeCloseTo(0.1338, 3)
  })

  it('같은 행동의 6개월 턴 효과는 3개월 턴의 2배다 (같은 능력치에서 시작할 때)', () => {
    const choice: TurnChoice = [{ id: 'video_review' }, { id: 'rest' }]
    const std = run(make({ age: 20, seasonTraining: 'video_review' }, 'fps', 'standard'), choice)
    const tut = run(make({ age: 20, seasonTraining: 'video_review' }, 'fps', 'tutorial'), choice)
    // 컨디션 계수가 둘 다 1.0이므로 정확히 2배 (튜토리얼은 입문용 성장 보너스가 붙는다)
    expect(tut.delta.stats.judgment).toBeCloseTo(std.delta.stats.judgment * 2 * modes.tutorial.growthBonus)
  })
})

describe('행동', () => {
  it('랭크전 연습은 장르 가중치 상위 3개 능력치를 올린다 (FPS: 정확도·반응속도 등)', () => {
    const r = run(make({ age: 20, seasonTraining: 'rank_practice' }), [{ id: 'rank_practice' }, { id: 'rest' }])
    expect(r.delta.stats.accuracy).toBeGreaterThan(0)
    expect(r.delta.stats.reaction).toBeGreaterThan(0)
    expect(r.delta.stats.judgment).toBe(0)
    const aos = run(make({ age: 20, seasonTraining: 'rank_practice' }, 'aos'), [{ id: 'rank_practice' }, { id: 'rest' }])
    expect(aos.delta.stats.judgment).toBeGreaterThan(0)
    expect(aos.delta.stats.teamwork).toBeGreaterThan(0)
    expect(aos.delta.stats.accuracy).toBe(0)
  })

  it('시작 특성은 해당 능력치만 1.2배로 키운다', () => {
    const r = run(make({ age: 20, seasonTraining: 'basics' }), [{ id: 'basics' }, { id: 'rest' }])
    // basics: 반응속도(특성 대상) 70, 정확도 50. 같은 s=100이므로 비율은 (70 × 1.2) ÷ 50
    expect(r.delta.stats.reaction / r.delta.stats.accuracy).toBeCloseTo((70 * 1.2) / 50)
  })

  it('훈련은 능력치를 세 개 올린다', () => {
    const r = run(make({ age: 20, seasonTraining: 'video_review' }), [{ id: 'video_review' }, { id: 'rest' }])
    const raised = Object.entries(r.delta.stats).filter(([k, v]) => v > 0 && k !== 'mental')
    expect(raised.length + (r.delta.stats.mental > 0 ? 1 : 0)).toBe(3)
  })

  it('시즌 훈련을 정하기 전에는 훈련을 고를 수 없고, 정한 훈련만 할 수 있다', () => {
    const s = make({ age: 20, trainingMenu: ['basics', 'video_review', 'aim_lab', 'concentration'] })
    expect(applyTurn(s, [{ id: 'basics' }, { id: 'rest' }]).ok).toBe(false)
    const chosen = chooseSeasonTraining(s, 'basics')
    expect(applyTurn(chosen, [{ id: 'basics' }, { id: 'rest' }]).ok).toBe(true)
    expect(applyTurn(chosen, [{ id: 'video_review' }, { id: 'rest' }]).ok).toBe(false)
    // 후보에 없는 훈련은 정할 수 없다
    expect(() => chooseSeasonTraining(s, 'sparring')).toThrow()
  })

  it('훈련 후보와 시즌 훈련은 시즌 동안 바뀌지 않고, 새 시즌이 시작되면 후보를 새로 뽑고 훈련을 다시 정한다', () => {
    const s = make({ age: 20, trainingMenu: ['basics', 'video_review', 'aim_lab', 'concentration'] })
    const chosen = chooseSeasonTraining(s, 'basics')
    const after = run(chosen, [{ id: 'basics' }, { id: 'rest' }]).state
    expect(after.trainingMenu).toEqual(chosen.trainingMenu)
    expect(after.seasonTraining).toBe('basics')
    const ended = { ...after, turnInSeason: turnsPerSeason(after.mode), history: [{ season: after.season, age: after.age, stage: after.stage, events: [] }] }
    const next = startNextSeason(ended)
    expect(next.seasonTraining).toBeNull()
    expect(next.trainingMenu).toHaveLength(rules.trainingMenuSize)
    expect(next.trainingMenu).not.toEqual(s.trainingMenu)
    // 같은 시드·같은 시즌이면 같은 후보
    expect(startNextSeason(ended).trainingMenu).toEqual(next.trainingMenu)
  })

  it('능력치가 높을수록 덜 오른다', () => {
    const low = run(make({ age: 20, seasonTraining: 'video_review' }), [{ id: 'video_review' }, { id: 'rest' }])
    const high = run(make({ age: 20, seasonTraining: 'video_review', stats: { ...FLAT, judgment: 800 } }), [{ id: 'video_review' }, { id: 'rest' }])
    expect(high.delta.stats.judgment).toBeLessThan(low.delta.stats.judgment)
  })

  it('컨디션이 낮으면 성장이 줄고, 컨디션은 0~100을 벗어나지 않는다', () => {
    const fresh = run(make({ age: 20, condition: 100, seasonTraining: 'video_review' }), [{ id: 'video_review' }, { id: 'rest' }])
    const tired = run(make({ age: 20, condition: 20, seasonTraining: 'video_review' }), [{ id: 'video_review' }, { id: 'rest' }])
    expect(tired.delta.stats.judgment).toBeLessThan(fresh.delta.stats.judgment)
    expect(fresh.state.condition).toBeLessThanOrEqual(100)
    const crash = run(make({ age: 20, condition: 5, seasonTraining: 'rank_practice' }), [{ id: 'rank_practice' }, { id: 'part_time' }])
    expect(crash.state.condition).toBeCloseTo(rules.conditionRecoveryPerBase) // 바닥까지 떨어진 뒤 턴 회복분만 남는다
  })

  it('두 번째 행동은 첫 번째 행동으로 줄어든 컨디션 기준으로 계산한다', () => {
    // 컨디션 85(완벽 ×1.15)에서 랭크전을 하면 70(좋음 ×1.0)이 되어, 뒤에 하는 개인 레슨은 처음부터 하는 것보다 덜 오른다
    const o = { age: 20, condition: 85, money: 1000, seasonTraining: 'rank_practice' as const }
    const both = run(make(o), [{ id: 'rank_practice' }, { id: 'private_lesson' }])
    const rankOnly = run(make(o), [{ id: 'rank_practice' }, { id: 'rest' }])
    const lessonFresh = run(make(o), [{ id: 'private_lesson' }, { id: 'rest' }])
    expect(both.delta.stats.accuracy - rankOnly.delta.stats.accuracy).toBeLessThan(lessonFresh.delta.stats.accuracy)
  })

  it('시즌 훈련은 두 칸에 모두 넣을 수 있고, 개인 레슨 같은 특별 훈련은 한 턴에 한 번만 된다', () => {
    const s = make({ age: 20, money: 1000, seasonTraining: 'rank_practice' })
    expect(applyTurn(s, [{ id: 'rank_practice' }, { id: 'rank_practice' }]).ok).toBe(true)
    const twice = applyTurn(s, [{ id: 'private_lesson' }, { id: 'private_lesson' }])
    expect(twice.ok).toBe(false)
    expect(twice.ok === false && twice.error).toContain('한 번만')
    expect(isRepeatable('rank_practice')).toBe(true)
    expect(isRepeatable('private_lesson')).toBe(false)
    expect(isRepeatable('rest')).toBe(true)
  })
})

describe('조건과 비용', () => {
  it('팀 스크림은 팀 소속이 필요하고, 아르바이트는 팀 소속 전에만 가능하다', () => {
    expect(applyTurn(make({ age: 20, seasonTraining: 'team_scrim' }), [{ id: 'team_scrim' }, { id: 'rest' }]).ok).toBe(false)
    expect(applyTurn(make({ age: 20, team: TEAM, seasonTraining: 'team_scrim' }), [{ id: 'team_scrim' }, { id: 'rest' }]).ok).toBe(true)
    expect(applyTurn(make({ age: 20, team: TEAM }), [{ id: 'part_time' }, { id: 'rest' }]).ok).toBe(false)
  })

  it('방송은 명성 20 이상이 필요하다', () => {
    expect(applyTurn(make({ age: 20, fame: 19 }), [{ id: 'broadcast' }, { id: 'rest' }]).ok).toBe(false)
    const r = run(make({ age: 20, fame: 20 }), [{ id: 'broadcast' }, { id: 'rest' }])
    expect(r.delta.fame).toBeCloseTo(5)
    expect(r.delta.money).toBeCloseTo(10)
  })

  it('아르바이트는 3개월에 30만 원, 6개월에는 60만 원', () => {
    expect(run(make({ age: 20 }), [{ id: 'part_time' }, { id: 'rest' }]).delta.money).toBeCloseTo(30)
    expect(run(make({ age: 20 }, 'fps', 'tutorial'), [{ id: 'part_time' }, { id: 'rest' }]).delta.money).toBeCloseTo(60)
  })

  it('장비 구매는 돈만 쓰고 턴과 행동 칸을 쓰지 않는다', () => {
    const s = make({ age: 20, money: 50 })
    const r = buyEquipment(s, 'keyboard')
    if (!r.ok) throw new Error(r.error)
    expect(r.state.equipment.keyboard).toBe(1)
    expect(r.state.money).toBe(45)
    expect(r.state.turnCount).toBe(s.turnCount)
    expect(r.state.turnInSeason).toBe(s.turnInSeason)
  })

  it('장비는 턴 제한 없이 돈이 되는 만큼 연달아 살 수 있다 (시즌 시작 계획에서 한꺼번에 산다)', () => {
    const first = buyEquipment(make({ age: 20, money: 500 }), 'keyboard')
    if (!first.ok) throw new Error(first.error)
    const second = buyEquipment(first.state, 'mouse')
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.state.money).toBe(500 - 5 - 5)
  })

  it('돈이 부족하거나 최고 단계면 구매할 수 없다', () => {
    expect(buyEquipment(make({ age: 20, money: 5 }), 'pc').ok).toBe(false)
    const maxed = make({ age: 20, money: 9999999, equipment: { keyboard: 10, mouse: 0, monitor: 0, pc: 0 } })
    expect(buyEquipment(maxed, 'keyboard').ok).toBe(false)
  })

  it('실패한 선택은 상태를 바꾸지 않는다 (원본 불변)', () => {
    const s = make({ age: 20, seasonTraining: 'basics' })
    const copy = structuredClone(s)
    applyTurn(s, [{ id: 'team_scrim' }, { id: 'rest' }])
    run(s, [{ id: 'basics' }, { id: 'rest' }])
    expect(s).toEqual(copy)
  })
})

describe('학교와 부모님 (16~18세)', () => {
  it('18세까지는 컨디션 -10, 용돈 +5만 원이 붙고 19세부터는 사라진다', () => {
    const choice: TurnChoice = [{ id: 'rest' }, { id: 'rest' }]
    const hs = run(make({ age: 18, condition: 20 }), choice)
    const adult = run(make({ age: 19, condition: 20 }), choice)
    expect(hs.delta.money).toBeCloseTo(5)
    expect(adult.delta.money).toBe(0)
    expect(adult.delta.condition - hs.delta.condition).toBeCloseTo(10)
  })
})

describe('시즌 진행', () => {
  it('마지막 턴에서만 seasonEnded가 true이고, 결산 전에는 다음 턴을 못 한다', () => {
    let s = make({ age: 20 }, 'fps', 'tutorial') // 시즌당 2턴
    const first = run(s, [{ id: 'rest' }, { id: 'rest' }])
    expect(first.seasonEnded).toBe(false)
    const second = run(first.state, [{ id: 'rest' }, { id: 'rest' }])
    expect(second.seasonEnded).toBe(true)
    s = second.state
    expect(applyTurn(s, [{ id: 'rest' }, { id: 'rest' }]).ok).toBe(false)
    expect(() => startNextSeason(s)).toThrow() // 결산 전에는 넘어갈 수 없다
    const next = startNextSeason(settleSeason(s).state)
    expect(next.age).toBe(21)
    expect(next.season).toBe(2)
    expect(next.turnInSeason).toBe(0)
  })

  it('시즌이 끝나기 전에는 다음 시즌으로 넘어갈 수 없다', () => {
    expect(() => startNextSeason(make())).toThrow()
  })

  it('나이 곡선: 25세부터 피지컬(반응속도·정확도·집중)은 해마다 더 크게 내려가고 경험(판단력·멘탈·팀워크)은 오른다 — 매 턴 조금씩', () => {
    const { physical, experience } = rules.ageDecline
    const turns = turnsPerSeason('standard')
    const rest: TurnChoice = [{ id: 'rest' }, { id: 'rest' }]
    // 한 시즌을 쉬며 보낸 뒤의 능력치
    const season = (age: number) => {
      let s = make({ age })
      for (let i = 0; i < turns; i++) s = run(s, rest).state
      return s
    }
    const young = season(24)
    expect(young.stats.reaction).toBe(100)
    expect(young.stats.judgment).toBe(100)
    const old = season(25)
    expect(old.stats.reaction).toBeCloseTo(100 - physical.base)
    expect(old.stats.accuracy).toBeCloseTo(100 - physical.base)
    expect(old.stats.focus).toBeCloseTo(100 - physical.base)
    expect(old.stats.judgment).toBeCloseTo(100 + experience.perSeason)
    expect(old.stats.mental).toBeGreaterThan(100 + experience.perSeason) // 휴식이 멘탈을 올린다
    expect(old.stats.teamwork).toBeCloseTo(100 + experience.perSeason)
    // 첫 턴이 지났을 때는 한 해치의 일부만 반영되어 있다
    const first = run(make({ age: 25 }), rest).state
    expect(first.stats.reaction).toBeCloseTo(100 - physical.base / turns)
    // 나이가 들수록 하락폭이 커진다
    expect(season(28).stats.reaction).toBeCloseTo(100 - (physical.base + physical.step * 3))
    // 결산 뒤 다음 시즌으로 넘어갈 때는 따로 변하지 않는다
    const end = { ...old, history: [{ season: 1, age: 25, stage: 'basement' as const, events: [] }] }
    expect(startNextSeason(end).stats.reaction).toBe(end.stats.reaction)
  })

  it('30세 시즌이 끝나면 커리어가 끝난다', () => {
    expect(isCareerOver(make({ age: 30, turnInSeason: 3 }))).toBe(false)
    expect(isCareerOver(make({ age: 30, turnInSeason: 4 }))).toBe(true)
    expect(isCareerOver(make({ age: 29, turnInSeason: 4 }))).toBe(false)
  })

  it('모드별 최대 턴 수는 30·60·180이다 (15시즌)', () => {
    for (const [mode, expected] of [['tutorial', 30], ['standard', 60], ['precise', 180]] as const) {
      let s = make({}, 'fps', mode)
      let turns = 0
      while (!isCareerOver(s)) {
        const r = run(s, [{ id: 'rest' }, { id: 'rest' }])
        s = r.state
        turns++
        if (r.seasonEnded) {
          s = settleSeason(s).state
          if (!isCareerOver(s)) s = startNextSeason(s)
        }
      }
      expect(turns).toBe(expected)
    }
  })
})
