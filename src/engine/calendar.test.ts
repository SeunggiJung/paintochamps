import { describe, expect, it } from 'vitest'
import competitions from '../data/competitions.json'
import { advanceCalendar } from './calendar.ts'
import { eventsFor, isInvited, isUnofficial, type EventDef } from './competitions.ts'
import { settleSeason } from './season.ts'
import { createInitialState, type GameState } from './state.ts'
import { applyTurn, startNextSeason, turnsPerSeason } from './turn.ts'
import type { Stats } from './types.ts'

const stats = (v: number): Stats => ({ reaction: v, accuracy: v, focus: v, judgment: v, mental: v, teamwork: v })
const TEAM = { id: 'org_0', name: '나이트호크' }

function make(o: Partial<GameState> = {}, power = 700, mode: GameState['mode'] = 'standard'): GameState {
  const base = createInitialState({
    name: '테스트',
    genre: 'aos',
    mode,
    seed: 33,
    gacha: { stats: stats(power), trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power },
  })
  return { ...base, age: 24, stage: 'pro1', team: TEAM, fame: 60, debutTeamId: 'org_0', everPro: true, ...o }
}

const REST = [{ id: 'rest' }, { id: 'rest' }] as const

describe('대회 일정 데이터', () => {
  const all: EventDef[][] = [
    ...Object.entries(competitions.stages)
      .filter(([k]) => k !== 'pro1')
      .map(([, v]) => v as EventDef[]),
    competitions.stages.pro1.aos as EventDef[],
    competitions.stages.pro1.fps as EventDef[],
  ]

  it('모든 대회의 기간은 0~1 안에서 시작이 끝보다 앞이다', () => {
    for (const list of all) for (const e of list) expect(e.span[0] >= 0 && e.span[1] <= 1 && e.span[0] < e.span[1], e.id).toBe(true)
  })

  it('앞선 대회에 기대는 대회(상위 팀 이어받기·진출권)는 그 대회가 끝난 뒤에 시작한다', () => {
    for (const list of all) {
      for (const e of list) {
        const needs = e.needs
        const deps = [e.from?.event, ...(needs ? list.filter((x) => x.qualifies?.some((q) => q.to === needs) || x.pointsQualify?.to === needs).map((x) => x.id) : [])].filter(Boolean)
        for (const d of deps) expect(list.find((x) => x.id === d)!.span[1], `${e.id} after ${d}`).toBeLessThanOrEqual(e.span[0])
      }
    }
  })
})

describe('시간에 따른 대회 진행', () => {
  it('리그는 절반 시점에 중간 순위를, 끝에 최종 순위와 보상을 공개한다', () => {
    const s = make({ stage: 'pro2', mode: 'standard' })
    // 프로 2부는 봄(0~50%)·가을(50~100%) 두 리그다. 봄 리그 절반(25%)에 중간 순위, 50%에 최종 순위
    const quarter = advanceCalendar(s, 0.25)
    expect(quarter.beats.map((b) => b.kind)).toEqual(['mid'])
    const mid = quarter.beats[0]
    if (mid.kind !== 'mid') throw new Error()
    expect(mid.eventId).toBe('pro2_spring')
    expect(mid.size).toBe(6)
    expect(mid.rank).toBeGreaterThanOrEqual(1)
    expect(quarter.state.fame).toBe(s.fame) // 아직 보상 없음
    const half = advanceCalendar(quarter.state, 0.5)
    expect(half.beats.map((b) => b.kind)).toEqual(['end'])
    const result = half.beats[0]
    if (result.kind !== 'end') throw new Error()
    expect(result.table).toHaveLength(6)
    expect(half.state.fame).toBeCloseTo(s.fame + result.fame)
    expect(half.state.money).toBeCloseTo(s.money + result.money)
    const autumn = advanceCalendar(half.state, 1)
    expect(autumn.beats.map((b) => `${b.eventId}:${b.kind}`)).toEqual(['pro2_autumn:mid', 'pro2_autumn:end'])
  })

  it('같은 시점을 다시 진행해도 같은 결과를 두 번 공개하거나 보상을 두 번 주지 않는다', () => {
    const once = advanceCalendar(make({ stage: 'pro2' }), 1)
    const again = advanceCalendar(once.state, 1)
    expect(again.beats).toHaveLength(0)
    expect(again.state.fame).toBe(once.state.fame)
  })

  it('같은 판이면 결과가 같고, 중간에 나눠 진행해도 한 번에 진행한 것과 같다', () => {
    const s = make({ stage: 'pro1' })
    const direct = advanceCalendar(s, 1)
    let split = advanceCalendar(s, 0.3).state
    split = advanceCalendar(split, 0.7).state
    split = advanceCalendar(split, 1).state
    expect(split.seasonRun!.runs.map((r) => [r.id, r.placement])).toEqual(direct.state.seasonRun!.runs.map((r) => [r.id, r.placement]))
  })

  it('프로 1부 AOS는 LCK컵 → … → 월드 순서로, 대회가 끝나는 시점마다 결과가 나온다', () => {
    const update = advanceCalendar(make({ stage: 'pro1' }, 1000), 1)
    const ends = update.beats.filter((b) => b.kind === 'end').map((b) => b.eventId)
    const order = ['lck_cup_groups', 'lck_cup', 'first_stand', 'rounds12', 'road_to_msi', 'msi', 'legend_group', 'rise_group', 'season_playin', 'playoffs', 'world']
    // 진출권을 못 얻은 대회는 열리지 않으므로 일부만 나올 수 있지만, 순서는 늘 달력 순이다
    expect(ends[0]).toBe('lck_cup_groups')
    expect(ends).toEqual(order.filter((id) => ends.includes(id)))
    const phases = update.beats.map((b) => b.phase)
    expect([...phases].sort((a, b) => a - b)).toEqual(phases)
  })

  it('모드와 상관없이 같은 달력이다: 튜토리얼 첫 턴에는 시즌 앞쪽 대회만 끝난다', () => {
    const s = make({ stage: 'pro1' }, 1000, 'tutorial')
    const r = applyTurn({ ...s, trainingMenu: ['basics', 'aim_lab', 'video_review'] }, REST)
    if (!r.ok) throw new Error(r.error)
    const ended = r.calendar.beats.filter((b) => b.kind === 'end')
    expect(ended[0].eventId).toBe('lck_cup_groups')
    for (const b of ended) expect(b.phase).toBeLessThanOrEqual(0.5)
    expect(ended.map((b) => b.eventId)).not.toContain('world')
    expect(r.calendar.phaseAfter).toBe(0.5)
  })

  it('턴을 진행하면 그 턴에 닿은 대회가 공개되고, 마지막 턴까지 가면 결산이 같은 결과를 이어받는다', () => {
    let s = make({ stage: 'pro2' }, 700)
    const seen: string[] = []
    let rewardFame = 0
    for (let i = 0; i < turnsPerSeason('standard'); i++) {
      const r = applyTurn({ ...s, trainingMenu: ['basics', 'aim_lab', 'video_review'] }, REST)
      if (!r.ok) throw new Error(r.error)
      for (const b of r.calendar.beats) {
        seen.push(b.kind)
        if (b.kind === 'end') rewardFame += b.fame
      }
      s = r.state
    }
    expect(seen).toEqual(['mid', 'end', 'mid', 'end'])
    const { report, state } = settleSeason(s)
    expect(report.events).toHaveLength(2)
    expect(report.events.reduce((sum, e) => sum + e.fame, 0)).toBe(rewardFame)
    // 결산이 대회를 다시 치르거나 보상을 한 번 더 주지 않는다
    expect(state.fame - s.fame).toBeLessThan(rewardFame + 10)
  })

  it('미리보기용(calendar=false)은 대회를 진행하지 않는다', () => {
    const s = make({ stage: 'pro2', trainingMenu: ['basics', 'aim_lab', 'video_review'] })
    const r = applyTurn(s, REST, undefined, false)
    if (!r.ok) throw new Error(r.error)
    expect(r.calendar.beats).toHaveLength(0)
    expect(r.state.seasonRun).toBeNull()
  })

  it('시즌이 바뀌면 대회 기록이 새로 시작된다', () => {
    const settled = settleSeason(advanceCalendar(make({ stage: 'pro2', turnInSeason: 4 }), 1).state).state
    const next = settled.finished ? settled : startNextSeason({ ...settled, pendingOffers: null })
    expect(next.seasonRun).toBeNull()
  })

  it('진출하지 못한 대회는 열리지 않는다 (약한 선수는 월드까지 못 간다)', () => {
    const update = advanceCalendar(make({ stage: 'pro1', team: TEAM }, 150), 1)
    expect(update.beats.some((b) => b.kind === 'end' && b.eventId === 'world')).toBe(false)
    expect(eventsFor(update.state).some((e) => e.id === 'world')).toBe(true)
  })
})

describe('비공식 초청 대회 (슈퍼 인비테이셔널)', () => {
  const prev = (placement: number) => [{ season: 5, age: 23, stage: 'pro1' as const, events: [{ id: 'legend_group', name: 'LCK 라운드 3~4 레전드 그룹', placement, fieldSize: 5 }] }]
  const invitational = () => eventsFor({ stage: 'pro1', genre: 'aos', mode: 'standard', season: 6 }).find((e) => e.id === 'invitational')!

  it('2시즌에 한 번(짝수 시즌)만 일정에 있고, 비공식 대회로 분류된다', () => {
    const idsAt = (season: number) => eventsFor({ stage: 'pro1', genre: 'aos', mode: 'standard', season }).map((e) => e.id)
    expect(idsAt(5)).not.toContain('invitational')
    expect(idsAt(6)).toContain('invitational')
    expect(isUnofficial('invitational')).toBe(true)
    expect(isUnofficial('world')).toBe(false)
  })

  it('명성이 부족하거나 직전 시즌 성적이 낮으면 초청받지 못한다', () => {
    const ev = invitational()
    expect(isInvited(make({ season: 6, fame: 200, history: prev(2) }), ev)).toBe(true)
    expect(isInvited(make({ season: 6, fame: 10, history: prev(2) }), ev)).toBe(false)
    expect(isInvited(make({ season: 6, fame: 200, history: prev(8) }), ev)).toBe(false)
    expect(isInvited(make({ season: 6, fame: 200, history: [] }), ev)).toBe(false)
    expect(isInvited(make({ season: 6, fame: 200, team: null, history: prev(2) }), ev)).toBe(false)
  })

  it('직전 시즌에 월드 챔피언십에 나갔다면 리그 성적이 낮아도 초청받는다', () => {
    const history = [{ season: 5, age: 23, stage: 'pro1' as const, events: [{ id: 'legend_group', name: 'LCK 라운드 3~4 레전드 그룹', placement: 9, fieldSize: 10 }, { id: 'world', name: '월드 챔피언십', placement: 8, fieldSize: 16 }] }]
    expect(isInvited(make({ season: 6, fame: 200, history }), invitational())).toBe(true)
  })

  it('초청받은 시즌에는 대회를 치르고 상금을 받는다. 초청이 없으면 불참으로 넘어간다', () => {
    const invited = advanceCalendar(make({ season: 6, fame: 200, history: prev(2) }), 1)
    expect(invited.state.seasonRun!.runs.some((r) => r.id === 'invitational')).toBe(true)
    const none = advanceCalendar(make({ season: 6, fame: 10, history: prev(2) }), 1)
    expect(none.state.seasonRun!.runs.some((r) => r.id === 'invitational')).toBe(false)
    expect(none.state.seasonRun!.skipped).toContain('invitational')
  })
})
