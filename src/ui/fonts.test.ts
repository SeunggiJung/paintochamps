// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

vi.mock('pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css', () => ({}))
vi.mock('@fontsource/jua/index.css', () => ({}))
vi.mock('galmuri/dist/galmuri.css', () => ({}))

import { FONT_STACK, loadFont } from './fonts.ts'
import { FONTS } from './prefs.ts'

describe('fonts', () => {
  it('세 글자 모두 스택이 있고 시스템 글자로 끝난다', () => {
    for (const id of FONTS) expect(FONT_STACK[id]).toMatch(/sans-serif$/)
  })

  it('loadFont는 같은 글자에 같은 Promise를 돌려준다', async () => {
    const a = loadFont('jua')
    expect(loadFont('jua')).toBe(a)
    await a
  })
})
