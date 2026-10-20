import type { CalendarBeat, CalendarUpdate } from '../engine/calendar.ts'
import { isInvited } from '../engine/competitions.ts'
import { eventsFor } from '../engine/season.ts'
import type { GameState, StandingRow } from '../engine/state.ts'
import type { GenreId } from '../engine/types.ts'
import { runOf } from '../engine/calendar.ts'
import { turnsPerSeason } from '../engine/turn.ts'
import { celebrate } from './confetti.ts'
import { formatMoney } from './format.ts'
import { h } from './dom.ts'
import { playBroadcast } from './broadcast.ts'
import { openSheet } from './sheet.ts'
import { playSfx } from './sound.ts'

/** 시즌은 봄(3월)에 시작해서 1년이다 */
const START_MONTH = 3
const monthOf = (phase: number) => ((START_MONTH - 1 + Math.round(phase * 12)) % 12) + 1

const medal = (place: number) => (place === 1 ? '🥇 우승' : place === 2 ? '🥈 준우승' : place === 3 ? '🥉 3위' : `${place}위`)

/** 순위표: 상위 5팀과 내 순위 (5위 밖이면 맨 아래에 따로) */
function tableView(rows: StandingRow[], limit = 5): HTMLElement {
  const me = rows.findIndex((r) => r.isPlayer)
  const shown = rows.slice(0, limit).map((r, i) => ({ r, i }))
  if (me >= limit) shown.push({ r: rows[me], i: me })
  return h(
    'ul',
    { class: 'plain standings' },
    ...shown.map(({ r, i }) =>
      h(
        'li',
        { class: `standing${r.isPlayer ? ' me' : ''}` },
        h('span', { class: 'rank' }, `${i + 1}`),
        h('span', { class: 'sname' }, r.name),
        h('span', { class: 'record muted' }, `${r.wins}승 ${r.losses}패`),
      ),
    ),
  )
}

/** 대회 결과·중간 순위 카드. 확인을 누르면 이어서 진행한다. */
export async function showBeat(beat: CalendarBeat, context?: { genre: GenreId; seed: number; season: number }): Promise<void> {
  // 결승 중계 대회에서 결승까지 올랐다면 결과 카드 전에 중계 연출이 먼저 나온다
  if (beat.kind === 'end' && beat.final && context) await playBroadcast(beat.final, context.genre, context.seed, context.season)
  if (beat.kind === 'end' && beat.world && beat.placement === 1) celebrate('UR')
  else if (beat.kind === 'end' && beat.placement === 1) celebrate('SR')
  else if (beat.kind === 'end') playSfx(beat.placement <= 3 ? 'statUp' : 'lose')
  return openSheet<void>((close) => {
    if (beat.kind === 'mid') {
      return h(
        'div',
        { class: 'stack-tight beat' },
        h('p', { class: 'eyebrow' }, `${beat.name} · 중간 순위`),
        h('h2', {}, `현재 ${beat.rank}위 / ${beat.size}팀`),
        tableView(beat.table),
        beat.expected !== null && h('p', { class: 'small' }, `팀 전력과 실력으로 본 예상 순위는 ${beat.expected}위였다.`),
        h('p', { class: 'muted small' }, '리그는 계속된다. 남은 경기에서 순위가 바뀔 수 있다.'),
        h('button', { class: 'btn primary', onclick: () => close() }, '계속'),
      )
    }
    const tone = beat.placement === 1 ? 'gold' : beat.placement <= 3 ? 'silver' : ''
    return h(
      'div',
      { class: 'stack-tight beat' },
      h('p', { class: 'eyebrow' }, `${beat.name} 종료`),
      h('h2', { class: `beat-title ${tone}` }, beat.world && beat.placement === 1 ? '🏆 월드 챔피언!' : medal(beat.placement)),
      h('p', { class: 'muted' }, `${beat.fieldSize}팀 중 ${beat.placement}위`),
      beat.table ? tableView(beat.table) : h('p', { class: 'muted small' }, `1~3위: ${beat.top.join(' · ')}`),
      h('p', { class: 'small' }, `명성 ${beat.fame >= 0 ? '+' : ''}${Math.round(beat.fame)}${beat.money > 0 ? ` · 상금 +${formatMoney(beat.money)}` : ''}`),
      beat.advanced.length > 0 && h('div', { class: 'chips' }, ...beat.advanced.map((a) => h('span', { class: 'chip' }, a))),
      h('button', { class: 'btn primary', onclick: () => close() }, '확인'),
    )
  }, { center: true })
}

export interface TimelineInput {
  before: GameState
  calendar: CalendarUpdate
  /** 이번 턴에 고른 행동 이름 */
  actions: string[]
  /** 정밀 모드처럼 턴이 많은 모드는 연출을 짧게 한다 */
  brief?: boolean
}

/**
 * 턴을 누르면 시간이 흘러가는 연출: "○○ 중…"이 이어지다가 대회가 끝나는 시점마다 결과 카드가 뜨고,
 * 확인하면 나머지 시간이 이어진다. 화면을 누르면 빠르게 넘어간다(결과 카드는 그대로 보여 준다).
 */
export function playTimeline({ before, calendar, actions, brief }: TimelineInput): Promise<void> {
  const { phaseBefore, phaseAfter, beats, running } = calendar
  return openSheet<void>((close) => {
    const status = h('h2', {}, '')
    const activity = h('p', { class: 'muted' }, '')
    const eventPill = h('p', { class: 'timeline-event' }, '')
    const clock = h('p', { class: 'eyebrow' }, '')
    const fill = h('div', { class: 'bar-fill timeline-fill' })
    fill.style.width = `${phaseBefore * 100}%`
    const root = h(
      'div',
      { class: 'stack-tight timeline' },
      clock,
      status,
      activity,
      eventPill,
      h('div', { class: 'bar' }, fill),
      h('button', { class: 'btn ghost small skip-btn', onclick: () => (fast = true) }, '스킵하기 ', h('span', { 'aria-hidden': 'true' }, '⏩')),
    )
    let fast = false
    root.addEventListener('click', () => (fast = true))
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, fast ? Math.min(ms, 90) : ms))

    const label = actions.join(' · ')
    const render = (phase: number) => {
      fill.style.width = `${Math.min(100, phase * 100)}%`
      clock.textContent = `${before.age}세 ${monthOf(phase)}월`
      const active = running.find((e) => phase > e.from - 1e-9 && phase <= e.to + 1e-9)
      status.textContent = `${label} 중…`
      activity.textContent = active ? '' : '훈련과 생활에 집중하는 시간'
      eventPill.textContent = active ? `🏆 ${active.name} 진행 중` : ''
    }

    const total = Math.max(1, turnsPerSeason(before.mode))
    const perTurn = brief ? 900 : 1700
    const segment = async (from: number, to: number) => {
      const steps = 6
      const ms = (perTurn * Math.max(1, (to - from) * total)) / steps
      for (let i = 1; i <= steps; i++) {
        render(from + ((to - from) * i) / steps)
        await wait(ms)
      }
    }

    void (async () => {
      let at = phaseBefore
      render(at)
      await wait(300)
      for (const beat of beats) {
        const target = Math.min(Math.max(beat.phase, at), phaseAfter)
        if (target > at) {
          await segment(at, target)
          at = target
        }
        // 결과 카드가 떠 있는 동안에는 진행 화면을 숨긴다
        const panel = root.closest<HTMLElement>('.sheet')
        if (panel) panel.style.visibility = 'hidden'
        await showBeat(beat, { genre: before.genre, seed: before.seed, season: before.season })
        if (panel) panel.style.visibility = ''
      }
      if (phaseAfter > at) await segment(at, phaseAfter)
      await wait(200)
      close()
    })()
    return root
  }, { center: true })
}

/** 홈 화면의 시즌 일정: 대회별로 예정·진행 중·중간 순위·최종 순위를 한눈에 보여 준다 */
export function scheduleBar(state: GameState): HTMLElement | null {
  const events = eventsFor(state)
  if (events.length === 0) return null
  const run = runOf(state)
  const phase = state.turnInSeason / turnsPerSeason(state.mode)
  return h(
    'section',
    { class: 'card schedule' },
    h('h3', {}, '이번 시즌 일정'),
    h(
      'div',
      { class: 'schedule-list' },
      ...events.map((ev) => {
        const rec = run.runs.find((r) => r.id === ev.id)
        const skipped = run.skipped.includes(ev.id)
        // 초청 대회는 시작 전에 초청 여부를 미리 알려 준다 (조건은 알려 주지 않는다)
        let text = ev.invite ? (isInvited(state, ev) ? '초청 받음' : '초청 미정') : '예정'
        let cls = 'upcoming'
        if (skipped) {
          text = '불참'
          cls = 'skipped'
        } else if (rec?.revealed === 'end') {
          text = `${rec.placement}위 / ${rec.fieldSize}팀`
          cls = rec.placement <= 3 ? 'done top' : 'done'
        } else if (rec?.revealed === 'mid' && rec.mid) {
          text = `중간 ${rec.mid.findIndex((r) => r.isPlayer) + 1}위`
          cls = 'running'
        } else if (phase >= ev.span[0] && phase < ev.span[1]) {
          text = '진행 중'
          cls = 'running'
        } else {
          const turns = Math.max(1, Math.ceil((ev.span[1] - phase) * turnsPerSeason(state.mode) - 1e-9))
          text = `${turns}턴 뒤 종료`
        }
        return h('div', { class: `schedule-row ${cls}` }, h('span', { class: 'sname' }, ev.name), h('span', { class: 'sstate' }, text))
      }),
    ),
  )
}
