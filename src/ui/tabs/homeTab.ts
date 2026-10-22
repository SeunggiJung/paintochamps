import genres from '../../data/genres.json'
import rules from '../../data/rules.json'
import { adsOf, adTypeName, AD_TYPES, shootTurn, type AdType } from '../../engine/ads.ts'
import { conditionTier } from '../../engine/growth.ts'
import { adaptationOf, isOverseas, leagueOfState } from '../../engine/leagues.ts'
import { canNegotiate } from '../../engine/negotiation.ts'
import { planChoice, planOf, presetDef } from '../../engine/plan.ts'
import { stageName } from '../../engine/season.ts'
import { salaryOf } from '../../engine/teams.ts'
import { ACTIONS, turnsPerSeason } from '../../engine/turn.ts'
import { scheduleBar } from '../calendarUi.ts'
import { chip } from '../components.ts'
import { conditionHelp, conditionText } from '../conditionHelp.ts'
import { countUp } from '../countUp.ts'
import { h } from '../dom.ts'
import { formatMoney } from '../format.ts'
import { MODE_INFO } from '../labels.ts'
import { teamMarketText } from '../marketLabel.ts'
import { roomSceneSvg } from '../roomScene.ts'
import type { GameSession } from '../session.ts'
import { showGuideOnce } from '../guides.ts'
import { teamIcon } from '../teamIcon.ts'

/** 계약 유형별 촬영 횟수 */
const AD_SHOOTS = Object.fromEntries(Object.entries(AD_TYPES).map(([k, v]) => [k, v.shoots])) as Record<AdType, number>

/** 홈 탭: 상태·내 방·이번 시즌 일정·계획 칩과 하단의 큰 '다음 턴 진행' 버튼 */
export function homeTab(session: GameSession): HTMLElement {
  const state = session.state
  const max = turnsPerSeason(state.mode)
  const tier = conditionTier(state.condition)

  const warnChips: string[] = []
  if (state.injuredMonths > 0) warnChips.push(`부상 ${Math.ceil(state.injuredMonths)}개월`)
  if (state.slumpMonths > 0) warnChips.push(`슬럼프 ${Math.ceil(state.slumpMonths)}개월`)
  if (state.vice >= rules.vice.addictionAt) warnChips.push('중독 위험')

  const status = h(
    'header',
    { class: 'status', 'data-guide': 'status' },
    h('div', { class: 'row' }, h('h2', {}, `${state.name} · ${state.age}세`), h('span', { class: 'muted small' }, `${state.season}시즌 ${state.turnInSeason + 1}/${max}턴`)),
    h(
      'p',
      { class: 'muted small team-line' },
      `${genres[state.genre].name} · ${MODE_INFO[state.mode].name} · ${stageName(state.stage)} · `,
      state.team && teamIcon(state.team.id, 18),
      `${state.team?.name ?? '무소속'}`,
      state.team && salaryOf(state) > 0 ? ` · 월급 ${formatMoney(salaryOf(state))}/3개월` : null,
      isOverseas(state) ? ` · ${leagueOfState(state).name} 적응 ${Math.round(adaptationOf(state))}%` : null,
    ),
    state.team && state.stage !== 'amateur_team' && h('p', { class: 'muted small' }, `구단 ${teamMarketText(state, state.team)}`),
    h(
      'div',
      { class: 'meters' },
      h('div', {}, h('span', { class: 'muted small cond-label' }, '컨디션', conditionHelp(state)), h('div', { class: 'bar' }, h('div', { class: `bar-fill${tier.max <= 30 ? ' low' : tier.label === '완벽' ? ' perfect' : ''}`, style: `width:${state.condition}%` })), h('b', {}, conditionText(state))),
      h('div', { class: 'kv' }, h('span', { class: 'muted small' }, '돈'), countUp(session.shown.money, state.money, (n) => formatMoney(Math.round(n)))),
      h('div', { class: 'kv' }, h('span', { class: 'muted small' }, '명성'), countUp(Math.round(session.shown.fame), Math.round(state.fame))),
    ),
    warnChips.length > 0 && h('div', { class: 'chips' }, ...warnChips.map((c) => h('span', { class: 'chip warn' }, c))),
  )

  const preview = h('div', { class: 'room-preview' })
  preview.innerHTML = roomSceneSvg(state)
  const room = h('section', { class: 'card' }, h('div', { class: 'row' }, h('h3', {}, '내 방'), h('button', { class: 'link-btn', type: 'button', disabled: session.busy, onclick: () => void session.openShop() }, '상점·꾸미기 ›')), preview)

  const plan = state.seasonTraining ? planOf(state) : null
  const planChips = h(
    'div',
    { class: 'chips', 'data-guide': 'plan' },
    plan ? chip(`방침 ${presetDef(plan.preset).name}`) : chip('계획 없음', 'alert'),
    state.seasonTraining && chip(`훈련 ${ACTIONS[state.seasonTraining].name}`),
    plan?.lesson && chip('개인 레슨'),
    plan && chip(`이번 턴 ${planChoice(state).map((c) => ACTIONS[c.id].name).join('·')}`),
    state.injuredMonths > 0 && chip('부상 중이라 쉬며 재활', 'alert'),
    canNegotiate(state) && chip('연봉 협상 가능', 'award'),
  )

  const contracts = adsOf(state)
  const ads =
    contracts.length > 0 &&
    h(
      'section',
      { class: 'card' },
      h('h3', {}, '광고 계약'),
      ...contracts.map((c) => {
        const remaining = AD_SHOOTS[c.type] - c.done
        return h('p', { class: 'small' }, h('b', {}, `${adTypeName(c.type)} · ${c.brand}`), h('span', { class: 'muted' }, remaining > 0 ? ` — 다음 촬영 ${shootTurn(c.type, c.done, state.mode)}턴째 뒤` : ' — 촬영 완료, 결산 때 정산'))
      }),
    )

  // 부상·슬럼프를 처음 볼 때 한 번 (연출 중에는 띄우지 않는다)
  if (!session.busy && warnChips.some((c) => c.startsWith('부상') || c.startsWith('슬럼프'))) void showGuideOnce(session.ctx, 'injury')

  const cta = h(
    'div',
    { class: 'turn-cta', 'data-guide': 'go' },
    session.error && h('p', { class: 'error', role: 'alert' }, session.error),
    h('button', { class: 'btn primary', type: 'button', disabled: session.busy || !state.seasonTraining, onclick: () => void session.playTurn() }, '다음 턴 진행'),
  )

  return h('main', { class: 'screen home-tab' }, status, room, scheduleBar(state), planChips, ads || null, cta)
}
