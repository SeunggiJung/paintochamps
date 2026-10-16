import { describe, expect, it } from 'vitest'
import { ENDINGS } from '../engine/endings.ts'
import { endingSceneSvg } from './endingScenes.ts'

describe('엔딩 장면(SVG)', () => {
  it.each(ENDINGS.map((e) => e.id))('%s: 모든 엔딩에 장면이 있고 SVG가 깨지지 않았다', (id) => {
    const svg = endingSceneSvg(id)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).not.toMatch(/undefined|NaN/)
    // 여는 태그와 닫는 태그 수가 맞아야 한다 (g·text·polygon 등 자체 닫힘이 아닌 것)
    for (const tag of ['g', 'text']) {
      expect((svg.match(new RegExp(`<${tag}[ >]`, 'g')) ?? []).length, `${id} <${tag}>`).toBe((svg.match(new RegExp(`</${tag}>`, 'g')) ?? []).length)
    }
  })
})
