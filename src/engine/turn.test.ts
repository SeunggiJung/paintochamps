import { describe, expect, it } from 'vitest'
import { conditionCoef, equipmentEfficiency, growthDelta } from './growth.ts'
import { settleSeason } from './season.ts'
import { createInitialState, type GameState, type ModeId } from './state.ts'
import { applyTurn, eventChance, isCareerOver, startNextSeason, turnScale, type TurnChoice } from './turn.ts'
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
  return { ...base, ...overrides }
}

function run(state: GameState, choice: TurnChoice) {
  const result = applyTurn(state, choice)
  if (!result.ok) throw new Error(result.error)
  return result
}

describe('성장 공식', () => {
  it('기획서 예시: 정확도 400, b=80, e=1.0, c=1.0, t=1.2 → 57.6', () => {
    const d = growthDelta({ base: 80, scale: 1, efficiency: 1, condition: 100, traitMultiplier: 1.2, current: 400 })
    expect(d).toBeCloseTo(57.6)
  })

  it('컨디션 계수: 80 이상 1.0, 40 이하 0.5, 사이는 직선', () => {
    expect(conditionCoef(100)).toBe(1)
    expect(conditionCoef(80)).toBe(1)
    expect(conditionCoef(60)).toBeCloseTo(0.75)
    expect(conditionCoef(40)).toBe(0.5)
    expect(conditionCoef(0)).toBe(0.5)
  })

  it('장비를 모두 최고 단계로 올리면 효율 1.2', () => {
    expect(equipmentEfficiency({ keyboard: 0, mouse: 0, monitor: 0, pc: 0 })).toBe(1)
    expect(equipmentEfficiency({ keyboard: 3, mouse: 3, monitor: 3, pc: 3 })).toBeCloseTo(1.2)
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
    const std = run(make({ age: 20 }, 'fps', 'standard'), choice)
    const tut = run(make({ age: 20 }, 'fps', 'tutorial'), choice)
    // 영상 분석은 판단력 +100: 컨디션 계수가 둘 다 1.0이므로 정확히 2배
    expect(tut.delta.stats.judgment).toBeCloseTo(std.delta.stats.judgment * 2)
  })
})

describe('행동', () => {
  it('랭크전 연습은 장르 가중치 상위 2개 능력치를 올린다 (FPS: 정확도·반응속도)', () => {
    const r = run(make({ age: 20 }), [{ id: 'rank_practice' }, { id: 'rest' }])
    expect(r.delta.stats.accuracy).toBeGreaterThan(0)
    expect(r.delta.stats.reaction).toBeGreaterThan(0)
    expect(r.delta.stats.judgment).toBe(0)
    const aos = run(make({ age: 20 }, 'aos'), [{ id: 'rank_practice' }, { id: 'rest' }])
    expect(aos.delta.stats.judgment).toBeGreaterThan(0)
    expect(aos.delta.stats.teamwork).toBeGreaterThan(0)
    expect(aos.delta.stats.accuracy).toBe(0)
  })

  it('시작 특성은 해당 능력치만 1.2배로 키운다', () => {
    const r = run(make({ age: 20 }), [{ id: 'basics' }, { id: 'rest' }])
    // basics: 반응속도(특성 대상) +80, 정확도 +80. 같은 s=100이므로 비율이 정확히 1.2
    expect(r.delta.stats.reaction / r.delta.stats.accuracy).toBeCloseTo(1.2)
  })

  it('능력치가 높을수록 덜 오른다', () => {
    const low = run(make({ age: 20 }), [{ id: 'video_review' }, { id: 'rest' }])
    const high = run(make({ age: 20, stats: { ...FLAT, judgment: 800 } }), [{ id: 'video_review' }, { id: 'rest' }])
    expect(high.delta.stats.judgment).toBeLessThan(low.delta.stats.judgment)
  })

  it('컨디션이 낮으면 성장이 줄고, 컨디션은 0~100을 벗어나지 않는다', () => {
    const fresh = run(make({ age: 20, condition: 100 }), [{ id: 'video_review' }, { id: 'rest' }])
    const tired = run(make({ age: 20, condition: 20 }), [{ id: 'video_review' }, { id: 'rest' }])
    expect(tired.delta.stats.judgment).toBeLessThan(fresh.delta.stats.judgment)
    expect(fresh.state.condition).toBeLessThanOrEqual(100)
    const crash = run(make({ age: 20, condition: 5 }), [{ id: 'rank_practice' }, { id: 'rank_practice' }])
    expect(crash.state.condition).toBe(0)
  })

  it('두 번째 행동은 첫 번째 행동으로 줄어든 컨디션 기준으로 계산한다', () => {
    const r = run(make({ age: 20, condition: 80 }), [{ id: 'rank_practice' }, { id: 'rank_practice' }])
    const single = run(make({ age: 20, condition: 80 }), [{ id: 'rank_practice' }, { id: 'rest' }])
    // 첫 행동 뒤 컨디션 65 → 계수 약 0.81 이라 두 번째 랭크전 효과가 더 작다
    expect(r.delta.stats.accuracy).toBeLessThan(single.delta.stats.accuracy * 2)
  })
})

describe('조건과 비용', () => {
  it('팀 스크림은 팀 소속이 필요하고, 아르바이트는 팀 소속 전에만 가능하다', () => {
    expect(applyTurn(make({ age: 20 }), [{ id: 'team_scrim' }, { id: 'rest' }]).ok).toBe(false)
    expect(applyTurn(make({ age: 20, team: TEAM }), [{ id: 'team_scrim' }, { id: 'rest' }]).ok).toBe(true)
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

  it('장비 구매는 돈을 쓰고 행동 칸 하나를 차지한다', () => {
    const r = run(make({ age: 20, money: 50 }), [{ id: 'buy_equipment', item: 'keyboard' }, { id: 'rest' }])
    expect(r.state.equipment.keyboard).toBe(1)
    expect(r.state.money).toBe(40)
  })

  it('돈이 부족하거나 최고 단계면 구매할 수 없다', () => {
    expect(applyTurn(make({ age: 20, money: 5 }), [{ id: 'buy_equipment', item: 'pc' }, { id: 'rest' }]).ok).toBe(false)
    const maxed = make({ age: 20, money: 999, equipment: { keyboard: 3, mouse: 0, monitor: 0, pc: 0 } })
    expect(applyTurn(maxed, [{ id: 'buy_equipment', item: 'keyboard' }, { id: 'rest' }]).ok).toBe(false)
  })

  it('실패한 선택은 상태를 바꾸지 않는다 (원본 불변)', () => {
    const s = make({ age: 20 })
    const copy = structuredClone(s)
    applyTurn(s, [{ id: 'team_scrim' }, { id: 'rest' }])
    run(s, [{ id: 'basics' }, { id: 'rest' }])
    expect(s).toEqual(copy)
  })
})

describe('학교와 부모님 (16~18세)', () => {
  it('18세까지는 컨디션 -10, 용돈 +5만 원이 붙고 19세부터는 사라진다', () => {
    const choice: TurnChoice = [{ id: 'rest' }, { id: 'rest' }]
    const hs = run(make({ age: 18, condition: 50 }), choice)
    const adult = run(make({ age: 19, condition: 50 }), choice)
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

  it('나이 곡선: 25세부터 반응속도·정확도만 시즌마다 10 내려간다', () => {
    // 표준 모드 시즌 끝, 결산을 마친 상태
    const end = (age: number) => make({ age, turnInSeason: 4, history: [{ season: 1, age, stage: 'basement', events: [] }] })
    const young = startNextSeason(end(24))
    expect(young.stats.reaction).toBe(100)
    const old = startNextSeason(end(25))
    expect(old.stats.reaction).toBe(90)
    expect(old.stats.accuracy).toBe(90)
    expect(old.stats.judgment).toBe(100)
    expect(old.stats.mental).toBe(100)
    expect(old.stats.teamwork).toBe(100)
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
