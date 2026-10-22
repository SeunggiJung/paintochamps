// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { emptyMeta, type KeyValueStorage } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { createScreen } from './create.ts'
import { gachaScreen } from './gachaScreen.ts'
import { rollAt } from './newGame.ts'
import { titleScreen } from './title.ts'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

function memory(): KeyValueStorage {
  const map = new Map<string, string>()
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) }
}

const ctx = () => ({ storage: memory(), meta: emptyMeta(), toCreate: vi.fn(), toGacha: vi.fn(), toTitle: vi.fn(), toHome: vi.fn(), toCodex: vi.fn(), toShop: vi.fn() }) as unknown as Ctx
const btn = (root: HTMLElement, text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text))

describe('타이틀', () => {
  it('저장이 있으면 이어하기가 큰 버튼, 새로 시작은 보조', () => {
    const saved = createInitialState({ name: '봇', genre: 'aos', mode: 'standard', gacha: rollAt(7, 'aos', 0), seed: 7 })
    const root = titleScreen(ctx(), saved)
    expect(btn(root, '이어하기')!.className).toContain('primary')
    expect(btn(root, '새로 시작')!.className).not.toContain('primary')
  })

  it('저장이 없으면 새로 시작이 큰 버튼이고 타일 3개가 있다', () => {
    const root = titleScreen(ctx(), null)
    expect(btn(root, '새로 시작')!.className).toContain('primary')
    expect(root.querySelectorAll('.title-tile').length).toBe(3)
  })
})

describe('캐릭터 만들기', () => {
  it('이름이 비면 에러 문구', () => {
    const root = createScreen(ctx())
    document.body.append(root)
    const input = root.querySelector<HTMLInputElement>('input')!
    input.value = '   '
    btn(root, '능력치 뽑기')!.click()
    expect(root.querySelector('.error')!.textContent).toContain('이름')
  })
})

describe('뽑기', () => {
  const draft = { name: '겜돌이', genre: 'aos', mode: 'tutorial', seed: 7 } as const

  it('하단 버튼은 다시 뽑기·이 캐릭터로 시작 둘뿐', () => {
    const root = gachaScreen(ctx(), draft)
    document.body.append(root)
    expect([...root.querySelectorAll('.gacha-actions button')].map((b) => b.textContent)).toEqual(['다시 뽑기', '이 캐릭터로 시작'])
  })

  it('다시 뽑기 뒤 안내 줄에 횟수가 나온다', () => {
    const root = gachaScreen(ctx(), draft)
    document.body.append(root)
    vi.advanceTimersByTime(5000)
    btn(root, '다시 뽑기')!.click()
    vi.advanceTimersByTime(5000)
    expect(root.querySelector('.gacha-note')!.textContent).toBe('1번 다시 뽑았어요')
  })
})
