import { applyEventChoice, availableChoices, choiceOutcomes, rollEvent, turnRng, type GameEvent } from '../engine/events.ts'
import { rollGacha } from '../engine/gacha.ts'
import { moneyScale } from '../engine/economy.ts'
import { conditionCoef } from '../engine/growth.ts'
import { autoTurn, PRESETS, setSeasonPlan, type SeasonPlan } from '../engine/plan.ts'
import { genrePower } from '../engine/power.ts'
import { createRng, mixSeed, type Rng } from '../engine/rng.ts'
import { choosePrep, PREP, upcomingTest } from '../engine/routes.ts'
import { acceptOffer, rollMidSeasonOffer, rollMidSeasonPromotion, settleSeason } from '../engine/season.ts'
import { createInitialState, type ActionId, type EquipmentId, type GameState, type ModeId } from '../engine/state.ts'
import { chooseSeasonTraining, trainingMenuOf } from '../engine/training.ts'
import { buyEquipment, startNextSeason, turnsPerSeason } from '../engine/turn.ts'
import type { GenreId } from '../engine/types.ts'

/**
 * 플레이어는 시즌 시작에 계획(방침·훈련·레슨·장비)만 세우고 시즌 중 행동은 자동으로 흘러간다.
 * casual: 앞의 훈련 후보와 균형 방침으로 하는 단순한 플레이 (장비·이벤트 판단 없음, 이벤트는 첫 선택지)
 * skilled: 시즌 전체를 미리 돌려 보고 가장 좋은 계획을 고르고, 장비를 사고, 이벤트 선택지도 비교하는 숙련 플레이
 * random: 훈련·방침·레슨·장비를 무작위로 정하는 플레이 (잘 모르고 눌러 보는 사람)
 */
export type BotPolicy = 'casual' | 'skilled' | 'random'

export interface BotOptions {
  policy: BotPolicy
  /** 1부 이적 제안을 받아들일지 (히든 엔딩은 데뷔 팀에 남아야 한다) */
  acceptTransfers?: boolean
  /** 해외 이적 제안을 받아들일지 (기본은 거절해서 국내 기준 난이도 측정을 지킨다) */
  acceptOverseas?: boolean
  /** 매 턴이 끝날 때마다 불린다 (성장 속도 같은 측정용) */
  onTurn?: (s: GameState) => void
}

const EQUIPMENT_IDS: EquipmentId[] = ['keyboard', 'mouse', 'monitor', 'pc']

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

/** 시즌 시작의 장비 구매: 숙련은 가치가 오르는 동안 계속, 무작위는 절반 확률로 아무거나(최대 두 번), 단순은 사지 않는다. */
function shop(s: GameState, policy: BotPolicy, rng: Rng): GameState {
  if (policy === 'casual') return s
  const options = (cur: GameState) => EQUIPMENT_IDS.map((item) => buyEquipment(cur, item)).flatMap((r) => (r.ok ? [r.state] : []))
  if (policy === 'random') {
    let cur = s
    for (let k = 0; k < 2; k++) {
      const opts = options(cur)
      if (opts.length > 0 && rng() < 0.5) cur = opts[Math.floor(rng() * opts.length)]
    }
    return cur
  }
  let cur = s
  for (;;) {
    const opts = options(cur)
    if (opts.length === 0) return cur
    const best = opts.reduce((a, b) => (value(b) > value(a) ? b : a))
    if (value(best) <= value(cur)) return cur
    cur = best
  }
}

/** 이 계획으로 이번 시즌을 끝까지 돌려 본 결과의 가치 (시험 진행이라 대회는 건너뛴다) */
function seasonValue(s: GameState, plan: SeasonPlan, training: ActionId): number {
  let cur = chooseSeasonTraining(setSeasonPlan(s, plan), training)
  for (let t = 0; t < turnsPerSeason(s.mode); t++) {
    const { result } = autoTurn(cur, undefined, false)
    if (!result.ok) break
    cur = result.state
  }
  // 계획의 목적은 성장이라, 돈·명성이 아니라 실력치와 컨디션으로 비교한다
  return genrePower(cur.stats, cur.genre) + 80 * conditionCoef(cur.condition) + 0.2 * cur.condition
}

/** 시즌 계획 세우기: 단순은 앞의 훈련+균형, 무작위는 전부 무작위, 숙련은 모든 조합을 시즌 단위로 돌려 보고 가장 좋은 것 */
function planSeason(s: GameState, policy: BotPolicy, rng: Rng): GameState {
  const menu = trainingMenuOf(s)
  if (policy === 'casual') return chooseSeasonTraining(setSeasonPlan(s, { preset: 'balanced', lesson: false }), menu[0])
  if (policy === 'random') {
    const preset = PRESETS[Math.floor(rng() * PRESETS.length)].id
    return chooseSeasonTraining(setSeasonPlan(s, { preset, lesson: rng() < 0.5 }), menu[Math.floor(rng() * menu.length)])
  }
  let best: { plan: SeasonPlan; training: ActionId } = { plan: { preset: 'balanced', lesson: false }, training: menu[0] }
  let bestValue = -Infinity
  for (const training of menu) {
    for (const p of PRESETS) {
      for (const lesson of [false, true]) {
        const plan: SeasonPlan = { preset: p.id, lesson }
        const v = seasonValue(s, plan, training)
        if (v > bestValue) {
          bestValue = v
          best = { plan, training }
        }
      }
    }
  }
  return chooseSeasonTraining(setSeasonPlan(s, best.plan), best.training)
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
  const options = PREP.filter((p) => !p.money || s.money + p.money * moneyScale(s.stage) >= 0)
  return options[Math.floor(rng() * options.length)].id
}

/** 한 판을 끝까지 자동으로 플레이한다. 같은 인자면 항상 같은 결과가 나온다. */
export function playCareer(genre: GenreId, mode: ModeId, seed: number, opts: BotOptions = { policy: 'skilled' }): GameState {
  const rng = createRng(seed)
  const botRng = createRng(mixSeed(seed, 0xb07))
  let s = createInitialState({ name: '봇', genre, mode, seed, gacha: rollGacha(rng, genre) })
  let turn = 0
  while (!s.finished) {
    // 시즌이 시작될 때 장비를 사고 계획을 세운다. 시즌 중에는 계획대로 자동으로 흘러간다.
    if (!s.seasonTraining) {
      s = shop(s, opts.policy, botRng)
      s = planSeason(s, opts.policy, botRng)
    }
    const { result: r } = autoTurn(s)
    if (!r.ok) throw new Error(`${genre}/${mode}/${seed} turn ${turn}: ${r.error}`)
    s = r.state
    turn++

    const event = rollEvent(s, turnRng(s))
    if (event) s = applyEventChoice(s, event, pickEventChoice(s, event, opts.policy, botRng))
    // 시즌 도중 승급 제안은 모두 받아들인다
    s = rollMidSeasonPromotion(s)
    if (s.pendingOffers) s = acceptOffer(s, 0)
    s = rollMidSeasonOffer(s)
    if (s.pendingOffers) s = acceptOffer(s, opts.acceptTransfers ? 0 : null)
    opts.onTurn?.(s)

    if (r.seasonEnded) {
      if (upcomingTest(s)) s = choosePrep(s, pickPrep(s, opts.policy, botRng))
      s = settleSeason(s).state
      if (s.finished) break
      if (s.pendingOffers) {
        if (s.pendingOffers.kind === 'transfer') s = acceptOffer(s, opts.acceptTransfers ? 0 : null)
        else if (s.pendingOffers.kind === 'overseas') s = acceptOffer(s, opts.acceptOverseas ? 0 : null)
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
