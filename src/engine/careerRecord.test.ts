import { describe, expect, it } from 'vitest'
import { buildCareer, changeTeam, hasSettledIn } from './career.ts'
import { createInitialState, type GameState } from './state.ts'

const stats = { reaction: 100, accuracy: 100, focus: 100, judgment: 100, mental: 100, teamwork: 100 }
const make = (o: Partial<GameState> = {}): GameState => ({
  ...createInitialState({ name: '테스트', genre: 'aos', mode: 'standard', seed: 5, gacha: { stats, trait: { id: 'grit', name: '끈기', stat: 'focus' }, grade: 'R', power: 100 } }),
  ...o,
})
const A = { id: 'aos_pro1_t1', name: 'T1' }
const B = { id: 'aos_pro1_geng', name: 'Gen.G' }

describe('경력', () => {
  it('팀을 옮기면 이전 구단 기간이 닫히고 새 구단이 이어진다', () => {
    let s = make({ stage: 'pro1', season: 3, age: 18, turnCount: 8 })
    s = changeTeam(s, A)
    s = changeTeam({ ...s, season: 5, age: 20, turnCount: 16 }, B)
    const c = buildCareer({ ...s, season: 6, age: 21 })
    expect(c.stints.map((x) => x.teamName)).toEqual(['T1', 'Gen.G'])
    expect(c.stints[0]).toMatchObject({ fromAge: 18, toAge: 20, seasons: 3, current: false })
    expect(c.stints[1]).toMatchObject({ fromAge: 20, current: true })
    expect(c.totals.teams).toBe(2)
  })

  it('시즌 결산 중에 정한 새 팀은 다음 시즌부터로 적는다', () => {
    const s = changeTeam(make({ stage: 'pro2', season: 4, age: 19 }), A, true)
    expect(s.stints![0]).toMatchObject({ fromSeason: 5, fromAge: 20 })
  })

  it('합류한 턴에는 정착하지 못했고, 한 턴이 지나야 한다', () => {
    const s = changeTeam(make({ turnCount: 7 }), A)
    expect(hasSettledIn(s)).toBe(false)
    expect(hasSettledIn({ ...s, turnCount: 8 })).toBe(true)
  })

  it('수상 경력은 대회 우승과 개인 수상을 모은다', () => {
    const history = [
      { season: 1, age: 20, stage: 'pro1' as const, events: [{ id: 'playoffs', name: '플레이오프', placement: 1, fieldSize: 6 }], highlights: { rating: 7.2, rank: 1, players: 50, awards: ['시즌 MVP'] } },
      { season: 2, age: 21, stage: 'pro1' as const, events: [{ id: 'cafe_cup', name: '컵', placement: 3, fieldSize: 8 }] },
    ]
    const c = buildCareer(make({ history, worldTitles: 0 }))
    expect(c.honors.map((h) => h.title)).toEqual(['플레이오프 우승', '시즌 MVP'])
    expect(c.totals).toMatchObject({ titles: 1, awards: 1, bestRating: 7.2 })
  })

  it('옛 세이브(구단 기록 없음)도 경력을 만든다', () => {
    const c = buildCareer({ ...make(), stints: undefined })
    expect(c.stints).toEqual([])
  })
})
