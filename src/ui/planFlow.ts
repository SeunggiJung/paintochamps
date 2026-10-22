import equipmentData from '../data/equipment.json'
import rules from '../data/rules.json'
import { adOffersFor, adsOf, adTypeName, AD_TYPES, finishAdOffers, shootTurn, signAd, type AdOffer } from '../engine/ads.ts'
import { equipmentCost } from '../engine/economy.ts'
import { buyFacility, checkFacility, facilityCost, facilityEffectText, FACILITIES, FACILITY_IDS, facilityLevel } from '../engine/facilities.ts'
import { isOverseas } from '../engine/leagues.ts'
import { assetGrade, buyHome, HOMES, homeBlocker, homeLevel, netWorth } from '../engine/life.ts'
import { planOf, PRESETS, setSeasonPlan, type PresetId } from '../engine/plan.ts'
import type { ActionId, EquipmentId, GameState } from '../engine/state.ts'
import { bestTraining, canRerollTraining, chooseSeasonTraining, rerollTrainingMenu, TRAINING_POOL, trainingMenuOf } from '../engine/training.ts'
import { ACTIONS, buyEquipment, checkEquipment } from '../engine/turn.ts'
import { saveGame } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { segmented, stepDots } from './components.ts'
import { guideHelp, showGuideOnce } from './guides.ts'
import { helpIcon } from './conditionHelp.ts'
import { confirmSheet } from './confirm.ts'
import { h } from './dom.ts'
import { formatMoney } from './format.ts'
import { STAT_LABEL } from './labels.ts'
import { actionCost, actionTags } from './preview.ts'
import { upgradeArt } from './upgradeArt.ts'
import { openUpgrade } from './upgradeSheet.ts'

const EQUIPMENT = equipmentData as Record<EquipmentId, { name: string; base: number }>

type SpendTab = 'equipment' | 'facility' | 'ads' | 'home'

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
    h('ul', { class: 'plain train-list' }, ...TRAINING_POOL.map((id) => h('li', {}, h('b', {}, ACTIONS[id].name), h('span', { class: 'muted' }, ` ${statOrder(id)}${ACTIONS[id].requires?.inTeam ? ' (팀 소속일 때만)' : ''}`)))),
  )
  icon.querySelector('.help-pop')?.classList.add('list')
  return icon
}

/**
 * 시즌 계획 전체 화면(탭 바 없음). ① 계획(방침·훈련·레슨) → ② 지출 계획(장비·시설·광고·집).
 * 마지막에 '이 계획으로 시즌 시작'을 누르면 계획을 확정·저장하고 홈으로 간다.
 */
export function planFlow(ctx: Ctx, initial: GameState): HTMLElement {
  let state = initial
  const prev = planOf(state)
  let preset: PresetId = prev.preset
  let lesson = prev.lesson
  let training: ActionId | null = state.seasonTraining && trainingMenuOf(state).includes(state.seasonTraining) ? state.seasonTraining : null
  let step: 1 | 2 = 1
  let spend: SpendTab = 'equipment'
  const root = h('main', { class: 'screen plan-flow' })

  const upgradeRow = (kind: string, name: string, level: number, max: number, cost: string, detail: string, reason: string | null, effectText: string, buy: () => boolean) =>
    h(
      'button',
      {
        class: 'choice with-art',
        type: 'button',
        disabled: !!reason,
        onclick: async () => {
          await openUpgrade({ kind: kind as never, name, level, max, costText: cost, moneyText: formatMoney(state.money), effectText, buy })
          draw()
        },
      },
      upgradeArt(kind as never, level, max, 'mini'),
      h('div', { class: 'choice-text' }, h('strong', {}, level >= max ? `${name} (최고)` : `${name} Lv${level} → Lv${level + 1} · ${cost}`), h('span', { class: 'muted small' }, detail)),
    )

  const equipmentList = () =>
    (Object.keys(EQUIPMENT) as EquipmentId[]).map((item) => {
      const level = state.equipment[item]
      const reason = checkEquipment(state, item)
      return upgradeRow(item, EQUIPMENT[item].name, level, rules.equipment.maxLevel, formatMoney(equipmentCost(item, level)), reason ?? '구매', reason, '훈련 효율이 올라갑니다.', () => {
        const r = buyEquipment(state, item)
        if (r.ok) state = r.state
        return r.ok
      })
    })

  const facilityList = () =>
    FACILITY_IDS.filter((id) => !FACILITIES[id].onlyOverseas || isOverseas(state)).map((id) => {
      const def = FACILITIES[id]
      const level = facilityLevel(state, id)
      const reason = checkFacility(state, id)
      return upgradeRow(
        id,
        def.name,
        level,
        def.maxLevel,
        formatMoney(facilityCost(state, id)),
        `${def.desc} (${def.unit}) · 지금 ${facilityEffectText(id, level)}${level < def.maxLevel ? ` → ${facilityEffectText(id, level + 1)}` : ''}${reason && level < def.maxLevel ? ` — ${reason}` : ''}`,
        reason,
        `${def.desc} (${def.unit}) 현재: ${facilityEffectText(id, level)} → 다음: ${facilityEffectText(id, level + 1)}`,
        () => {
          const r = buyFacility(state, id)
          if (r.ok) state = r.state
          return r.ok
        },
      )
    })

  /** 광고 제안: 시즌 시작에 계약하면 시즌 중 촬영 일정에 따라 돈을 번다 */
  const adList = (): HTMLElement[] => {
    const offers = adOffersFor(state)
    const signed = adsOf(state)
    const expected = (o: AdOffer): string => {
      if (o.type === 'world') return `기본 ${formatMoney(o.base)} + 월드 4강 이상이면 보너스 ${formatMoney(o.bonus)}`
      if (o.type === 'season') return `촬영 2번에 ${formatMoney(Math.round(o.base * 0.75))} + 잔금 ${formatMoney(Math.round(o.base * 0.25))} (시즌 성적이 상위 60% 이내일 때)`
      return formatMoney(o.base)
    }
    const when = (o: AdOffer) => AD_TYPES[o.type].shootAt.map((_, i) => `${shootTurn(o.type, i, state.mode)}턴 뒤`).join(', ')
    return [
      h('p', { class: 'muted small' }, '명성이 높아 브랜드들이 광고 모델 제안을 보냈습니다. 촬영 한 번마다 컨디션이 조금 줄어들어요. 브랜드는 모두 가상입니다.'),
      ...signed.map((c) => h('p', { class: 'notice' }, `계약 완료: ${adTypeName(c.type)} · ${c.brand}(${c.category})`)),
      ...offers.map((o) =>
        h(
          'button',
          {
            class: 'choice',
            type: 'button',
            onclick: () => {
              state = signAd(state, o)
              draw()
            },
          },
          h('strong', {}, `${adTypeName(o.type)} · ${o.brand} (${o.category})`),
          h('span', { class: 'muted small' }, `${AD_TYPES[o.type].desc} 수입: ${expected(o)} · 촬영: ${when(o)}`),
        ),
      ),
    ]
  }

  /** 집과 가족: 다음 단계 집을 마련하면 슬럼프가 짧아지고 가족 이벤트가 열린다 */
  const homeList = (): HTMLElement[] => {
    const level = homeLevel(state)
    const next = HOMES[level]
    const reason = homeBlocker(state)
    return [
      h('p', { class: 'muted small' }, `순자산 ${formatMoney(Math.round(netWorth(state)))} · ${assetGrade(state)}`),
      h('p', { class: 'muted small' }, level > 0 ? `지금: ${HOMES[level - 1].name} (슬럼프 기간 -${Math.round(HOMES[level - 1].slumpCut * 100)}%)` : '아직 집을 마련하지 못했습니다. 집을 마련하면 슬럼프가 짧아지고 가족 이벤트가 열립니다.'),
      next
        ? h(
            'button',
            {
              class: 'choice',
              type: 'button',
              disabled: !!reason,
              onclick: async () => {
                const ok = await confirmSheet({ title: next.name, message: `${next.desc} (${formatMoney(next.price)}, 슬럼프 기간 -${Math.round(next.slumpCut * 100)}%)`, ok: '마련한다', cancel: '다음에' })
                if (!ok) return
                const r = buyHome(state)
                if (r.ok) state = r.state
                draw()
              },
            },
            h('strong', {}, `${next.name} · ${formatMoney(next.price)}`),
            h('span', { class: 'muted small' }, `${next.desc}${reason ? ` — ${reason}` : ''}`),
          )
        : h('p', { class: 'notice' }, '내 집까지 마련했습니다.'),
    ]
  }

  const stepOne = (): HTMLElement[] => {
    const menu = trainingMenuOf(state)
    const best = bestTraining(state, menu)
    const lessonCost = Math.ceil(actionCost({ id: 'private_lesson' }, state))
    return [
      h('div', { class: 'row' }, h('p', { class: 'eyebrow' }, `${state.season}시즌 계획`), guideHelp(ctx, 'plan')),
      h('p', { class: 'event-text' }, '이번 시즌을 어떻게 보낼지 정하자. 시즌이 시작되면 컨디션에 맞춰 알아서 흘러가고, 대회·이적 같은 큰 일에만 직접 결정한다.'),
      h('h3', {}, '방침'),
      h(
        'div',
        { class: 'preset-grid' },
        ...PRESETS.map((p) =>
          h('button', { class: `choice${preset === p.id ? ' selected' : ''}`, type: 'button', 'aria-pressed': String(preset === p.id), onclick: () => ((preset = p.id), draw()) }, h('strong', {}, p.name), h('span', { class: 'muted small' }, p.desc)),
        ),
      ),
      h(
        'div',
        { class: 'row' },
        h('h3', {}, '이번 시즌 훈련', trainingListHelp()),
        h(
          'button',
          {
            class: 'btn reroll small',
            type: 'button',
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
            { class: `choice${training === id ? ' selected' : ''}${id === best ? ' best' : ''}`, type: 'button', 'aria-pressed': String(training === id), onclick: () => ((training = id), draw()) },
            h('strong', {}, id === best && h('span', { class: 'best-star', title: '실력치를 가장 많이 올려 주는 훈련' }, '★ '), ACTIONS[id].name, id === best && h('span', { class: 'best-tag' }, '추천')),
            h('span', { class: 'muted small' }, `${statOrder(id)} · ${actionTags({ id }, state).filter((t) => t.includes('컨디션') || !t.endsWith('↑')).join(' · ')}`.replace(/ · $/, '')),
          ),
        ),
      ),
      h('h3', {}, '개인 레슨'),
      h(
        'button',
        { class: `choice${lesson ? ' selected' : ''}`, type: 'button', role: 'switch', 'aria-checked': String(lesson), onclick: () => ((lesson = !lesson), draw()) },
        h('strong', {}, lesson ? '개인 레슨 받는다' : '개인 레슨 받지 않는다'),
        h('span', { class: 'muted small' }, `컨디션이 좋을 때 훈련 한 번을 레슨으로 바꿔 지금 실력치를 가장 많이 올려 주는 능력치 3개(${actionTags({ id: 'private_lesson' }, state).filter((t) => t.endsWith('↑') && !t.startsWith('컨디션')).join('·')})를 올립니다. 턴마다 ${formatMoney(lessonCost)}`),
      ),
      h(
        'div',
        { class: 'plan-cta' },
        h('button', { class: 'btn primary', type: 'button', disabled: training === null, onclick: () => ((step = 2), draw()) }, training === null ? '이번 시즌 훈련을 골라 주세요' : '다음 · 지출 계획'),
      ),
    ]
  }

  const stepTwo = (): HTMLElement[] => {
    const tabs: { id: SpendTab; label: string }[] = [
      { id: 'equipment', label: '장비' },
      { id: 'facility', label: '시설' },
    ]
    if (adOffersFor(state).length > 0 || adsOf(state).length > 0) tabs.push({ id: 'ads', label: '광고' })
    if (['pro2', 'pro1'].includes(state.stage)) tabs.push({ id: 'home', label: '집' })
    if (!tabs.some((t) => t.id === spend)) spend = 'equipment'
    const list = spend === 'equipment' ? equipmentList() : spend === 'facility' ? facilityList() : spend === 'ads' ? adList() : homeList()
    return [
      h('div', { class: 'row' }, h('h2', {}, '지출 계획', guideHelp(ctx, 'spend')), h('span', { class: 'muted small' }, `보유 돈 ${formatMoney(state.money)}`)),
      h('p', { class: 'muted small' }, '시즌 시작에 돈이 되는 만큼 살 수 있어요. 시즌 중에는 바꿀 수 없어요.'),
      segmented(tabs, spend, (id) => ((spend = id), draw())),
      h('div', { class: 'choices vertical' }, ...list),
      h(
        'div',
        { class: 'plan-cta btn-row' },
        h('button', { class: 'btn', type: 'button', onclick: () => ((step = 1), draw()) }, '이전'),
        h(
          'button',
          {
            class: 'btn primary',
            type: 'button',
            onclick: () => {
              const done = finishAdOffers(chooseSeasonTraining(setSeasonPlan(state, { preset, lesson }), training!))
              saveGame(ctx.storage, done)
              ctx.toHome(done)
            },
          },
          '이 계획으로 시즌 시작',
        ),
      ),
    ]
  }

  function draw() {
    root.replaceChildren(stepDots(2, step), ...(step === 1 ? stepOne() : stepTwo()))
    // 상황이 처음 나타날 때 한 번만 (이미 본 것은 아무것도 안 뜬다)
    if (step === 1) void showGuideOnce(ctx, 'plan')
    else {
      void showGuideOnce(ctx, 'spend').then(() => {
        if (spend === 'ads') return showGuideOnce(ctx, 'ads')
        if (spend === 'home') return showGuideOnce(ctx, 'house')
      })
    }
  }
  draw()
  return root
}
