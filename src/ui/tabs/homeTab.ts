import genres from '../../data/genres.json'
import rules from '../../data/rules.json'
import { adsOf, adTypeName, AD_TYPES, shootTurn, type AdType } from '../../engine/ads.ts'
import { CONDITION_TIERS, conditionTier } from '../../engine/growth.ts'
import { conditionWarning, trainingBalance } from '../../engine/guidance.ts'
import { adaptationOf, isOverseas, leagueOfState } from '../../engine/leagues.ts'
import { canNegotiate } from '../../engine/negotiation.ts'
import { planChoice, planOf, presetDef } from '../../engine/plan.ts'
import { stageName } from '../../engine/season.ts'
import { salaryOf } from '../../engine/teams.ts'
import { trainingMenuOf } from '../../engine/training.ts'
import { ACTIONS, turnsPerSeason } from '../../engine/turn.ts'
import { scheduleBar } from '../calendarUi.ts'
import { chip } from '../components.ts'
import { conditionHelp } from '../conditionHelp.ts'
import { countUp } from '../countUp.ts'
import { h } from '../dom.ts'
import { formatMoney } from '../format.ts'
import { MODE_INFO, STAT_LABEL } from '../labels.ts'
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

  // 상태 카드 하나: 컨디션(큰 숫자 + 단계 눈금) 위, 돈·명성·월급(또는 나이) 타일 아래
  const tierIndex = CONDITION_TIERS.findIndex((t) => t.label === tier.label)
  const salary = state.team ? salaryOf(state) : 0
  const status = h(
    'header',
    { class: 'status stat-card', 'data-guide': 'status' },
    h('div', { class: 'row' }, h('h2', {}, `${state.name} · ${state.age}세`), h('span', { class: 'muted small' }, `${state.season}시즌 ${state.turnInSeason + 1}/${max}턴`)),
    h(
      'p',
      { class: 'muted small team-line' },
      `${genres[state.genre].name} · ${MODE_INFO[state.mode].name} · ${stageName(state.stage)} · `,
      state.team && teamIcon(state.team.id, 18),
      `${state.team?.name ?? '무소속'}`,
      isOverseas(state) ? ` · ${leagueOfState(state).name} 적응 ${Math.round(adaptationOf(state))}%` : null,
    ),
    state.team && state.stage !== 'amateur_team' && h('p', { class: 'muted small' }, `구단 ${teamMarketText(state, state.team)}`),
    h(
      'div',
      {},
      h('div', { class: 'cond-head' }, h('h3', {}, '컨디션', conditionHelp(state)), h('span', { class: `chip ${tier.coef >= 1 ? 'ok' : 'warn'}` }, `${tier.coef >= 1 ? '▲' : '▼'} ${tier.label} · 훈련 ×${tier.coef}`)),
      h('div', { class: 'cond-big' }, h('span', { class: 'big' }, String(Math.round(state.condition))), h('span', { class: 'muted small' }, '/ 100')),
      h(
        'div',
        { class: `cond-bar t${tierIndex + 1}`, role: 'img', 'aria-label': `컨디션 ${Math.round(state.condition)}, ${tier.label} 단계` },
        h('div', { class: 'bar-fill', style: `width:${state.condition}%` }),
        ...CONDITION_TIERS.slice(0, -1).map((t) => h('span', { class: 'tick', style: `left:${t.max}%` })),
      ),
      h('div', { class: 'cond-tiers' }, ...CONDITION_TIERS.map((t) => h('span', { class: t.label === tier.label ? 'on' : '' }, t.min === 0 ? t.label : `${t.label} ${t.min}`))),
    ),
    h(
      'div',
      { class: 'stat-tiles' },
      h('div', { class: 'stat-tile' }, h('span', { class: 'l' }, '돈'), h('span', { class: 'v' }, countUp(session.shown.money, state.money, (n) => formatMoney(Math.round(n))))),
      h('div', { class: 'stat-tile' }, h('span', { class: 'l' }, '명성'), h('span', { class: 'v' }, countUp(Math.round(session.shown.fame), Math.round(state.fame)))),
      salary > 0
        ? h('div', { class: 'stat-tile' }, h('span', { class: 'l' }, '월급'), h('span', { class: 'v' }, formatMoney(salary)), h('span', { class: 'd' }, '3개월마다'))
        : h('div', { class: 'stat-tile' }, h('span', { class: 'l' }, '나이'), h('span', { class: 'v' }, `${state.age}세`)),
    ),
    warnChips.length > 0 && h('div', { class: 'chips' }, ...warnChips.map((c) => h('span', { class: 'chip warn' }, c))),
  )

  // 경고: 컨디션·훈련 쏠림. 하나만 펼치고 나머지는 '더 보기'로 접는다
  const lowCondition = conditionWarning(state)
  const balance = state.seasonTraining ? trainingBalance(state, state.seasonTraining, trainingMenuOf(state)) : null
  const notices: HTMLElement[] = []
  if (lowCondition) {
    notices.push(
      h(
        'div',
        { class: 'notice cond-warn', role: 'status' },
        h('span', { class: 'ic', 'aria-hidden': 'true' }, '⚠'),
        h('div', {}, h('b', {}, `컨디션이 ${lowCondition.label} 단계예요`), `컨디션 ${lowCondition.condition}: 지금은 훈련 성과가 ×${lowCondition.coef}로 떨어져요. ${lowCondition.slumpAt} 이하면 슬럼프, ${lowCondition.injuryAt} 이하면 부상 이벤트 위험이 있어요.`),
      ),
    )
  }
  if (balance) {
    notices.push(
      h(
        'div',
        { class: 'notice balance-warn', role: 'status' },
        h('span', { class: 'ic', 'aria-hidden': 'true' }, '⚖'),
        h('div', {}, h('b', {}, '훈련이 한쪽으로 치우쳤어요'), `뒤처진 능력치 · ${STAT_LABEL[balance.lagging]}: 가장 높은 능력치보다 ${Math.round(balance.gap)} 낮은데 이번 시즌 훈련은 올려 주지 않아요.`),
      ),
    )
  }
  const noticeBlock =
    notices.length === 0
      ? null
      : notices.length === 1
        ? notices[0]
        : h('div', { class: 'stack-tight' }, notices[0], h('details', { class: 'notice-more' }, h('summary', {}, `경고 ${notices.length - 1}건 더 보기`), ...notices.slice(1)))

  const preview = h('div', { class: 'room-preview' })
  preview.innerHTML = roomSceneSvg(state)
  const room = h('section', { class: 'card' }, h('div', { class: 'row' }, h('h3', {}, '내 방'), h('button', { class: 'link-btn', type: 'button', disabled: session.busy, onclick: () => void session.openShop() }, '상점·꾸미기 ›')), preview)

  const plan = state.seasonTraining ? planOf(state) : null
  const planChips = h(
    'div',
    { class: 'chips', 'data-guide': 'plan' },
    plan ? chip(`방침 ${presetDef(plan.preset).name}`, 'info') : chip('계획 없음', 'alert'),
    state.seasonTraining && chip(`훈련 ${ACTIONS[state.seasonTraining].name}`),
    plan?.lesson && chip('개인 레슨'),
    plan && chip(`이번 턴 ${planChoice(state).map((c) => ACTIONS[c.id].name).join('·')}`),
    state.injuredMonths > 0 && chip('부상 중이라 쉬며 재활', 'alert'),
    canNegotiate(state) && chip('연봉 협상 가능', 'award'),
  )
  const seasonCard = h(
    'section',
    { class: 'card season-card' },
    h('div', { class: 'card-title' }, h('h3', {}, '이번 시즌'), h('span', { class: 'muted small' }, `${state.turnInSeason + 1}/${max}턴`)),
    h('div', { class: 'steps-bar', role: 'img', 'aria-label': `${max}턴 중 ${state.turnInSeason + 1}턴째` }, ...Array.from({ length: max }, (_, i) => h('i', { class: i < state.turnInSeason ? 'done' : i === state.turnInSeason ? 'now' : '' }))),
    planChips,
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
    h('button', { class: 'btn primary lg', type: 'button', disabled: session.busy || !state.seasonTraining, onclick: () => void session.playTurn() }, '다음 턴 진행 ▶'),
    plan && h('p', { class: 'cap' }, `이번 턴 ${planChoice(state).map((c) => ACTIONS[c.id].name).join(' · ')}`),
  )

  return h('main', { class: 'screen home-tab' }, status, noticeBlock, room, scheduleBar(state), seasonCard, ads || null, cta)
}
