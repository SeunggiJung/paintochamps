import equipmentData from '../../data/equipment.json'
import gacha from '../../data/gacha.json'
import genres from '../../data/genres.json'
import rules from '../../data/rules.json'
import { FACILITIES, FACILITY_IDS, facilityLevel } from '../../engine/facilities.ts'
import { canNegotiate } from '../../engine/negotiation.ts'
import { genrePower } from '../../engine/power.ts'
import { transferBlocker } from '../../engine/season.ts'
import type { EquipmentId } from '../../engine/state.ts'
import { salaryOf } from '../../engine/teams.ts'
import { STAT_KEYS } from '../../engine/types.ts'
import { countUp } from '../countUp.ts'
import { h } from '../dom.ts'
import { formatMoney } from '../format.ts'
import type { GameSession } from '../session.ts'
import { guideHelp, showGuideOnce } from '../guides.ts'
import { statName } from '../statHelp.ts'

const EQUIPMENT = equipmentData as Record<EquipmentId, { name: string }>

/** 선수 탭: 능력치·계약(연봉 협상·이적 요청)·장비/시설 현황(보기 전용)·내 경력 */
export function playerTab(session: GameSession): HTMLElement {
  const state = session.state
  const power = Math.round(genrePower(state.stats, state.genre))

  const stats = h(
    'section',
    { class: 'card', 'data-guide': 'stats' },
    h('div', { class: 'row' }, h('h3', {}, '능력치'), h('span', { class: 'power' }, `${genres[state.genre].name} 실력치 `, countUp(session.shown.power, power))),
    ...STAT_KEYS.map((k) =>
      h(
        'div',
        { class: 'stat-row compact' },
        statName(k, state.genre, genres[state.genre].weights[k] >= 20),
        h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: `width:${(state.stats[k] / gacha.statMax) * 100}%` })),
        h('span', { class: 'stat-value' }, countUp(Math.round(session.shown.stats[k]), Math.round(state.stats[k]))),
        state.trait.stat === k ? h('span', { class: 'tag' }, '특성') : h('span', {}),
      ),
    ),
  )

  const salary = state.team ? salaryOf(state) : 0
  const contract = h(
    'section',
    { class: 'card', 'data-guide': 'contract' },
    h('div', { class: 'row' }, h('h3', {}, '계약'), guideHelp(session.ctx, 'contract')),
    h('p', { class: 'small' }, state.team ? `${state.team.name}` : '소속 팀 없음', salary > 0 ? h('span', { class: 'muted' }, ` · 월급 ${formatMoney(salary)}/3개월`) : null),
    h(
      'div',
      { class: 'btn-row' },
      h('button', { class: 'btn small', type: 'button', disabled: session.busy || !canNegotiate(state), onclick: () => void session.negotiate() }, '연봉 협상'),
      h('button', { class: 'btn small', type: 'button', disabled: session.busy || !!transferBlocker(state, 'mid'), onclick: () => void session.requestMidTransfer() }, '이적 요청'),
    ),
  )

  const gear = h(
    'section',
    { class: 'card' },
    h('h3', {}, '장비·시설 현황'),
    h(
      'ul',
      { class: 'plain small' },
      ...(Object.keys(EQUIPMENT) as EquipmentId[]).map((id) => h('li', {}, `${EQUIPMENT[id].name} Lv${state.equipment[id]}/${rules.equipment.maxLevel}`)),
      ...FACILITY_IDS.filter((id) => !FACILITIES[id].onlyOverseas || facilityLevel(state, id) > 0).map((id) => h('li', {}, `${FACILITIES[id].name} Lv${facilityLevel(state, id)}/${FACILITIES[id].maxLevel}`)),
    ),
    h('p', { class: 'muted small' }, '구매는 시즌 시작 때 지출 계획에서 해요.'),
  )

  if (state.team && !session.busy) void showGuideOnce(session.ctx, 'contract')

  const career = h('button', { class: 'settings-link', type: 'button', onclick: () => void session.showCareer() }, h('span', {}, '내 경력'), h('span', { class: 'muted' }, '›'))

  return h('main', { class: 'screen' }, stats, contract, gear, career)
}
