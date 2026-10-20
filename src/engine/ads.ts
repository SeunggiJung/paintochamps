import adData from '../data/ads.json'

/**
 * 광고 수입 모델 (초안, 아직 게임 흐름에는 연결하지 않았다 — 시뮬레이션으로 수치부터 본다).
 * 프로 1부 선수가 명성 unlockFame 이상이면 광고 슬롯이 생기고(명성 구간마다 1~3개), 슬롯마다 계약 유형이 정해져 수입이 나온다.
 * 광고 가치 = (명성 / unlockFame)^지수 × (기본 + 폭 × 최근 성적) × 리그 명성 배율. 브랜드는 가상이다.
 */
export type AdType = 'single' | 'season' | 'world'
export type AdPerf = keyof typeof adData.perf

interface AdTypeDef {
  name: string
  base: number
  /** 월드 특약: 월드 순위가 bonusTop 이내면 더해지는 금액 */
  bonus?: number
  bonusTop?: number
  /** 이 계약에서 치르는 촬영 횟수 */
  shoots: number
}

const TYPES = adData.types as Record<AdType, AdTypeDef>
const ORDER = adData.order as AdType[]

export const AD_UNLOCK_FAME = adData.unlockFame

/** 광고 슬롯 수: 명성이 unlockFame 미만이면 0, 이후 구간마다 1개씩 (최대 3) */
export function adSlots(fame: number): number {
  return adData.slotFame.filter((min) => fame >= min).length
}

/** 이번 시즌 계약에 쓰는 직전 성적 등급 */
export function adPerf(result: { worldPlace: number | null; playoffs: boolean }): AdPerf {
  if (result.worldPlace === 1) return 'title'
  if (result.worldPlace === 2) return 'finalist'
  if (result.worldPlace !== null) return 'world'
  return result.playoffs ? 'playoffs' : 'other'
}

/** 광고 가치 지수 (명성 60, 직전 성적 보통이면 1 안팎) */
export function adValue(fame: number, perf: AdPerf, prestige = 1): number {
  const level = Math.min(adData.valueCap, (Math.max(fame, 1) / adData.unlockFame) ** adData.valueExponent)
  return level * (adData.perfBase + adData.perfSpan * adData.perf[perf]) * prestige
}

export interface AdIncome {
  slots: number
  /** 슬롯마다 [유형, 수입(만 원), 촬영 횟수] */
  deals: { type: AdType; income: number; shoots: number }[]
  total: number
}

/**
 * 한 시즌의 광고 수입. 슬롯은 order 순서(시즌 모델 → 단발 → 월드 특약)대로 채운다.
 * worldPlace는 이번 시즌 월드 순위(나가지 못했으면 null)로, 월드 특약의 성과 보너스에만 쓴다.
 */
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
