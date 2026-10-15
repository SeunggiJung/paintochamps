import equipmentData from '../data/equipment.json'
import gacha from '../data/gacha.json'
import genres from '../data/genres.json'
import modes from '../data/modes.json'
import rules from '../data/rules.json'
import { rollEvent, turnRng } from '../engine/events.ts'
import { genrePower } from '../engine/power.ts'
import { stageName } from '../engine/season.ts'
import type { ActionId, EquipmentId, GameState } from '../engine/state.ts'
import { ACTIONS, applyTurn, checkSlot, turnsPerSeason, type Slot } from '../engine/turn.ts'
import { STAT_KEYS } from '../engine/types.ts'
import { saveGame } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { h } from './dom.ts'
import { runEvent } from './eventFlow.ts'
import { ACTION_GROUPS, MODE_INFO, STAT_LABEL } from './labels.ts'
import { actionCost, actionRisks, actionTags, describeChange, previewTurn } from './preview.ts'
import { openSheet } from './sheet.ts'

const EQUIPMENT = equipmentData as Record<EquipmentId, { name: string; costs: number[] }>
const BAR_MAX = gacha.statMax

/** 이 행동을 목록에 보여 줄지. 모드·팀·부상 같은 구조적 이유로 못 하는 행동은 아예 숨기고, 돈·명성 부족은 이유와 함께 비활성으로 보여 준다. */
function listed(state: GameState, id: ActionId): boolean {
  const a = ACTIONS[id]
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

  const slotName = (s: Slot) => (s.id === 'buy_equipment' ? `${EQUIPMENT[s.item].name} 구매` : ACTIONS[s.id].name)

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

  const playTurn = async () => {
    if (picked.length !== 2 || busy) return
    const r = applyTurn(state, [picked[0], picked[1]])
    if (!r.ok) {
      render(r.error)
      return
    }
    busy = true
    render()
    const before = state
    let next = r.state
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
      const slot: Slot = { id: 'buy_equipment', item }
      const title = maxed ? `${EQUIPMENT[item].name} (최고)` : `${EQUIPMENT[item].name} Lv${level} → ${level + 1}`
      const reason = checkSlot(state, slot)
      return h(
        'button',
        { class: 'action', disabled: !!reason || busy, onclick: () => pick(slot) },
        h('span', { class: 'action-title' }, title, !maxed && h('em', {}, ` ${EQUIPMENT[item].costs[level]}만`)),
        h('span', { class: 'muted small' }, reason ?? '훈련 효율↑'),
      )
    })

    const parts = [
      h(
        'header',
        { class: 'status' },
        h('div', { class: 'row' }, h('h2', {}, `${state.name} · ${state.age}세`), h('span', { class: 'muted small' }, `${state.season}시즌 ${state.turnInSeason + 1}/${max}턴`)),
        h('p', { class: 'muted small' }, `${genres[state.genre].name} · ${MODE_INFO[state.mode].name} · ${stageName(state.stage)} · ${state.team?.name ?? '무소속'}`),
        h(
          'div',
          { class: 'meters' },
          h('div', {}, h('span', { class: 'muted small' }, '컨디션'), h('div', { class: 'bar' }, h('div', { class: `bar-fill${state.condition < 40 ? ' low' : ''}`, style: `width:${state.condition}%` })), h('b', {}, String(Math.round(state.condition)))),
          h('div', { class: 'kv' }, h('span', { class: 'muted small' }, '돈'), h('b', {}, `${Math.round(state.money)}만`)),
          h('div', { class: 'kv' }, h('span', { class: 'muted small' }, '명성'), h('b', {}, String(Math.round(state.fame)))),
        ),
        statusChips().length > 0 && h('div', { class: 'chips' }, ...statusChips()),
      ),
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
      ...groups.map((g) => h('section', {}, h('h3', {}, g.title), h('div', { class: 'actions' }, ...g.items.map((id) => actionButton({ id: id as ActionId } as Slot, ACTIONS[id as ActionId].name))))),
      h('section', {}, h('h3', {}, '장비'), h('div', { class: 'actions' }, ...equipRows)),
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

  // 시즌의 마지막 턴까지 마친 상태. 결산 화면으로 넘어간다. (결산은 시드로 정해져서 중간에 나가도 같은 결과가 나온다.)
  function seasonEnd(): HTMLElement {
    return h(
      'section',
      { class: 'stack-tight' },
      h('p', { class: 'eyebrow' }, `${state.season}시즌 종료`),
      h('h2', {}, `${state.name} · ${state.age}세`),
      h('p', { class: 'muted' }, '이번 시즌의 모든 턴을 마쳤습니다. 대회 결과를 확인하세요. (진행 상황은 저장되어 있습니다.)'),
      h('button', { class: 'btn primary', onclick: () => ctx.toSeason(state) }, '시즌 결산 보기'),
      h('button', { class: 'btn ghost small', onclick: () => ctx.toTitle() }, '타이틀로'),
    )
  }

  render()
  return root
}
