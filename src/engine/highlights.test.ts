import { describe, expect, it } from 'vitest'
import { LEVEL_TEXT, levelOf, seasonHighlights } from './highlights.ts'
import { eventsFor } from './competitions.ts'
import { advanceCalendar } from './calendar.ts'
import { settleSeason } from './season.ts'
import { createInitialState, type GameState } from './state.ts'
import type { Stats } from './types.ts'

const TEAM = { id: 'org_0', name: '나이트호크' }
const stats = (v: number): Stats => ({ reaction: v, accuracy: v, focus: v, judgment: v, mental: v, teamwork: v })

function atEnd(power: number, o: Partial<GameState> = {}): GameState {
  const base = createInitialState({
    name: '테스트',
    genre: 'fps',
    mode: 'standard',
    seed: 7,
    gacha: { stats: stats(power), trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power },
  })
  return { ...base, age: 21, stage: 'pro2', team: TEAM, everPro: true, turnInSeason: 4, ...o }
}

const highlightsOf = (s: GameState) => {
  const run = advanceCalendar(s, 1).state.seasonRun!
  return seasonHighlights(s, run, eventsFor(s))
}

describe('시즌 활약 (평점·수상)', () => {
  it('순위 비율로 리그 내 수준이 정해진다', () => {
    expect(levelOf(1, 10)).toBe('top')
    expect(levelOf(2, 10)).toBe('high')
    expect(levelOf(5, 10)).toBe('mid')
    expect(levelOf(10, 10)).toBe('low')
    expect(Object.keys(LEVEL_TEXT)).toHaveLength(4)
  })

  it('리그가 있는 단계에서는 성적·평점·순위표가 나오고, 같은 판은 항상 같다', () => {
    const h = highlightsOf(atEnd(600))
    expect(h.league).not.toBeNull()
    expect(h.league!.wins + h.league!.losses).toBeGreaterThan(0)
    expect(h.rating).toBeGreaterThanOrEqual(2)
    expect(h.rating).toBeLessThanOrEqual(10)
    expect(h.ratingRank).toBeGreaterThanOrEqual(1)
    expect(h.ratingRank).toBeLessThanOrEqual(h.players)
    expect(h.board.some((l) => l.isPlayer)).toBe(true)
    expect(h.board.length).toBeLessThanOrEqual(6)
    expect(highlightsOf(atEnd(600))).toEqual(h)
  })

  it('실력이 압도적이면 평점이 높고 MVP·베스트 같은 수상이 붙는다. 형편없으면 평점이 낮고 수상이 없다', () => {
    let strongMvp = 0
    let strongRating = 0
    let weakRating = 0
    let weakAwards = 0
    const N = 30
    for (let seed = 1; seed <= N; seed++) {
      const s = highlightsOf(atEnd(1000, { seed }))
      strongRating += s.rating
      if (s.awards.some((a) => a.id === 'mvp')) strongMvp++
      const w = highlightsOf(atEnd(60, { seed }))
      weakRating += w.rating
      weakAwards += w.awards.filter((a) => a.id === 'mvp' || a.id === 'best').length
    }
    expect(strongRating / N).toBeGreaterThan(weakRating / N + 1)
    expect(strongMvp).toBeGreaterThan(N * 0.4)
    expect(weakAwards).toBe(0)
  })

  it('월드 우승은 결승 MVP 수상으로 남는다', () => {
    let found = false
    for (let seed = 1; seed <= 40 && !found; seed++) {
      const s = atEnd(1000, { seed, stage: 'pro1' })
      const h = highlightsOf(s)
      found = h.awards.some((a) => a.name.includes('결승 MVP'))
    }
    expect(found).toBe(true)
  })

  it('방구석 단계처럼 리그가 없으면 league는 null이고 수상은 대회 우승만 남는다', () => {
    const h = highlightsOf(atEnd(300, { stage: 'basement', team: null, age: 17 }))
    expect(h.league).toBeNull()
    expect(h.awards.every((a) => a.id.startsWith('win_'))).toBe(true)
  })

  it('시즌 결산이 기록(history)과 보고서에 활약을 담는다', () => {
    const { state, report } = settleSeason(atEnd(600))
    expect(report.highlights.rating).toBeGreaterThan(0)
    const last = state.history[state.history.length - 1]
    expect(last.highlights?.rating).toBe(report.highlights.rating)
    expect(last.highlights?.awards).toEqual(report.highlights.awards.map((a) => a.name))
  })
})
