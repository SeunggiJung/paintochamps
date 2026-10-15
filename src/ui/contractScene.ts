import type { GameState, Offer } from '../engine/state.ts'
import { offerTerms } from '../engine/teams.ts'
import { h } from './dom.ts'
import { perkLabel } from './offerView.ts'
import { teamHue, teamIconMarkup } from './teamIcon.ts'
import { openSheet } from './sheet.ts'

/** 도트 풍 계약 장면: 서명 → 팀 도장 → 악수. 클릭하면 연출을 건너뛴다. */
export function sceneSvg(teamId: string): string {
  const hue = teamHue(teamId)
  const team = `hsl(${hue} 65% 52%)`
  const teamDark = `hsl(${hue} 60% 36%)`
  const skin = '#f0c9a0'
  const skinShade = '#d9ab7c'
  return `
<svg class="contract-svg" viewBox="0 0 96 64" shape-rendering="crispEdges" role="img" aria-label="계약서에 서명하고 악수하는 장면">
  <rect width="96" height="64" fill="#1a2036"/>
  <rect y="0" width="96" height="3" fill="#232a47"/>
  <rect y="44" width="96" height="20" fill="#6b4a2f"/>
  <rect y="44" width="96" height="2" fill="#8a6440"/>
  <g class="c-paper">
    <rect x="27" y="9" width="42" height="37" fill="#c9c2a8"/>
    <rect x="26" y="8" width="42" height="37" fill="#f4f1e6"/>
    <rect x="31" y="13" width="26" height="2" fill="#9aa1bd"/>
    <rect x="31" y="18" width="32" height="2" fill="#c3c7d6"/>
    <rect x="31" y="22" width="30" height="2" fill="#c3c7d6"/>
    <rect x="31" y="26" width="32" height="2" fill="#c3c7d6"/>
    <rect x="31" y="38" width="20" height="1" fill="#6b7290"/>
    <path class="c-sign" d="M32 36 l2 -4 l2 5 l2 -6 l2 5 l3 -3 l2 2 l5 -2" fill="none" stroke="#1d3fa0" stroke-width="1.4" pathLength="100"/>
    <g class="c-pen"><rect x="30" y="26" width="2" height="9" fill="#e4572e"/><rect x="30" y="35" width="2" height="2" fill="#222"/></g>
    <g class="c-stamp">${teamIconMarkup(teamId, 1.6, 52, 26)}<rect x="51" y="25" width="14.8" height="14.8" fill="none" stroke="${team}" stroke-width="0.6"/></g>
  </g>
  <g class="c-clasp">
    <g class="c-arm-l"><rect x="4" y="30" width="28" height="12" fill="#4a7fd4"/><rect x="4" y="30" width="28" height="2" fill="#6a9ae6"/><rect x="32" y="31" width="10" height="9" fill="${skin}"/><rect x="32" y="38" width="10" height="2" fill="${skinShade}"/></g>
    <g class="c-arm-r"><rect x="64" y="30" width="28" height="12" fill="${team}"/><rect x="64" y="30" width="28" height="2" fill="${teamDark}"/><rect x="54" y="31" width="10" height="9" fill="${skin}"/><rect x="54" y="38" width="10" height="2" fill="${skinShade}"/></g>
    <g class="c-grip"><rect x="41" y="29" width="14" height="12" fill="${skin}"/>
    <rect x="41" y="29" width="14" height="2" fill="#fbe0bf"/>
    <rect x="43" y="33" width="2" height="5" fill="${skinShade}"/><rect x="47" y="33" width="2" height="5" fill="${skinShade}"/><rect x="51" y="33" width="2" height="5" fill="${skinShade}"/>
    <rect x="41" y="40" width="14" height="1" fill="${skinShade}"/></g>
  </g>
  <g class="c-spark" fill="#ffd34d"><rect x="46" y="20" width="2" height="6"/><rect x="44" y="22" width="6" height="2"/><rect x="30" y="24" width="1" height="3"/><rect x="29" y="25" width="3" height="1"/><rect x="66" y="22" width="1" height="3"/><rect x="65" y="23" width="3" height="1"/></g>
</svg>`
}

/** 입단·이적 계약 연출. 확인을 누르면 닫힌다. */
export async function showContract(state: GameState, offer: Offer, kind: 'join' | 'transfer'): Promise<void> {
  const terms = offerTerms(state, offer)
  await openSheet<void>((close) => {
    const root = h('div', { class: 'contract stack-tight' })
    root.innerHTML = sceneSvg(offer.team.id)
    const skip = () => root.classList.add('skip')
    root.addEventListener('click', skip)
    root.append(
      h(
        'div',
        { class: 'c-result' },
        h('p', { class: 'eyebrow' }, kind === 'transfer' ? '이적 계약 체결' : '입단 계약 체결'),
        h('h2', {}, `${offer.team.name}`),
        terms && h('p', { class: 'muted' }, `월급 ${terms.profile.salary}만 / 3개월 · ${perkLabel(offer)}`),
      ),
      h('button', { class: 'btn primary c-ok', onclick: () => close() }, '확인'),
    )
    return root
  }, { center: true })
}
