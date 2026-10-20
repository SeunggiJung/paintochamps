import { describe, expect, it } from 'vitest'
import { endingDef, ENDINGS } from './endings.ts'

describe('엔딩 도감 문구', () => {
  it('모든 엔딩에 설명·엔딩 문구가 있다', () => {
    expect(ENDINGS).toHaveLength(12)
    for (const e of ENDINGS) {
      expect(e.desc.length, `${e.id} desc`).toBeGreaterThan(5)
      expect(e.epilogue, `${e.id} epilogue`).toContain('{name}')
    }
  })

  it('엔딩 id는 중복이 없고 endingDef로 찾을 수 있다', () => {
    const ids = ENDINGS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(endingDef('legend').name).toBe('레전드')
  })
})
