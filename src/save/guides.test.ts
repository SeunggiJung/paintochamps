import { describe, expect, it } from 'vitest'
import { hasSeenGuide, loadMeta, markGuideSeen, META_KEY, type KeyValueStorage } from './storage.ts'

function memory(): KeyValueStorage {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

const oldMeta = (guideDone: boolean) => JSON.stringify({ version: 1, tutorialDone: true, guideDone, endings: {}, achievements: {}, bestStage: 'basement', finishedRuns: 0 })

describe('가이드 본 기록', () => {
  it('guidesSeen이 없는 옛 메타(guideDone:true)에서 시작 가이드는 본 것으로 친다', () => {
    const s = memory()
    s.setItem(META_KEY, oldMeta(true))
    const meta = loadMeta(s)
    expect(meta.guidesSeen).toEqual({})
    expect(hasSeenGuide(meta, 'start')).toBe(true)
    expect(hasSeenGuide(meta, 'plan')).toBe(false)
  })

  it('guideDone:false 옛 메타에서는 시작 가이드도 안 본 것', () => {
    const s = memory()
    s.setItem(META_KEY, oldMeta(false))
    expect(hasSeenGuide(loadMeta(s), 'start')).toBe(false)
  })

  it('markGuideSeen은 저장되고 멱등이다', () => {
    const s = memory()
    markGuideSeen(s, 'plan')
    markGuideSeen(s, 'plan')
    const meta = loadMeta(s)
    expect(hasSeenGuide(meta, 'plan')).toBe(true)
    expect(hasSeenGuide(meta, 'spend')).toBe(false)
    expect(meta.guidesSeen).toEqual({ plan: true })
  })

  it("'start'는 guideDone도 함께 올린다", () => {
    const s = memory()
    markGuideSeen(s, 'start')
    expect(loadMeta(s).guideDone).toBe(true)
  })

  it('setItem이 던져도 새 메타를 돌려준다', () => {
    const bad: KeyValueStorage = { getItem: () => null, setItem: () => { throw new Error('x') }, removeItem: () => {} }
    expect(hasSeenGuide(markGuideSeen(bad, 'shop'), 'shop')).toBe(true)
  })
})
