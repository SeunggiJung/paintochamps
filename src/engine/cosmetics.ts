import data from '../data/cosmetics.json'
import { createRng, mixSeed, shuffled } from './rng.ts'
import type { GameState } from './state.ts'

/**
 * 꾸미기와 상점. 방 배경·책상 소품·의상·명찰 네 칸을 외형만 바꾸고(전력 효과 없음), 모으면 업적이 열린다.
 * 상시 판매 상품과, 시즌마다 몇 개씩만 입고되는 한정 상품, 콜라보 이벤트로만 받는 상품이 있다.
 */
export type CosmeticSlot = 'room' | 'desk' | 'outfit' | 'badge'

export interface CosmeticDef {
  id: string
  slot: CosmeticSlot
  name: string
  /** 만 원 (소속 단계 배율 없는 절대 금액) */
  price: number
  desc: string
  limited?: boolean
  collab?: boolean
  art: Record<string, string>
}

export const SLOTS = data.slots as { id: CosmeticSlot; name: string }[]
export const CATALOG = data.items as unknown as CosmeticDef[]
const DEFAULTS = data.defaults as Record<CosmeticSlot, string>

export const cosmeticDef = (id: string): CosmeticDef | undefined => CATALOG.find((c) => c.id === id)
const isDefault = (id: string) => Object.values(DEFAULTS).includes(id)

/** 가지고 있는 꾸미기 (기본 상품은 늘 가지고 있다. 옛 세이브에는 owned가 없다) */
export function ownedIds(state: Pick<GameState, 'owned'>): string[] {
  return [...new Set([...Object.values(DEFAULTS), ...(state.owned ?? [])])]
}

/** 상점에서 산 것·받은 것의 수 (기본 상품 제외) */
export const ownedCount = (state: Pick<GameState, 'owned'>): number => ownedIds(state).filter((id) => !isDefault(id)).length

/** 칸마다 지금 장착한 것 (장착하지 않은 칸은 기본 상품) */
export function equippedOf(state: Pick<GameState, 'equipped'>): Record<CosmeticSlot, string> {
  return { ...DEFAULTS, ...(state.equipped ?? {}) }
}

/** 이번 시즌 상점에 입고된 한정 상품 (시즌마다 시드로 정해진다. 이미 산 것도 목록에는 남는다) */
export function limitedStock(state: Pick<GameState, 'seed' | 'season'>): CosmeticDef[] {
  const pool = CATALOG.filter((c) => c.limited)
  return shuffled(createRng(mixSeed(state.seed, state.season, 0x5707)), pool).slice(0, data.limitedPerSeason)
}

/** 상품을 살 수 없는 이유. 살 수 있으면 null. */
export function shopBlocker(state: GameState, id: string): string | null {
  const def = cosmeticDef(id)
  if (!def) return '없는 상품이다'
  if (state.finished) return '이미 끝난 커리어다'
  if (ownedIds(state).includes(id)) return '이미 가지고 있다'
  if (def.collab) return '콜라보 이벤트로만 받을 수 있다'
  if (def.limited && !limitedStock(state).some((c) => c.id === id)) return '이번 시즌 입고 목록에 없다'
  if (state.money < def.price) return '돈이 부족하다'
  return null
}

/** 상품을 산다 (산 뒤 바로 장착하지는 않는다) */
export function buyCosmetic(state: GameState, id: string): { ok: true; state: GameState } | { ok: false; error: string } {
  const error = shopBlocker(state, id)
  if (error) return { ok: false, error }
  return { ok: true, state: { ...state, money: state.money - cosmeticDef(id)!.price, owned: [...ownedIds(state), id] } }
}

/** 가진 상품을 장착한다 (같은 칸의 기존 장착은 해제된다) */
export function equipCosmetic(state: GameState, id: string): GameState {
  const def = cosmeticDef(id)
  if (!def || !ownedIds(state).includes(id)) return state
  return { ...state, equipped: { ...equippedOf(state), [def.slot]: id } }
}

/** 이벤트·콜라보로 상품을 받는다 (이미 있으면 그대로) */
export function grantCosmetic(state: GameState, id: string): GameState {
  return cosmeticDef(id) && !ownedIds(state).includes(id) ? { ...state, owned: [...ownedIds(state), id] } : state
}

/** 가진 한정 상품 수 (업적용) */
export const limitedOwned = (state: Pick<GameState, 'owned'>): number => ownedIds(state).filter((id) => cosmeticDef(id)?.limited).length

export const COLLECTOR_COUNT = data.collectorCount as number
export const LIMITED_HUNTER_COUNT = data.limitedHunterCount as number
