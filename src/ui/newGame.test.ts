import { describe, expect, it } from 'vitest'
import { STAT_KEYS } from '../engine/types.ts'
import { cleanName, NAME_MAX, playableGenres, REROLL_LIMIT, rollAt } from './newGame.ts'

describe('새 게임 로직', () => {
  it('같은 시드·같은 횟수면 뽑기 결과가 같고, 횟수가 다르면 달라진다', () => {
    expect(rollAt(123, 'fps', 0)).toEqual(rollAt(123, 'fps', 0))
    expect(rollAt(123, 'fps', 0).stats).not.toEqual(rollAt(123, 'fps', 1).stats)
  })

  it('뽑기 능력치 합계는 항상 600', () => {
    for (let i = 0; i <= REROLL_LIMIT; i++) {
      const sum = STAT_KEYS.reduce((a, k) => a + rollAt(7, 'aos', i).stats[k], 0)
      expect(sum).toBe(600)
    }
  })

  it('지금은 FPS와 AOS만 고를 수 있다', () => {
    expect(playableGenres().map((g) => g.id)).toEqual(['fps', 'aos'])
  })

  it('이름은 공백을 지우고 길이를 제한하며, 비면 null', () => {
    expect(cleanName('   ')).toBeNull()
    expect(cleanName('  겜돌이 ')).toBe('겜돌이')
    expect(cleanName('가'.repeat(30))).toHaveLength(NAME_MAX)
  })
})
