import routes from '../data/routes.json'
import { eventsFor, midPhase, playerPower, type EventDef } from './competitions.ts'
import { moneyScale } from './economy.ts'
import { academyName, makeOpponents } from './field.ts'
import { createRng, mixSeed } from './rng.ts'
import type { GameState, RunRecord, SeasonRun, StandingRow } from './state.ts'
import { teamBoost } from './teams.ts'
import { runElimination, runLeagueDetailed, type Standing, type Team } from './tournament.ts'

/**
 * 시즌 일정. 대회마다 기간(span)이 있고, 시간이 흘러 기간이 시작되면 결과가 정해지고(그때의 능력치로),
 * 리그는 기간의 절반에 중간 순위가, 끝나면 최종 순위·보상이 플레이어에게 공개된다.
 * 결과는 대회마다 따로 만든 시드 난수로 정해져서 같은 판이면 언제 불러와도 같다.
 */

export type CalendarBeat =
  | { kind: 'mid'; phase: number; eventId: string; name: string; table: StandingRow[]; rank: number; size: number }
  | {
      kind: 'end'
      phase: number
      eventId: string
      name: string
      placement: number
      fieldSize: number
      fame: number
      money: number
      /** 리그면 최종 순위표 */
      table: StandingRow[] | null
      /** 토너먼트면 1~3위 팀 이름 */
      top: string[]
      advanced: string[]
      /** 월드 챔피언십 */
      world: boolean
    }

/** 이번 시간 구간에서 진행 중이던 대회 (연출용) */
export interface RunningEvent {
  id: string
  name: string
  from: number
  to: number
}

export interface CalendarUpdate {
  state: GameState
  /** 시간 순서로 공개할 중간·최종 결과 */
  beats: CalendarBeat[]
  running: RunningEvent[]
  phaseBefore: number
  phaseAfter: number
}

const rows = (standings: Standing[]): StandingRow[] =>
  standings.map((s) => ({ name: s.team.name, wins: s.wins, losses: s.losses, isPlayer: !!s.team.isPlayer }))

function playerTeam(state: GameState, ev: EventDef, power: number): Team {
  const base = state.team ?? { id: 'player', name: state.name }
  const name = ev.field?.names === 'academy' ? academyName(base) : ev.field?.names === 'cafe' ? (state.cafeTeamName ?? `${state.name}팀`) : base.name
  return { id: base.id, name, power, isPlayer: true }
}

/** 대회 하나를 치러 결과를 정한다. 진출권이 없거나 상위 팀에 못 들었으면 null(열리지 않음). */
function playEvent(state: GameState, ev: EventDef, index: number, run: SeasonRun, events: EventDef[]): { record: RunRecord; qualified: string[]; points: number } | null {
  if (ev.needs && !run.qualified.includes(ev.needs)) return null
  const rng = createRng(mixSeed(state.seed, state.season, 0x5ea5, index))
  // 소속 팀이 리그 평균보다 강하면 전력이 오르고 약하면 내려간다 (PC방 대회처럼 팀 없이 나가는 대회는 제외)
  const power = playerPower(state, ev.big ?? false) + (ev.field?.names === 'cafe' ? 0 : teamBoost(state))

  let teams: Team[]
  if (ev.from) {
    const prev = run.runs.find((r) => r.id === ev.from!.event)
    if (!prev) return null
    const top = prev.order.slice(0, ev.from.top)
    if (!top.some((t) => t.isPlayer)) return null
    teams = top.map((t) => (t.isPlayer ? { ...t, power } : t))
  } else {
    const f = ev.field!
    const me = playerTeam(state, ev, power)
    teams = [me, ...makeOpponents(rng, f.names, f.tier, f.size - 1, new Set([me.id]), f.names === 'cafe' || f.names === 'intl' ? undefined : { seed: state.seed, season: state.season })]
  }

  let order: Team[]
  let mid: StandingRow[] | null = null
  let table: StandingRow[] | null = null
  if (ev.format === 'league') {
    const { final, mid: midStandings } = runLeagueDetailed(rng, teams, ev.rounds ?? 1, ev.bestOf)
    order = final.map((s) => s.team)
    mid = rows(midStandings)
    table = rows(final)
  } else {
    order = runElimination(rng, [...teams].sort((a, b) => b.power - a.power), ev.k ?? 1, ev.bestOf)
  }
  const placement = order.findIndex((t) => t.isPlayer) + 1

  const qualified: string[] = []
  const nameOf = (id: string) => events.find((e) => e.id === id)?.name ?? id
  const advanced: string[] = []
  for (const q of ev.qualifies ?? []) {
    if (placement <= q.top) {
      qualified.push(q.to)
      advanced.push(`${nameOf(q.to)} 진출!`)
    }
  }
  let points = run.points
  if (ev.points) points += ev.points[placement - 1] ?? 0
  if (ev.pointsQualify && points >= ev.pointsQualify.minPoints && !qualified.includes(ev.pointsQualify.to) && !run.qualified.includes(ev.pointsQualify.to)) {
    qualified.push(ev.pointsQualify.to)
    advanced.push(`${nameOf(ev.pointsQualify.to)} 진출! (챔피언십 포인트)`)
  }

  const reward = ev.rewards.find((r) => placement <= r.upTo) ?? ev.rewards[ev.rewards.length - 1]
  return {
    record: { id: ev.id, name: ev.name, placement, fieldSize: order.length, fame: reward.fame, money: reward.money * moneyScale(state.stage), order, mid, table, advanced, revealed: 'none' },
    qualified,
    points,
  }
}

/**
 * 이번 시즌의 진행 기록. 시즌이 바뀌었으면 새로 만든다.
 * 시즌을 아카데미 입단 테스트 초대를 받은 채로 시작하면 PC방 대회에는 나가지 않는다.
 */
export function runOf(state: GameState): SeasonRun {
  if (state.seasonRun && state.seasonRun.season === state.season) return state.seasonRun
  const skipCafe = state.academyInvite ? eventsFor(state).filter((e) => e.field?.names === 'cafe').map((e) => e.id) : []
  return { season: state.season, phase: 0, runs: [], skipped: skipCafe, qualified: [], points: 0 }
}

/**
 * 시간을 toPhase(0~1)까지 진행한다. 기간이 시작된 대회는 결과를 정하고, 절반·끝 시점에 닿은 대회는 결과를 공개한다(보상 반영).
 * 이미 공개한 것은 다시 공개하지 않으므로 여러 번 불러도 안전하다.
 */
export function advanceCalendar(state: GameState, toPhase: number): CalendarUpdate {
  const events = eventsFor(state)
  let run = runOf(state)
  const phaseBefore = run.phase
  let next = state
  const beats: CalendarBeat[] = []
  const running: RunningEvent[] = []

  events.forEach((ev, index) => {
    let rec = run.runs.find((r) => r.id === ev.id)
    // 기간이 시작되면 결과를 정한다
    if (!rec && !run.skipped.includes(ev.id) && ev.span[0] < toPhase) {
      const played = playEvent(next, ev, index, run, events)
      if (!played) run = { ...run, skipped: [...run.skipped, ev.id] }
      else {
        rec = played.record
        run = { ...run, runs: [...run.runs, rec], qualified: [...new Set([...run.qualified, ...played.qualified])], points: played.points }
      }
    }
    if (!rec) return

    // 이번 구간에서 진행 중인 기간
    const from = Math.max(ev.span[0], phaseBefore)
    const to = Math.min(ev.span[1], toPhase)
    if (to > from) running.push({ id: ev.id, name: ev.name, from, to })

    const mp = midPhase(ev)
    if (rec.revealed === 'none' && mp !== null && rec.mid && mp <= toPhase && ev.span[1] > mp) {
      beats.push({ kind: 'mid', phase: mp, eventId: ev.id, name: ev.name, table: rec.mid, rank: rec.mid.findIndex((r) => r.isPlayer) + 1, size: rec.mid.length })
      rec = { ...rec, revealed: 'mid' }
    }
    if (rec.revealed !== 'end' && ev.span[1] <= toPhase) {
      next = { ...next, fame: next.fame + rec.fame, money: next.money + rec.money }
      const advancedNotes = [...rec.advanced]
      // PC방 대회에서 상위 성적을 내면 그 자리에서 아카데미 입단 테스트에 초대된다 (이번 시즌 결산에서 시험을 본다)
      if (ev.field?.names === 'cafe' && rec.placement <= routes.cafe.inviteTop && !next.academyInvite) {
        next = { ...next, academyInvite: true }
        advancedNotes.push('아카데미에서 입단 테스트 초대장이 날아왔다!')
      }
      beats.push({
        kind: 'end',
        phase: ev.span[1],
        eventId: ev.id,
        name: ev.name,
        placement: rec.placement,
        fieldSize: rec.fieldSize,
        fame: rec.fame,
        money: rec.money,
        table: rec.table,
        top: rec.order.slice(0, 3).map((t) => t.name),
        advanced: advancedNotes,
        world: !!ev.world,
      })
      rec = { ...rec, revealed: 'end' }
    }
    const updated = rec
    run = { ...run, runs: run.runs.map((r) => (r.id === updated.id ? updated : r)) }
  })

  beats.sort((a, b) => a.phase - b.phase)
  return { state: { ...next, seasonRun: { ...run, phase: Math.max(run.phase, toPhase) } }, beats, running, phaseBefore, phaseAfter: toPhase }
}
