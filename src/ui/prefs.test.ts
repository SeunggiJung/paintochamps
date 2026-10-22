// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import type { KeyValueStorage } from '../save/storage.ts'
import { applyPrefs, defaultPrefs, loadPrefs, PREFS_KEY, resolveMotion, resolveTheme, savePrefs } from './prefs.ts'

function memory(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

describe('prefs', () => {
  it('DOM 환경이 켜져 있다', () => {
    expect(typeof document.createElement).toBe('function')
  })

  it('저장이 없으면 기본값', () => {
    expect(loadPrefs(memory())).toEqual(defaultPrefs)
  })

  it('저장 후 같은 값을 돌려준다', () => {
    const s = memory()
    const p = { theme: 'cozy', font: 'jua', motion: 'lively', codexView: 'list' } as const
    expect(savePrefs(s, p)).toBe(true)
    expect(loadPrefs(s)).toEqual(p)
  })

  it('깨진 JSON이면 기본값', () => {
    const s = memory()
    s.setItem(PREFS_KEY, '{oops')
    expect(loadPrefs(s)).toEqual(defaultPrefs)
  })

  it('모르는 값은 그 필드만 기본값으로 바꾼다', () => {
    const s = memory()
    s.setItem(PREFS_KEY, JSON.stringify({ theme: 'neon', font: 'comic', motion: 5, codexView: 'list' }))
    expect(loadPrefs(s)).toEqual({ ...defaultPrefs, codexView: 'list' })
  })

  it('setItem이 던져도 savePrefs는 false, getItem이 던져도 기본값', () => {
    const bad: KeyValueStorage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
      removeItem: () => {},
    }
    expect(savePrefs(bad, defaultPrefs)).toBe(false)
    expect(loadPrefs(bad)).toEqual(defaultPrefs)
  })

  it('테마·움직임 자동 해석, 직접 고른 값이 우선', () => {
    expect(resolveTheme('auto', true)).toBe('dark')
    expect(resolveTheme('auto', false)).toBe('light')
    expect(resolveTheme('cozy', true)).toBe('cozy')
    expect(resolveMotion('auto', true)).toBe('calm')
    expect(resolveMotion('auto', false)).toBe('normal')
    expect(resolveMotion('lively', true)).toBe('lively')
  })

  it('applyPrefs가 root.dataset에 쓴다', () => {
    const root = document.createElement('div')
    applyPrefs({ ...defaultPrefs, font: 'galmuri' }, { prefersDark: true, reducedMotion: false }, root)
    expect(root.dataset.theme).toBe('dark')
    expect(root.dataset.font).toBe('galmuri')
    expect(root.dataset.motion).toBe('normal')
  })
})
