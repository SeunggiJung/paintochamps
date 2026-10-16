import { applyEventChoice, availableChoices, choiceOutcomes, rollEvent, turnRng, type GameEvent } from '../engine/events.ts'
import { rollGacha } from '../engine/gacha.ts'
import { moneyScale } from '../engine/economy.ts'
import { conditionCoef } from '../engine/growth.ts'
import { genrePower } from '../engine/power.ts'
import { createRng, mixSeed, type Rng } from '../engine/rng.ts'
import { choosePrep, PREP, upcomingTest } from '../engine/routes.ts'
import { acceptOffer, rollMidSeasonOffer, settleSeason } from '../engine/season.ts'
import { createInitialState, type ActionId, type EquipmentId, type GameState, type ModeId } from '../engine/state.ts'
import { chooseSeasonTraining, trainingMenuOf } from '../engine/training.ts'
import { ACTIONS, applyTurn, buyEquipment, checkSlot, startNextSeason, turnsPerSeason, type Slot, type TurnChoice } from '../engine/turn.ts'
import type { GenreId } from '../engine/types.ts'

/**
 * casual: 컨디션만 관리하며 훈련하는 단순한 플레이 (장비·이벤트 판단 없음, 이벤트는 첫 선택지)
 * skilled: 한 턴 앞을 보고 행동을 고르고, 위험한 행동은 기댓값으로 비교하고, 이벤트 선택지도 비교하는 숙련 플레이
 * random: 가능한 행동·선택지 중 아무거나 고르는 플레이 (잘 모르고 눌러 보는 사람)
 */
export type BotPolicy = 'casual' | 'skilled' | 'random'

export interface BotOptions {
  policy: BotPolicy
  /** 1부 이적 제안을 받아들일지 (히든 엔딩은 데뷔 팀에 남아야 한다) */
  acceptTransfers?: boolean
  /** 매 턴이 끝날 때마다 불린다 (성장 속도 같은 측정용) */
  onTurn?: (s: GameState) => void
}

const ACTION_IDS = Object.keys(ACTIONS) as ActionId[]
const ACTION_SLOTS: Slot[] = ACTION_IDS.map((id) => ({ id }))
/** 지금 고를 수 있는 행동만 (무작위로 나오는 훈련은 이번 턴 후보만) */
const slotsFor = (s: GameState): Slot[] => ACTION_SLOTS.filter((slot) => checkSlot(s, slot) === null)
const EQUIPMENT_IDS: EquipmentId[] = ['keyboard', 'mouse', 'monitor', 'pc']

const isRisky = (slot: Slot) => !!ACTIONS[slot.id].outcomes

/** 숙련 봇이 상태를 얼마나 좋게 보는지: 실력치 + 컨디션(성장 효율) + 명성·돈 + 장비 − 방탕·부상·슬럼프 */
function value(s: GameState): number {
  const levels = Object.values(s.equipment).reduce((a, b) => a + b, 0)
  const horizon = Math.max(0, 30 - s.age) / 14
  return (
    genrePower(s.stats, s.genre) +
    80 * conditionCoef(s.condition) +
    0.2 * s.condition +
    0.5 * s.fame +
    0.15 * (s.money / moneyScale(s.stage)) + // 돈은 소속 단계의 규모로 나눠 같은 무게로 본다
    8 * levels * horizon -
    10 * s.vice -
    4 * s.injuredMonths -
    3 * s.slumpMonths
  )
}

const SAMPLES = 4

/** 위험한 행동이 들어 있으면 여러 번 굴려 평균을 낸다 (실제 결과를 미리 보지 않도록 봇 자신의 난수를 쓴다) */
function expectedValue(s: GameState, choice: TurnChoice, rng: Rng): number | null {
  const risky = isRisky(choice[0]) || isRisky(choice[1])
  const n = risky ? SAMPLES : 1
  let total = 0
  for (let k = 0; k < n; k++) {
    const r = applyTurn(s, choice, risky ? rng : undefined, false)
    if (!r.ok) return null
    total += value(r.state)
  }
  return total / n
}

/** 장비는 행동 칸을 쓰지 않고 한 턴에 하나까지 산다. 숙련은 가치가 오르는 것만, 무작위는 절반 확률로 아무거나, 단순은 사지 않는다. */
function shop(s: GameState, policy: BotPolicy, rng: Rng): GameState {
  if (policy === 'casual') return s
  const options = EQUIPMENT_IDS.map((item) => buyEquipment(s, item)).filter((r) => r.ok).map((r) => (r.ok ? r.state : s))
  if (options.length === 0) return s
  if (policy === 'random') {
    // 예전에 장비가 행동 후보 중 하나로 뽑히던 빈도(두 칸 중 한 번 이상)와 맞춘다
    const pSlot = EQUIPMENT_IDS.length / (ACTION_IDS.length + EQUIPMENT_IDS.length)
    return rng() < 1 - (1 - pSlot) ** 2 ? options[Math.floor(rng() * options.length)] : s
  }
  const best = options.reduce((a, b) => (value(b) > value(a) ? b : a))
  return value(best) > value(s) ? best : s
}

function skilledChoice(s: GameState, rng: Rng): TurnChoice {
  const slots = slotsFor(s)
  let best: TurnChoice = [{ id: 'rest' }, { id: 'rest' }]
  let bestValue = -Infinity
  for (let i = 0; i < slots.length; i++) {
    for (let j = i; j < slots.length; j++) {
      const choice: TurnChoice = [slots[i], slots[j]]
      const v = expectedValue(s, choice, rng)
      if (v !== null && v > bestValue) {
        bestValue = v
        best = choice
      }
    }
  }
  return best
}

function randomChoice(s: GameState, rng: Rng): TurnChoice {
  const valid: TurnChoice[] = []
  const slots = slotsFor(s)
  for (let i = 0; i < slots.length; i++) {
    for (let j = i; j < slots.length; j++) {
      const choice: TurnChoice = [slots[i], slots[j]]
      if (applyTurn(s, choice, rng, false).ok) valid.push(choice)
    }
  }
  return valid.length ? valid[Math.floor(rng() * valid.length)] : [{ id: 'rest' }, { id: 'rest' }]
}

/** 시즌 훈련 고르기: 숙련은 후보마다 그 훈련만 두 번 해 본 결과로 비교하고, 무작위는 아무거나, 단순은 앞의 후보(어떤 게 좋은지 따지지 않는다) */
function pickSeasonTraining(s: GameState, policy: BotPolicy, rng: Rng): ActionId {
  const menu = trainingMenuOf(s)
  if (policy === 'casual') return menu[0]
  if (policy === 'random') return menu[Math.floor(rng() * menu.length)]
  let best = menu[0]
  let bestValue = -Infinity
  // 훈련 하나를 시즌 내내 하게 되므로, 이 훈련으로 몇 턴 진행해 본 결과로 비교한다 (컨디션이 나쁘면 쉬며 이어 간다)
  const horizon = Math.min(turnsPerSeason(s.mode), 6)
  for (const id of menu) {
    let cur = chooseSeasonTraining(s, id)
    for (let t = 0; t < horizon; t++) {
      const choice: TurnChoice = cur.condition >= 60 ? [{ id }, { id }] : cur.condition >= 45 ? [{ id }, { id: 'rest' }] : [{ id: 'rest' }, { id: 'rest' }]
      const r = applyTurn(cur, choice, undefined, false)
      if (!r.ok) break
      cur = r.state
    }
    const v = value(cur)
    if (v > bestValue) {
      bestValue = v
      best = id
    }
  }
  return best
}

function casualChoice(s: GameState): TurnChoice {
  // 시즌 훈련 하나를 하고, 컨디션이 나쁘면 쉰다
  const rest: Slot = { id: 'rest' }
  const first: Slot = s.seasonTraining && checkSlot(s, { id: s.seasonTraining }) === null ? { id: s.seasonTraining } : rest
  const second: Slot = rest
  if (s.injuredMonths > 0 || s.condition < 45) return [rest, rest]
  if (s.condition < 65) return [first, rest]
  return [first, second]
}

function pickEventChoice(s: GameState, event: GameEvent, policy: BotPolicy, rng: Rng): number {
  const options = availableChoices(s, event)
  if (policy === 'casual') return options[0]
  if (policy === 'random') return options[Math.floor(rng() * options.length)]
  let best = options[0]
  let bestValue = -Infinity
  for (const i of options) {
    const v = choiceOutcomes(s, event, i).reduce((sum, o) => sum + o.chance * value(o.state), 0)
    if (v > bestValue) {
      bestValue = v
      best = i
    }
  }
  return best
}

/** 시험 준비: 숙련은 가장 효과가 큰 집중 준비, 단순은 컨디션 관리, 무작위는 돈이 되는 것 중 아무거나 */
function pickPrep(s: GameState, policy: BotPolicy, rng: Rng): string {
  if (policy === 'skilled') return 'focus'
  if (policy === 'casual') return 'rest'
  const options = PREP.filter((p) => !p.money || s.money + p.money >= 0)
  return options[Math.floor(rng() * options.length)].id
}

/** 한 판을 끝까지 자동으로 플레이한다. 같은 인자면 항상 같은 결과가 나온다. */
export function playCareer(genre: GenreId, mode: ModeId, seed: number, opts: BotOptions = { policy: 'skilled' }): GameState {
  const rng = createRng(seed)
  const botRng = createRng(mixSeed(seed, 0xb07))
  let s = createInitialState({ name: '봇', genre, mode, seed, gacha: rollGacha(rng, genre) })
  let turn = 0
  while (!s.finished) {
    if (!s.seasonTraining) s = chooseSeasonTraining(s, pickSeasonTraining(s, opts.policy, botRng))
    s = shop(s, opts.policy, botRng)
    const choice = opts.policy === 'skilled' ? skilledChoice(s, botRng) : opts.policy === 'random' ? randomChoice(s, botRng) : casualChoice(s)
    let r = applyTurn(s, choice)
    if (!r.ok) r = applyTurn(s, [{ id: 'rest' }, { id: 'rest' }])
    if (!r.ok) throw new Error(`${genre}/${mode}/${seed} turn ${turn}: ${r.error}`)
    s = r.state
    turn++

    const event = rollEvent(s, turnRng(s))
    if (event) s = applyEventChoice(s, event, pickEventChoice(s, event, opts.policy, botRng))
    s = rollMidSeasonOffer(s)
    if (s.pendingOffers) s = acceptOffer(s, opts.acceptTransfers ? 0 : null)
    opts.onTurn?.(s)

    if (r.seasonEnded) {
      if (upcomingTest(s)) s = choosePrep(s, pickPrep(s, opts.policy, botRng))
      s = settleSeason(s).state
      if (s.finished) break
      if (s.pendingOffers) {
        if (s.pendingOffers.kind === 'transfer') s = acceptOffer(s, opts.acceptTransfers ? 0 : null)
        else {
          const offers = s.pendingOffers.offers
          let pick = Math.floor(botRng() * offers.length)
          if (opts.policy !== 'random') {
            pick = 0
            offers.forEach((_, i) => {
              if (value(acceptOffer(s, i)) > value(acceptOffer(s, pick))) pick = i
            })
          }
          s = acceptOffer(s, pick)
        }
      }
      s = startNextSeason(s)
    }
  }
  return s
}
