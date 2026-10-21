import { describe, expect, it } from 'vitest'
import { ASKS, canNegotiate, negotiateSalary, negotiationChance } from './negotiation.ts'
import { acceptOffer, settleSeason } from './season.ts'
import { createInitialState, type GameState } from './state.ts'
import { offerTerms, salaryOf } from './teams.ts'
import type { Stats } from './types.ts'

const TEAM = { id: 'org_0', name: '나이트호크' }
const stats = (v: number): Stats => ({ reaction: v, accuracy: v, focus: v, judgment: v, mental: v, teamwork: v })

function make(o: Partial<GameState> = {}): GameState {
  const base = createInitialState({
    name: '테스트',
    genre: 'fps',
    mode: 'standard',
    seed: 7,
    gacha: { stats: stats(500), trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power: 500 },
  })
  return { ...base, age: 22, stage: 'pro2', team: TEAM, fame: 40, ...o }
}

describe('연봉 협상', () => {
  it('팀 소속이고 이번 시즌에 협상하지 않았을 때만 할 수 있다 (연습생·무소속은 못 한다)', () => {
    expect(canNegotiate(make())).toBe(true)
    expect(canNegotiate(make({ team: null }))).toBe(false)
    expect(canNegotiate(make({ negotiatedSeason: 1, season: 1 }))).toBe(false)
    expect(canNegotiate(make({ stage: 'amateur_team', path: 'academy' }))).toBe(false)
    expect(() => negotiateSalary(make({ team: null }), 'fair')).toThrow()
  })

  it('명성이 높을수록 성공 확률이 오르고 상한이 있으며, 크게 요구할수록 확률이 낮다', () => {
    const fair = ASKS.find((a) => a.id === 'fair')!
    const high = ASKS.find((a) => a.id === 'high')!
    expect(negotiationChance(make({ fame: 100 }), fair)).toBeGreaterThan(negotiationChance(make({ fame: 0 }), fair))
    expect(negotiationChance(make({ fame: 9999 }), fair)).toBeLessThanOrEqual(0.95)
    expect(negotiationChance(make(), high)).toBeLessThan(negotiationChance(make(), fair))
    expect(high.raise).toBeGreaterThan(fair.raise)
  })

  it('성공하면 월급이 오르고, 실패하면 그대로이며, 어느 쪽이든 이번 시즌 기회를 쓴다', () => {
    let up = 0
    let down = 0
    for (let seed = 1; seed <= 200; seed++) {
      const s = make({ seed })
      const before = salaryOf(s)
      const r = negotiateSalary(s, 'high')
      expect(canNegotiate(r.state)).toBe(false)
      if (r.success) {
        up++
        expect(r.salary).toBeGreaterThan(before)
      } else {
        down++
        expect(r.salary).toBe(before)
        expect(r.state.stats.mental).toBeLessThan(s.stats.mental) // 크게 요구했다 실패하면 멘탈이 흔들린다
      }
    }
    expect(up).toBeGreaterThan(40)
    expect(down).toBeGreaterThan(40)
  })

  it('같은 판·같은 요구면 같은 결과이고, 협상 안 함은 기회를 쓰지 않는다', () => {
    const s = make()
    expect(negotiateSalary(s, 'fair').success).toBe(negotiateSalary(s, 'fair').success)
    const skipped = negotiateSalary(s, null)
    expect(skipped.state).toBe(s)
    expect(canNegotiate(skipped.state)).toBe(true)
  })

  it('옛 세이브(협상 필드 없음)도 협상 전 상태로 본다', () => {
    const s = { ...make(), salaryMult: undefined, negotiatedSeason: undefined } as unknown as GameState
    expect(canNegotiate(s)).toBe(true)
    expect(salaryOf(s)).toBeGreaterThan(0)
  })

  it('팀을 옮겨도 올려 둔 월급은 제안 월급에 반영되고, 새 계약 직후에는 협상할 수 없고 한 턴이 지나면 다시 협상할 수 있다', () => {
    const raised = { ...make({ salaryMult: 1.5, negotiatedSeason: 1, season: 1 }), pendingOffers: { kind: 'transfer' as const, offers: [{ team: { id: 'org_3', name: '다른팀' }, perk: 'salary' as const }] } }
    const terms = offerTerms(raised, raised.pendingOffers.offers[0])!
    const moved = acceptOffer(raised, 0)
    // 시장 기준 월급이 아니라 지금 월급을 존중한 제안 월급이 그대로 이어진다
    expect(Math.abs(salaryOf(moved) - terms.offerSalary)).toBeLessThanOrEqual(1)
    expect(canNegotiate(moved)).toBe(false)
    expect(canNegotiate({ ...moved, turnCount: moved.turnCount + 1 })).toBe(true)
  })

  it('강등으로 팀이 바뀌어도 배율이 초기화된다', () => {
    let checked = 0
    for (let seed = 0; seed < 40; seed++) {
      const s = make({ seed, stats: stats(100), turnInSeason: 4, salaryMult: 1.5, everPro: true })
      const { state } = settleSeason(s)
      if (state.stage === 'amateur_team') {
        checked++
        expect(state.salaryMult).toBe(1)
      }
    }
    expect(checked).toBeGreaterThan(0)
  })
})
