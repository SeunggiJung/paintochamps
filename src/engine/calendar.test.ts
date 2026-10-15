import { describe, expect, it } from 'vitest'
import competitions from '../data/competitions.json'
import { advanceCalendar } from './calendar.ts'
import { eventsFor, type EventDef } from './competitions.ts'
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
    const half = advanceCalendar(s, 0.5)
    expect(half.beats.map((b) => b.kind)).toEqual(['mid'])
    const mid = half.beats[0]
    if (mid.kind !== 'mid') throw new Error()
    expect(mid.size).toBe(6)
    expect(mid.rank).toBeGreaterThanOrEqual(1)
    expect(half.state.fame).toBe(s.fame) // 아직 보상 없음
    const end = advanceCalendar(half.state, 1)
    expect(end.beats.map((b) => b.kind)).toEqual(['end'])
    const result = end.beats[0]
    if (result.kind !== 'end') throw new Error()
    expect(result.table).toHaveLength(6)
    expect(end.state.fame).toBeCloseTo(s.fame + result.fame)
    expect(end.state.money).toBeCloseTo(s.money + result.money)
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

  it('프로 1부 AOS는 전반기 → … → 월드 순서로, 대회가 끝나는 시점마다 결과가 나온다', () => {
    const update = advanceCalendar(make({ stage: 'pro1' }, 1000), 1)
    const ends = update.beats.filter((b) => b.kind === 'end').map((b) => b.eventId)
    const order = ['split1', 'mid_qualifier', 'midseason', 'split2', 'playoffs', 'world']
    // 진출권을 못 얻은 대회는 열리지 않으므로 일부만 나올 수 있지만, 순서는 늘 달력 순이다
    expect(ends[0]).toBe('split1')
    expect(ends).toEqual(order.filter((id) => ends.includes(id)))
    const phases = update.beats.map((b) => b.phase)
    expect([...phases].sort((a, b) => a - b)).toEqual(phases)
  })

  it('모드와 상관없이 같은 달력이다: 튜토리얼 첫 턴에는 시즌 앞쪽 대회만 끝난다', () => {
    const s = make({ stage: 'pro1' }, 1000, 'tutorial')
    const r = applyTurn({ ...s, trainingMenu: ['basics', 'aim_lab', 'video_review'] }, REST)
    if (!r.ok) throw new Error(r.error)
    const ended = r.calendar.beats.filter((b) => b.kind === 'end')
    expect(ended[0].eventId).toBe('split1')
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
    expect(seen).toEqual(['mid', 'end'])
    const { report, state } = settleSeason(s)
    expect(report.events).toHaveLength(1)
    expect(report.events[0].fame).toBe(rewardFame)
    // 결산이 대회를 다시 치르거나 보상을 한 번 더 주지 않는다
    expect(state.fame - s.fame).toBeLessThan(report.events[0].fame + 10)
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
