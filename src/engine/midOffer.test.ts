import { describe, expect, it } from 'vitest'
import { advanceCalendar, replayOngoing } from './calendar.ts'
import { acceptOffer, rollMidSeasonOffer } from './season.ts'
import { createInitialState, type GameState } from './state.ts'

const TEAM = { id: 'org_0', name: '나이트호크' }
const FLAT = { reaction: 300, accuracy: 300, focus: 300, judgment: 300, mental: 300, teamwork: 300 }

function make(o: Partial<GameState> = {}): GameState {
  const base = createInitialState({
    name: '테스트',
    genre: 'fps',
    mode: 'standard',
    seed: 11,
    gacha: { stats: FLAT, trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power: 300 },
  })
  return { ...base, age: 22, stage: 'pro2', team: TEAM, fame: 60, turnInSeason: 2, ...o }
}

/** 턴 번호를 바꿔 가며 처음 제안이 오는 상태를 찾는다 */
function firstOffer(base: GameState): GameState | null {
  for (let t = 0; t < 200; t++) {
    const s = rollMidSeasonOffer({ ...base, turnCount: t })
    if (s.pendingOffers) return s
  }
  return null
}

describe('시즌 중간 이적 제안', () => {
  it('팀에 소속되고 명성이 있으면 시즌 중간에 다른 팀에서 제안이 온다 (거절할 수 있는 이적 제안)', () => {
    const s = firstOffer(make())
    expect(s).not.toBeNull()
    expect(s!.pendingOffers!.kind).toBe('transfer')
    expect(s!.pendingOffers!.offers).toHaveLength(2)
    expect(s!.pendingOffers!.offers.every((o) => o.team.id !== TEAM.id)).toBe(true)
    expect(s!.midOfferSeason).toBe(s!.season)
    expect(acceptOffer(s!, null).pendingOffers).toBeNull()
    expect(acceptOffer(s!, 0).team?.id).not.toBe(TEAM.id)
  })

  it('시즌 중간에 옮기면 진행 중인 리그는 새 팀의 전력으로 다시 정해지고, 끝난 대회는 그대로다', () => {
    const base = make({ stage: 'pro2', mode: 'standard' })
    const mid = advanceCalendar(base, 0.3).state
    const before = mid.seasonRun!.runs.find((r) => r.id === 'pro2_spring')!
    expect(before.revealed).not.toBe('end')
    const offered = firstOffer(mid)!
    const moved = acceptOffer(offered, 0)
    const after = moved.seasonRun!.runs.find((r) => r.id === 'pro2_spring')!
    const me = (rows: NonNullable<typeof after.table>) => rows.find((r) => r.isPlayer)!.name
    expect(me(after.table!)).toBe(moved.team!.name)
    expect(after.order.find((t) => t.isPlayer)!.name).toBe(moved.team!.name)
    expect(after.revealed).toBe(before.revealed)
    // 같은 팀 전력이면 같은 결과 (옮기지 않고 다시 정해도 달라지지 않는다)
    expect(replayOngoing(mid).seasonRun!.runs[0].table).toEqual(before.table)
    // 이미 끝난 대회는 건드리지 않는다
    const ended = advanceCalendar(base, 1).state
    expect(replayOngoing({ ...ended, team: offered.pendingOffers!.offers[0].team }).seasonRun).toEqual(ended.seasonRun)
  })

  it('같은 판·같은 턴이면 같은 결과다', () => {
    const a = rollMidSeasonOffer(make({ turnCount: 7 }))
    const b = rollMidSeasonOffer(make({ turnCount: 7 }))
    expect(a).toEqual(b)
  })

  it('시즌당 한 번만 온다', () => {
    const s = firstOffer(make())!
    const declined = acceptOffer(s, null)
    for (let t = 0; t < 100; t++) expect(rollMidSeasonOffer({ ...declined, turnCount: t }).pendingOffers).toBeNull()
  })

  it('팀이 없거나 명성이 모자라거나 시즌의 마지막 턴이면 오지 않는다', () => {
    expect(firstOffer(make({ team: null }))).toBeNull()
    expect(firstOffer(make({ fame: 5 }))).toBeNull()
    expect(firstOffer(make({ turnInSeason: 4 }))).toBeNull()
    expect(firstOffer(make({ stage: 'local_cup' }))).toBeNull()
  })
})
