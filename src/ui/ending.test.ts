// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInitialState, type GameState } from '../engine/state.ts'
import { emptyMeta, type KeyValueStorage } from '../save/storage.ts'
import type { Ctx, EndingInfo } from './app.ts'
import { endingScreen } from './ending.ts'
import { rollAt } from './newGame.ts'

afterEach(() => {
  document.body.innerHTML = ''
})

function memory(): KeyValueStorage {
  const map = new Map<string, string>()
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) }
}

const season = (n: number) => ({ season: n, age: 15 + n, stage: 'pro1', events: [], stats: {}, team: null }) as unknown as GameState['history'][number]

function make(seasons: number): GameState {
  const s = createInitialState({ name: '테스트', genre: 'aos', mode: 'standard', gacha: rollAt(7, 'aos', 0), seed: 7 })
  return { ...s, finished: 'hobbyist', history: Array.from({ length: seasons }, (_, i) => season(i + 1)) }
}

const ctx = () => ({ storage: memory(), meta: emptyMeta(), toCodex: vi.fn(), toTitle: vi.fn() }) as unknown as Ctx
const info = (patch: Partial<EndingInfo> = {}): EndingInfo => ({ isNew: false, achievements: [], tokens: 0, ...patch })
const btn = (root: HTMLElement, text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text))

describe('엔딩 화면', () => {
  it('기록 세그먼트가 4개이고 기본은 요약', () => {
    const root = endingScreen(ctx(), make(3), info())
    const segs = [...root.querySelectorAll('.segmented-btn')]
    expect(segs.map((b) => b.textContent)).toEqual(['요약', '수상', '구단', '시즌별'])
    expect(root.querySelector('[aria-selected="true"]')?.textContent).toBe('요약')
    expect(root.textContent).toContain('커리어 요약')
  })

  it('시즌별은 최근 6시즌 + 더 보기', () => {
    const root = endingScreen(ctx(), make(10), info())
    document.body.append(root)
    btn(root, '시즌별')!.click()
    expect(root.querySelectorAll('.timeline-row').length).toBe(6)
    btn(root, '더 보기')!.click()
    expect(root.querySelectorAll('.timeline-row').length).toBe(10)
  })

  it('업적이 없으면 업적 요약 줄이 없다', () => {
    expect(endingScreen(ctx(), make(1), info()).textContent).not.toContain('업적')
    const withAch = endingScreen(ctx(), make(1), info({ achievements: [{ id: 'golden_road', isNew: true }], tokens: 3 }))
    expect(withAch.textContent).toContain('업적 1개')
    expect(withAch.textContent).toContain('🪙 +3')
  })

  it('새 기록이면 칩이 보인다', () => {
    expect(endingScreen(ctx(), make(1), info({ isNew: true })).textContent).toContain('도감에 새로 기록!')
    expect(endingScreen(ctx(), make(1), info()).textContent).not.toContain('도감에 새로 기록!')
  })
})
