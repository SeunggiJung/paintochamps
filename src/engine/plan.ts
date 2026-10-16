import plans from '../data/plans.json'
import type { Rng } from './rng.ts'
import type { ActionId, GameState } from './state.ts'
import { applyTurn, checkSlot, type Slot, type TurnChoice, type TurnResult } from './turn.ts'

/**
 * 시즌 계획: 시즌 시작에 방침(프리셋)과 개인 레슨 여부를 정해 두면, 시즌 중 매 턴의 행동(훈련·휴식·돈벌이)은
 * 컨디션에 맞춰 자동으로 정해진다. 플레이어는 시즌 중에 행동을 고르지 않고 큰 사건(대회·이적·이벤트 등)에만 관여한다.
 */

export type PresetId = 'focus' | 'balanced' | 'care' | 'money'

export interface SeasonPlan {
  preset: PresetId
  /** 개인 레슨을 받을지 (컨디션이 좋고 돈이 있을 때 훈련 한 번을 레슨으로 바꾼다) */
  lesson: boolean
}

type Token = 'train' | 'rest' | 'money'

export interface PresetDef {
  id: PresetId
  name: string
  desc: string
  /** 컨디션이 min 이상인 첫 단계의 두 칸을 쓴다 (위에서부터) */
  tiers: { min: number; slots: [Token, Token] }[]
}

export const PRESETS = plans.presets as PresetDef[]

export const DEFAULT_PLAN: SeasonPlan = { preset: 'balanced', lesson: false }

export function presetDef(id: PresetId): PresetDef {
  return PRESETS.find((p) => p.id === id)!
}

/** 지금 상태의 계획. 옛 세이브·새 판에는 없어서 기본 계획(균형)을 쓴다. */
export function planOf(state: Pick<GameState, 'plan'>): SeasonPlan {
  return state.plan ?? DEFAULT_PLAN
}

export function setSeasonPlan(state: GameState, plan: SeasonPlan): GameState {
  return { ...state, plan }
}

const REST: Slot = { id: 'rest' }

/**
 * 이번 턴에 자동으로 할 행동 두 개. 부상 중이면 쉬며 재활하고, 아니면 방침에 따라 컨디션 단계별로 정한다.
 * 슬럼프면 쉬는 칸 하나를 상담으로 바꾸고, 개인 레슨을 켰다면 훈련 한 칸을 레슨으로 바꾼다. 못 하는 행동은 휴식이 된다.
 */
export function planChoice(state: GameState): TurnChoice {
  if (state.injuredMonths > 0) {
    const rehab: Slot = { id: 'rehab' }
    return [REST, checkSlot(state, rehab) === null ? rehab : REST]
  }

  const plan = planOf(state)
  const tiers = presetDef(plan.preset).tiers
  const tier = tiers.find((t) => state.condition >= t.min) ?? tiers[tiers.length - 1]
  const train = state.seasonTraining

  const resolve = (token: Token): ActionId => {
    if (token === 'rest') return 'rest'
    if (token === 'train') return train ?? 'rest'
    // 돈벌이: 지금 할 수 있는 것 중 첫 번째, 없으면 훈련
    const money = plans.moneyOrder.find((id) => checkSlot(state, { id: id as ActionId }) === null)
    return (money ?? train ?? 'rest') as ActionId
  }
  const ids = tier.slots.map(resolve)

  if (state.slumpMonths > 0) {
    const i = ids.indexOf('rest')
    if (i >= 0 && checkSlot(state, { id: 'counseling' }) === null) ids[i] = 'counseling'
  }
  if (plan.lesson && train && state.condition >= plans.lesson.minCondition) {
    const lesson = plans.lesson.action as ActionId
    const i = ids.lastIndexOf(train)
    if (i >= 0 && checkSlot(state, { id: lesson }) === null) ids[i] = lesson
  }
  return ids.map((id) => (checkSlot(state, { id }) === null ? { id } : REST)) as unknown as TurnChoice
}

/** 계획대로 한 턴을 자동으로 진행한다. 계획이 막히는 일이 생기면(돈 부족 등) 쉬는 것으로 대신한다. choice는 실제로 한 행동. */
export function autoTurn(state: GameState, rng?: Rng, calendar = true): { result: TurnResult; choice: TurnChoice } {
  const planned = planChoice(state)
  const result = applyTurn(state, planned, rng, calendar)
  if (result.ok) return { result, choice: planned }
  const fallback: TurnChoice = [REST, REST]
  return { result: applyTurn(state, fallback, rng, calendar), choice: fallback }
}
