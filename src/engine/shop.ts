import shop from '../data/shop.json'
import type { Perks } from './state.ts'

/** 업적 상점. 업적을 달성하면 토큰을 받고, 토큰으로 다음 판들에 쓰는 보너스를 산다. 판을 넘어 유지되는 기록(MetaSave)이 가진다. */
export interface ShopItem {
  id: string
  name: string
  kind: 'stock' | 'level'
  desc: string
  /** stock: 한 번에 가질 수 있는 최대 수 */
  max?: number
  /** stock: 한 장 가격 */
  cost?: number
  /** level: 단계별 가격 */
  costs?: number[]
}

export const SHOP_ITEMS = shop.items as ShopItem[]

/** 업적 하나로 받는 토큰: 처음 달성하면 많이, 다시 달성하면 조금 */
export function tokenReward(firstTime: boolean): number {
  return firstTime ? shop.tokens.first : shop.tokens.repeat
}

/** 지금 가진 개수(stock)나 단계(level) */
export type Inventory = Record<string, number>

/** 다음 한 개(한 단계)의 가격. 더 살 수 없으면 null */
export function nextCost(item: ShopItem, inv: Inventory): number | null {
  const owned = inv[item.id] ?? 0
  if (item.kind === 'stock') return owned < (item.max ?? 1) ? (item.cost ?? 0) : null
  return item.costs && owned < item.costs.length ? item.costs[owned] : null
}

export function canBuy(item: ShopItem, inv: Inventory, tokens: number): boolean {
  const cost = nextCost(item, inv)
  return cost !== null && tokens >= cost
}

/** 산 물건으로 새 판에 주는 영구 효과 */
export function perksOf(inv: Inventory): Perks & { fame?: number } {
  return {
    negotiation: (inv.negotiation ?? 0) * shop.perk.negotiationPerLevel,
    fame: (inv.fame_start ?? 0) * shop.perk.startFamePerLevel,
  }
}
