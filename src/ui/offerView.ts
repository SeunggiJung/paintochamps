import stageData from '../data/stages.json'
import { moneyScale } from '../engine/economy.ts'
import type { GameState, Offer, StageId } from '../engine/state.ts'
import { offerTerms, type Strength } from '../engine/teams.ts'
import { h } from './dom.ts'
import { formatMoney, formatMoneyDelta } from './format.ts'
import { teamIcon } from './teamIcon.ts'

const STRENGTH_LABEL: Record<Strength, string> = { strong: '강팀', average: '평범한 팀', weak: '약팀' }
const signed = (n: number) => (n > 0 ? `+${Math.round(n)}` : String(Math.round(n)))

/** 계약 혜택 문구 */
export function perkLabel(offer: Offer, stage: StageId): string {
  return offer.perk === 'salary' ? `계약금 ${formatMoney(stageData.offers.salaryMoney * moneyScale(stage))}` : '출전 기회 (명성 +8)'
}

/** 제안 한 건을 결정에 필요한 정보와 함께 보여 주는 선택 버튼 */
export function offerButton(state: GameState, offer: Offer, onPick: () => void, stage: StageId = state.pendingOffers?.stage ?? state.stage): HTMLElement {
  const terms = offerTerms(state, offer, stage)
  const lines: HTMLElement[] = []
  if (terms) {
    const { profile, gap, salaryDelta, strength, boost } = terms
    const gapText = Math.abs(gap) < 5 ? '내 실력과 비슷' : gap > 0 ? `내 실력보다 ${Math.round(gap)} 높음` : `내 실력보다 ${Math.round(-gap)} 낮음`
    lines.push(
      h('span', { class: 'offer-line' }, `전력 ${Math.round(profile.power)} · ${STRENGTH_LABEL[strength]} (${gapText})`),
      h('span', { class: 'offer-line' }, `지난 시즌 ${profile.lastRank}위 / ${profile.leagueSize}팀`),
      h(
        'span',
        { class: 'offer-line' },
        `월급 ${formatMoney(profile.salary)} / 3개월`,
        state.team ? h('em', { class: salaryDelta >= 0 ? 'up' : 'down' }, ` (지금보다 ${formatMoneyDelta(salaryDelta)})`) : null,
      ),
      h('span', { class: 'offer-line muted' }, `대회 전력 ${signed(boost)} · ${perkLabel(offer, stage)}`),
    )
  } else lines.push(h('span', { class: 'offer-line muted' }, perkLabel(offer, stage)))
  return h('button', { class: 'choice offer', onclick: onPick }, teamIcon(offer.team.id, 44), h('span', { class: 'offer-body' }, h('b', {}, offer.team.name), ...lines))
}
