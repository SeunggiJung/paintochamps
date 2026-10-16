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
