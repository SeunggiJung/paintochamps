import gacha from '../data/gacha.json'
import genres from '../data/genres.json'
import modes from '../data/modes.json'
import rules from '../data/rules.json'
import { rollEvent, turnRng } from '../engine/events.ts'
import { adsOf, adTypeName, dueShoots, performShoot, shootTurn } from '../engine/ads.ts'
import { facilityEffectLines } from '../engine/facilities.ts'
import { playAdShoot } from './adShoot.ts'
import { outfitLook, roomSceneSvg } from './roomScene.ts'
import { openShop } from './shopSheet.ts'
import { AD_TYPES, type AdType } from '../engine/ads.ts'
import { adaptationOf, isOverseas, leagueOfState } from '../engine/leagues.ts'
import { autoTurn, planChoice, planOf, presetDef } from '../engine/plan.ts'
import { genrePower } from '../engine/power.ts'
import { choosePrep, expectedScore, PREP, testItems, testName, upcomingTest } from '../engine/routes.ts'
import { acceptOffer, eventsFor, requestTransfer, rollMidSeasonOffer, rollMidSeasonPromotion, stageName, transferBlocker } from '../engine/season.ts'
import type { ActionId, GameState } from '../engine/state.ts'
import { applyCoachSwap, coachSwapOffer, trainingValue, type CoachOffer } from '../engine/training.ts'
import { ACTIONS, ageShiftPerTurn, turnsPerSeason } from '../engine/turn.ts'
import { STAT_KEYS } from '../engine/types.ts'
import { markGuideDone, saveGame } from '../save/storage.ts'
import { cleanTeamName, TEAM_NAME_MAX } from './newGame.ts'
import type { Ctx } from './app.ts'
import { confirmSheet } from './confirm.ts'
import { h } from './dom.ts'
import { runEvent } from './eventFlow.ts'
import { MODE_INFO } from './labels.ts'
import { rollMiniGame } from '../engine/minigame.ts'
import { offerMiniGame } from './miniGame.ts'
import { actionTags } from './preview.ts'
import { openSheet } from './sheet.ts'
import { playTimeline, scheduleBar } from './calendarUi.ts'
import { conditionHelp, conditionText } from './conditionHelp.ts'
import { conditionTier } from '../engine/growth.ts'
import { showContract } from './contractScene.ts'
import { offerButton } from './offerView.ts'
import { openNegotiation } from './negotiationView.ts'
import { openPlanSheet } from './planScreen.ts'
import { statName } from './statHelp.ts'
import { teamIcon } from './teamIcon.ts'
import { salaryOf } from '../engine/teams.ts'
import { formatMoney } from './format.ts'
import { runGuide } from './guide.ts'
import { turnChangeGraph } from './turnResult.ts'
import { playSfx, vibrate } from './sound.ts'
import { countUp } from './countUp.ts'

const BAR_MAX = gacha.statMax

/** 계약 유형별 촬영 횟수 */
const AD_SHOOTS = Object.fromEntries(Object.entries(AD_TYPES).map(([k, v]) => [k, v.shoots])) as Record<AdType, number>

export function homeScreen(ctx: Ctx, initial: GameState): HTMLElement {
  let state = initial
  let busy = false
  // 직전에 화면에 보여 준 값: 달라진 숫자는 이 값에서 새 값으로 올라가는(내려가는) 연출을 한다
  let shown = { money: initial.money, fame: initial.fame, power: Math.round(genrePower(initial.stats, initial.genre)), stats: { ...initial.stats } }
  const root = h('main', { class: 'screen home' })

  const seasonOver = () => state.turnInSeason >= turnsPerSeason(state.mode)

  const statusChips = () => {
    const chips: string[] = []
    if (state.injuredMonths > 0) chips.push(`부상 ${Math.ceil(state.injuredMonths)}개월`)
    if (state.slumpMonths > 0) chips.push(`슬럼프 ${Math.ceil(state.slumpMonths)}개월`)
    if (state.vice >= rules.vice.addictionAt) chips.push('중독 위험')
    return chips.map((c) => h('span', { class: 'chip warn' }, c))
  }

  /** 시즌 시작 계획(방침·훈련·레슨·장비)을 세운다. 정하면 시즌 중 행동은 컨디션에 맞춰 자동으로 흘러간다. */
  const makePlan = async () => {
    state = await openPlanSheet(state)
    saveGame(ctx.storage, state)
    render()
  }

  /** 코치의 훈련 교체 제안: 부족한 능력치를 채워 주는 후보 중 하나로 바꾸거나 지금 훈련을 유지한다. 어느 쪽이든 이번 시즌 제안은 끝난다. */
  const askCoachSwap = async (s: GameState, offer: CoachOffer): Promise<GameState> => {
    const picked = await openSheet<ActionId | null>((close) =>
      h(
        'div',
        { class: 'stack-tight' },
        h('p', { class: 'eyebrow' }, '코치의 제안'),
        h('p', { class: 'event-text' }, `${offer.eventName}에서 지금 ${offer.rank}위야. 우리 전력과 네 실력이면 ${offer.expected}위권은 해야 하는데... 지금 하는 ${ACTIONS[s.seasonTraining!].name}을(를) 다른 훈련으로 바꿔 볼래?`),
        h(
          'div',
          { class: 'choices vertical' },
          ...offer.options.map((t) => {
            // 지금 훈련보다 실력치를 더 많이 올려 주는 제안은 강조한다
            const better = trainingValue(s, t) > trainingValue(s, s.seasonTraining!)
            return h(
              'button',
              { class: `choice${better ? ' best' : ''}`, onclick: () => close(t) },
              h('strong', {}, better && h('span', { class: 'best-star' }, '★ '), `${ACTIONS[t].name}으로 바꾼다`, better && h('span', { class: 'best-tag' }, '지금보다 도움')),
              h('span', { class: 'muted small' }, actionTags({ id: t }, s).join(' · ')),
            )
          }),
        ),
        h('button', { class: 'btn ghost small', onclick: () => close(null) }, `지금 훈련(${ACTIONS[s.seasonTraining!].name})을 유지한다`),
      ),
    )
    return applyCoachSwap(s, picked)
  }

  /** 시즌 도중 승급 제안: 실력과 성적이 되면 시즌이 끝나길 기다리지 않고 위 단계 팀에서 연락이 온다. 받으면 바로 올라간다. */
  const askPromotion = async (s: GameState): Promise<GameState> => {
    const pending = s.pendingOffers
    if (!pending || pending.kind !== 'callup') return s
    const stage = pending.stage ?? 'pro1'
    const index = await openSheet<number | null>((close) =>
      h(
        'div',
        { class: 'stack-tight' },
        h('p', { class: 'eyebrow' }, `${stageName(stage)} 승급 제안`),
        h('p', { class: 'event-text' }, `이번 시즌 활약을 본 ${stageName(stage)} 팀들에서 연락이 왔다. 시즌이 끝나길 기다리지 않고 지금 올라갈까?`),
        h('div', { class: 'choices vertical' }, ...pending.offers.map((o, i) => offerButton(s, o, () => close(i), stage, true))),
        h('button', { class: 'btn ghost small', onclick: () => close(null) }, `지금 팀에 남는다`),
      ),
    )
    if (index !== null) await showContract(s, pending.offers[index], 'callup', stage)
    const moved = acceptOffer(s, index)
    return index !== null ? await openNegotiation(moved) : moved
  }

  /** 시즌 도중 다른 팀에서 온 이적 제안. 하나를 골라 옮기거나 남는다. */
  const askMidSeasonOffer = async (s: GameState, requested = false): Promise<GameState> => {
    const pending = s.pendingOffers
    if (!pending) return s
    const index = await openSheet<number | null>((close) =>
      h(
        'div',
        { class: 'stack-tight' },
        h('p', { class: 'eyebrow' }, '이적 제안'),
        h('p', { class: 'event-text' }, requested ? `이적을 요청하자 다른 팀들이 관심을 보인다. 지금 ${s.team?.name ?? '팀'}을(를) 떠날까?` : `시즌 도중에 다른 팀에서 연락이 왔다. 지금 ${s.team?.name ?? '팀'}을(를) 떠날까?`),
        h(
          'div',
          { class: 'choices vertical' },
          ...pending.offers.map((o, i) => offerButton(s, o, () => close(i), undefined, true)),
        ),
        h('button', { class: 'btn ghost small', onclick: () => close(null) }, '지금 팀에 남는다'),
      ),
    )
    if (index !== null) await showContract(s, pending.offers[index], 'transfer')
    const moved = acceptOffer(s, index)
    // 팀을 옮겼으면 새 계약의 월급을 협상할 수 있다
    return index !== null ? await openNegotiation(moved) : moved
  }

  /** 시즌 중간에 플레이어가 이적을 요청한다. 다른 팀 제안을 받아 보고, 거절하면 남는다. */
  const requestMidTransfer = async () => {
    if (busy || transferBlocker(state, 'mid')) return
    const ok = await confirmSheet({
      title: '이적 요청',
      message: `${state.team?.name ?? '지금 팀'}에 이적을 요청할까요? 다른 팀의 제안을 받아 보고, 마음에 안 들면 남을 수 있어요. (시즌 중간 요청은 시즌당 한 번)`,
      ok: '이적 요청하기',
    })
    if (!ok) return
    const r = requestTransfer(state, 'mid')
    if (!r.ok) return render(r.error)
    busy = true
    if (r.success) state = await askMidSeasonOffer(r.state, true)
    else {
      state = r.state
      await confirmSheet({ title: '이적 요청', message: '아직 관심을 보이는 팀이 없다. 이번 시즌 중간 요청은 여기까지다. 성적과 명성을 더 쌓으면 기회가 온다.', ok: '확인', cancel: '닫기' })
    }
    busy = false
    saveGame(ctx.storage, state)
    render()
  }

  /** 다음 턴: 계획대로 자동으로 진행하고, 결과·대회·이벤트·제안만 플레이어에게 보여 준다. */
  const playTurn = async () => {
    if (busy || !state.seasonTraining) return
    // PC방 대회는 시즌 중간에 열리므로, 출전 전에 팀 이름을 정한다
    busy = true
    await askTeamName()
    const before = state
    const { result: r, choice } = autoTurn(state)
    if (!r.ok) {
      busy = false
      render(r.error)
      return
    }
    render()
    let next = r.state
    // 시간이 흘러가는 연출 (대회가 끝나는 시점마다 결과 카드)
    await playTimeline({ before, calendar: r.calendar, actions: choice.map((c) => ACTIONS[c.id].name) })
    if (next.injuredMonths > before.injuredMonths) {
      playSfx('hurt')
      vibrate([120, 60, 120])
    }
    await openSheet<void>((close) =>
      h(
        'div',
        { class: 'stack-tight' },
        h('p', { class: 'eyebrow' }, `${modes[before.mode].turnMonths}개월이 지났다`),
        ...r.notes.map((n) => h('p', { class: 'risk' }, `⚠ ${n}`)),
        turnChangeGraph(before, next, { ageShift: ageShiftPerTurn(before) }),
        facilityEffectLines(next).length > 0 &&
          h('div', { class: 'stack-tight facility-effects' }, h('p', { class: 'eyebrow' }, '시설 덕분에'), ...facilityEffectLines(next).map((line) => h('p', { class: 'muted small' }, line))),
        h('button', { class: 'btn primary', onclick: () => close() }, '다음'),
      ),
    )
    const coach = coachSwapOffer(next, r.calendar.beats)
    if (coach) next = await askCoachSwap(next, coach)
    const event = rollEvent(next, turnRng(next))
    if (event) next = await runEvent(next, event)
    next = await runAdShoots(next)
    next = await askPromotion(rollMidSeasonPromotion(next))
    next = await askMidSeasonOffer(rollMidSeasonOffer(next))
    // 시즌이 이어질 때 가끔(약 30%): 쉬는 시간 미니게임(건너뛰어도 되고, 잘하면 다음 턴 훈련 효율이 조금 오른다)
    const mini = !next.finished && !next.pendingOffers && next.turnInSeason < turnsPerSeason(next.mode) ? rollMiniGame(next) : null
    if (mini) next = await offerMiniGame(next, mini)
    state = next
    busy = false
    saveGame(ctx.storage, state)
    render()
    scrollTo(0, 0)
  }

  /** 일정이 된 광고 촬영을 연출과 함께 치른다 */
  const runAdShoots = async (s: GameState): Promise<GameState> => {
    if (s.finished || s.pendingOffers) return s
    let cur = s
    for (const due of dueShoots(s)) {
      const result = performShoot(cur, due.contract.id)
      await playAdShoot({ brand: due.contract.brand, category: due.contract.category, type: due.contract.type, index: due.index, shoots: AD_SHOOTS[due.contract.type], paid: result.paid, look: outfitLook(cur) })
      cur = result.state
    }
    return cur
  }

  /** 내 방: 꾸민 모습과 상점 버튼 */
  const roomCard = (): HTMLElement => {
    const preview = h('div', { class: 'room-preview' })
    preview.innerHTML = roomSceneSvg(state)
    return h(
      'section',
      { class: 'card' },
      h('div', { class: 'row' }, h('h3', {}, '내 방'), h('button', { class: 'btn small', disabled: busy, onclick: () => void openShopFlow() }, '상점·꾸미기')),
      preview,
    )
  }

  const openShopFlow = async () => {
    if (busy) return
    busy = true
    state = await openShop(state)
    busy = false
    saveGame(ctx.storage, state)
    render()
  }

  /** 계약 중인 광고와 다음 촬영 일정 */
  const adCard = (): HTMLElement | null => {
    const contracts = adsOf(state)
    if (contracts.length === 0) return null
    return h(
      'section',
      { class: 'card' },
      h('h3', {}, '광고 계약'),
      ...contracts.map((c) => {
        const remaining = AD_SHOOTS[c.type] - c.done
        return h('p', { class: 'small' }, h('b', {}, `${adTypeName(c.type)} · ${c.brand}`), h('span', { class: 'muted' }, remaining > 0 ? ` — 다음 촬영 ${shootTurn(c.type, c.done, state.mode)}턴째 뒤` : ' — 촬영 완료, 결산 때 정산'))
      }),
    )
  }

  /** 이번 시즌 계획 카드: 방침·훈련·레슨과, 지금 컨디션에서 이번 턴에 자동으로 할 행동 */
  const planCard = () => {
    const tier = conditionTier(state.condition)
    const train = state.seasonTraining
    if (!train) {
      return h(
        'section',
        { class: 'card', 'data-guide': 'plan' },
        h('h3', {}, `${state.season}시즌 계획`),
        h('p', { class: 'muted small' }, '이번 시즌의 방침과 훈련을 정해야 시즌이 시작됩니다.'),
        h('button', { class: 'btn primary', disabled: busy, onclick: () => void makePlan() }, '계획 세우기'),
      )
    }
    const plan = planOf(state)
    const preset = presetDef(plan.preset)
    const names = planChoice(state).map((c) => ACTIONS[c.id].name)
    return h(
      'section',
      { class: 'card', 'data-guide': 'plan' },
      h('h3', {}, `${state.season}시즌 계획`),
      h('p', {}, h('b', {}, preset.name), ` · 훈련: ${ACTIONS[train].name}${plan.lesson ? ' · 개인 레슨' : ''}`),
      h('p', { class: 'muted small' }, preset.desc),
      state.injuredMonths > 0 && h('p', { class: 'notice' }, '부상 중이라 쉬면서 재활합니다.'),
      h('p', { class: 'small' }, h('span', { class: 'muted' }, '이번 턴 예정 '), names.join(' · ')),
      h('p', { class: `muted small cond-hint tier-${tier.label}` }, `컨디션 ${tier.label}: ${tier.desc} (×${tier.coef}) — 컨디션에 맞춰 알아서 훈련·휴식을 조절합니다.`),
    )
  }

  function render(error = '') {
    if (seasonOver()) {
      root.replaceChildren(seasonEnd())
      return
    }
    const max = turnsPerSeason(state.mode)
    const power = Math.round(genrePower(state.stats, state.genre))
    const tier = conditionTier(state.condition)

    const parts = [
      h(
        'header',
        { class: 'status', 'data-guide': 'status' },
        h('div', { class: 'row' }, h('h2', {}, `${state.name} · ${state.age}세`), h('span', { class: 'muted small' }, `${state.season}시즌 ${state.turnInSeason + 1}/${max}턴 `, h('button', { class: 'guide-help', 'aria-label': '게임 가이드 다시 보기', onclick: () => void showGuide() }, '?'))),
        h(
          'p',
          { class: 'muted small team-line' },
          `${genres[state.genre].name} · ${MODE_INFO[state.mode].name} · ${stageName(state.stage)} · `,
          state.team && teamIcon(state.team.id, 18),
          `${state.team?.name ?? '무소속'}`,
          state.team && salaryOf(state) > 0 ? ` · 월급 ${formatMoney(salaryOf(state))}/3개월` : null,
          isOverseas(state) ? ` · ${leagueOfState(state).name} 적응 ${Math.round(adaptationOf(state))}%` : null,
        ),
        h(
          'div',
          { class: 'meters' },
          h('div', {}, h('span', { class: 'muted small cond-label' }, '컨디션', conditionHelp(state)), h('div', { class: 'bar' }, h('div', { class: `bar-fill${tier.max <= 30 ? ' low' : tier.label === '완벽' ? ' perfect' : ''}`, style: `width:${state.condition}%` })), h('b', {}, conditionText(state))),
          h('div', { class: 'kv' }, h('span', { class: 'muted small' }, '돈'), countUp(shown.money, state.money, (n) => formatMoney(Math.round(n)))),
          h('div', { class: 'kv' }, h('span', { class: 'muted small' }, '명성'), countUp(Math.round(shown.fame), Math.round(state.fame))),
        ),
        statusChips().length > 0 && h('div', { class: 'chips' }, ...statusChips()),
      ),
      scheduleBar(state),
      planCard(),
      adCard(),
      roomCard(),
      h(
        'section',
        { class: 'card', 'data-guide': 'stats' },
        h('div', { class: 'row' }, h('h3', {}, '능력치'), h('span', { class: 'power' }, `${genres[state.genre].name} 실력치 `, countUp(shown.power, power))),
        ...STAT_KEYS.map((k) =>
          h(
            'div',
            { class: 'stat-row compact' },
            statName(k, state.genre, genres[state.genre].weights[k] >= 20),
            h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: `width:${(state.stats[k] / BAR_MAX) * 100}%` })),
            h('span', { class: 'stat-value' }, countUp(Math.round(shown.stats[k]), Math.round(state.stats[k]))),
            state.trait.stat === k ? h('span', { class: 'tag' }, '특성') : h('span', {}),
          ),
        ),
      ),
      h(
        'div',
        { class: 'turn-bar', 'data-guide': 'turnbar' },
        error && h('p', { class: 'error', role: 'alert' }, error),
        h('button', { class: 'btn primary', disabled: busy || !state.seasonTraining, onclick: playTurn }, state.seasonTraining ? '다음 턴 진행' : '먼저 시즌 계획을 세우세요'),
        !busy && !transferBlocker(state, 'mid') && h('button', { class: 'btn small', onclick: () => void requestMidTransfer() }, '이적 요청'),
        h('button', { class: 'btn ghost small', onclick: () => ctx.toTitle() }, '타이틀로 (자동 저장됨)'),
      ),
    ]
    root.replaceChildren(...parts.filter((p): p is HTMLElement => !!p))
    shown = { money: state.money, fame: state.fame, power, stats: { ...state.stats } }
  }

  /** PC방 대회에 처음 나가기 전에 팀 이름을 직접 짓게 한다. */
  const askTeamName = async () => {
    if (state.cafeTeamName || state.academyInvite || !eventsFor(state).some((e) => e.field?.names === 'cafe')) return
    const input = h('input', { type: 'text', maxLength: TEAM_NAME_MAX, value: `${state.name}팀`, autocomplete: 'off', 'aria-label': '팀 이름' })
    const name = await openSheet<string>((close) =>
      h(
        'form',
        {
          class: 'stack-tight',
          onsubmit: (e: Event) => {
            e.preventDefault()
            close(cleanTeamName(input.value) ?? `${state.name}팀`)
          },
        },
        h('p', { class: 'eyebrow' }, 'PC방 대회 출전'),
        h('p', { class: 'event-text' }, '친구들과 PC방 대회에 나가기로 했다. 팀 이름은 뭐로 할까?'),
        input,
        h('button', { class: 'btn primary', type: 'submit' }, '이 이름으로 출전'),
      ),
    )
    state = { ...state, cafeTeamName: name }
    saveGame(ctx.storage, state)
  }

  /** 이번 결산에서 볼 시험의 현재 달성도와 준비 선택 */
  function prepCard(): HTMLElement | null {
    const upcoming = upcomingTest(state)
    if (!upcoming) return null
    const items = testItems(state, upcoming.id)
    const score = Math.round(expectedScore(state, upcoming.id) * 100)
    const chosen = PREP.find((p) => p.id === state.testPrep)
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
                  disabled: !!p.money && state.money + p.money < 0,
                  onclick: () => {
                    state = choosePrep(state, p.id)
                    saveGame(ctx.storage, state)
                    render()
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
      h('p', { class: 'eyebrow' }, `${state.season}시즌 종료`),
      h('h2', {}, `${state.name} · ${state.age}세`),
      h('p', { class: 'muted' }, '이번 시즌의 모든 턴을 마쳤습니다. 대회 결과를 확인하세요. (진행 상황은 저장되어 있습니다.)'),
      prepCard(),
      h(
        'button',
        {
          class: 'btn primary',
          onclick: async () => {
            const test = upcomingTest(state)
            if (test && !state.testPrep) {
              const ok = await confirmSheet({
                title: `${testName(test.id)} 준비를 안 했어요`,
                message: '시험 준비(집중·컨디션·조언)를 고르지 않고 결산으로 넘어갈까요? 준비하면 합격 확률이 올라갑니다.',
                ok: '준비 없이 넘어가기',
                cancel: '돌아가서 준비하기',
              })
              if (!ok) return
            }
            await askTeamName()
            ctx.toSeason(state)
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

  render()
  // 화면에 붙은 뒤에 위치를 재야 해서 다음 프레임에 띄운다. 가이드를 먼저 보고, 그다음에 이번 시즌 계획을 세운다.
  requestAnimationFrame(async () => {
    if (!ctx.meta.guideDone && state.season === 1 && state.turnInSeason === 0) await showGuide()
    if (!state.seasonTraining && !seasonOver()) await makePlan()
  })
  return root
}
