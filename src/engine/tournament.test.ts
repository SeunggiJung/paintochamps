import { describe, expect, it } from 'vitest'
import { mentalAdjusted, seriesWinProbability, winProbability } from './match.ts'
import { createRng } from './rng.ts'
import { runElimination, runLeague, runLeagueDetailed, type Team } from './tournament.ts'

const team = (id: string, power: number): Team => ({ id, name: id, power })
const field = (powers: number[]) => powers.map((p, i) => team(`t${i}`, p))

describe('경기 승률', () => {
  it('실력 차 0이면 50%, 100이면 약 72%, 200이면 약 86% (기획서)', () => {
    expect(winProbability(500, 500)).toBeCloseTo(0.5)
    expect(winProbability(600, 500)).toBeCloseTo(0.715, 2)
    expect(winProbability(700, 500)).toBeCloseTo(0.863, 2)
  })

  it('멘탈 보정: 800이면 +30, 100이면 -40 (기획서)', () => {
    expect(mentalAdjusted(500, 800)).toBeCloseTo(530)
    expect(mentalAdjusted(500, 100)).toBeCloseTo(460)
    expect(mentalAdjusted(500, 500)).toBe(500)
  })

  it('시리즈는 판 수가 늘수록 강한 쪽에 유리하다', () => {
    const p = 0.6
    expect(seriesWinProbability(p, 1)).toBeCloseTo(0.6)
    expect(seriesWinProbability(p, 3)).toBeCloseTo(0.648)
    expect(seriesWinProbability(p, 5)).toBeCloseTo(0.68256)
    expect(seriesWinProbability(0.5, 5)).toBeCloseTo(0.5)
  })
})

describe('runLeague', () => {
  it('6팀 더블 라운드로빈은 팀당 10경기다', () => {
    const table = runLeague(createRng(1), field([1, 2, 3, 4, 5, 6].map((n) => n * 100)), 2, 1)
    expect(table).toHaveLength(6)
    for (const row of table) expect(row.wins + row.losses).toBe(10)
    expect(table.reduce((s, r) => s + r.wins, 0)).toBe(30)
  })

  it('승수 내림차순으로 정렬된다', () => {
    const table = runLeague(createRng(2), field([100, 300, 500, 700]), 2, 3)
    for (let i = 1; i < table.length; i++) expect(table[i - 1].wins).toBeGreaterThanOrEqual(table[i].wins)
  })

  it('압도적으로 강한 팀이 대부분 1위를 한다', () => {
    let firsts = 0
    for (let seed = 0; seed < 200; seed++) {
      const table = runLeague(createRng(seed), field([900, 500, 500, 500, 500, 500]), 2, 3)
      if (table[0].team.id === 't0') firsts++
    }
    expect(firsts).toBeGreaterThan(190)
  })

  it('같은 시드면 같은 결과가 나온다', () => {
    const teams = field([400, 450, 500, 550])
    expect(runLeague(createRng(9), teams, 2, 3).map((r) => r.team.id)).toEqual(runLeague(createRng(9), teams, 2, 3).map((r) => r.team.id))
  })
})

describe('runElimination', () => {
  for (const n of [4, 6, 8, 12, 16]) {
    for (const k of [1, 2, 3]) {
      it(`${n}팀 ${k}패 탈락: 모든 팀이 한 번씩 순위에 들어가고 끝난다`, () => {
        const teams = field(Array.from({ length: n }, (_, i) => 300 + i * 20))
        const placement = runElimination(createRng(n * 10 + k), teams, k, 3)
        expect(placement).toHaveLength(n)
        expect(new Set(placement.map((t) => t.id)).size).toBe(n)
      })
    }
  }

  it('단판 토너먼트는 막강한 팀이 거의 항상 우승한다', () => {
    let champs = 0
    for (let seed = 0; seed < 200; seed++) {
      const placement = runElimination(createRng(seed), field([1000, 400, 400, 400, 400, 400, 400, 400]), 1, 5)
      if (placement[0].id === 't0') champs++
    }
    expect(champs).toBeGreaterThan(190)
  })

  it('더블 엘리미네이션이 단판보다 강팀의 우승 확률이 높다', () => {
    const powers = [600, 500, 500, 500, 500, 500, 500, 500]
    const rate = (k: number) => {
      let wins = 0
      const N = 3000
      for (let seed = 0; seed < N; seed++) {
        if (runElimination(createRng(seed), field(powers), k, 3)[0].id === 't0') wins++
      }
      return wins / N
    }
    expect(rate(2)).toBeGreaterThan(rate(1))
  })

  it('1팀이면 그 팀이 우승이다', () => {
    expect(runElimination(createRng(1), field([500]), 2, 3).map((t) => t.id)).toEqual(['t0'])
  })
})

describe('리그 중간 순위', () => {
  it.each([12, 11, 8])('%i팀 리그: 중간 시점에 모든 팀이 비슷한 수의 경기를 치렀다 (플레이어 몰아치기 방지)', (n) => {
    const teams = field(Array.from({ length: n }, () => 500))
    const { mid, final } = runLeagueDetailed(createRng(7), teams, 1, 3)
    const played = mid.map((s) => s.wins + s.losses)
    expect(Math.max(...played) - Math.min(...played)).toBeLessThanOrEqual(2)
    expect(played[0]).toBeLessThan(n - 1)
    expect(final.every((s) => s.wins + s.losses === n - 1)).toBe(true)
  })
})
