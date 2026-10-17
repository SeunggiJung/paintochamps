import { describe, expect, it } from 'vitest'
import { earnedAchievements } from './achievements.ts'
import { createInitialState, type GameState, type SeasonRecord } from './state.ts'

const stats = { reaction: 500, accuracy: 500, focus: 500, judgment: 500, mental: 500, teamwork: 500 }
const base = createInitialState({ name: 't', genre: 'aos', mode: 'standard', seed: 1, gacha: { stats, trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power: 500 } })

const ev = (id: string, placement: number) => ({ id, name: id, placement, fieldSize: 10 })
const season = (n: number, stage: SeasonRecord['stage'], events: SeasonRecord['events']): SeasonRecord => ({ season: n, age: 15 + n, stage, events })
const ALL_WON = [ev('split1', 1), ev('mid_qualifier', 1), ev('midseason', 1), ev('split2', 1), ev('playoffs', 1), ev('world', 1)]
const done = (history: SeasonRecord[], o: Partial<GameState> = {}): GameState => ({ ...base, finished: 'legend', worldTitles: 1, history, ...o })

describe('업적', () => {
  it('골든로드: 시즌의 공식 대회를 전부 우승하면 달성', () => {
    expect(earnedAchievements(done([season(8, 'pro1', ALL_WON)]))).toContain('golden_road')
  })

  it('골든로드: 하나라도 1위가 아니면 달성하지 못한다 (월드 우승이어도)', () => {
    const miss = ALL_WON.map((e) => (e.id === 'split1' ? ev('split1', 2) : e))
    expect(earnedAchievements(done([season(8, 'pro1', miss)]))).not.toContain('golden_road')
  })

  it('골든로드: 비공식 초청 대회 성적은 따지지 않는다', () => {
    const withInvite = [...ALL_WON, ev('invitational', 5)]
    expect(earnedAchievements(done([season(8, 'pro1', withInvite)]))).toContain('golden_road')
  })

  it('골든로드: 공식 대회가 너무 적은 시즌은 인정하지 않는다', () => {
    expect(earnedAchievements(done([season(8, 'pro1', [ev('world', 1)])]))).not.toContain('golden_road')
  })

  it('데뷔 시즌 월드 제패: 프로 1부 첫 시즌에 월드 우승', () => {
    const history = [season(6, 'pro2', [ev('pro2_fall', 1)]), season(7, 'pro1', ALL_WON)]
    expect(earnedAchievements(done(history))).toContain('rookie_champion')
  })

  it('데뷔 시즌 월드 제패: 1부 두 번째 시즌 이후의 우승은 해당 없음', () => {
    const history = [season(6, 'pro1', [ev('split1', 5)]), season(7, 'pro1', ALL_WON)]
    expect(earnedAchievements(done(history))).not.toContain('rookie_champion')
  })

  it('월드 우승이 아닌 판이나 끝나지 않은 판은 업적이 없다', () => {
    expect(earnedAchievements(done([season(8, 'pro1', ALL_WON)], { worldTitles: 0 }))).toEqual([])
    expect(earnedAchievements(done([season(8, 'pro1', ALL_WON)], { finished: null }))).toEqual([])
  })
})

describe('밈 업적', () => {
  const win = (n: number, age: number, extra: Partial<SeasonRecord> = {}): SeasonRecord => ({ ...season(n, 'pro1', [ev('split1', 3), ev('world', 1)]), age, ...extra })
  const lose = (n: number, age: number, placement = 6, extra: Partial<SeasonRecord> = {}): SeasonRecord => ({ ...season(n, 'pro1', [ev('world', placement)]), age, ...extra })
  const got = (history: SeasonRecord[], o: Partial<GameState> = {}) => earnedAchievements(done(history, { worldTitles: history.filter((r) => r.events.some((e) => e.id === 'world' && e.placement === 1)).length, ...o }))

  it('중꺾마: 28세 이상에 첫 우승', () => {
    expect(got([lose(1, 24), win(2, 28)])).toContain('late_bloomer')
    expect(got([win(1, 24), win(2, 28)])).not.toContain('late_bloomer')
    expect(got([win(1, 27)])).not.toContain('late_bloomer')
  })
  it('왕조·불사대마왕: 3회 우승과 3연속 우승', () => {
    const streak = got([win(1, 22), win(2, 23), win(3, 24)])
    expect(streak).toEqual(expect.arrayContaining(['dynasty', 'immortal']))
    const gap = got([win(1, 22), win(2, 23), lose(3, 24), win(4, 25)])
    expect(gap).toContain('dynasty')
    expect(gap).not.toContain('immortal')
  })
  it('불사조·언더독·우승 청부사·원클럽맨', () => {
    expect(got([lose(1, 22, 6, { setback: true }), win(2, 23)])).toContain('phoenix')
    expect(got([lose(1, 22), win(2, 23)])).not.toContain('phoenix')
    expect(got([win(1, 22, { underdog: true })])).toContain('underdog')
    expect(got([lose(1, 22, 6, { teamId: 'a' }), win(2, 23, { teamId: 'b' })])).toContain('hired_gun')
    expect(got([lose(1, 22, 6, { teamId: 'a' }), win(2, 23, { teamId: 'a' })])).not.toContain('hired_gun')
    const five = [1, 2, 3, 4].map((n) => lose(n, 20 + n, 6, { teamId: 'a' }))
    expect(got([...five, win(5, 25, { teamId: 'a' })])).toContain('one_club')
    expect(got([...five.slice(1), win(5, 25, { teamId: 'a' })])).not.toContain('one_club')
  })
  it('라스트 댄스·신인 돌풍', () => {
    expect(got([lose(1, 29), win(2, 30)])).toContain('last_dance')
    expect(got([win(1, 30), lose(2, 31)])).not.toContain('last_dance')
    expect(got([win(1, 19)])).toContain('prodigy')
    expect(got([win(1, 20)])).not.toContain('prodigy')
  })
  it('우승 없이도 받는 업적: 터줏대감·철인·노장·준우승', () => {
    expect(earnedAchievements(done([], { worldTitles: 0, seasonsInPro1: 10 }))).toContain('pro1_pillar')
    const five = [1, 2, 3, 4, 5].map((n) => lose(n, 21 + n))
    expect(earnedAchievements(done(five, { worldTitles: 0 }))).toContain('ironman')
    expect(earnedAchievements(done([...five.slice(0, 4)], { worldTitles: 0 }))).not.toContain('ironman')
    expect(earnedAchievements(done([lose(1, 30)], { worldTitles: 0 }))).toContain('old_guard')
    const finals = [1, 2, 3].map((n) => lose(n, 20 + n, 2))
    expect(earnedAchievements(done(finals, { worldTitles: 0 }))).toContain('runner_up')
    expect(earnedAchievements(done(finals.slice(0, 2), { worldTitles: 0 }))).not.toContain('runner_up')
  })
})
