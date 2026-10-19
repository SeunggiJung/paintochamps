import { describe, expect, it } from 'vitest'
import { playCareer } from '../sim/bot.ts'
import { ENDINGS } from './endings.ts'
import type { ModeId } from './state.ts'
import { turnsPerSeason } from './turn.ts'
import { STAT_KEYS, type GenreId } from './types.ts'

const MAX_TURNS: Record<ModeId, number> = { tutorial: 30, standard: 60 }

describe('처음부터 엔딩까지 완주', () => {
  const genres: GenreId[] = ['fps', 'aos', 'rts', 'fighting']
  const modes: ModeId[] = ['tutorial', 'standard']

  for (const genre of genres) {
    for (const mode of modes) {
      for (const policy of ['casual', 'skilled'] as const) {
        it(`${genre} / ${mode} / ${policy}: 10판 모두 오류 없이 끝나고 상태가 유효하다`, () => {
          for (let seed = 1; seed <= 10; seed++) {
            const s = playCareer(genre, mode, seed, { policy })
            expect(ENDINGS.map((e) => e.id)).toContain(s.finished)
            expect(s.turnCount).toBeLessThanOrEqual(MAX_TURNS[mode])
            expect(s.turnCount).toBe(s.history.length * turnsPerSeason(mode))
            expect(s.age).toBeLessThanOrEqual(30)
            expect(s.condition).toBeGreaterThanOrEqual(0)
            expect(s.condition).toBeLessThanOrEqual(100)
            expect(s.money).toBeGreaterThanOrEqual(0)
            for (const key of STAT_KEYS) {
              expect(s.stats[key]).toBeGreaterThanOrEqual(0)
              expect(s.stats[key]).toBeLessThanOrEqual(1000)
            }
          }
        })
      }
    }
  }

  it('같은 시드로 두 번 플레이하면 완전히 같은 결과가 나온다', () => {
    expect(playCareer('aos', 'standard', 42)).toEqual(playCareer('aos', 'standard', 42))
    expect(playCareer('aos', 'standard', 42)).not.toEqual(playCareer('aos', 'standard', 43))
  })
})
