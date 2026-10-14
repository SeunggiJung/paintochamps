import { applyEventChoice, rollEvent, turnRng, type GameEvent } from '../engine/events.ts'
import { rollGacha } from '../engine/gacha.ts'
import { conditionCoef } from '../engine/growth.ts'
import { genrePower } from '../engine/power.ts'
import { createRng } from '../engine/rng.ts'
import { acceptOffer, settleSeason } from '../engine/season.ts'
import { createInitialState, type EquipmentId, type GameState, type ModeId } from '../engine/state.ts'
import { applyTurn, startNextSeason, type Slot, type TurnChoice } from '../engine/turn.ts'
import type { GenreId } from '../engine/types.ts'

/**
 * casual: 컨디션만 관리하며 훈련하는 단순한 플레이 (장비·이벤트 판단 없음)
 * skilled: 한 턴 앞을 보고 행동을 고르고, 장비를 사고, 이벤트 선택지를 비교하는 숙련 플레이
 */
export type BotPolicy = 'casual' | 'skilled'

export interface BotOptions {
  policy: BotPolicy
  /** 1부 이적 제안을 받아들일지 (히든 엔딩은 데뷔 팀에 남아야 한다) */
  acceptTransfers?: boolean
}

const ACTION_SLOTS: Slot[] = [
  { id: 'rank_practice' },
  { id: 'basics' },
  { id: 'video_review' },
  { id: 'team_scrim' },
  { id: 'rest' },
  { id: 'part_time' },
  { id: 'broadcast' },
]
const BUY_SLOTS: Slot[] = (['keyboard', 'mouse', 'monitor', 'pc'] as EquipmentId[]).map((item) => ({ id: 'buy_equipment', item }))

/** 숙련 봇이 상태를 얼마나 좋게 보는지: 실력치 + 컨디션(성장 효율) + 명성·돈 + 장비 */
function value(s: GameState): number {
  const levels = Object.values(s.equipment).reduce((a, b) => a + b, 0)
  const horizon = Math.max(0, 30 - s.age) / 14
  return genrePower(s.stats, s.genre) + 80 * conditionCoef(s.condition) + 0.2 * s.condition + 0.5 * s.fame + 0.15 * s.money + 8 * levels * horizon
}

function skilledChoice(s: GameState): TurnChoice {
  const slots = [...ACTION_SLOTS, ...BUY_SLOTS]
  let best: TurnChoice = [{ id: 'rest' }, { id: 'rest' }]
  let bestValue = -Infinity
  for (let i = 0; i < slots.length; i++) {
    for (let j = i; j < slots.length; j++) {
      const choice: TurnChoice = [slots[i], slots[j]]
      const r = applyTurn(s, choice)
      if (!r.ok) continue
      const v = value(r.state)
      if (v > bestValue) {
        bestValue = v
        best = choice
      }
    }
  }
  return best
}

function casualChoice(s: GameState, genre: GenreId, turn: number): TurnChoice {
  const train: Slot[] = genre === 'fps' || genre === 'fighting' ? [{ id: 'basics' }, { id: 'rank_practice' }] : [{ id: 'video_review' }, { id: 'rank_practice' }]
  const work: Slot = turn % 2 ? train[0] : s.team ? { id: 'team_scrim' } : train[1]
  if (s.injuredMonths > 0 || s.condition < 45) return [{ id: 'rest' }, { id: 'rest' }]
  if (s.condition < 65) return [work, { id: 'rest' }]
  return [work, train[(turn + 1) % 2]]
}

function pickEventChoice(s: GameState, event: GameEvent, policy: BotPolicy): number {
  if (policy === 'casual') return 0
  let best = 0
  let bestValue = -Infinity
  event.choices.forEach((_, i) => {
    const v = value(applyEventChoice(s, event, i))
    if (v > bestValue) {
      bestValue = v
      best = i
    }
  })
  return best
}

/** 한 판을 끝까지 자동으로 플레이한다. 같은 인자면 항상 같은 결과가 나온다. */
export function playCareer(genre: GenreId, mode: ModeId, seed: number, opts: BotOptions = { policy: 'skilled' }): GameState {
  const rng = createRng(seed)
  let s = createInitialState({ name: '봇', genre, mode, seed, gacha: rollGacha(rng, genre) })
  let turn = 0
  while (!s.finished) {
    const choice = opts.policy === 'skilled' ? skilledChoice(s) : casualChoice(s, genre, turn)
    let r = applyTurn(s, choice)
    if (!r.ok) r = applyTurn(s, [{ id: 'rest' }, { id: 'rest' }])
    if (!r.ok) throw new Error(`${genre}/${mode}/${seed} turn ${turn}: ${r.error}`)
    s = r.state
    turn++

    const event = rollEvent(s, turnRng(s))
    if (event) s = applyEventChoice(s, event, pickEventChoice(s, event, opts.policy))

    if (r.seasonEnded) {
      s = settleSeason(s).state
      if (s.finished) break
      if (s.pendingOffers) {
        if (s.pendingOffers.kind === 'transfer') s = acceptOffer(s, opts.acceptTransfers ? 0 : null)
        else {
          const offers = s.pendingOffers.offers
          let pick = 0
          offers.forEach((_, i) => {
            if (value(acceptOffer(s, i)) > value(acceptOffer(s, pick))) pick = i
          })
          s = acceptOffer(s, pick)
        }
      }
      s = startNextSeason(s)
    }
  }
  return s
}
