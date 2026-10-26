import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { exportBackup, importBackup } from './backup.ts'
import { emptyMeta, loadGame, loadMeta, META_KEY, saveGame, SAVE_KEY, type KeyValueStorage } from './storage.ts'

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
}

const stats = { reaction: 100, accuracy: 100, focus: 100, judgment: 100, mental: 100, teamwork: 100 }
const state = () => createInitialState({ name: '백업 테스트', genre: 'fps', mode: 'standard', seed: 11, gacha: { stats, trait: { id: 'grit', name: '끈기', stat: 'focus' }, grade: 'R', power: 100 } })

describe('저장 코드 백업', () => {
  it('내보낸 코드를 다른 저장소에 불러오면 판과 기록이 그대로 옮겨진다 (한글 이름 포함)', () => {
    const a = new MemoryStorage()
    saveGame(a, state())
    a.setItem(META_KEY, JSON.stringify({ ...emptyMeta(), finishedRuns: 3, tokens: 7 }))
    const code = exportBackup(a)
    expect(code.startsWith('PTC1.')).toBe(true)

    const b = new MemoryStorage()
    const r = importBackup(b, code)
    expect(r).toEqual({ ok: true, hasSave: true, finishedRuns: 3 })
    expect(loadGame(b)?.name).toBe('백업 테스트')
    expect(loadMeta(b).tokens).toBe(7)
  })

  it('공백·줄바꿈이 섞여 붙어도 읽는다', () => {
    const a = new MemoryStorage()
    saveGame(a, state())
    const code = exportBackup(a)
    const spaced = code.replace(/(.{20})/g, '$1\n ')
    expect(importBackup(new MemoryStorage(), spaced).ok).toBe(true)
  })

  it('엉뚱한 글이나 깨진 코드는 거절하고 저장소를 건드리지 않는다', () => {
    const s = new MemoryStorage()
    s.setItem(SAVE_KEY, 'old')
    expect(importBackup(s, 'hello').ok).toBe(false)
    expect(importBackup(s, 'PTC1.!!!!').ok).toBe(false)
    const bad = 'PTC1.' + btoa(JSON.stringify({ save: '{"not":"a save"}', meta: null }))
    expect(importBackup(s, bad).ok).toBe(false)
    expect(importBackup(s, 'PTC1.' + btoa(JSON.stringify({ save: null, meta: null }))).ok).toBe(false)
    expect(s.getItem(SAVE_KEY)).toBe('old')
  })

  it('기록만 있는 코드를 불러오면 진행 중인 판은 지워진다', () => {
    const a = new MemoryStorage()
    a.setItem(META_KEY, JSON.stringify(emptyMeta()))
    const b = new MemoryStorage()
    saveGame(b, state())
    expect(importBackup(b, exportBackup(a))).toEqual({ ok: true, hasSave: false, finishedRuns: 0 })
    expect(loadGame(b)).toBeNull()
  })
})
