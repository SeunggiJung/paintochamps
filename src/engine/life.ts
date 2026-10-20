import lifeData from '../data/life.json'
import type { GameState } from './state.ts'

/**
 * 생활과 자산. 집을 3단계까지 마련하면 슬럼프가 짧아지고 가족 이벤트·엔딩 문구가 열린다(전력에는 직접 영향이 없다).
 * 순자산(돈 + 집 가치)은 등급으로 엔딩·결과 카드에 표시되고, 충분하면 30세 엔딩에서 구단을 인수해 '구단주' 엔딩을 볼 수 있다.
 */
export interface HomeDef {
  id: string
  name: string
  /** 만 원 (소속 단계 배율 없는 절대 금액) */
  price: number
  /** 이 단계까지 마련했을 때 슬럼프 기간이 줄어드는 비율 */
  slumpCut: number
  desc: string
  epilogue: string
}

export const HOMES = lifeData.homes as HomeDef[]
const ASSET_GRADES = lifeData.assetGrades
export const OWNER = lifeData.owner

/** 마련한 집 단계 (0~3, 옛 세이브에는 없어 0) */
export const homeLevel = (state: Pick<GameState, 'home'>): number => state.home ?? 0

/** 슬럼프 기간 배율 (1이면 평소, 3단계면 0.7) */
export function homeSlumpFactor(state: Pick<GameState, 'home'>): number {
  const level = homeLevel(state)
  return level > 0 ? 1 - HOMES[level - 1].slumpCut : 1
}

/** 다음 집을 살 수 없는 이유. 살 수 있으면 null. */
export function homeBlocker(state: GameState): string | null {
  if (state.finished) return '이미 끝난 커리어다'
  if (!(lifeData.homeFromStage as string[]).includes(state.stage)) return '프로 2부 이상이 되어야 집을 마련할 수 있다'
  const level = homeLevel(state)
  if (level >= HOMES.length) return '이미 내 집을 마련했다'
  if (state.money < HOMES[level].price) return '돈이 부족하다'
  return null
}

/** 다음 집을 산다 */
export function buyHome(state: GameState): { ok: true; state: GameState } | { ok: false; error: string } {
  const error = homeBlocker(state)
  if (error) return { ok: false, error }
  const level = homeLevel(state)
  return { ok: true, state: { ...state, money: state.money - HOMES[level].price, home: level + 1 } }
}

/** 순자산(만 원): 돈 + 마련한 집 가치(구매가의 homeValueRate) */
export function netWorth(state: GameState): number {
  const homes = HOMES.slice(0, homeLevel(state)).reduce((sum, h) => sum + h.price * lifeData.homeValueRate, 0)
  return state.money + homes
}

/** 순자산 등급 이름 */
export function assetGrade(state: GameState): string {
  const worth = netWorth(state)
  return [...ASSET_GRADES].reverse().find((g) => worth >= g.min)!.name
}

/** 엔딩 화면에 덧붙일 집 문구 (집이 없으면 null) */
export function homeEpilogue(state: GameState): string | null {
  const level = homeLevel(state)
  return level > 0 ? HOMES[level - 1].epilogue.replaceAll('{name}', state.name) : null
}

/** 구단을 인수할 수 없는 이유. 인수할 수 있으면 null (커리어가 끝났고 순자산·돈이 충분해야 한다). */
export function ownerBlocker(state: GameState): string | null {
  if (!state.finished) return '커리어가 끝난 뒤에만 구단을 인수할 수 있다'
  if (state.finished === 'owner') return '이미 구단주다'
  if (!state.everPro) return '프로 경험이 있어야 한다'
  if (netWorth(state) < OWNER.minWorth) return '순자산이 부족하다'
  if (state.money < OWNER.cost) return '인수 대금이 부족하다'
  return null
}

/** 구단을 인수하고 구단주 엔딩으로 끝낸다 */
export function acquireTeam(state: GameState): GameState {
  const error = ownerBlocker(state)
  if (error) throw new Error(error)
  return { ...state, money: state.money - OWNER.cost, owner: true, finished: 'owner' }
}
