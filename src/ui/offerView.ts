import stageData from '../data/stages.json'
import { moneyScale } from '../engine/economy.ts'
import { leagueDef, OVERSEAS_RULES } from '../engine/leagues.ts'
import { leagueRankOf } from '../engine/leagueRank.ts'
import type { GameState, Offer, StageId } from '../engine/state.ts'
import { offerVerdict } from '../engine/guidance.ts'
import { confirmSheet } from './confirm.ts'
import { offerTerms, salaryOf, seasonResultsOf, type Strength } from '../engine/teams.ts'
import { marketContext, marketTrend } from '../engine/teamMarket.ts'
import { h } from './dom.ts'
import { marketText } from './marketLabel.ts'
import { formatMoney, formatMoneyDelta } from './format.ts'
import { teamIcon } from './teamIcon.ts'

const STRENGTH_LABEL: Record<Strength, string> = { strong: '강팀', average: '평범한 팀', weak: '약팀' }
const signed = (n: number) => (n > 0 ? `+${Math.round(n)}` : String(Math.round(n)))

/** 계약 혜택 문구 */
export function perkLabel(offer: Offer, stage: StageId): string {
  return offer.perk === 'salary' ? `계약금 ${formatMoney(stageData.offers.salaryMoney * moneyScale(stage))}` : '출전 기회 (명성 +8)'
}

/** 주의 판정의 이유 문장들 */
function cautionReasons(terms: NonNullable<ReturnType<typeof offerTerms>>): string[] {
  const v = offerVerdict(terms)
  const out: string[] = []
  if (v.salaryDrop > 0) out.push(`월급이 지금보다 ${formatMoney(v.salaryDrop)} 낮아요`)
  if (v.weak) out.push(`팀 전력이 낮아 대회 전력이 ${Math.abs(Math.round(v.boost))} 깎여요`)
  return out
}

/**
 * 손해가 분명한 제안(월급 하락·대회 전력 하락)을 고르기 전에 한 번 더 묻는다. 문제가 없으면 바로 true.
 * 입단·콜업 제안은 월급이 내려갈 일이 없고 선택지가 없어서 묻지 않는다.
 */
export async function confirmOffer(state: GameState, offer: Offer, stage: StageId = state.pendingOffers?.stage ?? state.stage): Promise<boolean> {
  const terms = offerTerms(state, offer, stage)
  if (!terms || !state.team) return true
  const reasons = cautionReasons(terms)
  if (reasons.length === 0) return true
  return confirmSheet({ title: `${offer.team.name}(으)로 옮길까요?`, message: `손해가 있는 이적이에요. ${reasons.join(', ')}.`, ok: '그래도 이적한다', cancel: '다시 생각한다' })
}

/** 제안 한 건을 결정에 필요한 정보와 함께 보여 주는 선택 버튼 */
export function offerButton(state: GameState, offer: Offer, onPick: () => void, stage: StageId = state.pendingOffers?.stage ?? state.stage, midSeason = false): HTMLElement {
  const terms = offerTerms(state, offer, stage)
  const lines: HTMLElement[] = []
  let verdictTag: HTMLElement | null = null
  if (terms) {
    const { profile, gap, salaryDelta, strength, boost, offerSalary } = terms
    const m = profile.market
    const gapText = Math.abs(gap) < 5 ? '내 실력과 비슷' : gap > 0 ? `내 실력보다 ${Math.round(gap)} 높음` : `내 실력보다 ${Math.round(-gap)} 낮음`
    // 시즌 중간 제안은 지난 시즌보다 이번 시즌에 이미 공개된 대회 성적이 판단에 더 쓸모 있다
    const results = midSeason ? seasonResultsOf(state, offer.team) : []
    const record = results.map((r) => `${r.event} ${r.rank}위${r.wins !== undefined ? `(${r.wins}승 ${r.losses}패${r.ongoing ? ', 진행 중' : ''})` : ''}`).join(' · ')
    const verdict = offerVerdict(terms)
    if (verdict.level !== 'neutral') {
      const reasons = verdict.level === 'caution' ? cautionReasons(terms) : [`대회 전력 ${signed(boost)}${terms.salaryDelta > 0 && state.team ? ', 월급도 올라요' : ''}`]
      verdictTag = h('span', { class: `tag ${verdict.level === 'caution' ? 'caution' : 'rec'}` }, verdict.level === 'caution' ? '주의' : '추천')
      lines.push(h('span', { class: `offer-line verdict ${verdict.level}` }, reasons.join(' · ')))
    }
    lines.push(
      h('span', { class: 'offer-line' }, `전력 ${Math.round(profile.power)} · ${STRENGTH_LABEL[strength]} (${gapText})`),
      midSeason
        ? h('span', { class: 'offer-line' }, record ? `이번 시즌 ${record}` : `이번 시즌 기록 없음 · 지난 시즌 ${profile.lastRank}위 / ${profile.leagueSize}팀`)
        : h('span', { class: 'offer-line' }, `지난 시즌 ${profile.lastRank}위 / ${profile.leagueSize}팀`),
      h(
        'span',
        { class: 'offer-line' },
        `월급 ${formatMoney(offerSalary)} / 3개월`,
        state.team ? h('em', { class: salaryDelta >= 0 ? 'up' : 'down' }, ` (지금보다 ${formatMoneyDelta(salaryDelta)})`) : null,
      ),
      h('span', { class: 'offer-line muted' }, marketText(m, marketTrend(offer.team, marketContext(state)))),
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
      lines.push(h('span', { class: 'offer-line muted' }, `적응 난이도 ${lg.adaptHard} (적응도 ${lg.adaptStart}에서 시작, 시즌마다 +${OVERSEAS_RULES.adaptGain}) · 이적 계약금 ${terms ? formatMoney(terms.offerSalary * OVERSEAS_RULES.signingBonusTurns) : '-'}`))
    }
  }
  return h('button', { class: 'choice offer', onclick: onPick }, teamIcon(offer.team.id, 44), h('span', { class: 'offer-body' }, h('span', { class: 'opt-title' }, offer.team.name, verdictTag), ...lines))
}
