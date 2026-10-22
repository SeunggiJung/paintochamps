import gacha from '../data/gacha.json'
import genres from '../data/genres.json'
import rules from '../data/rules.json'
import { adsOf, adTypeName, AD_TYPES, shootTurn, type AdType } from '../engine/ads.ts'
import { adaptationOf, isOverseas, leagueOfState } from '../engine/leagues.ts'
import { canNegotiate } from '../engine/negotiation.ts'
import { planChoice, planOf, presetDef } from '../engine/plan.ts'
import { genrePower } from '../engine/power.ts'
import { choosePrep, expectedScore, PREP, testItems, testName, upcomingTest } from '../engine/routes.ts'
import { stageName, transferBlocker } from '../engine/season.ts'
import type { GameState } from '../engine/state.ts'
import { salaryOf } from '../engine/teams.ts'
import { conditionTier } from '../engine/growth.ts'
import { ACTIONS, turnsPerSeason } from '../engine/turn.ts'
import { STAT_KEYS } from '../engine/types.ts'
import { markGuideDone } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { conditionHelp, conditionText } from './conditionHelp.ts'
import { confirmSheet } from './confirm.ts'
import { countUp } from './countUp.ts'
import { h } from './dom.ts'
import { formatMoney } from './format.ts'
import { runGuide } from './guide.ts'
import { MODE_INFO } from './labels.ts'
import { teamMarketText } from './marketLabel.ts'
import { openPlanSheet } from './planScreen.ts'
import { roomSceneSvg } from './roomScene.ts'
import { GameSession } from './session.ts'
import { statName } from './statHelp.ts'
import { teamIcon } from './teamIcon.ts'
import { scheduleBar } from './calendarUi.ts'

const BAR_MAX = gacha.statMax

/** 계약 유형별 촬영 횟수 */
const AD_SHOOTS = Object.fromEntries(Object.entries(AD_TYPES).map(([k, v]) => [k, v.shoots])) as Record<AdType, number>

export function homeScreen(ctx: Ctx, initial: GameState): HTMLElement {
  const session = new GameSession(ctx, initial)
  const root = h('main', { class: 'screen home' })

  // 화면에서 쓰는 상태는 늘 세션의 현재 값이다
  const seasonOver = () => session.seasonOver()

  const statusChips = () => {
    const chips: string[] = []
    if (session.state.injuredMonths > 0) chips.push(`부상 ${Math.ceil(session.state.injuredMonths)}개월`)
    if (session.state.slumpMonths > 0) chips.push(`슬럼프 ${Math.ceil(session.state.slumpMonths)}개월`)
    if (session.state.vice >= rules.vice.addictionAt) chips.push('중독 위험')
    return chips.map((c) => h('span', { class: 'chip warn' }, c))
  }

  /** 시즌 시작 계획(방침·훈련·레슨·장비)을 세운다. 정하면 시즌 중 행동은 컨디션에 맞춰 자동으로 흘러간다. */
  const makePlan = async () => {
    session.commit(await openPlanSheet(session.state))
  }

  /** 내 방: 꾸민 모습과 상점 버튼 */
  const roomCard = (): HTMLElement => {
    const preview = h('div', { class: 'room-preview' })
    preview.innerHTML = roomSceneSvg(session.state)
    return h(
      'section',
      { class: 'card' },
      h('div', { class: 'row' }, h('h3', {}, '내 방'), h('button', { class: 'btn small', disabled: session.busy, onclick: () => void session.openShop() }, '상점·꾸미기')),
      preview,
    )
  }

  /** 계약 중인 광고와 다음 촬영 일정 */
  const adCard = (): HTMLElement | null => {
    const contracts = adsOf(session.state)
    if (contracts.length === 0) return null
    return h(
      'section',
      { class: 'card' },
      h('h3', {}, '광고 계약'),
      ...contracts.map((c) => {
        const remaining = AD_SHOOTS[c.type] - c.done
        return h('p', { class: 'small' }, h('b', {}, `${adTypeName(c.type)} · ${c.brand}`), h('span', { class: 'muted' }, remaining > 0 ? ` — 다음 촬영 ${shootTurn(c.type, c.done, session.state.mode)}턴째 뒤` : ' — 촬영 완료, 결산 때 정산'))
      }),
    )
  }

  /** 이번 시즌 계획 카드: 방침·훈련·레슨과, 지금 컨디션에서 이번 턴에 자동으로 할 행동 */
  const planCard = () => {
    const tier = conditionTier(session.state.condition)
    const train = session.state.seasonTraining
    if (!train) {
      return h(
        'section',
        { class: 'card', 'data-guide': 'plan' },
        h('h3', {}, `${session.state.season}시즌 계획`),
        h('p', { class: 'muted small' }, '이번 시즌의 방침과 훈련을 정해야 시즌이 시작됩니다.'),
        h('button', { class: 'btn primary', disabled: session.busy, onclick: () => void makePlan() }, '계획 세우기'),
      )
    }
    const plan = planOf(session.state)
    const preset = presetDef(plan.preset)
    const names = planChoice(session.state).map((c) => ACTIONS[c.id].name)
    return h(
      'section',
      { class: 'card', 'data-guide': 'plan' },
      h('h3', {}, `${session.state.season}시즌 계획`),
      h('p', {}, h('b', {}, preset.name), ` · 훈련: ${ACTIONS[train].name}${plan.lesson ? ' · 개인 레슨' : ''}`),
      h('p', { class: 'muted small' }, preset.desc),
      session.state.injuredMonths > 0 && h('p', { class: 'notice' }, '부상 중이라 쉬면서 재활합니다.'),
      h('p', { class: 'small' }, h('span', { class: 'muted' }, '이번 턴 예정 '), names.join(' · ')),
      h('p', { class: `muted small cond-hint tier-${tier.label}` }, `컨디션 ${tier.label}: ${tier.desc} (×${tier.coef}) — 컨디션에 맞춰 알아서 훈련·휴식을 조절합니다.`),
    )
  }

  function render() {
    const error = session.error
    if (seasonOver()) {
      root.replaceChildren(seasonEnd())
      return
    }
    const max = turnsPerSeason(session.state.mode)
    const power = Math.round(genrePower(session.state.stats, session.state.genre))
    const tier = conditionTier(session.state.condition)

    const parts = [
      h(
        'header',
        { class: 'status', 'data-guide': 'status' },
        h('div', { class: 'row' }, h('h2', {}, `${session.state.name} · ${session.state.age}세`), h('span', { class: 'muted small' }, `${session.state.season}시즌 ${session.state.turnInSeason + 1}/${max}턴 `, h('button', { class: 'guide-help', 'aria-label': '게임 가이드 다시 보기', onclick: () => void showGuide() }, '?'))),
        h(
          'p',
          { class: 'muted small team-line' },
          `${genres[session.state.genre].name} · ${MODE_INFO[session.state.mode].name} · ${stageName(session.state.stage)} · `,
          session.state.team && teamIcon(session.state.team.id, 18),
          `${session.state.team?.name ?? '무소속'}`,
          session.state.team && salaryOf(session.state) > 0 ? ` · 월급 ${formatMoney(salaryOf(session.state))}/3개월` : null,
          isOverseas(session.state) ? ` · ${leagueOfState(session.state).name} 적응 ${Math.round(adaptationOf(session.state))}%` : null,
        ),
        session.state.team && session.state.stage !== 'amateur_team' && h('p', { class: 'muted small' }, `구단 ${teamMarketText(session.state, session.state.team)}`),
        h(
          'div',
          { class: 'meters' },
          h('div', {}, h('span', { class: 'muted small cond-label' }, '컨디션', conditionHelp(session.state)), h('div', { class: 'bar' }, h('div', { class: `bar-fill${tier.max <= 30 ? ' low' : tier.label === '완벽' ? ' perfect' : ''}`, style: `width:${session.state.condition}%` })), h('b', {}, conditionText(session.state))),
          h('div', { class: 'kv' }, h('span', { class: 'muted small' }, '돈'), countUp(session.shown.money, session.state.money, (n) => formatMoney(Math.round(n)))),
          h('div', { class: 'kv' }, h('span', { class: 'muted small' }, '명성'), countUp(Math.round(session.shown.fame), Math.round(session.state.fame))),
        ),
        statusChips().length > 0 && h('div', { class: 'chips' }, ...statusChips()),
      ),
      scheduleBar(session.state),
      planCard(),
      adCard(),
      roomCard(),
      h(
        'section',
        { class: 'card', 'data-guide': 'stats' },
        h('div', { class: 'row' }, h('h3', {}, '능력치'), h('span', { class: 'power' }, `${genres[session.state.genre].name} 실력치 `, countUp(session.shown.power, power))),
        ...STAT_KEYS.map((k) =>
          h(
            'div',
            { class: 'stat-row compact' },
            statName(k, session.state.genre, genres[session.state.genre].weights[k] >= 20),
            h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: `width:${(session.state.stats[k] / BAR_MAX) * 100}%` })),
            h('span', { class: 'stat-value' }, countUp(Math.round(session.shown.stats[k]), Math.round(session.state.stats[k]))),
            session.state.trait.stat === k ? h('span', { class: 'tag' }, '특성') : h('span', {}),
          ),
        ),
      ),
      h(
        'div',
        { class: 'turn-bar', 'data-guide': 'turnbar' },
        error && h('p', { class: 'error', role: 'alert' }, error),
        h('button', { class: 'btn primary', disabled: session.busy || !session.state.seasonTraining, onclick: () => void session.playTurn() }, session.state.seasonTraining ? '다음 턴 진행' : '먼저 시즌 계획을 세우세요'),
        h('button', { class: 'btn ghost small', onclick: () => void session.showCareer() }, '내 경력'),
        !session.busy && canNegotiate(session.state) && h('button', { class: 'btn small', onclick: () => void session.negotiate() }, '연봉 협상'),
        !session.busy && !transferBlocker(session.state, 'mid') && h('button', { class: 'btn small', onclick: () => void session.requestMidTransfer() }, '이적 요청'),
        h('button', { class: 'btn ghost small', onclick: () => ctx.toTitle() }, '타이틀로 (자동 저장됨)'),
      ),
    ]
    root.replaceChildren(...parts.filter((p): p is HTMLElement => !!p))
  }

  /** 이번 결산에서 볼 시험의 현재 달성도와 준비 선택 */
  function prepCard(): HTMLElement | null {
    const upcoming = upcomingTest(session.state)
    if (!upcoming) return null
    const items = testItems(session.state, upcoming.id)
    const score = Math.round(expectedScore(session.state, upcoming.id) * 100)
    const chosen = PREP.find((p) => p.id === session.state.testPrep)
    return h(
      'section',
      { class: 'card' },
      h('div', { class: 'row' }, h('h3', {}, testName(upcoming.id)), h('span', { class: 'power' }, '예상 ', h('b', {}, `${score}`), ' / 합격 100')),
      !upcoming.certain && h('p', { class: 'muted small' }, '지역 대회 성적이 좋으면 응시할 수 있다.'),
      ...items.map((it) =>
        h(
          'div',
          { class: 'stat-row compact' },
          h('span', { class: 'stat-name' }, it.label),
          h('div', { class: 'bar' }, h('div', { class: `bar-fill${it.ratio < 0.8 ? ' low' : ''}`, style: `width:${Math.min(100, (it.ratio / 1.5) * 100)}%` })),
          h('span', { class: 'stat-value' }, `${Math.round(it.ratio * 100)}%`),
          h('span', {}),
        ),
      ),
      chosen
        ? h('p', { class: 'muted' }, `준비: ${chosen.label}`)
        : h(
            'div',
            { class: 'choices vertical' },
            ...PREP.map((p) =>
              h(
                'button',
                {
                  class: 'choice',
                  disabled: !!p.money && session.state.money + p.money < 0,
                  onclick: () => {
                    session.commit(choosePrep(session.state, p.id))
                  },
                },
                h('b', {}, p.label),
                h('span', { class: 'muted small' }, p.desc),
              ),
            ),
          ),
    )
  }

  // 시즌의 마지막 턴까지 마친 상태. 결산 화면으로 넘어간다. (결산은 시드로 정해져서 중간에 나가도 같은 결과가 나온다.)
  function seasonEnd(): HTMLElement {
    return h(
      'section',
      { class: 'stack-tight' },
      h('p', { class: 'eyebrow' }, `${session.state.season}시즌 종료`),
      h('h2', {}, `${session.state.name} · ${session.state.age}세`),
      h('p', { class: 'muted' }, '이번 시즌의 모든 턴을 마쳤습니다. 대회 결과를 확인하세요. (진행 상황은 저장되어 있습니다.)'),
      prepCard(),
      h(
        'button',
        {
          class: 'btn primary',
          onclick: async () => {
            const test = upcomingTest(session.state)
            if (test && !session.state.testPrep) {
              const ok = await confirmSheet({
                title: `${testName(test.id)} 준비를 안 했어요`,
                message: '시험 준비(집중·컨디션·조언)를 고르지 않고 결산으로 넘어갈까요? 준비하면 합격 확률이 올라갑니다.',
                ok: '준비 없이 넘어가기',
                cancel: '돌아가서 준비하기',
              })
              if (!ok) return
            }
            await session.askTeamName()
            ctx.toSeason(session.state)
          },
        },
        '시즌 결산 보기',
      ),
      h('button', { class: 'btn ghost small', onclick: () => ctx.toTitle() }, '타이틀로'),
    )
  }

  /** 말풍선 가이드를 띄우고 봤다고 기록한다 (처음 접속하거나 ? 를 눌렀을 때) */
  const showGuide = async () => {
    await runGuide(root)
    ctx.meta = markGuideDone(ctx.storage)
  }

  session.subscribe(render)
  render()
  // 화면에 붙은 뒤에 위치를 재야 해서 다음 프레임에 띄운다. 가이드를 먼저 보고, 그다음에 이번 시즌 계획을 세운다.
  requestAnimationFrame(async () => {
    if (!ctx.meta.guideDone && session.state.season === 1 && session.state.turnInSeason === 0) await showGuide()
    if (!session.state.seasonTraining && !seasonOver()) await makePlan()
  })
  return root
}
