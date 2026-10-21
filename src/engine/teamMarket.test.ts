import { describe, expect, it } from 'vitest'
import { marketOf, offerSalary, popularityFame, prestigeFame } from './teamMarket.ts'
import { proOrgs } from './field.ts'

const M = (finance: 1 | 2 | 3 | 4 | 5) => ({ finance, popularity: 3 as const, prestige: 3 as const })

describe('구단 시장(재정·인기·명성)', () => {
  it('실존 구단은 등급표를 따르고, T1은 재정·인기·명성이 모두 최상위다', () => {
    const t1 = proOrgs('aos').find((t) => t.name === 'T1')!
    expect(marketOf(t1)).toEqual({ finance: 5, popularity: 5, prestige: 5 })
    // 2군 팀은 모 구단의 등급을 따른다
    const academy = proOrgs('aos').length > 0 ? marketOf({ id: 'aos_pro2_t1-academy', name: 'T1 Esports Academy' }) : null
    expect(academy).toEqual(marketOf(t1))
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
    const lo = { id: 'x', name: 'x' }
    expect(prestigeFame({ id: 'aos_pro1_t1', name: 'T1' })).toBeGreaterThan(prestigeFame({ id: 'aos_pro1_brion', name: 'Brion' }))
    expect(popularityFame({ team: { id: 'aos_pro1_t1', name: 'T1' } })).toBeGreaterThan(popularityFame({ team: { id: 'aos_pro1_brion', name: 'Brion' } }))
    expect(popularityFame({ team: null })).toBe(0)
    void lo
  })
})
