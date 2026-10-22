import { describe, expect, it } from 'vitest'
import { acceptOffer } from '../engine/season.ts'
import { createInitialState, type GameState, type PendingOffers } from '../engine/state.ts'
import { rollAt } from './newGame.ts'
import { canStartNextSeason, settleAlerts, startLabel } from './seasonFlow.ts'

const base = (): GameState => createInitialState({ name: '테스트', genre: 'aos', mode: 'standard', gacha: rollAt(7, 'aos', 0), seed: 7 })
const offer = { team: { id: 'aos_pro1_x', name: 'X' } } as unknown as PendingOffers['offers'][number]
const withOffers = (kind: PendingOffers['kind']): GameState => ({ ...base(), pendingOffers: { kind, offers: [offer] } })

describe('결산 흐름', () => {
  it('제안이 없으면 시작할 수 있다', () => {
    const s = base()
    expect(canStartNextSeason(s)).toEqual({ ok: true, reason: null })
    expect(settleAlerts(s).offers).toBe(false)
    expect(startLabel(s, 3)).toBe('4시즌 시작')
  })

  it.each(['scout', 'callup', 'transfer', 'overseas'] as const)('%s 제안이 남아 있으면 시작할 수 없다', (kind) => {
    const s = withOffers(kind)
    expect(canStartNextSeason(s).ok).toBe(false)
    expect(canStartNextSeason(s).reason).toBe('제안을 골라 주세요')
    expect(settleAlerts(s).offers).toBe(true)
    expect(startLabel(s, 3)).toBe('제안을 골라 주세요')
  })

  it('거절할 수 있는 제안은 거절하면 풀린다, 입단 제안은 거절할 수 없다', () => {
    const declined = acceptOffer(withOffers('transfer'), null)
    expect(canStartNextSeason(declined).ok).toBe(true)
    expect(() => acceptOffer(withOffers('scout'), null)).toThrow()
  })

  it('끝난 커리어는 커리어 마무리', () => {
    const s = { ...base(), finished: 'legend' } as GameState
    expect(startLabel(s, 5)).toBe('커리어 마무리')
  })
})
