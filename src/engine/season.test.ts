import { describe, expect, it } from 'vitest'
import { evaluateEnding } from './endings.ts'
import { makeOpponents } from './field.ts'
import { createRng } from './rng.ts'
import { createInitialState, type GameState, type StageId } from './state.ts'
import { acceptOffer, eventsFor, retire, settleSeason } from './season.ts'
import { applyTurn, startNextSeason } from './turn.ts'
import type { GenreId, Stats } from './types.ts'

const TEAM = { id: 'org_0', name: '나이트호크' }

function stats(power: number): Stats {
  return { reaction: power, accuracy: power, focus: power, judgment: power, mental: power, teamwork: power }
}

/** 시즌 마지막 턴까지 마친 상태 (표준 모드, 시즌당 4턴) */
function atSeasonEnd(overrides: Partial<GameState> & { power?: number } = {}, genre: GenreId = 'fps'): GameState {
  const { power = 500, ...rest } = overrides
  const base = createInitialState({
    name: '테스트',
    genre,
    mode: 'standard',
    seed: 7,
    gacha: { stats: stats(power), trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power },
  })
  return { ...base, age: 20, turnInSeason: 4, ...rest }
}

describe('이벤트 목록', () => {
  it('방구석 단계의 PC방 대회는 모든 모드에 열리고, 1부는 장르별 일정이 다르다', () => {
    for (const mode of ['tutorial', 'standard', 'precise'] as const) expect(eventsFor({ stage: 'basement', genre: 'fps', mode }).map((e) => e.id)).toEqual(['cafe_cup'])
    expect(eventsFor({ stage: 'pro1', genre: 'aos', mode: 'standard' }).map((e) => e.id)).toEqual(['split1', 'mid_qualifier', 'midseason', 'split2', 'playoffs', 'world'])
    expect(eventsFor({ stage: 'pro1', genre: 'fps', mode: 'standard' }).map((e) => e.id)).toEqual([
      'kickoff', 'masters1', 'stage1', 'stage1_playoffs', 'masters2', 'stage2', 'stage2_playoffs', 'world',
    ])
  })
})

describe('시즌 결산', () => {
  it('시즌이 끝나지 않았거나 이미 결산했으면 거부한다', () => {
    expect(() => settleSeason(atSeasonEnd({ turnInSeason: 2 }))).toThrow()
    const { state } = settleSeason(atSeasonEnd())
    expect(() => settleSeason(state)).toThrow()
  })

  it('같은 시드와 상태면 같은 결과가 나온다', () => {
    const a = settleSeason(atSeasonEnd({ stage: 'pro2', team: TEAM, power: 600 }))
    const b = settleSeason(atSeasonEnd({ stage: 'pro2', team: TEAM, power: 600 }))
    expect(a.report).toEqual(b.report)
  })

  it('입력 상태는 바뀌지 않는다', () => {
    const s = atSeasonEnd({ stage: 'pro2', team: TEAM, power: 600 })
    const copy = structuredClone(s)
    settleSeason(s)
    expect(s).toEqual(copy)
  })

  it('대회 보상(명성·돈)이 반영되고 기록이 남는다', () => {
    const s = atSeasonEnd({ stage: 'local_cup', power: 700, fame: 0, money: 0 })
    const { state, report } = settleSeason(s)
    const reward = report.events.reduce((sum, e) => sum + e.fame, 0)
    expect(report.events).toHaveLength(1)
    expect(state.fame).toBeGreaterThanOrEqual(reward)
    expect(state.history).toHaveLength(1)
    expect(state.history[0].events[0].id).toBe('local_cup')
  })
})

describe('승급과 강등', () => {
  it('지역 대회에서 상위권에 들고 실력이 받쳐 주면 스카우트 제안이 생긴다', () => {
    const r = settleSeason(atSeasonEnd({ stage: 'local_cup', power: 900, fame: 100 }))
    expect(r.state.stage).toBe('amateur_team')
    expect(r.state.pendingOffers?.kind).toBe('scout')
    expect(r.state.pendingOffers?.offers).toHaveLength(3)
  })

  it('제안을 고르면 팀이 정해지고 연봉 또는 명성 보너스를 받는다', () => {
    const { state } = settleSeason(atSeasonEnd({ stage: 'local_cup', power: 900, fame: 100 }))
    const offer = state.pendingOffers!.offers[0]
    const after = acceptOffer(state, 0)
    expect(after.team).toEqual(offer.team)
    expect(after.pendingOffers).toBeNull()
    expect(offer.perk === 'salary' ? after.money - state.money : after.fame - state.fame).toBeGreaterThan(0)
  })

  it('입단 제안은 거절할 수 없다', () => {
    const { state } = settleSeason(atSeasonEnd({ stage: 'local_cup', power: 900, fame: 100 }))
    expect(() => acceptOffer(state, null)).toThrow()
  })

  it('제안을 고르기 전에는 턴을 진행할 수 없다', () => {
    const { state } = settleSeason(atSeasonEnd({ stage: 'local_cup', power: 900, fame: 100 }))
    const next = { ...state, turnInSeason: 0 }
    expect(applyTurn(next, [{ id: 'rest' }, { id: 'rest' }]).ok).toBe(false)
    expect(() => startNextSeason(state)).toThrow()
  })

  it('프로 2부에서 조건을 채우면 자동 승급이 아니라 1부 팀의 콜업 제안이 온다 (지금 팀의 1군 콜업이 첫 번째)', () => {
    const { state, report } = settleSeason(atSeasonEnd({ stage: 'pro2', team: TEAM, power: 900, everPro: true }))
    // 압도적으로 강하면 2부 1위이므로 강등되지 않는다. 제안을 고르기 전까지는 2부다.
    expect(state.stage).toBe('pro2')
    expect(report.promoted).toBe(false)
    expect(state.pendingOffers?.kind).toBe('callup')
    expect(state.pendingOffers?.stage).toBe('pro1')
    expect(state.pendingOffers?.offers[0].team).toEqual(TEAM)
    expect(new Set(state.pendingOffers?.offers.map((o) => o.team.id)).size).toBe(state.pendingOffers?.offers.length)
    expect(() => startNextSeason(state)).toThrow()
  })

  it('콜업을 받아들이면 1부로 올라가고 그 팀이 1부 데뷔 팀이 된다. 거절하면 2부에 남는다', () => {
    const { state } = settleSeason(atSeasonEnd({ stage: 'pro2', team: TEAM, power: 900, everPro: true }))
    const other = state.pendingOffers!.offers[1]
    const up = acceptOffer(state, 1)
    expect(up.stage).toBe('pro1')
    expect(up.team).toEqual(other.team)
    expect(up.debutTeamId).toBe(other.team.id)
    expect(up.pendingOffers).toBeNull()
    const stay = acceptOffer(state, null)
    expect(stay.stage).toBe('pro2')
    expect(stay.team).toEqual(TEAM)
    expect(startNextSeason(stay).stage).toBe('pro2')
  })

  it('실력이 형편없으면 하위권으로 강등된다 (프로 2부 → 아마추어, 소속 팀 변경)', () => {
    let demoted = 0
    for (let seed = 0; seed < 60; seed++) {
      const { state } = settleSeason(atSeasonEnd({ stage: 'pro2', team: TEAM, power: 100, everPro: true, seed }))
      if (state.stage === 'amateur_team') {
        demoted++
        expect(state.team).not.toBeNull()
        expect(state.team!.id).not.toBe('org_0')
      }
    }
    expect(demoted).toBeGreaterThan(50)
  })

  it('아마추어 팀에서 강등되면 방출되어 지역 대회로 돌아간다', () => {
    let released = 0
    for (let seed = 0; seed < 60; seed++) {
      const { state } = settleSeason(atSeasonEnd({ stage: 'amateur_team', team: { id: 'am_1', name: '붉은여우' }, power: 20, seed }))
      if (state.stage === 'local_cup') {
        released++
        expect(state.team).toBeNull()
      }
    }
    expect(released).toBeGreaterThan(50)
  })
})

describe('프로 1부와 월드 챔피언십', () => {
  const pro1 = (genre: GenreId, power: number, seed: number) =>
    atSeasonEnd({ stage: 'pro1', team: TEAM, power, everPro: true, debutTeamId: 'org_0', fame: 60, seed }, genre)

  for (const genre of ['aos', 'fps'] as GenreId[]) {
    it(`${genre}: 최고 수준의 실력이면 월드에 나가 우승하고 커리어가 끝난다`, () => {
      let champions = 0
      let reached = 0
      for (let seed = 0; seed < 30; seed++) {
        const { state, report } = settleSeason(pro1(genre, 1000, seed))
        if (report.events.some((e) => e.id === 'world')) reached++
        if (report.worldChampion) {
          champions++
          expect(state.worldTitles).toBe(1)
          expect(state.finished).toBe('hidden_loyal')
        }
      }
      // 월드 상대(국제전 평균 990)도 실력치 상한(1000) 근처라, 능력치를 끝까지 올려도 우승이 보장되지는 않는다
      expect(reached).toBeGreaterThan(20)
      expect(champions).toBeGreaterThan(8)
    })

    it(`${genre}: 실력이 낮으면 월드에 진출하지 못하거나 우승하지 못한다`, () => {
      let champions = 0
      for (let seed = 0; seed < 30; seed++) {
        if (settleSeason(pro1(genre, 450, seed)).report.worldChampion) champions++
      }
      expect(champions).toBe(0)
    })
  }

  it('1부 시즌 수를 센다', () => {
    const { state } = settleSeason(pro1('aos', 700, 3))
    expect(state.seasonsInPro1).toBe(1)
  })

  it('월드 우승 시 다른 팀으로 이적했다면 레전드 엔딩이다', () => {
    let seen = false
    for (let seed = 0; seed < 40 && !seen; seed++) {
      const s = { ...pro1('aos', 1000, seed), team: { id: 'org_5', name: '실버폭스' } }
      const { state, report } = settleSeason(s)
      if (report.worldChampion) {
        expect(state.finished).toBe('legend')
        seen = true
      }
    }
    expect(seen).toBe(true)
  })
})

describe('엔딩', () => {
  const base = atSeasonEnd()
  const make = (o: Partial<GameState>): GameState => ({ ...base, ...o })

  it('표의 위쪽 조건이 우선한다', () => {
    expect(evaluateEnding(make({ worldTitles: 1, team: TEAM, debutTeamId: 'org_0', everPro: true, stage: 'pro1' }))).toBe('hidden_loyal')
    expect(evaluateEnding(make({ worldTitles: 1, team: TEAM, debutTeamId: 'org_9', everPro: true, stage: 'pro1' }))).toBe('legend')
    expect(evaluateEnding(make({ worldAppearances: 2, everPro: true, stage: 'pro1' }))).toBe('world_finalist')
    expect(evaluateEnding(make({ seasonsInPro1: 5, everPro: true, stage: 'pro1' }))).toBe('pro1_regular')
    expect(evaluateEnding(make({ stage: 'pro2', everPro: true }))).toBe('pro2_veteran')
  })

  it('튜토리얼에서는 데뷔 팀에서 우승해도 히든이 아니라 레전드다', () => {
    const champion = { worldTitles: 1, team: TEAM, debutTeamId: 'org_0', everPro: true, stage: 'pro1' as const }
    expect(evaluateEnding(make({ ...champion, mode: 'standard' }))).toBe('hidden_loyal')
    expect(evaluateEnding(make({ ...champion, mode: 'precise' }))).toBe('hidden_loyal')
    expect(evaluateEnding(make({ ...champion, mode: 'tutorial' }))).toBe('legend')
  })

  it('프로 경력이 있으면 코치·감독, 아니면 명성이 높을 때 스트리머', () => {
    const strong = { ...stats(500), teamwork: 700 }
    expect(evaluateEnding(make({ stage: 'pro1', everPro: true, stats: strong, seasonsInPro1: 2 }))).toBe('coach')
    expect(evaluateEnding(make({ stage: 'local_cup', everPro: false, fame: 70 }))).toBe('streamer')
    expect(evaluateEnding(make({ stage: 'pro1', everPro: true, fame: 80, seasonsInPro1: 2 }))).toBe('streamer')
  })

  it('프로 계약을 못 했으면 취미로 남은 겜돌이, 프로 경력이 있는데 어느 조건도 아니면 터주대감', () => {
    expect(evaluateEnding(make({ stage: 'basement', everPro: false, fame: 0 }))).toBe('hobbyist')
    expect(evaluateEnding(make({ stage: 'amateur_team', everPro: true, fame: 0 }))).toBe('pro2_veteran')
  })

  it('자진 은퇴는 결산 뒤에만 가능하고 엔딩이 정해진다', () => {
    expect(() => retire(atSeasonEnd())).toThrow()
    const { state } = settleSeason(atSeasonEnd({ power: 200 }))
    const done = retire(state)
    expect(done.finished).toBe('hobbyist')
  })

  it('30세 시즌을 마치면 자동으로 엔딩이 정해진다', () => {
    const { state, report } = settleSeason(atSeasonEnd({ age: 30, power: 200 }))
    expect(report.finished).toBe('hobbyist')
    expect(state.finished).toBe('hobbyist')
    expect((['pro1', 'basement'] as StageId[]).length).toBe(2)
  })
})

describe('PC방 대회와 뽑기 기록', () => {
  it('방구석 표준 모드 시즌에 PC방 대회를 치르고 명성·상금이 들어온다', () => {
    const s = atSeasonEnd({ stage: 'basement', cafeTeamName: '접으셈즈' })
    const { report, state } = settleSeason(s)
    expect(report.events.map((e) => e.id)).toEqual(['cafe_cup'])
    expect(report.events[0].fieldSize).toBe(8)
    expect(state.fame).toBeGreaterThanOrEqual(s.fame)
  })

  it('PC방 대회 상대는 조잡한 이름 목록에서 뽑고 서로 겹치지 않는다', () => {
    const teams = makeOpponents(createRng(3), 'cafe', 'cafe', 7, new Set(['player']))
    expect(new Set(teams.map((t) => t.name)).size).toBe(7)
    expect(teams.every((t) => t.id.startsWith('cafe_'))).toBe(true)
  })

  it('다시 뽑은 횟수가 기록된다', () => {
    const base = createInitialState({ name: 'a', genre: 'fps', mode: 'tutorial', seed: 1, rerolls: 5, gacha: { stats: stats(100), trait: { id: 'grit', name: '끈기', stat: 'focus' }, grade: 'N', power: 100 } })
    expect(base.rerolls).toBe(5)
    expect(base.cafeTeamName).toBeNull()
  })
})
