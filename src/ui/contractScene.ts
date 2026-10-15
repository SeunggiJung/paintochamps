import type { GameState, Offer } from '../engine/state.ts'
import { offerTerms } from '../engine/teams.ts'
import { h } from './dom.ts'
import { formatMoney } from './format.ts'
import { perkLabel } from './offerView.ts'
import { OUTLINE, placeSprite, shade } from './sprite.ts'
import { teamHue, teamIconMarkup } from './teamIcon.ts'
import { openSheet } from './sheet.ts'

/** hsl(0~359, %, %) → #rrggbb (스프라이트 셔츠 색은 16진수만 받는다) */
function hslHex(hue: number, sat: number, light: number): string {
  const s = sat / 100
  const l = light / 100
  const k = (n: number) => (n + hue / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`
}

/** 윤곽선이 있는 상자 */
function box(x: number, y: number, w: number, hh: number, c: string): string {
  return `<rect x="${x - 1}" y="${y - 1}" width="${w + 2}" height="${hh + 2}" fill="${OUTLINE}"/><rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${c}"/><rect x="${x}" y="${y}" width="${w}" height="1" fill="${shade(c, 1.28)}"/><rect x="${x}" y="${y + hh - 1}" width="${w}" height="1" fill="${shade(c, 0.78)}"/>`
}

/**
 * 도트 계약 장면(타이틀과 같은 스프라이트 스타일): 책상 양쪽에서 서명하고 팀 도장을 찍은 뒤,
 * 두 사람이 가운데로 다가와 악수한다. 클릭하면 연출을 건너뛴다.
 */
export function sceneSvg(teamId: string): string {
  const hue = teamHue(teamId)
  const teamColor = hslHex(hue, 65, 52)
  const skin = '#ffd9b3'
  return `
<svg class="contract-svg" viewBox="0 0 160 100" shape-rendering="crispEdges" role="img" aria-label="계약서에 서명하고 악수하는 장면">
  <rect width="160" height="100" fill="#cfe6ff"/><rect y="56" width="160" height="14" fill="#a9c9ee"/><rect y="56" width="160" height="2" fill="#d6e8ff"/>
  <rect y="70" width="160" height="30" fill="#c98f55"/><rect y="82" width="160" height="1" fill="#b27a45"/><rect y="92" width="160" height="1" fill="#b27a45"/>
  ${box(60, 8, 40, 34, teamColor)}${teamIconMarkup(teamId, 3, 68, 13)}
  ${box(146, 56, 9, 10, '#d9503a')}<rect x="148" y="48" width="5" height="8" fill="#58c05a"/><rect x="145" y="51" width="4" height="4" fill="#58c05a"/><rect x="152" y="50" width="4" height="4" fill="#58c05a"/>
  <g class="c-desk">
    ${box(46, 66, 68, 5, '#b9793c')}${box(50, 71, 5, 16, '#8a5a30')}${box(105, 71, 5, 16, '#8a5a30')}
    ${box(64, 61, 32, 5, '#ffffff')}
    <rect x="68" y="63" width="16" height="1" fill="#b5bcd3"/>
    <path class="c-sign" d="M68 65 l2 -3 l2 4 l2 -5 l2 4 l3 -2 l2 2 l5 -2" fill="none" stroke="#1d3fa0" stroke-width="1.2" pathLength="100"/>
    <g class="c-pen"><rect x="68" y="55" width="2" height="8" fill="#e4572e"/><rect x="68" y="63" width="2" height="2" fill="#222"/></g>
    <g class="c-stamp">${teamIconMarkup(teamId, 1.2, 84, 55)}<rect x="83" y="54" width="10.6" height="10.6" fill="none" stroke="${teamColor}" stroke-width="0.6"/></g>
  </g>
  <g class="c-char-l">${placeSprite({ shirt: '#3a86ff', headset: '#ff5a3c' }, 'stand', 58, 88, 44)}</g>
  <g class="c-char-r">${placeSprite({ shirt: teamColor, hair: '#2a2a2a' }, 'stand', 102, 88, 44)}</g>
  <g class="c-arms"><g class="c-hands">
    ${box(68, 68, 9, 5, '#3a86ff')}${box(85, 68, 9, 5, teamColor)}
    ${box(77, 68, 8, 5, skin)}
  </g></g>
  <g class="c-spark" fill="#ffd34d"><rect x="79" y="62" width="2" height="6"/><rect x="77" y="64" width="6" height="2"/><rect x="66" y="66" width="1" height="3"/><rect x="65" y="67" width="3" height="1"/><rect x="94" y="64" width="1" height="3"/><rect x="93" y="65" width="3" height="1"/></g>
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
        terms && h('p', { class: 'muted' }, `월급 ${formatMoney(terms.profile.salary)} / 3개월 · ${perkLabel(offer, state.stage)}`),
      ),
      h('button', { class: 'btn primary c-ok', onclick: () => close() }, '확인'),
    )
    return root
  }, { center: true })
}
