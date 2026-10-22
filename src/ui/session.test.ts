// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { createInitialState, type GameState } from '../engine/state.ts'
import { turnsPerSeason } from '../engine/turn.ts'
import { loadGame, SAVE_KEY, type KeyValueStorage } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { rollAt } from './newGame.ts'
import { GameSession } from './session.ts'

function memory(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) }
}

function make(): { session: GameSession; storage: ReturnType<typeof memory>; initial: GameState } {
  const storage = memory()
  const initial = createInitialState({ name: '테스트', genre: 'aos', mode: 'standard', gacha: rollAt(7, 'aos', 0), seed: 7 })
  const ctx = { storage } as unknown as Ctx
  return { session: new GameSession(ctx, initial), storage, initial }
}

describe('GameSession', () => {
  it('commit은 상태를 바꾸고 저장하고 구독자를 부른다', () => {
    const { session, storage, initial } = make()
    let calls = 0
    session.subscribe(() => calls++)
    session.commit({ ...initial, money: 123 })
    expect(calls).toBe(1)
    expect(session.state.money).toBe(123)
    expect(storage.map.has(SAVE_KEY)).toBe(true)
    expect(loadGame(storage)?.money).toBe(123)
  })

  it('구독 해제 뒤에는 불리지 않는다', () => {
    const { session, initial } = make()
    let calls = 0
    const off = session.subscribe(() => calls++)
    off()
    session.commit({ ...initial, money: 1 })
    expect(calls).toBe(0)
  })

  it('seasonOver는 마지막 턴 직전 false, 마지막 턴 뒤 true', () => {
    const { session, initial } = make()
    const last = turnsPerSeason(initial.mode)
    session.commit({ ...initial, turnInSeason: last - 1 })
    expect(session.seasonOver()).toBe(false)
    session.commit({ ...initial, turnInSeason: last })
    expect(session.seasonOver()).toBe(true)
  })

  it('busy 중 playTurn은 아무 일도 하지 않는다', async () => {
    const { session } = make()
    session.busy = true
    const before = session.state
    await session.playTurn()
    expect(session.state).toBe(before)
  })
})
