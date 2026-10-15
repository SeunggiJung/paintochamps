import { describe, expect, it } from 'vitest'
import gacha from '../data/gacha.json'
import { gradeOdds, gradeOf, rollGacha, rollStats } from './gacha.ts'
import { genrePower } from './power.ts'
import { createRng } from './rng.ts'
import { STAT_KEYS, type GenreId, type Grade } from './types.ts'

describe('rollStats', () => {
  it('합계는 항상 600이고 각 능력치는 최소 50 이상이다', () => {
    const rng = createRng(1)
    for (let i = 0; i < 2000; i++) {
      const stats = rollStats(rng)
      const sum = STAT_KEYS.reduce((s, k) => s + stats[k], 0)
      expect(sum).toBe(gacha.statTotal)
      for (const k of STAT_KEYS) {
        expect(Number.isInteger(stats[k])).toBe(true)
        expect(stats[k]).toBeGreaterThanOrEqual(gacha.statMin)
        expect(stats[k]).toBeLessThanOrEqual(gacha.statMax)
      }
    }
  })

  it('같은 시드면 같은 결과가 나온다', () => {
    expect(rollGacha(createRng(42), 'fps')).toEqual(rollGacha(createRng(42), 'fps'))
    expect(rollGacha(createRng(42), 'fps')).not.toEqual(rollGacha(createRng(43), 'fps'))
  })
})

describe('genrePower', () => {
  it('능력치가 모두 같으면 장르와 관계없이 그 값이 R이다', () => {
    const flat = { reaction: 100, accuracy: 100, focus: 100, judgment: 100, mental: 100, teamwork: 100 }
    for (const genre of ['fps', 'aos', 'rts', 'fighting'] as GenreId[]) {
      expect(genrePower(flat, genre)).toBeCloseTo(100)
    }
  })

  it('FPS는 정확도에 가장 큰 가중치(30%)를 준다', () => {
    const stats = { reaction: 50, accuracy: 350, focus: 50, judgment: 50, mental: 50, teamwork: 50 }
    expect(genrePower(stats, 'fps')).toBeCloseTo(50 + 0.3 * 300)
  })
})

describe('gradeOf', () => {
  it('경계값에서 등급이 바뀐다', () => {
    expect(gradeOf(122)).toBe('UR')
    expect(gradeOf(121.9)).toBe('SSR')
    expect(gradeOf(115)).toBe('SSR')
    expect(gradeOf(107)).toBe('SR')
    expect(gradeOf(99)).toBe('R')
    expect(gradeOf(98.9)).toBe('N')
  })
})

describe('등급 분포 (기획서: UR 1% / SSR 4% / SR 15% / R 30% / N 50%)', () => {
  const N = 40000
  for (const genre of ['fps', 'aos'] as GenreId[]) {
    it(`${genre}: 각 등급 비율이 목표에서 ±3%p 안이다`, () => {
      const rng = createRng(2026)
      const count: Record<Grade, number> = { UR: 0, SSR: 0, SR: 0, R: 0, N: 0 }
      for (let i = 0; i < N; i++) count[rollGacha(rng, genre).grade]++
      const pct = (g: Grade) => (count[g] / N) * 100
      expect(Math.abs(pct('UR') - 1)).toBeLessThan(3)
      expect(Math.abs(pct('SSR') - 4)).toBeLessThan(3)
      expect(Math.abs(pct('SR') - 15)).toBeLessThan(3)
      expect(Math.abs(pct('R') - 30)).toBeLessThan(3)
      expect(Math.abs(pct('N') - 50)).toBeLessThan(3)
    })
  }
})

describe('gradeOdds', () => {
  const genres: GenreId[] = ['fps', 'aos', 'rts', 'fighting']
  for (const genre of genres) {
    it(`${genre}: 확률 합이 1이고 높은 등급일수록 드물다`, () => {
      const odds = gradeOdds(genre)
      const total = (Object.keys(odds) as Grade[]).reduce((s, g) => s + odds[g], 0)
      expect(total).toBeCloseTo(1, 6)
      expect(odds.UR).toBeLessThan(odds.SSR)
      expect(odds.SSR).toBeLessThan(odds.SR)
      expect(odds.SR).toBeLessThan(odds.R)
      expect(odds.UR).toBeGreaterThan(0)
    })
  }

  it('실제 뽑기 분포와 일치한다', () => {
    const odds = gradeOdds('fps')
    const rng = createRng(777)
    const n = 20000
    const hits: Record<string, number> = {}
    for (let i = 0; i < n; i++) {
      const g = rollGacha(rng, 'fps').grade
      hits[g] = (hits[g] ?? 0) + 1
    }
    for (const g of Object.keys(odds) as Grade[]) expect(Math.abs((hits[g] ?? 0) / n - odds[g])).toBeLessThan(0.015)
  })
})
