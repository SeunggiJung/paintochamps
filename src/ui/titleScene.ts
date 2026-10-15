import { h } from './dom.ts'
import { OUTLINE, placeSprite, shade } from './sprite.ts'

/**
 * 타이틀 화면 중앙의 도트 애니메이션 (메이플스토리풍): 방구석 게임 → 대회 출전 → 훈련 → 우승이 16초 주기로 이어진다.
 * 밝고 알록달록한 배경, 진한 갈색 윤곽선이 있는 소품, 큰 머리의 캐릭터로 게임이 어떤 이야기인지 한눈에 보여 준다.
 * 모두 SVG 도트(crispEdges)와 CSS 애니메이션이라 에셋 파일이 없다.
 */

const W = 160
const H = 100

/** 윤곽선 + 윗면 하이라이트 + 아랫면 그림자가 있는 상자 (소품의 기본 단위) */
function box(x: number, y: number, w: number, hh: number, c: string, cls = ''): string {
  return (
    `<rect x="${x - 1}" y="${y - 1}" width="${w + 2}" height="${hh + 2}" fill="${OUTLINE}"/>` +
    `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${hh}" fill="${c}"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${shade(c, 1.28)}"/>` +
    `<rect x="${x}" y="${y + hh - 1}" width="${w}" height="1" fill="${shade(c, 0.78)}"/>`
  )
}

/** 사람(스프라이트): 발끝이 footY에 닿고 키는 44 */
function person(x: number, footY: number, shirt: string, pose: 'stand' | 'cheer' = 'stand', cls = '', hair = '#7a4426', headset = ''): string {
  return placeSprite({ shirt, hair, headset }, pose, x, footY, 44, cls)
}

function monitor(x: number, y: number, w: number, hh: number, extra = ''): string {
  return (
    box(x, y, w, hh, '#3a4268') +
    `<rect class="screen" x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${hh - 6}" fill="#5fd1ff"/>` +
    extra +
    box(x + w / 2 - 4, y + hh, 8, 3, '#2b3250')
  )
}

function sceneHome(): string {
  const stripes = Array.from({ length: 10 }, (_, i) => `<rect x="${i * 16}" y="0" width="8" height="52" fill="#f1d49c" opacity="0.55"/>`).join('')
  const planks = Array.from({ length: 12 }, (_, i) => `<rect x="${(i * 29) % 160}" y="${70 + (i % 3) * 9}" width="1" height="9" fill="#b27a45"/>`).join('')
  return `<g class="scene s1">
  <rect width="${W}" height="${H}" fill="#f8e3b8"/>${stripes}
  <rect y="52" width="${W}" height="14" fill="#e2b27a"/><rect y="52" width="${W}" height="2" fill="#f7d9a8"/>
  <rect y="66" width="${W}" height="34" fill="#c98f55"/><rect y="78" width="${W}" height="1" fill="#b27a45"/><rect y="87" width="${W}" height="1" fill="#b27a45"/>${planks}
  ${box(104, 10, 42, 32, '#8fd6ff')}
  <rect x="124" y="10" width="2" height="32" fill="${OUTLINE}"/><rect x="104" y="25" width="42" height="2" fill="${OUTLINE}"/>
  <rect class="sun" x="109" y="14" width="8" height="8" fill="#ffe27a"/>
  <g class="cloud"><rect x="128" y="16" width="10" height="4" fill="#fff"/><rect x="131" y="13" width="6" height="4" fill="#fff"/></g>
  ${box(22, 14, 22, 28, '#ff8fb3')}
  <rect x="29" y="22" width="8" height="8" fill="#fff3a0"/><rect x="31" y="19" width="4" height="14" fill="#fff3a0"/><rect x="27" y="25" width="12" height="2" fill="#fff3a0"/>
  ${box(4, 62, 46, 14, '#9b6a3c')}${box(8, 56, 38, 10, '#4f8dff')}${box(8, 52, 14, 6, '#ffffff')}
  <rect x="26" y="58" width="16" height="2" fill="#8fb8ff"/>
  ${box(60, 44, 18, 28, '#e0503c')}
  ${person(70, 78, '#3a86ff', 'stand', 'bob', '#7a4426', '#ff5a3c')}
  ${box(56, 66, 90, 5, '#b9793c')}${box(60, 71, 5, 20, '#8a5a30')}${box(137, 71, 5, 20, '#8a5a30')}
  ${monitor(96, 42, 40, 24, '<rect class="blk1" x="102" y="52" width="6" height="6" fill="#ffd34d"/><rect class="blk2" x="118" y="48" width="6" height="6" fill="#ff6b7a"/><rect class="beam" x="100" y="46" width="32" height="2" fill="#c8f2ff"/>')}
  ${box(80, 62, 14, 3, '#ffffff')}${box(98, 62, 6, 3, '#e8e8f0')}
  ${box(148, 56, 9, 10, '#d9503a')}<rect x="150" y="48" width="5" height="8" fill="#58c05a"/><rect x="147" y="51" width="4" height="4" fill="#58c05a"/><rect x="154" y="50" width="4" height="4" fill="#58c05a"/>
  <rect class="blink" x="140" y="62" width="4" height="3" fill="#7fe3ff"/>
</g>`
}

function sceneMatch(): string {
  const heads = ['#7a4426', '#2a2a2a', '#d8a04a', '#c0583a']
  const shirts = ['#ff6b7a', '#4cc38a', '#ffb740', '#b980ff', '#4fa3ff']
  const crowd = Array.from({ length: 12 }, (_, i) => {
    const x = 6 + i * 13
    return (
      `<g class="crowd" style="animation-delay:${((i * 0.13) % 0.6).toFixed(2)}s">` +
      `<rect x="${x - 1}" y="${86 + (i % 2)}" width="10" height="14" fill="${OUTLINE}"/>` +
      `<rect x="${x}" y="${88 + (i % 2)}" width="8" height="12" fill="${shirts[i % 5]}"/>` +
      `<rect x="${x - 1}" y="${80 + (i % 2)}" width="10" height="9" fill="${OUTLINE}"/>` +
      `<rect x="${x}" y="${81 + (i % 2)}" width="8" height="7" fill="#ffd9b3"/>` +
      `<rect x="${x}" y="${81 + (i % 2)}" width="8" height="3" fill="${heads[i % 4]}"/>` +
      `<rect x="${x + 1}" y="${85 + (i % 2)}" width="2" height="2" fill="#2a1f3d"/><rect x="${x + 5}" y="${85 + (i % 2)}" width="2" height="2" fill="#2a1f3d"/>` +
      `<rect x="${x + 8}" y="${72 + (i % 3)}" width="2" height="12" fill="${shirts[(i + 2) % 5]}"/>` +
      `</g>`
    )
  }).join('')
  return `<g class="scene s2">
  <rect width="${W}" height="${H}" fill="#7b8cf0"/><rect width="${W}" height="30" fill="#5d6fe0"/>
  <polygon class="spot" points="26,0 42,0 66,66 6,66" fill="#fff6c8" opacity="0.2"/>
  <polygon class="spot" points="118,0 134,0 156,66 96,66" fill="#fff6c8" opacity="0.2"/>
  ${box(40, 8, 80, 16, '#ff5a3c')}
  <g fill="#ffffff"><rect x="54" y="13" width="6" height="6"/><rect x="72" y="13" width="6" height="6"/><rect x="90" y="13" width="6" height="6"/><rect x="108" y="13" width="6" height="6"/></g>
  <g fill="#ffe27a"><rect x="56" y="11" width="2" height="10"/><rect x="52" y="15" width="10" height="2"/><rect x="92" y="11" width="2" height="10"/><rect x="88" y="15" width="10" height="2"/></g>
  ${box(8, 14, 12, 22, '#ffd34d')}<rect x="13" y="36" width="2" height="30" fill="${OUTLINE}"/>
  ${box(140, 14, 12, 22, '#4cc38a')}<rect x="145" y="36" width="2" height="30" fill="${OUTLINE}"/>
  ${box(0, 64, W, 14, '#8a63d2')}<rect y="78" width="${W}" height="4" fill="#5b3fa0"/>
  ${box(104, 52, 36, 5, '#caa26a')}
  ${monitor(108, 36, 14, 14)}${monitor(126, 36, 14, 14)}
  ${person(122, 64, '#e0503c', 'stand', 'bob', '#2a2a2a')}
  <g class="walk">${person(34, 80, '#3a86ff', 'stand', 'step')}</g>
  ${crowd}
</g>`
}

function sceneTrain(): string {
  const bar = (y: number, color: string, delay: string) =>
    `${box(104, y, 8, 8, color)}<rect x="116" y="${y + 1}" width="34" height="6" fill="#1a2140"/><rect class="hbar" x="116" y="${y + 1}" width="34" height="6" fill="${color}" style="animation-delay:${delay}"/>`
  const arrows = [0, 1, 2]
    .map((i) => `<g class="rise" style="animation-delay:${i * 0.7}s"><rect x="${44 + i * 14}" y="30" width="3" height="6" fill="#ffe27a"/><rect x="${42 + i * 14}" y="30" width="7" height="2" fill="#ffe27a"/><rect x="${43 + i * 14}" y="28" width="5" height="2" fill="#ffe27a"/></g>`)
    .join('')
  return `<g class="scene s3">
  <rect width="${W}" height="${H}" fill="#cfeff3"/><rect y="0" width="${W}" height="6" fill="#a9dbe6"/>
  <rect y="66" width="${W}" height="34" fill="#9fc3d0"/><rect y="66" width="${W}" height="2" fill="#c3e1ea"/>
  ${monitor(10, 14, 22, 14)}${monitor(38, 14, 22, 14)}
  ${box(70, 10, 18, 18, '#ffffff')}<rect x="78" y="14" width="2" height="8" fill="${OUTLINE}"/><rect x="78" y="20" width="6" height="2" fill="${OUTLINE}"/>
  ${box(98, 8, 56, 52, '#2a3359')}
  ${bar(16, '#4cc38a', '0s')}${bar(32, '#4fa3ff', '0.1s')}${bar(48, '#ffb740', '0.2s')}
  ${arrows}
  ${person(34, 78, '#3a86ff', 'stand', 'bob', '#7a4426', '#ff5a3c')}
  ${box(10, 66, 66, 5, '#b9793c')}${box(14, 71, 5, 18, '#8a5a30')}${box(66, 71, 5, 18, '#8a5a30')}
  ${monitor(52, 44, 22, 20)}
  <rect class="sweat" x="52" y="34" width="3" height="5" fill="#7fe3ff"/><rect class="sweat late" x="18" y="40" width="3" height="5" fill="#7fe3ff"/>
  ${box(84, 72, 10, 14, '#e0503c')}
</g>`
}

function sceneWin(): string {
  const colors = ['#ffd34d', '#ff6b7a', '#4fa3ff', '#4cc38a', '#b980ff']
  const confetti = Array.from({ length: 24 }, (_, i) => `<rect class="conf" x="${4 + ((i * 13) % 150)}" y="-6" width="3" height="5" fill="${colors[i % 5]}" style="animation-delay:${((i * 0.41) % 2.6).toFixed(2)}s"/>`).join('')
  return `<g class="scene s4">
  <rect width="${W}" height="${H}" fill="#6a4fc0"/><rect width="${W}" height="40" fill="#4a35a0"/><rect y="40" width="${W}" height="20" fill="#8a63d8"/>
  <polygon class="spot" points="58,0 102,0 136,80 24,80" fill="#fff0b0" opacity="0.26"/>
  ${box(0, 82, W, 18, '#3b2f6e')}
  ${box(48, 66, 64, 18, '#ffd34d')}<rect x="76" y="70" width="8" height="10" fill="#e0a500"/><rect x="78" y="70" width="4" height="10" fill="#fff0a0"/>
  <g class="trophy">
    ${box(70, 36, 20, 24, '#ffd34d')}${box(76, 60, 8, 6, '#e0a500')}
    ${box(64, 40, 6, 4, '#ffd34d')}${box(90, 40, 6, 4, '#ffd34d')}
    <rect x="68" y="44" width="2" height="8" fill="${OUTLINE}"/><rect x="90" y="44" width="2" height="8" fill="${OUTLINE}"/>
    <rect x="74" y="40" width="4" height="14" fill="#fff6b0"/>
  </g>
  <g class="cheer">${person(26, 84, '#3a86ff', 'cheer')}</g>
  <g class="cheer late">${person(134, 84, '#e0503c', 'cheer', '', '#2a2a2a')}</g>
  <g class="stars" fill="#fff6a8"><rect x="40" y="20" width="4" height="4"/><rect x="38" y="21" width="8" height="2"/><rect x="42" y="18" width="0.01" height="0.01"/><rect x="120" y="18" width="4" height="4"/><rect x="118" y="19" width="8" height="2"/><rect x="60" y="10" width="2" height="2"/><rect x="104" y="30" width="2" height="2"/></g>
  ${confetti}
</g>`
}

/** 16초 주기 애니메이션 CSS. 장면 k는 주기의 [25k%, 25(k+1)%]에 보이고, 앞뒤 2%에서 부드럽게 바뀐다. */
const CSS = `
.hero { width: 100%; max-width: 380px; margin: 4px auto; }
.hero-frame { position: relative; border-radius: 14px; overflow: hidden; border: 3px solid #3b2418; background: #0c0f1a; box-shadow: 0 6px 24px #0008; }
.hero svg { display: block; width: 100%; height: auto; image-rendering: pixelated; }
.hero .scene { opacity: 0; }
.hero .s1 { animation: heroS1 16s infinite; }
.hero .s2 { animation: heroS2 16s infinite; }
.hero .s3 { animation: heroS3 16s infinite; }
.hero .s4 { animation: heroS4 16s infinite; }
@keyframes heroS1 { 0%, 22% { opacity: 1; } 25%, 97% { opacity: 0; } 100% { opacity: 1; } }
@keyframes heroS2 { 0%, 22% { opacity: 0; } 25%, 47% { opacity: 1; } 50%, 100% { opacity: 0; } }
@keyframes heroS3 { 0%, 47% { opacity: 0; } 50%, 72% { opacity: 1; } 75%, 100% { opacity: 0; } }
@keyframes heroS4 { 0%, 72% { opacity: 0; } 75%, 97% { opacity: 1; } 100% { opacity: 0; } }
.hero .screen { animation: heroFlicker 0.9s steps(2) infinite; }
@keyframes heroFlicker { 0% { fill: #5fd1ff; } 50% { fill: #86e0ff; } }
.hero .beam { animation: heroBeam 1.4s linear infinite; }
@keyframes heroBeam { from { transform: translateY(0); } to { transform: translateY(12px); } }
.hero .blk1 { animation: heroBlk 0.8s steps(2) infinite; }
.hero .blk2 { animation: heroBlk 0.8s steps(2) infinite reverse; }
@keyframes heroBlk { 50% { transform: translateY(-3px); } }
.hero .bob, .hero .step { animation: heroBob 0.5s steps(2) infinite; }
@keyframes heroBob { 50% { transform: translateY(-1.5px); } }
.hero .blink { animation: heroBlink 1s steps(2) infinite; }
@keyframes heroBlink { 50% { opacity: 0; } }
.hero .sun { animation: heroSun 3s steps(2) infinite; }
@keyframes heroSun { 50% { fill: #fff3a8; } }
.hero .cloud { animation: heroCloud 8s linear infinite alternate; }
@keyframes heroCloud { from { transform: translateX(0); } to { transform: translateX(-24px); } }
.hero .walk { animation: heroWalk 16s infinite; }
@keyframes heroWalk { 0%, 25% { transform: translateX(-34px); } 38%, 100% { transform: translateX(30px); } }
.hero .spot { animation: heroSpot 2.4s ease-in-out infinite alternate; }
@keyframes heroSpot { from { opacity: 0.12; } to { opacity: 0.3; } }
.hero .crowd { animation: heroCrowd 0.6s steps(2) infinite; }
@keyframes heroCrowd { 50% { transform: translateY(-3px); } }
.hero .hbar { transform-box: fill-box; transform-origin: left center; animation: heroBar 16s infinite; }
@keyframes heroBar { 0%, 50% { transform: scaleX(0.12); } 70%, 100% { transform: scaleX(1); } }
.hero .rise { animation: heroRise 2.1s linear infinite; }
@keyframes heroRise { from { transform: translateY(8px); opacity: 0; } 30% { opacity: 1; } to { transform: translateY(-14px); opacity: 0; } }
.hero .sweat { animation: heroSweat 1.2s linear infinite; }
.hero .sweat.late { animation-delay: 0.6s; }
@keyframes heroSweat { from { transform: translateY(0); opacity: 1; } to { transform: translateY(12px); opacity: 0; } }
.hero .trophy { animation: heroTrophy 16s infinite; }
@keyframes heroTrophy { 0%, 75% { transform: translateY(28px); } 82%, 100% { transform: translateY(0); } }
.hero .cheer { animation: heroCheer 0.45s steps(2) infinite; }
.hero .cheer.late { animation-delay: 0.22s; }
@keyframes heroCheer { 50% { transform: translateY(-3px); } }
.hero .conf { animation: heroConf 2.6s linear infinite; }
@keyframes heroConf { from { transform: translateY(0); } to { transform: translateY(112px); } }
.hero .stars { animation: heroBlink 0.8s steps(2) infinite; }
.hero-captions { display: grid; margin-top: 10px; min-height: 1.5em; }
.hero-captions span { grid-area: 1 / 1; opacity: 0; font-weight: 700; }
.hero-captions .c1 { animation: heroS1 16s infinite; }
.hero-captions .c2 { animation: heroS2 16s infinite; }
.hero-captions .c3 { animation: heroS3 16s infinite; }
.hero-captions .c4 { animation: heroS4 16s infinite; color: var(--grade-UR); }
@media (prefers-reduced-motion: reduce) {
  .hero *, .hero-captions span { animation: none !important; }
  .hero .scene { opacity: 0; }
  .hero .s4 { opacity: 1; }
  .hero-captions .c4 { opacity: 1; }
}
`

let cssInstalled = false

/** 타이틀 화면 가운데에 들어가는 도트 애니메이션 */
export function titleHero(): HTMLElement {
  if (!cssInstalled) {
    cssInstalled = true
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.append(style)
  }
  const frame = h('div', { class: 'hero-frame' })
  frame.innerHTML = `<svg viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" role="img" aria-label="방구석에서 게임하던 겜돌이가 대회에 나가고 훈련해서 우승하는 도트 애니메이션">${sceneHome()}${sceneMatch()}${sceneTrain()}${sceneWin()}</svg>`
  return h(
    'div',
    { class: 'hero' },
    frame,
    h('div', { class: 'hero-captions', 'aria-hidden': 'true' }, h('span', { class: 'c1' }, '방구석에서 게임하던 겜돌이가'), h('span', { class: 'c2' }, '대회에 도전하고'), h('span', { class: 'c3' }, '훈련으로 실력을 키워서'), h('span', { class: 'c4' }, '월드 챔피언을 향해!')),
  )
}
