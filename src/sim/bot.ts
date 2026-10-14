import { applyEventChoice, availableChoices, choiceOutcomes, rollEvent, turnRng, type GameEvent } from '../engine/events.ts'
import { rollGacha } from '../engine/gacha.ts'
import { conditionCoef } from '../engine/growth.ts'
import { genrePower } from '../engine/power.ts'
import { createRng, mixSeed, type Rng } from '../engine/rng.ts'
import { acceptOffer, settleSeason } from '../engine/season.ts'
import { createInitialState, type ActionId, type EquipmentId, type GameState, type ModeId } from '../engine/state.ts'
import { ACTIONS, applyTurn, startNextSeason, type Slot, type TurnChoice } from '../engine/turn.ts'
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
}

const ACTION_IDS = Object.keys(ACTIONS) as ActionId[]
const ACTION_SLOTS: Slot[] = ACTION_IDS.map((id) => ({ id }))
const BUY_SLOTS: Slot[] = (['keyboard', 'mouse', 'monitor', 'pc'] as EquipmentId[]).map((item) => ({ id: 'buy_equipment', item }))
const ALL_SLOTS: Slot[] = [...ACTION_SLOTS, ...BUY_SLOTS]

const isRisky = (slot: Slot) => slot.id !== 'buy_equipment' && !!ACTIONS[slot.id].outcomes

/** 숙련 봇이 상태를 얼마나 좋게 보는지: 실력치 + 컨디션(성장 효율) + 명성·돈 + 장비 − 방탕·부상·슬럼프 */
function value(s: GameState): number {
  const levels = Object.values(s.equipment).reduce((a, b) => a + b, 0)
  const horizon = Math.max(0, 30 - s.age) / 14
  return (
    genrePower(s.stats, s.genre) +
    80 * conditionCoef(s.condition) +
    0.2 * s.condition +
    0.5 * s.fame +
    0.15 * s.money +
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
    const r = applyTurn(s, choice, risky ? rng : undefined)
    if (!r.ok) return null
    total += value(r.state)
  }
  return total / n
}

function skilledChoice(s: GameState, rng: Rng): TurnChoice {
  let best: TurnChoice = [{ id: 'rest' }, { id: 'rest' }]
  let bestValue = -Infinity
  for (let i = 0; i < ALL_SLOTS.length; i++) {
    for (let j = i; j < ALL_SLOTS.length; j++) {
      const choice: TurnChoice = [ALL_SLOTS[i], ALL_SLOTS[j]]
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
  for (let i = 0; i < ALL_SLOTS.length; i++) {
    for (let j = i; j < ALL_SLOTS.length; j++) {
      const choice: TurnChoice = [ALL_SLOTS[i], ALL_SLOTS[j]]
      if (applyTurn(s, choice, rng).ok) valid.push(choice)
    }
  }
  return valid.length ? valid[Math.floor(rng() * valid.length)] : [{ id: 'rest' }, { id: 'rest' }]
}

function casualChoice(s: GameState, genre: GenreId, turn: number): TurnChoice {
  const train: Slot[] = genre === 'fps' || genre === 'fighting' ? [{ id: 'basics' }, { id: 'rank_practice' }] : [{ id: 'video_review' }, { id: 'rank_practice' }]
  const work: Slot = turn % 2 ? train[0] : s.team ? { id: 'team_scrim' } : train[1]
  if (s.injuredMonths > 0 || s.condition < 45) return [{ id: 'rest' }, { id: 'rest' }]
  if (s.condition < 65) return [work, { id: 'rest' }]
  return [work, train[(turn + 1) % 2]]
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

/** 한 판을 끝까지 자동으로 플레이한다. 같은 인자면 항상 같은 결과가 나온다. */
export function playCareer(genre: GenreId, mode: ModeId, seed: number, opts: BotOptions = { policy: 'skilled' }): GameState {
  const rng = createRng(seed)
  const botRng = createRng(mixSeed(seed, 0xb07))
  let s = createInitialState({ name: '봇', genre, mode, seed, gacha: rollGacha(rng, genre) })
  let turn = 0
  while (!s.finished) {
    const choice = opts.policy === 'skilled' ? skilledChoice(s, botRng) : opts.policy === 'random' ? randomChoice(s, botRng) : casualChoice(s, genre, turn)
    let r = applyTurn(s, choice)
    if (!r.ok) r = applyTurn(s, [{ id: 'rest' }, { id: 'rest' }])
    if (!r.ok) throw new Error(`${genre}/${mode}/${seed} turn ${turn}: ${r.error}`)
    s = r.state
    turn++

    const event = rollEvent(s, turnRng(s))
    if (event) s = applyEventChoice(s, event, pickEventChoice(s, event, opts.policy, botRng))

    if (r.seasonEnded) {
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
