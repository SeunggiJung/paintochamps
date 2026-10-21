import { describe, expect, it } from 'vitest'
import { proOrgs } from './field.ts'
import type { SeasonRecord } from './state.ts'
import { marketContext, marketOf, marketTrend, offerSalary, popularityFame, prestigeFame, type MarketContext, type TeamMarket } from './teamMarket.ts'

const M = (finance: number): TeamMarket => ({ finance, popularity: 3, prestige: 3 })
const T1 = { id: 'aos_pro1_t1', name: 'T1' }
const BRION = { id: 'aos_pro1_brion', name: 'Hanjin Brion' }
const ctx = (season: number, history: SeasonRecord[] = [], seed = 21): MarketContext => ({ seed, season, genre: 'aos', history })

/** 그 시즌에 이 팀에서 뛰며 우승한 기록 */
const winning = (season: number, teamId: string, world = false): SeasonRecord => ({
  season,
  age: 16 + season,
  stage: 'pro1',
  events: [{ id: world ? 'worlds' : 'playoffs', name: world ? '월드 챔피언십' : '플레이오프', placement: 1, fieldSize: 10 }],
  teamId,
})

describe('구단 시장(재정·인기·명성)', () => {
  it('실존 구단은 등급표를 따르고, T1은 재정·인기·명성이 모두 최상위다', () => {
    const t1 = proOrgs('aos').find((t) => t.name === 'T1')!
    expect(marketOf(t1)).toEqual({ finance: 5, popularity: 5, prestige: 5 })
    // 2군 팀은 모 구단의 등급을 따른다
    expect(marketOf({ id: 'aos_pro2_t1-academy', name: 'T1 Esports Academy' })).toEqual(marketOf(t1))
  })

  it('재정이 넉넉한 구단은 지금 월급 이상을 제시하고, 빠듯한 구단은 월급을 깎지만 반토막은 내지 않는다', () => {
    const market = 3000
    const current = 6000 // 협상으로 시장 월급의 두 배까지 올려 둔 선수
    expect(offerSalary(M(5), market, current)).toBeGreaterThan(current)
    expect(offerSalary(M(3), market, current)).toBeGreaterThanOrEqual(current)
    const poor = offerSalary(M(1), market, current)
    expect(poor).toBeLessThan(current) // 감당 못 하는 구단은 한도에서 멈춘다
    expect(poor).toBeGreaterThanOrEqual(market)
  })

  it('지금 월급이 시장 기준보다 낮으면 시장 기준 월급을 받고, 무소속이면 시장 기준 그대로다', () => {
    expect(offerSalary(M(3), 3000, 1000)).toBe(3000)
    expect(offerSalary(M(5), 3000, 0)).toBe(3000)
  })

  it('인기·명성 효과는 등급이 높을수록 크다', () => {
    const base = { seed: 21, season: 1, genre: 'aos' as const, history: [] }
    expect(prestigeFame(T1, marketContext(base))).toBeGreaterThan(prestigeFame(BRION, marketContext(base)))
    expect(popularityFame({ ...base, team: T1 })).toBeGreaterThan(popularityFame({ ...base, team: BRION }))
    expect(popularityFame({ ...base, team: null })).toBe(0)
  })
})

describe('시즌에 따라 변하는 구단 시장', () => {
  it('첫 시즌은 시작 등급 그대로이고, 같은 판이면 언제 계산해도 같다', () => {
    expect(marketOf(BRION, ctx(1))).toEqual(marketOf(BRION))
    expect(marketOf(BRION, ctx(8))).toEqual(marketOf(BRION, ctx(8)))
  })

  it('등급은 1~5 안에 머문다', () => {
    for (const t of proOrgs('aos')) {
      for (const season of [3, 8, 15]) {
        const m = marketOf(t, ctx(season))
        for (const v of [m.finance, m.popularity, m.prestige]) {
          expect(v).toBeGreaterThanOrEqual(1)
          expect(v).toBeLessThanOrEqual(5)
        }
      }
    }
  })

  it('시즌이 지나면 구단마다 등급이 달라진다 (고정이 아니다)', () => {
    const changed = proOrgs('aos').filter((t) => marketOf(t, ctx(10)).finance !== marketOf(t).finance)
    expect(changed.length).toBeGreaterThan(5)
  })

  it('플레이어가 약소 구단에서 몇 해 연속 우승하면 그 구단의 재정·인기·명성이 오른다', () => {
    const history = [1, 2, 3, 4].map((s, i) => winning(s, BRION.id, i === 3))
    const before = marketOf(BRION, ctx(5))
    const after = marketOf(BRION, ctx(5, history))
    expect(after.finance).toBeGreaterThan(before.finance)
    expect(after.popularity).toBeGreaterThan(before.popularity)
    expect(after.prestige).toBeGreaterThan(before.prestige)
    expect(marketTrend(BRION, ctx(5, history))).toBe(1)
  })

  it('다른 구단의 시장은 플레이어의 우승에 영향받지 않는다', () => {
    const history = [1, 2, 3].map((s) => winning(s, BRION.id))
    expect(marketOf(T1, ctx(5, history))).toEqual(marketOf(T1, ctx(5)))
  })

  it('몇 해째 리그 하위권이면 내려가고, 상위권이면 올라간다 (같은 시드에서 순위가 가장 낮은/높은 구단)', () => {
    const orgs = proOrgs('aos')
    // 시즌 2~7의 평균 전력 순위로 상·하위 구단을 고른다
    const avg = (id: string) => {
      const m = marketOf({ id, name: id }, ctx(8))
      return m.finance + m.popularity + m.prestige
    }
    const start = (id: string) => {
      const m = marketOf({ id, name: id })
      return m.finance + m.popularity + m.prestige
    }
    const deltas = orgs.map((t) => avg(t.id) - start(t.id))
    expect(Math.max(...deltas)).toBeGreaterThan(0.5)
    expect(Math.min(...deltas)).toBeLessThan(-0.5)
  })
})
