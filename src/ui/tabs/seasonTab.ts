import { planOf, presetDef } from '../../engine/plan.ts'
import { ACTIONS } from '../../engine/turn.ts'
import { scheduleBar } from '../calendarUi.ts'
import { h } from '../dom.ts'
import type { GameSession } from '../session.ts'
import { openStandings } from '../standingsView.ts'

/** 시즌 탭: 이번 시즌 일정·계획 요약(보기만)·다른 팀 성적 */
export function seasonTab(session: GameSession): HTMLElement {
  const state = session.state
  const train = state.seasonTraining
  const plan = train ? planOf(state) : null
  const summary = h(
    'section',
    { class: 'card' },
    h('h3', {}, `${state.season}시즌 계획`),
    plan && train
      ? h('p', {}, h('b', {}, presetDef(plan.preset).name), ` · 훈련: ${ACTIONS[train].name}${plan.lesson ? ' · 개인 레슨' : ''}`)
      : h('p', { class: 'muted' }, '아직 정하지 않았어요'),
    plan && h('p', { class: 'muted small' }, presetDef(plan.preset).desc),
    h('p', { class: 'muted small' }, '계획은 시즌 시작 때 정하고, 시즌 중에는 바꾸지 않아요.'),
  )
  const standings =
    state.seasonRun &&
    h('button', { class: 'settings-link', type: 'button', onclick: () => void openStandings(state) }, h('span', {}, '다른 팀 성적 보기'), h('span', { class: 'muted' }, '›'))
  return h('main', { class: 'screen' }, scheduleBar(state), summary, standings || null)
}
