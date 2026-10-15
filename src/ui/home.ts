import equipmentData from '../data/equipment.json'
import gacha from '../data/gacha.json'
import genres from '../data/genres.json'
import modes from '../data/modes.json'
import rules from '../data/rules.json'
import { rollEvent, turnRng } from '../engine/events.ts'
import { genrePower } from '../engine/power.ts'
import { choosePrep, expectedScore, PREP, testItems, testName, upcomingTest } from '../engine/routes.ts'
import { acceptOffer, eventsFor, rollMidSeasonOffer, stageName } from '../engine/season.ts'
import type { ActionId, EquipmentId, GameState } from '../engine/state.ts'
import { trainingMenuOf } from '../engine/training.ts'
import { ACTIONS, applyTurn, buyEquipment, checkEquipment, checkSlot, turnsPerSeason, type Slot } from '../engine/turn.ts'
import { STAT_KEYS } from '../engine/types.ts'
import { saveGame } from '../save/storage.ts'
import { cleanTeamName, TEAM_NAME_MAX } from './newGame.ts'
import type { Ctx } from './app.ts'
import { h } from './dom.ts'
import { runEvent } from './eventFlow.ts'
import { ACTION_GROUPS, MODE_INFO, STAT_LABEL } from './labels.ts'
import { actionCost, actionRisks, actionTags, describeChange, previewTurn } from './preview.ts'
import { openSheet } from './sheet.ts'
import { playTimeline, scheduleBar } from './calendarUi.ts'
import { showContract } from './contractScene.ts'
import { offerButton } from './offerView.ts'
import { teamIcon } from './teamIcon.ts'
import { salaryOf } from '../engine/teams.ts'

const EQUIPMENT = equipmentData as Record<EquipmentId, { name: string; costs: number[] }>
const BAR_MAX = gacha.statMax

/** 이 행동을 목록에 보여 줄지. 모드·팀·부상 같은 구조적 이유로 못 하는 행동은 아예 숨기고, 돈·명성 부족은 이유와 함께 비활성으로 보여 준다. */
function listed(state: GameState, id: ActionId): boolean {
  const a = ACTIONS[id]
  if (a.pool && !trainingMenuOf(state).includes(id)) return false
  if (a.modes && !a.modes.includes(state.mode)) return false
  const { inTeam, injured, slump } = a.requires ?? {}
  if (inTeam !== undefined && (state.team !== null) !== inTeam) return false
  if (injured && state.injuredMonths <= 0) return false
  if (slump && state.slumpMonths <= 0) return false
  if (state.injuredMonths > 0 && !a.allowWhenInjured) return false
  return true
}

export function homeScreen(ctx: Ctx, initial: GameState): HTMLElement {
  let state = initial
  let picked: Slot[] = []
  let busy = false
  const root = h('main', { class: 'screen home' })

  const seasonOver = () => state.turnInSeason >= turnsPerSeason(state.mode)

  const slotName = (s: Slot) => ACTIONS[s.id].name

  /** 장비는 행동 칸을 쓰지 않고 바로 산다. (한 턴에 하나까지) */
  const buy = (item: EquipmentId) => {
    const r = buyEquipment(state, item)
    if (!r.ok) return render(r.error)
    state = r.state
    saveGame(ctx.storage, state)
    render()
  }

  const pick = (slot: Slot) => {
    // 빈 칸부터 채우고, 둘 다 찼으면 두 번째 칸을 바꾼다
    picked = picked.length < 2 ? [...picked, slot] : [picked[0], slot]
    render()
  }

  const actionButton = (slot: Slot, title: string) => {
    const reason = checkSlot(state, slot)
    const tags = actionTags(slot, state)
    const cost = actionCost(slot, state)
    const risks = actionRisks(slot, state)
    return h(
      'button',
      { class: 'action', disabled: !!reason || busy, onclick: () => pick(slot) },
      h('span', { class: 'action-title' }, title, cost > 0 && h('em', {}, ` ${cost}만`)),
      h('span', { class: 'muted small' }, reason ?? tags.join(' · ')),
      risks.length > 0 && !reason && h('span', { class: 'risk small' }, `⚠ ${risks.join(' / ')}`),
    )
  }

  const statusChips = () => {
    const chips: string[] = []
    if (state.injuredMonths > 0) chips.push(`부상 ${Math.ceil(state.injuredMonths)}개월`)
    if (state.slumpMonths > 0) chips.push(`슬럼프 ${Math.ceil(state.slumpMonths)}개월`)
    if (state.vice >= rules.vice.addictionAt) chips.push('중독 위험')
    return chips.map((c) => h('span', { class: 'chip warn' }, c))
  }

  /** 시즌 도중 다른 팀에서 온 이적 제안. 하나를 골라 옮기거나 남는다. */
  const askMidSeasonOffer = async (s: GameState): Promise<GameState> => {
    const pending = s.pendingOffers
    if (!pending) return s
    const index = await openSheet<number | null>((close) =>
      h(
        'div',
        { class: 'stack-tight' },
        h('p', { class: 'eyebrow' }, '이적 제안'),
        h('p', { class: 'event-text' }, `시즌 도중에 다른 팀에서 연락이 왔다. 지금 ${s.team?.name ?? '팀'}을(를) 떠날까?`),
        h(
          'div',
          { class: 'choices vertical' },
          ...pending.offers.map((o, i) => offerButton(s, o, () => close(i))),
        ),
        h('button', { class: 'btn ghost small', onclick: () => close(null) }, '지금 팀에 남는다'),
      ),
    )
    if (index !== null) await showContract(s, pending.offers[index], 'transfer')
    return acceptOffer(s, index)
  }

  const playTurn = async () => {
    if (picked.length !== 2 || busy) return
    // PC방 대회는 시즌 중간에 열리므로, 출전 전에 팀 이름을 정한다
    busy = true
    await askTeamName()
    busy = false
    const r = applyTurn(state, [picked[0], picked[1]])
    if (!r.ok) {
      render(r.error)
      return
    }
    busy = true
    render()
    const before = state
    let next = r.state
    // 시간이 흘러가는 연출 (대회가 끝나는 시점마다 결과 카드)
    await playTimeline({ before, calendar: r.calendar, actions: picked.map(slotName), brief: before.mode === 'precise' })
    const lines = describeChange(before, next, 'exact')
    await openSheet<void>((close) =>
      h(
        'div',
        { class: 'stack-tight' },
        h('p', { class: 'eyebrow' }, `${modes[before.mode].turnMonths}개월이 지났다`),
        ...r.notes.map((n) => h('p', { class: 'risk' }, `⚠ ${n}`)),
        lines.length > 0 ? h('ul', { class: 'plain' }, ...lines.map((l) => h('li', {}, l))) : h('p', { class: 'muted' }, '눈에 띄는 변화가 없다.'),
        h('button', { class: 'btn primary', onclick: () => close() }, '다음'),
      ),
    )
    const event = rollEvent(next, turnRng(next))
    if (event) next = await runEvent(next, event)
    next = await askMidSeasonOffer(rollMidSeasonOffer(next))
    state = next
    picked = []
    busy = false
    saveGame(ctx.storage, state)
    render()
    scrollTo(0, 0)
  }

  function render(error = '') {
    if (seasonOver()) {
      root.replaceChildren(seasonEnd())
      return
    }
    const max = turnsPerSeason(state.mode)
    const power = Math.round(genrePower(state.stats, state.genre))
    const preview = picked.length === 2 ? previewTurn(state, [picked[0], picked[1]]) : null

    const slotChip = (i: number) =>
      picked[i]
        ? h('button', { class: 'slot filled', onclick: () => ((picked = picked.filter((_, j) => j !== i)), render()) }, slotName(picked[i]), h('span', { class: 'muted small' }, '눌러서 빼기'))
        : h('div', { class: 'slot' }, `행동 ${i + 1}`)

    const groups = ACTION_GROUPS.map((g) => ({
      title: g.title,
      items: g.ids.filter((id) => ACTIONS[id as ActionId] && listed(state, id as ActionId)),
    })).filter((g) => g.items.length > 0)

    const equipRows = (Object.keys(EQUIPMENT) as EquipmentId[]).map((item) => {
      const level = state.equipment[item]
      const maxed = level >= rules.equipment.maxLevel
      const title = maxed ? `${EQUIPMENT[item].name} (최고)` : `${EQUIPMENT[item].name} Lv${level} → ${level + 1}`
      const reason = checkEquipment(state, item)
      return h(
        'button',
        { class: 'action', disabled: !!reason || busy, onclick: () => buy(item) },
        h('span', { class: 'action-title' }, title, !maxed && h('em', {}, ` ${EQUIPMENT[item].costs[level]}만`)),
        h('span', { class: 'muted small' }, reason ?? '훈련 효율↑ · 바로 구매 (턴 소모 없음)'),
      )
    })

    const parts = [
      h(
        'header',
        { class: 'status' },
        h('div', { class: 'row' }, h('h2', {}, `${state.name} · ${state.age}세`), h('span', { class: 'muted small' }, `${state.season}시즌 ${state.turnInSeason + 1}/${max}턴`)),
        h(
          'p',
          { class: 'muted small team-line' },
          `${genres[state.genre].name} · ${MODE_INFO[state.mode].name} · ${stageName(state.stage)} · `,
          state.team && teamIcon(state.team.id, 18),
          `${state.team?.name ?? '무소속'}`,
          state.team && salaryOf(state) > 0 ? ` · 월급 ${salaryOf(state)}만` : null,
        ),
        h(
          'div',
          { class: 'meters' },
          h('div', {}, h('span', { class: 'muted small' }, '컨디션'), h('div', { class: 'bar' }, h('div', { class: `bar-fill${state.condition < 40 ? ' low' : ''}`, style: `width:${state.condition}%` })), h('b', {}, String(Math.round(state.condition)))),
          h('div', { class: 'kv' }, h('span', { class: 'muted small' }, '돈'), h('b', {}, `${Math.round(state.money)}만`)),
          h('div', { class: 'kv' }, h('span', { class: 'muted small' }, '명성'), h('b', {}, String(Math.round(state.fame)))),
        ),
        statusChips().length > 0 && h('div', { class: 'chips' }, ...statusChips()),
      ),
      scheduleBar(state),
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'row' }, h('h3', {}, '능력치'), h('span', { class: 'power' }, `${genres[state.genre].name} 실력치 `, h('b', {}, String(power)))),
        ...STAT_KEYS.map((k) =>
          h(
            'div',
            { class: 'stat-row compact' },
            h('span', { class: 'stat-name' }, STAT_LABEL[k], genres[state.genre].weights[k] >= 20 && h('b', {}, ' ★')),
            h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: `width:${(state.stats[k] / BAR_MAX) * 100}%` })),
            h('span', { class: 'stat-value' }, String(Math.round(state.stats[k]))),
            state.trait.stat === k ? h('span', { class: 'tag' }, '특성') : h('span', {}),
          ),
        ),
      ),
      h('section', { class: 'card' }, h('h3', {}, `이번 ${modes[state.mode].turnMonths}개월, 행동 2개를 고르세요`), h('div', { class: 'slots' }, slotChip(0), slotChip(1))),
      state.injuredMonths > 0 && h('p', { class: 'notice' }, '부상 중이라 휴식·재활만 할 수 있다.'),
      ...groups.map((g) => h('section', {}, h('h3', {}, g.title), g.title === '훈련' && h('p', { class: 'muted small' }, '훈련은 매 턴 무작위로 후보가 바뀝니다. 한 번에 능력치 3개가 오릅니다.'), h('div', { class: 'actions' }, ...g.items.map((id) => actionButton({ id: id as ActionId } as Slot, ACTIONS[id as ActionId].name))))),
      h('section', {}, h('h3', {}, '장비'), h('p', { class: 'muted small' }, '행동을 쓰지 않고 한 턴에 하나까지 살 수 있습니다.'), h('div', { class: 'actions' }, ...equipRows)),
      h(
        'div',
        { class: 'turn-bar' },
        preview && (preview.ok ? h('p', { class: 'preview' }, h('span', { class: 'muted small' }, '예상 '), preview.lines.join(' · ') || '변화 없음') : h('p', { class: 'error' }, preview.error)),
        error && h('p', { class: 'error', role: 'alert' }, error),
        h('button', { class: 'btn primary', disabled: picked.length !== 2 || busy || (preview !== null && !preview.ok), onclick: playTurn }, picked.length === 2 ? '턴 진행' : `행동을 ${2 - picked.length}개 더 고르세요`),
        h('button', { class: 'btn ghost small', onclick: () => ctx.toTitle() }, '타이틀로 (자동 저장됨)'),
      ),
    ]
    root.replaceChildren(...parts.filter((p): p is HTMLElement => !!p))
  }

  /** PC방 대회에 처음 나가기 전에 팀 이름을 직접 짓게 한다. */
  const askTeamName = async () => {
    if (state.cafeTeamName || !eventsFor(state).some((e) => e.field?.names === 'cafe')) return
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
      h('button', { class: 'btn primary', onclick: async () => (await askTeamName(), ctx.toSeason(state)) }, '시즌 결산 보기'),
      h('button', { class: 'btn ghost small', onclick: () => ctx.toTitle() }, '타이틀로'),
    )
  }

  render()
  return root
}
