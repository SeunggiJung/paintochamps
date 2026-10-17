import actionData from '../data/actions.json'
import equipmentData from '../data/equipment.json'
import gacha from '../data/gacha.json'
import genres from '../data/genres.json'
import modes from '../data/modes.json'
import routes from '../data/routes.json'
import rules from '../data/rules.json'
import { advanceCalendar, type CalendarUpdate } from './calendar.ts'
import { applyEffects, type Effects } from './effects.ts'
import { coachEfficiency, housingRecovery, medicSpeed, prFame } from './facilities.ts'
import { ageGrowthFactor, equipmentEfficiency, growthDelta } from './growth.ts'
import { warmupBonus } from './minigame.ts'
import { createRng, mixSeed, type Rng } from './rng.ts'
import type { ActionId, EquipmentId, GameState } from './state.ts'
import { equipmentCost, moneyScale } from './economy.ts'
import { salaryOf } from './teams.ts'
import { drawTrainingMenu } from './training.ts'
import { STAT_KEYS, type StatKey, type Stats } from './types.ts'

interface Outcome {
  chance: number
  label: string
  /** true면 방탕 게이지가 높을수록 일어날 확률이 올라간다 (부작용) */
  viceRisk?: boolean
  effects: Effects
}

interface ActionDef {
  name: string
  /** 성장 공식(컨디션·장비·특성 반영)을 거쳐 오르는 능력치 */
  stats?: Partial<Record<StatKey, number>>
  topGenreStats?: { count: number; amount: number }
  condition?: number
  money?: number
  fame?: number
  vice?: number
  /** 음수면 부상 회복을 앞당긴다 */
  injuredMonths?: number
  /** 음수면 슬럼프 회복을 앞당긴다 */
  slumpMonths?: number
  /** 한 번 굴려서 하나가 일어난다. 합이 1보다 작으면 나머지는 아무 일도 없다. */
  outcomes?: Outcome[]
  requires?: { inTeam?: boolean; minFame?: number; injured?: boolean; slump?: boolean }
  allowWhenInjured?: boolean
  /** true면 시즌 훈련 후보(trainingMenu) 중 시즌 초에 정한 하나(seasonTraining)만 할 수 있는 훈련 */
  pool?: boolean
  /** true면 한 턴에 같은 행동을 두 번 고를 수 없다 (특별 훈련류) */
  noRepeat?: boolean
  /** 이 모드에서만 할 수 있다. 없으면 모든 모드. (정밀 모드는 선택지가 더 많다) */
  modes?: GameState['mode'][]
}

export const ACTIONS = actionData as Record<ActionId, ActionDef>
const EQUIPMENT = equipmentData as Record<EquipmentId, { name: string; base: number }>

/** 한 칸의 선택: 일반 행동 (장비 구매는 행동을 쓰지 않는다 — buyEquipment) */
export type Slot = { id: ActionId }
/** 한 턴에 행동 2개를 고른다. 같은 행동을 두 번 골라도 된다. */
export type TurnChoice = readonly [Slot, Slot]

export interface Delta {
  stats: Stats
  condition: number
  money: number
  fame: number
}

export type TurnResult =
  | { ok: true; state: GameState; delta: Delta; seasonEnded: boolean; notes: string[]; calendar: CalendarUpdate }
  | { ok: false; error: string }

/** 턴 길이 배율: 6개월 2, 3개월 1, 1개월 1/3 */
export function turnScale(mode: GameState['mode']): number {
  return modes[mode].turnMonths / rules.baseMonths
}

export function turnsPerSeason(mode: GameState['mode']): number {
  return modes[mode].turnsPerSeason
}

/** 한 턴에 이벤트가 하나 이상 일어날 확률: 1 − 0.65^(턴 길이 ÷ 3개월) */
export function eventChance(mode: GameState['mode']): number {
  return 1 - rules.eventBase ** turnScale(mode)
}

/** 모드별 성장 보너스(튜토리얼) × 정석 루트(아카데미 코칭) 보너스 */
function modeGrowth(state: GameState): number {
  const mode = (modes[state.mode] as { growthBonus?: number }).growthBonus ?? 1
  return mode * (state.path === 'academy' ? routes.academy.growthBonus : 1)
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** 행동에 쓰는 돈 (양수). 돈을 버는 행동이면 0. 소속 단계의 돈 규모를 곱한다. */
export function moneyCostOf(state: Pick<GameState, 'stage' | 'mode'>, id: ActionId): number {
  return Math.max(0, -(ACTIONS[id].money ?? 0)) * turnScale(state.mode) * moneyScale(state.stage)
}

/** 같은 행동을 한 턴에 두 번 고를 수 있는지. 시즌 훈련은 하나뿐이라 두 칸에 모두 넣을 수 있고, 특별 훈련(noRepeat)만 한 번이다. */
export function isRepeatable(id: ActionId): boolean {
  return !ACTIONS[id]?.noRepeat
}

/** 선택 가능한지 확인한다. 가능하면 null, 아니면 이유를 돌려준다. */
export function checkSlot(state: GameState, slot: Slot): string | null {
  const action = ACTIONS[slot.id]
  if (!action) return '알 수 없는 행동이다'
  if (action.pool) {
    if (!state.seasonTraining) return '이번 시즌에 할 훈련을 먼저 정해야 한다'
    if (state.seasonTraining !== slot.id) return '이번 시즌에 정한 훈련이 아니다'
  }
  if (action.modes && !action.modes.includes(state.mode)) {
    // 튜토리얼은 1회차 전용이라, 튜토리얼만 빠진 행동은 "2회차부터"라고 알려 준다
    return action.modes.includes('standard') ? `${action.name}은(는) 2회차부터 할 수 있다` : `${action.name}은(는) 정밀 모드에서만 할 수 있다`
  }
  if (state.injuredMonths > 0 && !action.allowWhenInjured) return '부상 중이라 휴식·재활만 할 수 있다'
  const { inTeam, minFame, injured, slump } = action.requires ?? {}
  if (inTeam !== undefined && (state.team !== null) !== inTeam) {
    return inTeam ? `${action.name}은(는) 팀에 소속되어야 할 수 있다` : `${action.name}은(는) 팀에 들어가기 전에만 할 수 있다`
  }
  if (minFame !== undefined && state.fame < minFame) return `${action.name}은(는) 명성 ${minFame} 이상이어야 한다`
  if (injured && state.injuredMonths <= 0) return `${action.name}은(는) 부상 중에만 할 수 있다`
  if (slump && state.slumpMonths <= 0) return `${action.name}은(는) 슬럼프 중에만 할 수 있다`
  const cost = moneyCostOf(state, slot.id)
  if (state.money < cost) return `돈이 부족하다 (${Math.ceil(cost)}만 원 필요)`
  return null
}

/** 장비를 살 수 있는지 확인한다. 턴을 쓰지 않고 돈만 있으면 몇 개든 살 수 있다(화면에서는 시즌 시작 계획 때). 가능하면 null. */
export function checkEquipment(state: GameState, item: EquipmentId): string | null {
  const def = EQUIPMENT[item]
  if (!def) return '알 수 없는 장비다'
  if (state.finished) return '이미 끝난 커리어다'
  const level = state.equipment[item]
  if (level >= rules.equipment.maxLevel) return `${def.name}은(는) 이미 최고 단계다`
  if (state.money < equipmentCost(item, level)) return `돈이 부족하다 (${equipmentCost(item, level).toLocaleString('ko-KR')}만 원 필요)`
  return null
}

/** 장비를 산다. 행동 칸을 쓰지 않는다. */
export function buyEquipment(state: GameState, item: EquipmentId): { ok: true; state: GameState } | { ok: false; error: string } {
  const error = checkEquipment(state, item)
  if (error) return { ok: false, error }
  const level = state.equipment[item]
  return {
    ok: true,
    state: {
      ...state,
      money: state.money - equipmentCost(item, level),
      equipment: { ...state.equipment, [item]: level + 1 },
    },
  }
}

/** 선택 하나를 적용한 새 상태. 컨디션 계수는 이 행동을 하기 직전의 컨디션으로 계산한다. */
function applySlot(state: GameState, slot: Slot, scale: number, rng: Rng, notes: string[]): GameState {
  const action = ACTIONS[slot.id]
  const slumpFactor = state.slumpMonths > 0 ? rules.slumpGrowthFactor : 1
  const gains: Partial<Record<StatKey, number>> = { ...action.stats }
  if (action.topGenreStats) {
    const weights = genres[state.genre].weights
    const top = [...STAT_KEYS].sort((a, b) => weights[b] - weights[a]).slice(0, action.topGenreStats.count)
    for (const key of top) gains[key] = action.topGenreStats.amount
  }

  const efficiency = equipmentEfficiency(state.equipment) * coachEfficiency(state) * (1 + warmupBonus(state))
  const stats = { ...state.stats }
  for (const key of STAT_KEYS) {
    const base = gains[key]
    if (base === undefined) continue
    const delta = growthDelta({
      base,
      scale: scale * slumpFactor * modeGrowth(state),
      efficiency: efficiency * ageGrowthFactor(state.age, key),
      condition: state.condition,
      traitMultiplier: state.trait.stat === key ? gacha.traitMultiplier : 1,
      current: state.stats[key],
    })
    stats[key] = clamp(state.stats[key] + delta, 0, gacha.statMax)
  }

  let next = applyEffects(
    { ...state, stats },
    { condition: action.condition, money: action.money, fame: action.fame, vice: action.vice, injuredMonths: action.injuredMonths, slumpMonths: action.slumpMonths },
    scale,
  )

  if (action.outcomes) {
    const roll = rng()
    let acc = 0
    for (const o of action.outcomes) {
      acc += Math.min(0.95, o.chance + (o.viceRisk ? rules.vice.riskPerPoint * state.vice : 0))
      if (roll < acc) {
        next = applyEffects(next, o.effects, scale)
        notes.push(o.label)
        break
      }
    }
  }
  return next
}

function diff(before: GameState, after: GameState): Delta {
  const stats = {} as Stats
  for (const key of STAT_KEYS) stats[key] = after.stats[key] - before.stats[key]
  return {
    stats,
    condition: after.condition - before.condition,
    money: after.money - before.money,
    fame: after.fame - before.fame,
  }
}

/** 같은 상태·같은 턴이면 같은 결과가 나오는 행동 결과용 난수 */
export function actionRng(state: GameState): Rng {
  return createRng(mixSeed(state.seed, state.turnCount, 0xac71))
}

/**
 * 한 턴을 진행한다. 행동 두 개를 차례로 적용하고(부작용·도박 같은 확률 결과 포함),
 * 방탕 게이지와 학교·용돈을 반영한 뒤 턴을 센다.
 * 시즌의 마지막 턴이면 seasonEnded가 true이고, 결산을 마친 뒤 startNextSeason을 부른다.
 * rng를 넘기지 않으면 상태에서 정해진 난수를 쓴다. (플레이어가 미리 결과를 알 수 없도록 AI가 점수를 매길 때는 다른 난수를 넘긴다.)
 */
export function applyTurn(state: GameState, choice: TurnChoice, rng: Rng = actionRng(state), calendar = true): TurnResult {
  if (state.finished) return { ok: false, error: '이미 끝난 커리어다' }
  if (state.pendingOffers) return { ok: false, error: '받은 제안을 먼저 정해야 한다' }
  if (state.turnInSeason >= turnsPerSeason(state.mode)) return { ok: false, error: '시즌 결산이 필요하다' }

  if (choice[0].id === choice[1].id && !isRepeatable(choice[0].id)) return { ok: false, error: `${ACTIONS[choice[0].id].name}은(는) 한 턴에 한 번만 할 수 있다` }

  const scale = turnScale(state.mode)
  const notes: string[] = []
  let next = state
  for (const slot of choice) {
    const error = checkSlot(next, slot)
    if (error) return { ok: false, error }
    next = applySlot(next, slot, scale, rng, notes)
  }

  // 방탕 게이지: 이번 턴에 술·유흥·도박을 안 했으면 내려가고, 높으면 중독 패널티가 붙는다
  const usedVice = choice.some((s) => (ACTIONS[s.id].vice ?? 0) > 0)
  if (!usedVice) next = { ...next, vice: Math.max(0, next.vice - rules.vice.decayPerBase * scale) }
  if (next.vice >= rules.vice.addictionAt) {
    next = applyEffects(next, { condition: rules.vice.addictionCondition, stats: { mental: rules.vice.addictionMental } }, scale)
    notes.push('중독 증세로 몸과 마음이 무너져 간다')
  }

  if (next.age <= rules.school.untilAge) {
    next = {
      ...next,
      condition: clamp(next.condition + rules.school.conditionPerBase * scale, 0, 100),
      money: next.money + rules.school.allowancePerBase * scale,
    }
  }

  // 팀에 소속되어 있으면 월급이 꾸준히 들어온다 (3개월 기준 금액에 턴 길이 배율)
  if (next.team) next = { ...next, money: next.money + salaryOf(next) * scale }

  // 턴이 지나면 컨디션이 조금씩 저절로 회복된다 (3개월 기준 금액에 턴 길이 배율)
  next = { ...next, condition: clamp(next.condition + (rules.conditionRecoveryPerBase + housingRecovery(next)) * scale, 0, 100) }
  // 홍보 에이전시: 턴마다 명성이 조금씩 오른다
  if (prFame(next) > 0) next = { ...next, fame: next.fame + prFame(next) * scale }

  const months = modes[next.mode].turnMonths
  next = {
    ...next,
    // 재활 트레이너가 있으면 부상·슬럼프에서 더 빨리 돌아온다
    slumpMonths: Math.max(0, next.slumpMonths - months * medicSpeed(next)),
    injuredMonths: Math.max(0, next.injuredMonths - months * medicSpeed(next)),
    turnInSeason: next.turnInSeason + 1,
    turnCount: next.turnCount + 1,
    warmup: 0,
  }
  // 시간이 흘러 기간이 시작·절반·끝에 닿은 대회를 진행하고 결과를 공개한다 (미리보기·AI 평가는 건너뛴다)
  const phase = next.turnInSeason / turnsPerSeason(next.mode)
  const update: CalendarUpdate = calendar ? advanceCalendar(next, phase) : { state: next, beats: [], running: [], phaseBefore: phase, phaseAfter: phase }
  next = update.state
  return { ok: true, state: next, delta: diff(state, next), seasonEnded: next.turnInSeason === turnsPerSeason(next.mode), notes, calendar: update }
}

/** 이번 시즌의 결산(settleSeason)을 이미 마쳤는지 */
export function isSettled(state: GameState): boolean {
  return state.history.length > 0 && state.history[state.history.length - 1].season === state.season
}

/** 시즌 결산과 제안 선택을 마친 뒤 다음 시즌으로 넘어간다. 25세부터 반응속도·정확도가 내려간다. */
export function startNextSeason(state: GameState): GameState {
  if (state.finished) throw new Error('이미 끝난 커리어다')
  if (state.turnInSeason < turnsPerSeason(state.mode)) throw new Error('시즌이 아직 끝나지 않았다')
  if (!isSettled(state)) throw new Error('시즌 결산이 필요하다')
  if (state.pendingOffers) throw new Error('받은 제안을 먼저 정해야 한다')
  const stats = { ...state.stats }
  if (state.age >= rules.ageDecline.fromAge) {
    for (const key of rules.ageDecline.stats as StatKey[]) {
      stats[key] = Math.max(0, stats[key] - rules.ageDecline.amountPerSeason)
    }
  }
  return {
    ...state,
    stats,
    seasonStartStats: { ...stats },
    age: state.age + 1,
    season: state.season + 1,
    turnInSeason: 0,
    seasonRun: null,
    // 새 시즌의 훈련 후보를 뽑고, 이번 시즌 훈련은 플레이어가 다시 정한다
    trainingMenu: drawTrainingMenu(state.seed, state.season + 1, state.team !== null),
    seasonTraining: null,
  }
}

/** 30세 시즌이 끝났으면 커리어가 끝난다. */
export function isCareerOver(state: GameState): boolean {
  return state.age >= rules.maxAge && state.turnInSeason >= turnsPerSeason(state.mode)
}
