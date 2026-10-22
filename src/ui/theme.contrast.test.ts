import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/ui/theme.css', 'utf-8')

function theme(id: string): Record<string, string> {
  const m = css.match(new RegExp(`:root\\[data-theme='${id}'\\]\\s*\\{([^}]*)\\}`))
  if (!m) throw new Error(`테마 블록 없음: ${id}`)
  const vars: Record<string, string> = {}
  for (const v of m[1].matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g)) vars[v[1]] = v[2]
  return vars
}

function lum(hex: string): number {
  let h = hex.slice(1)
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

describe.each(['light', 'cozy', 'dark'])('테마 %s 대비', (id) => {
  const t = theme(id)
  it('본문 글자 ≥ 4.5', () => expect(contrast(t['--text'], t['--bg'])).toBeGreaterThanOrEqual(4.5))
  it('보조 글자 ≥ 3', () => expect(contrast(t['--muted'], t['--bg'])).toBeGreaterThanOrEqual(3))
  it('강조 버튼 글자 ≥ 3', () => expect(contrast(t['--accent-text'], t['--accent'])).toBeGreaterThanOrEqual(3))
  it('증가색 ≥ 3', () => expect(contrast(t['--up'], t['--bg'])).toBeGreaterThanOrEqual(3))
  it('경고색 ≥ 3', () => expect(contrast(t['--danger'], t['--bg'])).toBeGreaterThanOrEqual(3))
})
