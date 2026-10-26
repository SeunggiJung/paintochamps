import { describe, expect, it } from 'vitest'
import { decodeChallenge, encodeChallenge } from './challenge.ts'

describe('도전 코드', () => {
  it('인코딩한 코드를 다시 읽으면 시드·장르·모드가 그대로다', () => {
    for (const seed of [0, 1, 123456789, 4294967295]) {
      for (const genre of ['fps', 'aos'] as const) {
        const c = { seed, genre, mode: 'standard' as const }
        expect(decodeChallenge(encodeChallenge(c))).toEqual(c)
      }
    }
    expect(encodeChallenge({ seed: 4294967295, genre: 'fps', mode: 'tutorial' })).toBe('FT-1Z141Z3')
  })
  it('소문자·공백이 섞여도 읽고, 형식이 틀리면 null이다', () => {
    expect(decodeChallenge(' fs-1z141z3 ')).toEqual({ seed: 4294967295, genre: 'fps', mode: 'standard' })
    for (const bad of ['', 'hello', 'FS-', 'ZS-ABC', 'FZ-ABC', 'FS-ZZZZZZZ', 'FS-1Z141Z3X']) expect(decodeChallenge(bad)).toBeNull()
  })
})
