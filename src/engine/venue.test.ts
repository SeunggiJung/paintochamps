import { describe, expect, it } from 'vitest'
import { eventsFor } from './competitions.ts'
import { eventVenue, leagueDef } from './leagues.ts'

const base = { stage: 'pro1' as const, genre: 'fps' as const, mode: 'standard' as const, league: 'vct_pacific' }
const names = (season: number, seed = 7) => eventsFor({ ...base, season, seed }).filter((e) => /마스터즈|챔피언스/.test(e.name)).map((e) => e.name)

describe('국제 대회 개최지', () => {
  it('정식 명칭 뒤에 그 시즌 개최 도시가 붙고, 이전의 고정 도시(산티아고·런던·상하이)가 아니다', () => {
    const n = names(1)
    expect(n).toHaveLength(3)
    expect(n[0]).toMatch(/^VCT 마스터즈 \S+$/)
    expect(n[1]).toMatch(/^VCT 마스터즈 \S+$/)
    expect(n[2]).toMatch(/^VCT 챔피언스 \S+$/)
    expect(n.join()).not.toMatch(/\{city\}/)
  })

  it('도시는 개최 지역의 후보 중에서 나오고, 챔피언스는 월드 개최 지역에서 열린다', () => {
    for (let season = 1; season <= 8; season++) {
      const champ = eventVenue('fps', season, 7, 'world', 0)
      expect(leagueDef(champ.region.id).cities).toContain(champ.city)
      const m1 = eventVenue('fps', season, 7, 'masters1', 1)
      expect(m1.region.id).not.toBe(champ.region.id)
      expect(names(season)[2]).toBe(`VCT 챔피언스 ${champ.city}`)
    }
  })

  it('같은 판·같은 시즌이면 같은 도시이고, 시즌이 바뀌면 개최지가 돈다', () => {
    expect(names(3)).toEqual(names(3))
    const hosts = new Set([1, 2, 3, 4].map((s) => eventVenue('fps', s, 7, 'world', 0).region.id))
    expect(hosts.size).toBe(4)
  })

  it('AOS 대회 이름에는 도시가 붙지 않는다', () => {
    const all = eventsFor({ stage: 'pro1', genre: 'aos', mode: 'standard', season: 2, seed: 7 })
    expect(all.every((e) => !e.name.includes('{city}'))).toBe(true)
  })
})
