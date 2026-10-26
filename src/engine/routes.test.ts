import { describe, expect, it } from 'vitest'
import { EVENTS, isEligible } from './events.ts'
import { advanceCalendar } from './calendar.ts'
import { choosePrep, expectedScore, testName, upcomingTest } from './routes.ts'
import { settleSeason } from './season.ts'
import { createInitialState, type GameState } from './state.ts'
import { applyTurn } from './turn.ts'
import type { Stats } from './types.ts'

const stats = (v: number): Stats => ({ reaction: v, accuracy: v, focus: v, judgment: v, mental: v, teamwork: v })

/** 시즌 마지막 턴까지 마친 상태 (표준 모드) */
function at(power: number, o: Partial<GameState> = {}): GameState {
  const base = createInitialState({
    name: '테스트',
    genre: 'fps',
    mode: 'standard',
    seed: 7,
    gacha: { stats: stats(power), trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power },
  })
  return { ...base, age: 17, turnInSeason: 4, ...o }
}

describe('초반 루트: PC방 대회', () => {
  it('PC방 대회 상위 성적이면 대회가 끝나는 시점에 초대를 받고, 같은 해 결산에서 입단 테스트를 본다', () => {
    const cup = advanceCalendar(at(900, { turnInSeason: 3 }), 1)
    const end = cup.beats.find((b) => b.kind === 'end')
    if (!end || end.kind !== 'end') throw new Error('대회 결과가 없다')
    expect(end.advanced.join(' ')).toContain('초대장')
    expect(cup.state.academyInvite).toBe(true)
    // 초대장을 보낸 구단이 정해지고 안내 문구와 테스트 이름에 나온다
    const org = cup.state.academyOrg!
    expect(org).toBeTruthy()
    expect(end.advanced.join(' ')).toContain(`${org.name} 아카데미`)
    expect(testName('academy_test', cup.state)).toBe(`${org.name} 아카데미 입단 테스트`)
    // 합격하면 그 구단의 아카데미로 간다
    const passed = settleSeason({ ...at(900), academyInvite: true, academyOrg: org })
    expect(passed.state.team?.name).toBe(`${org.name} 아카데미`)
    expect(passed.state.academyOrg).toBeNull()
    const { state, report } = settleSeason(at(900))
    expect(report.tests).toHaveLength(1)
    expect(state.stage).toBe('amateur_team')
    expect(state.path).toBe('academy')
    expect(state.cafeAttempts).toBe(1)
  })

  it('PC방 대회에서 눈에 띄지 못하면 초대 없이 방구석에 머문다', () => {
    const { state, report } = settleSeason(at(40))
    expect(state.academyInvite).toBe(false)
    expect(report.tests).toHaveLength(0)
    expect(state.stage).toBe('basement')
  })

  it('초대를 받은 해에는 PC방 대회에 나가지 않고, 강한 선수는 시험에 합격해 아카데미(정석)로 간다', () => {
    const { state, report } = settleSeason(at(900, { academyInvite: true, cafeAttempts: 1 }))
    expect(report.events).toHaveLength(0)
    expect(report.tests).toHaveLength(1)
    expect(state.stage).toBe('amateur_team')
    expect(state.path).toBe('academy')
    expect(state.team?.name).toContain('아카데미')
    expect(state.academyInvite).toBe(false)
  })

  it('시험에 떨어지면 한 번은 재도전하고, 두 번째 불합격이면 지역 대회로 돌아간다', () => {
    const first = settleSeason(at(60, { academyInvite: true })).state
    expect(first.stage).toBe('basement')
    expect(first.academyInvite).toBe(true)
    expect(first.academyRetries).toBe(1)
    const second = settleSeason(at(60, { academyInvite: true, academyRetries: 1 })).state
    expect(second.stage).toBe('local_cup')
    expect(second.path).toBe('open')
    expect(second.academyInvite).toBe(false)
  })

  it('성적이 안 좋으면 몇 번 더 도전하다가 지역 대회로 넘어간다', () => {
    const early = settleSeason(at(40, { cafeAttempts: 0 })).state
    expect(early.stage).toBe('basement')
    expect(early.academyInvite).toBe(false)
    const forced = settleSeason(at(40, { cafeAttempts: 2 })).state
    expect(forced.stage).toBe('local_cup')
    expect(forced.path).toBe('open')
  })
})

describe('초반 루트: 지역 대회와 아마추어 팀', () => {
  it('지역 대회 상위 + 실력이면 스카우트 제안 3팀, 나이 한계를 넘으면 열리지 않는다', () => {
    const r = settleSeason(at(900, { stage: 'local_cup', age: 20 }))
    expect(r.state.stage).toBe('amateur_team')
    expect(r.state.path).toBe('open')
    expect(r.state.pendingOffers?.offers).toHaveLength(3)
    expect(settleSeason(at(900, { stage: 'local_cup', age: 23 })).state.stage).toBe('local_cup')
  })

  it('정석 루트의 연습생은 아마추어 리그 성적이 나빠도 방출되지 않는다', () => {
    const team = { id: 'org_1', name: '실버폭스 아카데미' }
    for (let seed = 0; seed < 40; seed++) {
      const s = settleSeason(at(30, { stage: 'amateur_team', path: 'academy', team, age: 19, seed })).state
      expect(s.stage).toBe('amateur_team')
    }
    let released = 0
    for (let seed = 0; seed < 40; seed++) if (settleSeason(at(30, { stage: 'amateur_team', path: 'open', team, age: 19, seed })).state.stage === 'local_cup') released++
    expect(released).toBeGreaterThan(30)
  })

  it('프로 트라이아웃에 합격하면 프로 2부와 스카우트 제안이 열리고, 같은 실력이면 정석 쪽 시험이 더 쉽다', () => {
    const academy = at(900, { stage: 'amateur_team', path: 'academy', team: { id: 'org_1', name: '실버폭스 아카데미' }, age: 20, fame: 80 })
    const r = settleSeason(academy)
    expect(r.state.stage).toBe('pro2')
    expect(r.state.everPro).toBe(true)
    expect(r.state.pendingOffers?.offers).toHaveLength(3)
    const mid = at(230, { stage: 'amateur_team', fame: 20 })
    expect(expectedScore({ ...mid, path: 'academy' }, 'pro_tryout')).toBeGreaterThan(expectedScore({ ...mid, path: 'open' }, 'pro2_open_test'))
  })

  it('정석 루트(아카데미 코칭)는 성장이 조금 더 빠르다', () => {
    const base = at(100, { turnInSeason: 0, trainingMenu: ['basics', 'aim_lab', 'video_review'], seasonTraining: 'basics' })
    const gain = (path: GameState['path']) => {
      const r = applyTurn({ ...base, path }, [{ id: 'basics' }, { id: 'rest' }])
      if (!r.ok) throw new Error(r.error)
      return r.delta.stats.reaction
    }
    expect(gain('academy')).toBeGreaterThan(gain('open'))
  })
})

describe('시험 준비', () => {
  it('볼 시험이 있을 때만 고를 수 있고, 한 번만 고른다', () => {
    const none = at(300, { stage: 'pro2', team: { id: 'org_0', name: '나이트호크' } })
    expect(upcomingTest(none)).toBeNull()
    expect(() => choosePrep(none, 'focus')).toThrow()
    const s = at(300, { academyInvite: true })
    expect(upcomingTest(s)).toEqual({ id: 'academy_test', certain: true })
    const prepared = choosePrep(s, 'focus')
    expect(prepared.condition).toBeLessThan(s.condition)
    expect(() => choosePrep(prepared, 'rest')).toThrow()
  })

  it('준비 보너스는 예상 점수를 올리고, 결산이 끝나면 비워진다', () => {
    const s = at(300, { academyInvite: true })
    expect(expectedScore(choosePrep(s, 'focus'), 'academy_test')).toBeGreaterThan(expectedScore(s, 'academy_test'))
    expect(settleSeason(choosePrep(s, 'focus')).state.testPrep).toBeNull()
  })

  it('같은 시드면 시험 결과도 같다', () => {
    const a = settleSeason(at(200, { academyInvite: true })).report.tests
    const b = settleSeason(at(200, { academyInvite: true })).report.tests
    expect(a).toEqual(b)
  })
})

describe('루트별 이벤트', () => {
  const eligible = (state: GameState) => EVENTS.filter((e) => isEligible(state, e)).map((e) => e.id)
  const team = { id: 'org_1', name: '실버폭스 아카데미' }

  it('아카데미 이벤트는 정석 루트의 연습생에게만 나온다', () => {
    const academy = at(300, { stage: 'amateur_team', path: 'academy', team, age: 18, turnInSeason: 1, condition: 70 })
    expect(eligible(academy)).toEqual(expect.arrayContaining(['academy_senior_spar', 'academy_monthly_eval', 'academy_dorm_life']))
    expect(eligible({ ...academy, path: 'open' })).not.toContain('academy_senior_spar')
  })

  it('초대장 이벤트는 초대를 받은 방구석 선수에게만 나온다', () => {
    const rookie = at(200, { turnInSeason: 1, condition: 70 })
    expect(eligible(rookie)).not.toContain('invite_letter_day')
    expect(eligible({ ...rookie, academyInvite: true })).toContain('invite_letter_day')
  })

  it('PC방 도전이 한 번 이상이고 초대를 못 받았을 때 격려 이벤트가 나온다', () => {
    const rookie = at(200, { turnInSeason: 1, condition: 70, cafeAttempts: 1 })
    expect(eligible(rookie)).toContain('cafe_retry_resolve')
    expect(eligible({ ...rookie, academyInvite: true })).not.toContain('cafe_retry_resolve')
  })

  it('우회 루트 이벤트: 지역 대회 소문과 스트리머 제안', () => {
    const local = at(300, { stage: 'local_cup', path: 'open', fame: 20, age: 20, turnInSeason: 1, condition: 70 })
    expect(eligible(local)).toEqual(expect.arrayContaining(['local_cup_scout_rumor', 'open_route_streamer_collab', 'late_bloomer_family_worry']))
    expect(eligible({ ...local, path: 'academy' })).not.toContain('open_route_streamer_collab')
  })
})
