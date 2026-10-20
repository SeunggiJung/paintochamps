import stageData from '../data/stages.json'
import { moneyScale } from '../engine/economy.ts'
import { leagueDef, OVERSEAS_RULES } from '../engine/leagues.ts'
import { leagueRankOf } from '../engine/leagueRank.ts'
import type { GameState, Offer, StageId } from '../engine/state.ts'
import { offerTerms, salaryOf, seasonResultsOf, type Strength } from '../engine/teams.ts'
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
export function offerButton(state: GameState, offer: Offer, onPick: () => void, stage: StageId = state.pendingOffers?.stage ?? state.stage, midSeason = false): HTMLElement {
  const terms = offerTerms(state, offer, stage)
  const lines: HTMLElement[] = []
  if (terms) {
    const { profile, gap, salaryDelta, strength, boost } = terms
    const gapText = Math.abs(gap) < 5 ? '내 실력과 비슷' : gap > 0 ? `내 실력보다 ${Math.round(gap)} 높음` : `내 실력보다 ${Math.round(-gap)} 낮음`
    // 시즌 중간 제안은 지난 시즌보다 이번 시즌에 이미 공개된 대회 성적이 판단에 더 쓸모 있다
    const results = midSeason ? seasonResultsOf(state, offer.team) : []
    const record = results.map((r) => `${r.event} ${r.rank}위${r.wins !== undefined ? `(${r.wins}승 ${r.losses}패${r.ongoing ? ', 진행 중' : ''})` : ''}`).join(' · ')
    lines.push(
      h('span', { class: 'offer-line' }, `전력 ${Math.round(profile.power)} · ${STRENGTH_LABEL[strength]} (${gapText})`),
      midSeason
        ? h('span', { class: 'offer-line' }, record ? `이번 시즌 ${record}` : `이번 시즌 기록 없음 · 지난 시즌 ${profile.lastRank}위 / ${profile.leagueSize}팀`)
        : h('span', { class: 'offer-line' }, `지난 시즌 ${profile.lastRank}위 / ${profile.leagueSize}팀`),
      h(
        'span',
        { class: 'offer-line' },
        `월급 ${formatMoney(profile.salary)} / 3개월`,
        state.team ? h('em', { class: salaryDelta >= 0 ? 'up' : 'down' }, ` (지금보다 ${formatMoneyDelta(salaryDelta)})`) : null,
      ),
      h('span', { class: 'offer-line muted' }, `대회 전력 ${signed(boost)} · ${perkLabel(offer, stage)}`),
    )
  } else lines.push(h('span', { class: 'offer-line muted' }, perkLabel(offer, stage)))
  // 백지수표: 지금 월급의 몇 배인지 앞세워 보여 준다
  if (offer.checkMult !== undefined) {
    lines.unshift(h('span', { class: 'offer-line' }, h('b', {}, `백지수표 · 지금 월급의 ${offer.checkMult}배 (${formatMoney(salaryOf(state) * offer.checkMult)} / 3개월)`)))
  }
  // 다른 리그의 제안이면 리그 정보(지역·리그 순위·적응 난이도·계약금)를 앞세워 보여 준다
  if (offer.league) {
    const lg = leagueDef(offer.league)
    const rank = leagueRankOf(state, lg.id)
    lines.unshift(h('span', { class: 'offer-line' }, `${lg.name} · ${lg.region} · ${rank ? `리그 순위 ${rank.rank}위 / ${rank.size}개 리그` : '리그 순위 집계 전'}`))
    if (!lg.domestic) {
      lines.push(h('span', { class: 'offer-line muted' }, `적응 난이도 ${lg.adaptHard} (적응도 ${lg.adaptStart}에서 시작, 시즌마다 +${OVERSEAS_RULES.adaptGain}) · 이적 계약금 ${terms ? formatMoney(terms.profile.salary * OVERSEAS_RULES.signingBonusTurns) : '-'}`))
    }
  }
  return h('button', { class: 'choice offer', onclick: onPick }, teamIcon(offer.team.id, 44), h('span', { class: 'offer-body' }, h('b', {}, offer.team.name), ...lines))
}
