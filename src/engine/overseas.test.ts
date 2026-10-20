import { describe, expect, it } from 'vitest'
import { earnedAchievements } from './achievements.ts'
import { eventsFor } from './competitions.ts'
import { isEligible, EVENTS } from './events.ts'
import { checkFacility } from './facilities.ts'
import { leagueOfTeam, leagueTeams, makeOpponents, teamPower } from './field.ts'
import { adaptationOf, adaptationPenalty, intlOffset, leaguesOf, transferableLeagues, worldHost } from './leagues.ts'
import { leagueRanking } from './leagueRank.ts'
import { interestedLeagues, makeOverseasOffers, overseasBlocker } from './overseas.ts'
import { createRng } from './rng.ts'
import { acceptOffer, requestTransfer, settleSeason } from './season.ts'
import { createInitialState, type GameState } from './state.ts'
import { offerTerms, salaryOf, teamBoost, teamProfile } from './teams.ts'
import { startNextSeason } from './turn.ts'
import type { GenreId, Stats } from './types.ts'

const stats = (power: number): Stats => ({ reaction: power, accuracy: power, focus: power, judgment: power, mental: power, teamwork: power })

/** 프로 1부 국내 소속, 시즌 마지막 턴을 마친 상태 */
function pro1(genre: GenreId = 'aos', overrides: Partial<GameState> = {}): GameState {
  const base = createInitialState({ name: '테스트', genre, mode: 'standard', seed: 11, gacha: { stats: stats(800), trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power: 800 } })
  const team = genre === 'aos' ? { id: 'aos_pro1_t1', name: 'T1' } : { id: 'fps_pro1_t1', name: 'T1' }
  return { ...base, age: 24, stage: 'pro1', team, fame: 120, turnInSeason: 4, season: 6, ...overrides }
}

describe('리그 데이터', () => {
  it('이적 가능한 해외 리그가 장르군마다 3개이고 팀이 8곳 이상이다', () => {
    for (const genre of ['aos', 'fps'] as const) {
      const leagues = transferableLeagues(genre)
      expect(leagues).toHaveLength(3)
      for (const l of leagues) expect(leagueTeams(l.id).length).toBeGreaterThanOrEqual(8)
    }
  })

  it('팀 id가 겹치지 않고 팀이 속한 리그를 찾을 수 있다', () => {
    const ids = new Set<string>()
    for (const genre of ['aos', 'fps'] as const) {
      for (const l of leaguesOf(genre)) {
        for (const t of leagueTeams(l.id)) {
          expect(ids.has(t.id)).toBe(false)
          ids.add(t.id)
          expect(leagueOfTeam(t.id)).toBe(l.id)
        }
      }
    }
  })

  it('국제전 상대의 리그 보정은 해외 팀 전체에서 평균 0이라 국내 선수의 난이도가 그대로다', () => {
    for (const genre of ['aos', 'fps'] as const) {
      const teams = leaguesOf(genre).filter((l) => !l.domestic).flatMap((l) => leagueTeams(l.id).map(() => intlOffset(l.id)))
      expect(Math.abs(teams.reduce((a, b) => a + b, 0) / teams.length)).toBeLessThan(0.001)
    }
  })

  it('국제전 풀은 소속 리그의 팀을 뺀다', () => {
    const rng = createRng(1)
    const home = makeOpponents(rng, 'intl', 'intl', 60, new Set(), 'aos')
    expect(home.every((t) => leagueOfTeam(t.id) !== 'lck')).toBe(true)
    const abroad = makeOpponents(createRng(1), 'intl', 'intl', 80, new Set(), 'aos', undefined, 'lpl')
    expect(abroad.some((t) => leagueOfTeam(t.id) === 'lck')).toBe(true)
    expect(abroad.every((t) => leagueOfTeam(t.id) !== 'lpl')).toBe(true)
  })

  it('월드 개최지는 리그를 순환한다', () => {
    expect(worldHost('aos', 1).id).toBe('lck')
    expect(worldHost('aos', 2).id).toBe('lpl')
    expect(worldHost('aos', 5).id).toBe('lck')
    expect(worldHost('fps', 3).id).toBe('vct_emea')
  })
})

describe('해외 일정과 강도', () => {
  it('해외 리그의 일정 이름은 소속 리그로 바뀌고 국내는 그대로다', () => {
    const abroad = eventsFor({ stage: 'pro1', genre: 'aos', mode: 'standard', league: 'lpl' })
    expect(abroad.find((e) => e.id === 'rounds12')?.name).toBe('LPL 라운드 1~2')
    expect(eventsFor({ stage: 'pro1', genre: 'aos', mode: 'standard' }).find((e) => e.id === 'rounds12')?.name).toBe('LCK 라운드 1~2')
    expect(eventsFor({ stage: 'pro1', genre: 'fps', mode: 'standard', league: 'vct_emea' }).find((e) => e.id === 'stage1')?.name).toBe('VCT EMEA 스테이지 1')
  })

  it('해외 팀의 전력과 월급은 리그 보정과 월급 배율을 따른다', () => {
    const lpl = leagueTeams('lpl')[0]
    const lcs = leagueTeams('lcs')[0]
    expect(teamPower(11, 6, lpl.id, 'pro1')).toBeGreaterThan(0)
    const p = teamProfile(11, 6, lpl, 'pro1', 120, 'aos')!
    expect(p.league).toBe('lpl')
    expect(p.leagueSize).toBe(leagueTeams('lpl').length)
    const home = teamProfile(11, 6, { id: 'aos_pro1_t1', name: 'T1' }, 'pro1', 120, 'aos')!
    expect(home.league).toBe('lck')
    // 같은 전력 등급이라면 LPL이 LCS보다 월급 배율이 높다 (1.5 대 1.2)
    const pl = teamProfile(11, 6, lcs, 'pro1', 120, 'aos')!
    expect(p.salary / pl.salary).toBeGreaterThan(0.5)
  })

  it('적응도가 낮을수록 대회 전력이 깎이고 국내에서는 늘 100이다', () => {
    const s = pro1()
    expect(adaptationOf(s)).toBe(100)
    expect(adaptationPenalty(s)).toBe(0)
    const abroad = { ...s, league: 'lpl', adaptation: 30 }
    expect(adaptationOf(abroad)).toBe(30)
    expect(adaptationPenalty(abroad)).toBeCloseTo(35)
  })

  it('팀 전력 보정(teamBoost)은 같은 리그 안에서의 강약만 본다', () => {
    const boost = teamBoost({ ...pro1(), league: 'lpl', team: leagueTeams('lpl')[0] })
    expect(Math.abs(boost)).toBeLessThan(120)
  })
})

describe('해외 이적 제안', () => {
  it('조건을 채운 국내 선수에게 서로 다른 해외 리그 제안이 최대 3곳 온다', () => {
    const s = pro1()
    expect(overseasBlocker(s)).toBeNull()
    const pending = makeOverseasOffers(s, createRng(5))!
    expect(pending.kind).toBe('overseas')
    expect(pending.offers.length).toBeGreaterThan(0)
    expect(pending.offers.length).toBeLessThanOrEqual(3)
    const leagues = pending.offers.map((o) => o.league)
    expect(new Set(leagues).size).toBe(leagues.length)
    for (const o of pending.offers) expect(leagueOfTeam(o.team.id)).toBe(o.league)
  })

  it('명성·나이·단계·이번 시즌 이적 여부로 막힌다', () => {
    expect(overseasBlocker(pro1('aos', { fame: 10 }))).not.toBeNull()
    expect(overseasBlocker(pro1('aos', { age: 29 }))).not.toBeNull()
    expect(overseasBlocker(pro1('aos', { stage: 'pro2' }))).not.toBeNull()
    expect(overseasBlocker(pro1('aos', { leagueMoveSeason: 6 }))).not.toBeNull()
  })

  it('실력이 기준에 못 미치는 리그에서는 제안이 오지 않는다', () => {
    const weak = pro1('aos', { stats: stats(520) })
    expect(interestedLeagues(weak).map((l) => l.id)).toEqual(['lcs'])
    expect(interestedLeagues(pro1()).map((l) => l.id).sort()).toEqual(['lcs', 'lec', 'lpl'])
  })

  it('이적하면 리그·적응도·계약금이 바뀌고, 첫 시즌 적응도는 시작값 그대로이며 이후 오른다', () => {
    const settled = settleSeason(pro1()).state
    const base = { ...settled, pendingOffers: makeOverseasOffers({ ...settled, leagueMoveSeason: 0 }, createRng(5)) }
    expect(base.pendingOffers).not.toBeNull()
    const offer = base.pendingOffers!.offers[0]
    const moved = acceptOffer(base, 0)
    expect(moved.league).toBe(offer.league)
    expect(moved.adaptation).toBeLessThan(100)
    expect(moved.leagueMoveSeason).toBe(settled.season)
    expect(moved.money).toBeGreaterThan(settled.money)
    expect(salaryOf(moved)).toBeGreaterThan(0)
    expect(offerTerms(base, offer, 'pro1')?.profile.league).toBe(offer.league)
    const next = startNextSeason(moved)
    expect(next.adaptation).toBe(moved.adaptation)
    const later = startNextSeason({ ...settleSeason({ ...next, turnInSeason: 4 }).state, pendingOffers: null })
    expect(later.adaptation).toBeGreaterThan(next.adaptation)
  })

  it('해외 선수에게는 국내 복귀를 포함한 다른 리그 제안이 온다', () => {
    const abroad = pro1('aos', { league: 'lpl', adaptation: 60, team: leagueTeams('lpl')[0], age: 30, leagueMoveSeason: 0 })
    expect(overseasBlocker(abroad)).toBeNull()
    const pending = makeOverseasOffers(abroad, createRng(2))!
    expect(pending.offers.some((o) => o.league === 'lck')).toBe(true)
    expect(pending.offers.every((o) => o.league !== 'lpl')).toBe(true)
    const home = acceptOffer({ ...abroad, pendingOffers: pending }, pending.offers.findIndex((o) => o.league === 'lck'))
    expect(home.league).toBe('lck')
    expect(home.adaptation).toBe(100)
  })

  it('이적 요청의 해외 경로는 시즌 결산 때만 열리고 요청 기회를 공유한다', () => {
    const settled = settleSeason(pro1()).state
    const mid = requestTransfer({ ...pro1(), turnInSeason: 2 }, 'mid', 'overseas')
    expect(mid.ok).toBe(false)
    const r = requestTransfer({ ...settled, pendingOffers: null }, 'settle', 'overseas')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.transferSettleSeason).toBe(settled.season)
      if (r.success) expect(r.state.pendingOffers?.kind).toBe('overseas')
    }
    expect(requestTransfer(r.ok ? r.state : settled, 'settle', 'overseas').ok).toBe(false)
  })
})

describe('해외 생활', () => {
  it('해외 리그에서 한 시즌을 끝까지 치러도 오류가 없고 기록에 리그가 남는다', () => {
    const s = pro1('fps', { league: 'vct_emea', adaptation: 40, team: leagueTeams('vct_emea')[0], turnInSeason: 4 })
    const { state, report } = settleSeason(s)
    expect(state.history[state.history.length - 1].league).toBe('vct_emea')
    expect(report.events.length).toBeGreaterThan(0)
    expect(report.events.some((e) => e.name.includes('VCT EMEA'))).toBe(true)
  })

  it('언어 코치 시설은 해외에서만 살 수 있다', () => {
    expect(checkFacility({ ...pro1(), money: 1e9 }, 'language')).not.toBeNull()
    expect(checkFacility({ ...pro1(), money: 1e9, league: 'lpl' }, 'language')).toBeNull()
  })

  it('해외 전용 이벤트는 해외 리그 소속일 때만 나온다', () => {
    const overseasEvents = EVENTS.filter((e) => e.when.overseas === true)
    expect(overseasEvents.length).toBeGreaterThanOrEqual(8)
    const home = pro1('aos', { turnInSeason: 1 })
    const abroad = { ...home, league: 'lpl', adaptation: 40 }
    for (const e of overseasEvents) {
      expect(isEligible(home, e)).toBe(false)
      expect(isEligible(abroad, e)).toBe(true)
    }
  })
})

describe('리그 순위와 업적', () => {
  it('국제전 성적이 쌓이면 리그 순위가 만들어진다', () => {
    const s = pro1('aos', { stats: stats(900), turnInSeason: 4 })
    const { state, report } = settleSeason(s)
    expect(report.leagueRanking).toHaveLength(leaguesOf('aos').length)
    expect(report.leagueRanking.filter((r) => r.score !== null).length).toBeGreaterThanOrEqual(2)
    expect(leagueRanking(state, state.history).length).toBe(leaguesOf('aos').length)
  })

  it('다른 지역에서 열린 월드 우승이 도서관장이고, 세 리그에서 뛰면 용병왕이다', () => {
    const win = (season: number, league: string) => ({
      season, age: 20 + season, stage: 'pro1' as const, league, events: [{ id: 'world', name: '월드', placement: 1, fieldSize: 16 }, { id: 'playoffs', name: '플레이오프', placement: 1, fieldSize: 6 }],
    })
    const s = { ...pro1(), finished: 'legend' as const, worldTitles: 3, history: [win(1, 'lck'), win(2, 'lck'), win(3, 'lpl'), win(4, 'lec')] }
    // 시즌 2는 중국 개최인데 국내 소속이라 도서관장. 한국·중국·유럽 세 리그에서 뛰었으니 용병왕
    const ach = earnedAchievements(s)
    expect(ach).toContain('library_master')
    expect(ach).toContain('worldwide')
    expect(ach).toContain('mercenary_king')
    const homeOnly = earnedAchievements({ ...s, history: [win(1, 'lck'), win(5, 'lck')] })
    expect(homeOnly).not.toContain('library_master')
    expect(homeOnly).not.toContain('mercenary_king')
  })
})
