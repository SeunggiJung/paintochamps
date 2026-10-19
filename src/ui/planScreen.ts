import equipmentData from '../data/equipment.json'
import rules from '../data/rules.json'
import { equipmentCost } from '../engine/economy.ts'
import { buyFacility, checkFacility, FACILITIES, FACILITY_IDS, facilityCost, facilityLevel } from '../engine/facilities.ts'
import { planOf, PRESETS, setSeasonPlan, type PresetId } from '../engine/plan.ts'
import type { ActionId, EquipmentId, GameState } from '../engine/state.ts'
import { canRerollTraining, chooseSeasonTraining, bestTraining, rerollTrainingMenu, TRAINING_POOL, trainingMenuOf } from '../engine/training.ts'
import { ACTIONS, buyEquipment, checkEquipment } from '../engine/turn.ts'
import { openUpgrade } from './upgradeSheet.ts'
import { upgradeArt } from './upgradeArt.ts'
import { helpIcon } from './conditionHelp.ts'
import { h } from './dom.ts'
import { STAT_LABEL } from './labels.ts'
import { formatMoney } from './format.ts'
import { actionCost, actionTags } from './preview.ts'
import { openSheet } from './sheet.ts'

const EQUIPMENT = equipmentData as Record<EquipmentId, { name: string; base: number }>

/** 훈련 하나가 올려 주는 능력치를 주력 순으로 (예: '판단력·정확도·멘탈') */
function statOrder(id: ActionId): string {
  const a = ACTIONS[id]
  const keys = Object.entries(a.stats ?? {}).sort((x, y) => (y[1] ?? 0) - (x[1] ?? 0)).map(([k]) => STAT_LABEL[k as keyof typeof STAT_LABEL])
  return keys.length > 0 ? keys.join('·') : '장르 핵심 능력치'
}

/** '이번 시즌 훈련' 옆 도움말: 나올 수 있는 훈련 전체와 올려 주는 능력치 */
function trainingListHelp(): HTMLElement {
  const icon = helpIcon(
    '훈련 목록',
    h('b', {}, '나올 수 있는 훈련'),
    h('p', { class: 'small muted' }, '앞에 있는 능력치일수록 많이 오릅니다.'),
    h(
      'ul',
      { class: 'plain train-list' },
      ...TRAINING_POOL.map((id) =>
        h('li', {}, h('b', {}, ACTIONS[id].name), h('span', { class: 'muted' }, ` ${statOrder(id)}${ACTIONS[id].requires?.inTeam ? ' (팀 소속일 때만)' : ''}`)),
      ),
    ),
  )
  icon.querySelector('.help-pop')?.classList.add('list')
  return icon
}

/**
 * 시즌 시작 계획 시트: 방침(프리셋)·이번 시즌 훈련·개인 레슨을 정하고 장비를 산다.
 * 정한 뒤에는 시즌 중 행동이 컨디션에 맞춰 자동으로 흘러가고, 플레이어는 시즌 중에 행동을 고르지 않는다.
 * 확정한 상태(계획·훈련 반영, 장비 구매 반영)를 돌려준다.
 */
export function openPlanSheet(initial: GameState): Promise<GameState> {
  let state = initial
  const prev = planOf(state)
  let preset: PresetId = prev.preset
  let lesson = prev.lesson
  let training: ActionId | null = state.seasonTraining && trainingMenuOf(state).includes(state.seasonTraining) ? state.seasonTraining : null

  return openSheet<GameState>((close) => {
    const root = h('div', { class: 'stack-tight plan-sheet' })

    const draw = () => {
      const menu = trainingMenuOf(state)
      const best = bestTraining(state, menu)
      const lessonCost = Math.ceil(actionCost({ id: 'private_lesson' }, state))
      root.replaceChildren(
        h('p', { class: 'eyebrow' }, `${state.season}시즌 계획`),
        h('p', { class: 'event-text' }, '이번 시즌을 어떻게 보낼지 정하자. 시즌이 시작되면 컨디션에 맞춰 알아서 흘러가고, 대회·이적 같은 큰 일에만 직접 결정한다.'),

        h('h3', {}, '방침'),
        h(
          'div',
          { class: 'choices vertical' },
          ...PRESETS.map((p) =>
            h(
              'button',
              { class: `choice${preset === p.id ? ' selected' : ''}`, 'aria-pressed': String(preset === p.id), onclick: () => ((preset = p.id), draw()) },
              h('strong', {}, p.name),
              h('span', { class: 'muted small' }, p.desc),
            ),
          ),
        ),

        h('div', { class: 'row' }, h('h3', {}, '이번 시즌 훈련', trainingListHelp()),
          h(
            'button',
            {
              class: 'btn reroll small',
              disabled: !canRerollTraining(state),
              onclick: () => {
                state = rerollTrainingMenu(state)
                training = null
                draw()
              },
            },
            canRerollTraining(state) ? '후보 다시 뽑기 (시즌 1회)' : '이번 시즌 다시 뽑기 사용함',
          ),
        ),
        h('p', { class: 'muted small' }, '시즌 동안 이 훈련을 합니다. 훈련은 시즌마다 무작위 후보가 나옵니다. ★ 표시는 지금 실력치를 가장 많이 올려 주는 훈련이에요.'),
        h(
          'div',
          { class: 'choices vertical' },
          ...menu.map((id) =>
            h(
              'button',
              { class: `choice${training === id ? ' selected' : ''}${id === best ? ' best' : ''}`, 'aria-pressed': String(training === id), onclick: () => ((training = id), draw()) },
              h('strong', {}, id === best && h('span', { class: 'best-star', title: '실력치를 가장 많이 올려 주는 훈련' }, '★ '), ACTIONS[id].name, id === best && h('span', { class: 'best-tag' }, '추천')),
              h('span', { class: 'muted small' }, `${statOrder(id)} · ${actionTags({ id }, state).filter((t) => t.includes('컨디션') || !t.endsWith('↑')).join(' · ')}`.replace(/ · $/, '')),
            ),
          ),
        ),

        h('h3', {}, '개인 레슨'),
        h(
          'button',
          { class: `choice${lesson ? ' selected' : ''}`, 'aria-pressed': String(lesson), onclick: () => ((lesson = !lesson), draw()) },
          h('strong', {}, lesson ? '개인 레슨 받는다' : '개인 레슨 받지 않는다'),
          h('span', { class: 'muted small' }, `컨디션이 좋을 때 훈련 한 번을 레슨으로 바꿔 지금 실력치를 가장 많이 올려 주는 능력치 3개(${actionTags({ id: 'private_lesson' }, state).filter((t) => t.endsWith('↑') && !t.startsWith('컨디션')).join('·')})를 올립니다. 턴마다 ${formatMoney(lessonCost)}`),
        ),

        h('div', { class: 'row' }, h('h3', {}, '장비'), h('span', { class: 'muted small' }, `보유 돈 ${formatMoney(state.money)}`)),
        h('p', { class: 'muted small' }, '훈련 효율이 올라갑니다. 시즌 시작에 돈이 되는 만큼 살 수 있습니다.'),
        h(
          'div',
          { class: 'choices vertical' },
          ...(Object.keys(EQUIPMENT) as EquipmentId[]).map((item) => {
            const level = state.equipment[item]
            const maxed = level >= rules.equipment.maxLevel
            const reason = checkEquipment(state, item)
            return h(
              'button',
              {
                class: 'choice with-art',
                disabled: !!reason,
                onclick: async () => {
                  await openUpgrade({
                    kind: item,
                    name: EQUIPMENT[item].name,
                    level,
                    max: rules.equipment.maxLevel,
                    costText: formatMoney(equipmentCost(item, level)),
                    moneyText: formatMoney(state.money),
                    effectText: '훈련 효율이 올라갑니다.',
                    buy: () => {
                      const r = buyEquipment(state, item)
                      if (r.ok) state = r.state
                      return r.ok
                    },
                  })
                  draw()
                },
              },
              upgradeArt(item, level, rules.equipment.maxLevel, 'mini'),
              h('div', { class: 'choice-text' }, h('strong', {}, maxed ? `${EQUIPMENT[item].name} (최고)` : `${EQUIPMENT[item].name} Lv${level} → Lv${level + 1} · ${formatMoney(equipmentCost(item, level))}`),
              h('span', { class: 'muted small' }, reason ?? '구매')),
            )
          }),
        ),

        h('h3', {}, '시설 투자'),
        h('p', { class: 'muted small' }, '장비를 다 올린 뒤에도 돈을 쓸 곳입니다. 가격은 지금 소속 단계의 돈 규모를 따라갑니다.'),
        h(
          'div',
          { class: 'choices vertical' },
          ...FACILITY_IDS.map((id) => {
            const def = FACILITIES[id]
            const level = facilityLevel(state, id)
            const reason = checkFacility(state, id)
            return h(
              'button',
              {
                class: 'choice with-art',
                disabled: !!reason,
                onclick: async () => {
                  await openUpgrade({
                    kind: id,
                    name: def.name,
                    level,
                    max: def.maxLevel,
                    costText: formatMoney(facilityCost(state, id)),
                    moneyText: formatMoney(state.money),
                    effectText: `${def.desc} (${def.unit})`,
                    buy: () => {
                      const r = buyFacility(state, id)
                      if (r.ok) state = r.state
                      return r.ok
                    },
                  })
                  draw()
                },
              },
              upgradeArt(id, level, def.maxLevel, 'mini'),
              h('div', { class: 'choice-text' }, h('strong', {}, level >= def.maxLevel ? `${def.name} (최고)` : `${def.name} Lv${level} → Lv${level + 1} · ${formatMoney(facilityCost(state, id))}`),
              h('span', { class: 'muted small' }, `${def.desc} (${def.unit})${reason && level < def.maxLevel ? ` — ${reason}` : ''}`)),
            )
          }),
        ),

        h(
          'button',
          {
            class: 'btn primary',
            disabled: training === null,
            onclick: () => close(chooseSeasonTraining(setSeasonPlan(state, { preset, lesson }), training!)),
          },
          training === null ? '이번 시즌 훈련을 골라 주세요' : '이 계획으로 시즌 시작',
        ),
      )
    }

    draw()
    return root
  }, { autofocus: false })
}
