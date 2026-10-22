// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameState, PendingOffers } from '../engine/state.ts'

const forced: { offers: PendingOffers | null; finished: boolean } = { offers: null, finished: false }

vi.mock('../engine/season.ts', async () => {
  const actual = await vi.importActual<typeof import('../engine/season.ts')>('../engine/season.ts')
  return {
    ...actual,
    settleSeason: (s: GameState) => {
      const r = actual.settleSeason(s)
      return { ...r, state: { ...r.state, pendingOffers: forced.offers, finished: forced.finished ? ('legend' as const) : r.state.finished } }
    },
  }
})

import { turnsPerSeason } from '../engine/turn.ts'
import { createInitialState } from '../engine/state.ts'
import { emptyMeta, type KeyValueStorage } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { rollAt } from './newGame.ts'
import { seasonScreen } from './seasonScreen.ts'

afterEach(() => {
  document.body.innerHTML = ''
  forced.offers = null
  forced.finished = false
})

function memory(): KeyValueStorage {
  const map = new Map<string, string>()
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) }
}

const before = (): GameState => {
  const s = createInitialState({ name: '테스트', genre: 'aos', mode: 'standard', gacha: rollAt(7, 'aos', 0), seed: 7 })
  return { ...s, turnInSeason: turnsPerSeason(s.mode) }
}

const ctx = () => ({ storage: memory(), meta: emptyMeta(), toHome: vi.fn(), toEnding: vi.fn(), toTitle: vi.fn() }) as unknown as Ctx

const buttons = (root: HTMLElement) => [...root.querySelectorAll<HTMLButtonElement>('button')]
const byText = (root: HTMLElement, text: string) => buttons(root).find((b) => b.textContent?.includes(text))
const cta = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('.plan-cta .btn.primary')!

const offer = () => ({ team: { id: 'aos_pro1_t1', name: 'T1' }, perk: 'salary' as const })

describe('시즌 결산 화면', () => {
  it('제안이 없으면 시작 버튼이 켜져 있고 제안 탭에 점이 없다', () => {
    const root = seasonScreen(ctx(), before())
    document.body.append(root)
    expect(cta(root).disabled).toBe(false)
    expect(cta(root).textContent).toBe('2시즌 시작')
    expect(root.querySelector('.segmented .dot')).toBeNull()
  })

  it('입단 제안이 있으면 어느 탭에서도 시작이 막히고 제안 탭에 점이 있다', () => {
    forced.offers = { kind: 'scout', offers: [offer()] }
    const root = seasonScreen(ctx(), before())
    document.body.append(root)
    expect(cta(root).disabled).toBe(true)
    expect(cta(root).textContent).toBe('제안을 골라 주세요')
    expect(root.querySelector('.segmented .dot')).not.toBeNull()
    for (const label of ['성장', '정산', '성적', '제안']) {
      byText(root, label)!.click()
      expect(cta(root).disabled).toBe(true)
    }
  })

  it('이적 제안은 거절하면 풀리고 점이 사라진다', async () => {
    forced.offers = { kind: 'transfer', offers: [offer()] }
    const root = seasonScreen(ctx(), before())
    document.body.append(root)
    byText(root, '제안')!.click()
    byText(root, '이적하지 않는다')!.click()
    await new Promise((r) => setTimeout(r, 0))
    expect(cta(root).disabled).toBe(false)
    expect(root.querySelector('.segmented .dot')).toBeNull()
  })

  it('커리어가 끝나는 시즌은 커리어 마무리', () => {
    forced.finished = true
    const root = seasonScreen(ctx(), before())
    expect(cta(root).textContent).toBe('커리어 마무리')
  })
})
