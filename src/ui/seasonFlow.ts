import type { GameState } from '../engine/state.ts'

export type SettleTab = 'result' | 'growth' | 'money' | 'offers'

/**
 * 다음 시즌을 시작할 수 있는가. 받은 제안(입단·콜업·이적·해외·백지수표)이 남아 있으면 먼저 정해야 한다.
 * 이적·콜업·해외는 제안 카드의 거절 버튼으로 제안을 비울 수 있고, 입단 제안만 반드시 하나를 골라야 한다.
 */
export function canStartNextSeason(state: GameState): { ok: boolean; reason: string | null } {
  return state.pendingOffers ? { ok: false, reason: '제안을 골라 주세요' } : { ok: true, reason: null }
}

/** 탭에 빨간 점을 띄울 일이 남았는가 */
export function settleAlerts(state: GameState): { offers: boolean } {
  return { offers: !!state.pendingOffers }
}

/** 결산 화면 하단 큰 버튼의 문구 */
export function startLabel(state: GameState, season: number): string {
  if (state.finished) return '커리어 마무리'
  if (state.pendingOffers) return '제안을 골라 주세요'
  return `${season + 1}시즌 시작`
}
