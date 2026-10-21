import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialState, type GameState } from '../engine/state.ts'
import { negotiationChance, ASKS } from '../engine/negotiation.ts'
import { rollAtMin } from '../ui/newGame.ts'
import { buyItem, loadMeta, META_KEY, perksFromMeta, recordFinish, tokensFor, useSrTicket, type KeyValueStorage } from './storage.ts'

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
const make = (o: Partial<GameState> = {}): GameState => ({
  ...createInitialState({ name: '테스트', genre: 'fps', mode: 'standard', seed: 9, gacha: { stats, trait: { id: 'grit', name: '끈기', stat: 'focus' }, grade: 'R', power: 100 } }),
  ...o,
})

let storage: MemoryStorage
beforeEach(() => {
  storage = new MemoryStorage()
})

const withTokens = (tokens: number) => storage.setItem(META_KEY, JSON.stringify({ ...loadMeta(storage), tokens }))

describe('업적 토큰과 상점', () => {
  it('판을 마치면 달성한 업적만큼 토큰을 받고, 다시 달성하면 적게 받는다', () => {
    const s = make({ finished: 'hobbyist', worldTitles: 1, worldAppearances: 1, history: [] })
    const first = tokensFor(loadMeta(storage), s)
    const meta = recordFinish(storage, s)
    expect(meta.tokens).toBe(first)
    expect(meta.tokensEarned).toBe(first)
    const again = tokensFor(meta, s)
    expect(again).toBeLessThanOrEqual(first)
  })

  it('끝낸 커리어의 경력이 명예의 전당에 쌓인다', () => {
    const meta = recordFinish(storage, make({ finished: 'hobbyist', stints: [{ team: { id: 'a', name: 'A' }, stage: 'pro1', fromSeason: 1, fromAge: 16 }] }))
    expect(meta.careers).toHaveLength(1)
    expect(meta.careers[0].career.stints[0].teamName).toBe('A')
  })

  it('토큰이 모자라면 못 사고, 사면 토큰이 줄고 영구 효과가 생긴다', () => {
    expect(buyItem(storage, 'negotiation')).toBeNull()
    withTokens(30)
    const m = buyItem(storage, 'negotiation')!
    expect(m.tokens).toBe(20)
    expect(m.inventory.negotiation).toBe(1)
    expect(perksFromMeta(m).negotiation).toBeCloseTo(0.03)
    // 단계가 끝나면 더 살 수 없다
    withTokens(100)
    buyItem(storage, 'negotiation')
    buyItem(storage, 'negotiation')
    expect(buyItem(storage, 'negotiation')).toBeNull()
  })

  it('협상 노하우는 연봉 협상 확률을 영구히 올려 주고, 인맥 쌓기는 시작 명성을 올려 준다', () => {
    const base = make({ fame: 10 })
    const ask = ASKS[0]
    const boosted = { ...base, perks: { negotiation: 0.03 } }
    expect(negotiationChance(boosted, ask) - negotiationChance(base, ask)).toBeCloseTo(0.03)
    const fameBase = make().fame
    const withPerk = createInitialState({ name: 'x', genre: 'fps', mode: 'standard', seed: 1, gacha: { stats, trait: { id: 'grit', name: '끈기', stat: 'focus' }, grade: 'R', power: 100 }, perks: { fame: 5 } })
    expect(withPerk.fame - fameBase).toBe(5)
  })

  it('SR 보장권은 한 장씩 줄고, 쓰면 SR 이상만 나온다', () => {
    expect(useSrTicket(storage)).toBeNull()
    withTokens(20)
    buyItem(storage, 'sr_ticket')
    expect(useSrTicket(storage)!.inventory.sr_ticket).toBe(0)
    for (let i = 0; i < 15; i++) expect(['SR', 'SSR', 'UR']).toContain(rollAtMin(123, 'fps', i).grade)
    expect(rollAtMin(123, 'fps', 3)).toEqual(rollAtMin(123, 'fps', 3))
  })
})
