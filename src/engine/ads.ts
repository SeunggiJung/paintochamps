import adData from '../data/ads.json'
import { studioFameCut } from './facilities.ts'
import { isWorldEvent } from './competitions.ts'
import { leagueDef, leagueIdOf } from './leagues.ts'
import { createRng, mixSeed } from './rng.ts'
import type { GameState } from './state.ts'
import { turnsPerSeason } from './turn.ts'

/**
 * 광고. 프로 1부 선수가 명성 unlockFame(스튜디오가 있으면 낮아짐) 이상이면 시즌 시작 계획 때 광고 제안이 오고,
 * 계약하면 시즌 중 촬영 일정을 치르며 돈을 번다. 브랜드는 가상이다.
 * 광고 가치 = min(상한, (명성 / 해금 명성)^지수) × (기본 + 폭 × 직전 성적) × 리그 명성 배율.
 */
export type AdType = 'single' | 'season' | 'world'
export type AdPerf = keyof typeof adData.perf

interface AdTypeDef {
  name: string
  desc: string
  base: number
  bonus?: number
  bonusTop?: number
  shoots: number
  /** 촬영이 있는 시점 (시즌의 몇 %가 지났을 때) */
  shootAt: number[]
  /** 촬영마다 받는 비율 */
  payRatio: number[]
  /** 시즌 결산 때 받는 잔금 비율과, 이 비율 이내의 리그 순위여야 받는다 */
  settleRatio?: number
  settleMaxPlace?: number
}

const TYPES = adData.types as Record<AdType, AdTypeDef>
const ORDER = adData.order as AdType[]

export const AD_TYPES = TYPES
export const adTypeName = (type: AdType): string => TYPES[type].name

/** 광고 계약 하나 (시즌이 끝나면 정산되어 사라진다) */
export interface AdContract {
  id: string
  type: AdType
  brand: string
  category: string
  /** 계약 때 정해진 기본 금액(만 원)과 월드 특약의 성과 보너스 */
  base: number
  bonus: number
  /** 지금까지 치른 촬영 횟수 */
  done: number
}

/** 시즌 시작 때 받는 광고 제안 */
export type AdOffer = Omit<AdContract, 'id' | 'done'>

/** 해금 명성 */
export const adUnlockFame = (state: GameState): number => Math.max(10, adData.unlockFame - studioFameCut(state))

/** 광고 슬롯 수: 해금 명성 구간마다 1개씩 (최대 3) */
export function adSlots(fame: number, fameCut = 0): number {
  return adData.slotFame.filter((min) => fame >= Math.max(10, min - fameCut)).length
}

/** 직전 성적 등급 */
export function adPerf(result: { worldPlace: number | null; playoffs: boolean }): AdPerf {
  if (result.worldPlace === 1) return 'title'
  if (result.worldPlace === 2) return 'finalist'
  if (result.worldPlace !== null) return 'world'
  return result.playoffs ? 'playoffs' : 'other'
}

/** 지난 시즌 기록으로 본 직전 성적 */
export function prevPerf(state: GameState): AdPerf {
  const last = state.history[state.history.length - 1]
  if (!last) return 'other'
  const world = last.events.find((e) => isWorldEvent(e.id))
  const playoffs = last.events.some((e) => (e.id === 'playoffs' || e.id.endsWith('_playoffs')) && e.placement <= 4)
  return adPerf({ worldPlace: world?.placement ?? null, playoffs })
}

/** 광고 가치 지수 (해금 명성에서 직전 성적 보통이면 1 안팎) */
export function adValue(fame: number, perf: AdPerf, prestige = 1, unlockFame = adData.unlockFame): number {
  const level = Math.min(adData.valueCap, (Math.max(fame, 1) / unlockFame) ** adData.valueExponent)
  return level * (adData.perfBase + adData.perfSpan * adData.perf[perf]) * prestige
}

export interface AdIncome {
  slots: number
  deals: { type: AdType; income: number; shoots: number }[]
  total: number
}

/** 한 시즌의 광고 수입 모델 (시뮬레이션용). worldPlace는 이번 시즌 월드 순위(없으면 null) */
export function adIncome(input: { fame: number; perf: AdPerf; prestige?: number; worldPlace: number | null }): AdIncome {
  const slots = adSlots(input.fame)
  const value = adValue(input.fame, input.perf, input.prestige ?? 1)
  const deals = ORDER.slice(0, slots).map((type) => {
    const def = TYPES[type]
    const bonus = def.bonus && input.worldPlace !== null && input.worldPlace <= (def.bonusTop ?? 0) ? def.bonus : 0
    return { type, income: Math.round((def.base + bonus) * value), shoots: def.shoots }
  })
  return { slots, deals, total: deals.reduce((sum, d) => sum + d.income, 0) }
}

/** 광고 계약 목록 (옛 세이브에는 없다) */
export const adsOf = (state: Pick<GameState, 'ads'>): AdContract[] => state.ads ?? []

/**
 * 이번 시즌 광고 제안. 프로 1부 소속·명성 해금·이번 시즌 아직 정하지 않았을 때만 있고, 슬롯 수만큼(시즌 모델 → 단발 → 월드 특약) 나온다.
 * 같은 판·같은 시즌이면 같은 제안이다.
 */
export function adOffersFor(state: GameState): AdOffer[] {
  if (state.finished || state.stage !== 'pro1' || !state.team) return []
  if ((state.adOfferSeason ?? 0) === state.season) return []
  const slots = adSlots(state.fame, studioFameCut(state))
  if (slots === 0) return []
  const rng = createRng(mixSeed(state.seed, state.season, 0xad5))
  const value = adValue(state.fame, prevPerf(state), leagueDef(leagueIdOf(state)).prestige, adUnlockFame(state))
  const signed = new Set(adsOf(state).map((c) => c.type))
  return ORDER.slice(0, slots)
    .map((type) => {
      const brand = adData.brands[Math.floor(rng() * adData.brands.length)]
      const def = TYPES[type]
      return { type, brand: brand.name, category: brand.category, base: Math.round(def.base * value), bonus: Math.round((def.bonus ?? 0) * value) }
    })
    .filter((offer) => !signed.has(offer.type))
}

/** 제안을 계약한다 */
export function signAd(state: GameState, offer: AdOffer): GameState {
  const contract: AdContract = { ...offer, id: `${state.season}-${offer.type}`, done: 0 }
  return { ...state, ads: [...adsOf(state).filter((c) => c.id !== contract.id), contract] }
}

/** 이번 시즌 광고 제안을 정했다고 기록한다 (남은 제안은 거절한 것) */
export function finishAdOffers(state: GameState): GameState {
  return { ...state, adOfferSeason: state.season }
}

/** 촬영이 있는 턴 번호 (그 턴을 마치고 난 뒤) */
export function shootTurn(type: AdType, index: number, mode: GameState['mode']): number {
  return Math.max(1, Math.ceil(TYPES[type].shootAt[index] * turnsPerSeason(mode)))
}

/** 지금 치러야 하는 촬영 (일정이 된 계약의 다음 촬영) */
export function dueShoots(state: GameState): { contract: AdContract; index: number }[] {
  return adsOf(state)
    .filter((c) => c.done < TYPES[c.type].shoots && state.turnInSeason >= shootTurn(c.type, c.done, state.mode))
    .map((contract) => ({ contract, index: contract.done }))
}

/** 촬영 한 번에 받는 돈(만 원) */
export function shootPay(contract: AdContract, index: number): number {
  return Math.round(contract.base * TYPES[contract.type].payRatio[index])
}

/** 촬영을 치른다: 돈을 받고 컨디션이 줄고 명성이 조금 오른다 */
export function performShoot(state: GameState, id: string): { state: GameState; paid: number } {
  const contract = adsOf(state).find((c) => c.id === id)
  if (!contract || contract.done >= TYPES[contract.type].shoots) return { state, paid: 0 }
  const paid = shootPay(contract, contract.done)
  return {
    paid,
    state: {
      ...state,
      money: state.money + paid,
      fame: state.fame + adData.shoot.fame,
      condition: Math.max(0, state.condition + adData.shoot.condition),
      adEarned: (state.adEarned ?? 0) + paid,
      ads: adsOf(state).map((c) => (c.id === id ? { ...c, done: c.done + 1 } : c)),
    },
  }
}

export interface AdSettlement {
  state: GameState
  /** 결산 때 받은 돈(만 원) */
  paid: number
  notes: string[]
}

/**
 * 시즌 결산 때 계약을 정산한다. 시즌 모델은 촬영을 모두 마쳤고 리그 순위가 상위 settleMaxPlace 이내면 잔금을 받고,
 * 월드 특약은 월드 순위가 bonusTop 이내면 성과 보너스를 받는다. 정산한 계약은 사라진다.
 * placeRatio는 이번 시즌 마지막 리그의 (순위 / 팀 수), 리그가 없으면 null.
 */
export function settleAds(state: GameState, ctx: { worldPlace: number | null; placeRatio: number | null }): AdSettlement {
  const notes: string[] = []
  let paid = 0
  for (const c of adsOf(state)) {
    const def = TYPES[c.type]
    const finished = c.done >= def.shoots
    if (def.settleRatio) {
      if (finished && (ctx.placeRatio === null || ctx.placeRatio <= (def.settleMaxPlace ?? 1))) {
        paid += Math.round(c.base * def.settleRatio)
        notes.push(`${c.brand} 시즌 모델 잔금을 받았다`)
      } else notes.push(`${c.brand} 시즌 모델 잔금 없음 (${finished ? '시즌 성적이 계약 조건에 못 미쳤다' : '촬영을 다 마치지 못했다'})`)
    }
    if (def.bonus && finished && ctx.worldPlace !== null && ctx.worldPlace <= (def.bonusTop ?? 0)) {
      paid += c.bonus
      notes.push(`${c.brand} 월드 특약 성과 보너스를 받았다`)
    }
  }
  return { paid, notes, state: { ...state, money: state.money + paid, adEarned: (state.adEarned ?? 0) + paid, ads: [] } }
}
