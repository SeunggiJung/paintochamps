// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chooseSeasonTraining, trainingMenuOf } from '../engine/training.ts'
import { createInitialState, type GameState } from '../engine/state.ts'
import type { KeyValueStorage } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { rollAt } from './newGame.ts'
import { GameSession } from './session.ts'
import { homeTab } from './tabs/homeTab.ts'
import { playerTab } from './tabs/playerTab.ts'
import { seasonTab } from './tabs/seasonTab.ts'

afterEach(() => {
  document.body.innerHTML = ''
})

function memory(): KeyValueStorage {
  const map = new Map<string, string>()
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) }
}

function baseState(patch: Partial<GameState> = {}): GameState {
  let s = createInitialState({ name: '테스트', genre: 'aos', mode: 'standard', gacha: rollAt(7, 'aos', 0), seed: 7 })
  s = chooseSeasonTraining(s, trainingMenuOf(s)[0])
  return { ...s, ...patch }
}

const proState = (patch: Partial<GameState> = {}) =>
  baseState({ stage: 'pro1', team: { id: 'aos_pro1_t1', name: 'T1' } as GameState['team'], turnCount: 3, teamSinceTurn: 0, negotiatedSeason: 0, ...patch })

function session(state: GameState): GameSession {
  return new GameSession({ storage: memory() } as unknown as Ctx, state)
}

const find = (root: HTMLElement, text: string) => [...root.querySelectorAll<HTMLElement>('button, .chip')].find((b) => b.textContent?.includes(text))

describe('홈 탭', () => {
  it('다음 턴 진행 버튼이 있고 busy면 비활성', () => {
    const s = session(baseState())
    const btn = find(homeTab(s), '다음 턴 진행') as HTMLButtonElement
    expect(btn).toBeTruthy()
    expect(btn.disabled).toBe(false)
    s.busy = true
    expect((find(homeTab(s), '다음 턴 진행') as HTMLButtonElement).disabled).toBe(true)
  })

  it('연봉 협상 가능 칩은 협상할 수 있을 때만', () => {
    expect(find(homeTab(session(baseState())), '연봉 협상 가능')).toBeUndefined()
    expect(find(homeTab(session(proState())), '연봉 협상 가능')).toBeTruthy()
  })

  it('상점·꾸미기를 누르면 session.openShop을 부른다', () => {
    const s = session(baseState())
    const spy = vi.spyOn(s, 'openShop').mockResolvedValue()
    find(homeTab(s), '상점·꾸미기')!.click()
    expect(spy).toHaveBeenCalled()
  })
})

describe('선수 탭', () => {
  it('계약 카드가 있고 협상이 불가능하면 연봉 협상 버튼이 비활성', () => {
    const root = playerTab(session(baseState()))
    expect(root.textContent).toContain('계약')
    expect((find(root, '연봉 협상') as HTMLButtonElement).disabled).toBe(true)
    expect((find(playerTab(session(proState())), '연봉 협상') as HTMLButtonElement).disabled).toBe(false)
  })

  it('장비·시설 영역에 구매 버튼이 없다', () => {
    const root = playerTab(session(proState()))
    expect(root.textContent).toContain('구매는 시즌 시작 때 지출 계획에서 해요')
    expect(find(root, '구매')?.tagName).not.toBe('BUTTON')
  })

  it('내 경력 행이 session.showCareer를 부른다', () => {
    const s = session(baseState())
    const spy = vi.spyOn(s, 'showCareer').mockResolvedValue()
    find(playerTab(s), '내 경력')!.click()
    expect(spy).toHaveBeenCalled()
  })
})

describe('시즌 탭', () => {
  it('seasonRun이 없으면 다른 팀 성적 행을 숨긴다', () => {
    expect(find(seasonTab(session(baseState())), '다른 팀 성적')).toBeUndefined()
  })

  it('seasonTraining이 null이어도 그려진다', () => {
    const root = seasonTab(session(baseState({ seasonTraining: null })))
    expect(root.textContent).toContain('아직 정하지 않았어요')
  })
})
