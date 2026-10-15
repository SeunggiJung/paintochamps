import { h } from './dom.ts'

/**
 * 타이틀 화면 중앙의 도트 애니메이션: 방구석 게임 → 대회 출전 → 훈련 → 우승이 16초 주기로 이어진다.
 * 게임이 어떤 이야기인지 한눈에 보여 주는 장면이다. 모두 SVG 도트(crispEdges)와 CSS 애니메이션이라 에셋 파일이 없다.
 */

const SKIN = '#f0c9a0'
const HAIR = '#3a2a22'

/** 도트 사람 (왼쪽 위 x,y 기준 10×19). arms: 'down' | 'up' | 'type' */
function person(x: number, y: number, shirt: string, arms: 'down' | 'up' | 'type' = 'down', cls = ''): string {
  const armsSvg =
    arms === 'up'
      ? `<rect x="${x - 2}" y="${y - 3}" width="2" height="9" fill="${SKIN}"/><rect x="${x + 10}" y="${y - 3}" width="2" height="9" fill="${SKIN}"/><rect x="${x - 2}" y="${y + 5}" width="3" height="3" fill="${shirt}"/><rect x="${x + 9}" y="${y + 5}" width="3" height="3" fill="${shirt}"/>`
      : arms === 'type'
        ? `<rect x="${x + 8}" y="${y + 8}" width="6" height="2" fill="${shirt}"/><rect x="${x + 13}" y="${y + 8}" width="2" height="2" fill="${SKIN}"/>`
        : `<rect x="${x - 1}" y="${y + 7}" width="2" height="7" fill="${shirt}"/><rect x="${x + 9}" y="${y + 7}" width="2" height="7" fill="${shirt}"/>`
  return `<g class="${cls}"><rect x="${x + 2}" y="${y}" width="6" height="6" fill="${SKIN}"/><rect x="${x + 2}" y="${y}" width="6" height="2" fill="${HAIR}"/><rect x="${x + 1}" y="${y + 2}" width="1" height="3" fill="${HAIR}"/>${
    '<rect x="' + (x + 4) + '" y="' + (y + 3) + '" width="1" height="1" fill="#222"/><rect x="' + (x + 6) + '" y="' + (y + 3) + '" width="1" height="1" fill="#222"/>'
  }<rect x="${x + 1}" y="${y + 6}" width="8" height="8" fill="${shirt}"/>${armsSvg}<rect x="${x + 2}" y="${y + 14}" width="2" height="5" fill="#2c3550"/><rect x="${x + 6}" y="${y + 14}" width="2" height="5" fill="#2c3550"/><rect x="${x + 2}" y="${y + 18}" width="3" height="1" fill="#111"/><rect x="${x + 6}" y="${y + 18}" width="3" height="1" fill="#111"/></g>`
}

const monitor = (x: number, y: number, w: number, hh: number, cls = '') =>
  `<rect x="${x - 1}" y="${y - 1}" width="${w + 2}" height="${hh + 2}" fill="#0c0f1a"/><rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="#1e6f8a" class="${cls}"/><rect x="${x + w / 2 - 2}" y="${y + hh + 1}" width="4" height="2" fill="#0c0f1a"/>`

function sceneHome(): string {
  return `<g class="scene s1">
  <rect width="96" height="60" fill="#161a2c"/>
  <rect x="62" y="6" width="22" height="18" fill="#0c0f1a"/><rect x="63" y="7" width="20" height="16" fill="#1d2a52"/>
  <rect x="74" y="9" width="5" height="5" fill="#ffe9a8"/><rect x="76" y="9" width="3" height="5" fill="#1d2a52"/>
  <rect x="66" y="16" width="1" height="1" fill="#fff"/><rect x="70" y="11" width="1" height="1" fill="#fff"/><rect x="80" y="19" width="1" height="1" fill="#fff"/>
  <rect x="73" y="6" width="1" height="18" fill="#0c0f1a"/><rect x="62" y="15" width="22" height="1" fill="#0c0f1a"/>
  <rect y="46" width="96" height="14" fill="#5b3f2a"/><rect y="46" width="96" height="2" fill="#7a573a"/>
  <rect x="4" y="30" width="22" height="16" fill="#3a3f66"/><rect x="4" y="30" width="22" height="3" fill="#565c93"/><rect x="5" y="36" width="20" height="10" fill="#4a4f80"/>
  <rect x="28" y="30" width="6" height="14" fill="#2b2f4e"/>
  ${person(31, 23, '#4a7fd4', 'type', 'bob')}
  <rect x="32" y="22" width="8" height="1" fill="#e4572e"/><rect x="31" y="25" width="2" height="4" fill="#e4572e"/><rect x="39" y="25" width="2" height="4" fill="#e4572e"/>
  <rect x="26" y="40" width="64" height="3" fill="#8a6440"/><rect x="26" y="40" width="64" height="1" fill="#a67c52"/><rect x="30" y="43" width="3" height="3" fill="#6b4a2f"/><rect x="84" y="43" width="3" height="3" fill="#6b4a2f"/>
  ${monitor(50, 26, 24, 14, 'screen')}
  <rect class="beam" x="52" y="28" width="20" height="2" fill="#7fe3ff"/>
  <rect x="40" y="38" width="8" height="2" fill="#1a1d2e"/><rect x="41" y="38" width="6" height="1" fill="#e4572e"/>
  <rect class="blink" x="80" y="34" width="4" height="2" fill="#7fe3ff"/>
</g>`
}

function sceneMatch(): string {
  const crowd = Array.from({ length: 14 }, (_, i) => {
    const x = 2 + i * 7
    const c = ['#3a3f66', '#5a3f66', '#3f6655', '#66543f'][i % 4]
    return `<rect x="${x}" y="${50 + (i % 2)}" width="5" height="5" fill="${c}"/><rect x="${x + 1}" y="${47 + (i % 2)}" width="3" height="3" fill="${SKIN}" opacity="0.7"/>`
  }).join('')
  return `<g class="scene s2">
  <rect width="96" height="60" fill="#12162a"/>
  <polygon class="spot" points="20,0 28,0 40,40 8,40" fill="#fff6c8" opacity="0.18"/>
  <polygon class="spot" points="68,0 76,0 90,40 58,40" fill="#fff6c8" opacity="0.18"/>
  <rect x="26" y="4" width="44" height="10" fill="#e4572e"/><rect x="26" y="4" width="44" height="2" fill="#ff8f66"/>
  <rect x="32" y="8" width="4" height="4" fill="#fff"/><rect x="40" y="8" width="4" height="4" fill="#fff"/><rect x="48" y="8" width="4" height="4" fill="#fff"/><rect x="56" y="8" width="4" height="4" fill="#fff"/>
  <rect y="38" width="96" height="10" fill="#2b2f4e"/><rect y="38" width="96" height="2" fill="#565c93"/>
  ${monitor(56, 26, 12, 8, 'screen')}${monitor(76, 26, 12, 8, 'screen')}
  <rect x="55" y="35" width="14" height="3" fill="#8a6440"/><rect x="75" y="35" width="14" height="3" fill="#8a6440"/>
  ${person(80, 18, '#c0392b', 'type')}
  <g class="walk">${person(10, 20, '#4a7fd4', 'down', 'step')}</g>
  <rect y="48" width="96" height="12" fill="#0c0f1a"/>${crowd}
</g>`
}

function sceneTrain(): string {
  const bar = (y: number, color: string, delay: string) =>
    `<rect x="62" y="${y}" width="28" height="4" fill="#0c0f1a"/><rect class="hbar" x="62" y="${y}" width="28" height="4" fill="${color}" style="animation-delay:${delay}"/>`
  return `<g class="scene s3">
  <rect width="96" height="60" fill="#151a2e"/>
  <rect y="46" width="96" height="14" fill="#2b3350"/><rect y="46" width="96" height="2" fill="#3f4a75"/>
  ${monitor(8, 10, 14, 9, 'screen')}${monitor(26, 10, 14, 9, 'screen')}
  <rect x="44" y="6" width="12" height="12" fill="#e8e4d4"/><rect x="45" y="7" width="10" height="10" fill="#fff"/><rect x="49" y="9" width="1" height="5" fill="#222"/><rect x="49" y="13" width="4" height="1" fill="#222"/>
  <rect x="60" y="10" width="32" height="30" fill="#0c0f1a"/><rect x="61" y="11" width="30" height="28" fill="#1a2140"/>
  ${bar(15, '#4cc38a', '0s')}${bar(24, '#4fa3ff', '0.1s')}${bar(33, '#ffb740', '0.2s')}
  ${monitor(14, 24, 22, 13, 'screen')}
  <rect x="10" y="38" width="30" height="3" fill="#8a6440"/><rect x="12" y="41" width="3" height="5" fill="#6b4a2f"/><rect x="35" y="41" width="3" height="5" fill="#6b4a2f"/>
  ${person(20, 25, '#4a7fd4', 'type', 'bob')}
  <rect x="21" y="24" width="8" height="1" fill="#e4572e"/>
  <rect class="sweat" x="32" y="28" width="2" height="3" fill="#7fe3ff"/>
  <rect class="sweat late" x="18" y="30" width="2" height="3" fill="#7fe3ff"/>
  <rect x="6" y="46" width="6" height="8" fill="#3a3f66"/><rect x="5" y="44" width="8" height="3" fill="#565c93"/>
</g>`
}

function sceneWin(): string {
  const confetti = Array.from({ length: 16 }, (_, i) => {
    const colors = ['#ffd34d', '#ff6b7a', '#4fa3ff', '#4cc38a', '#b980ff']
    return `<rect class="conf" x="${3 + ((i * 11) % 90)}" y="-4" width="2" height="3" fill="${colors[i % 5]}" style="animation-delay:${((i * 0.37) % 2.4).toFixed(2)}s"/>`
  }).join('')
  return `<g class="scene s4">
  <rect width="96" height="60" fill="#1b1730"/>
  <polygon class="spot" points="36,0 60,0 80,46 16,46" fill="#ffe9a8" opacity="0.22"/>
  <rect y="46" width="96" height="14" fill="#2b2f4e"/><rect y="46" width="96" height="2" fill="#565c93"/>
  <rect x="34" y="38" width="28" height="10" fill="#d8a53a"/><rect x="34" y="38" width="28" height="2" fill="#ffd34d"/><rect x="44" y="41" width="8" height="5" fill="#8f6a18"/>
  <g class="trophy">
    <rect x="42" y="30" width="12" height="8" fill="#ffd34d"/><rect x="40" y="18" width="16" height="12" fill="#ffd34d"/><rect x="42" y="18" width="12" height="2" fill="#fff2a8"/>
    <rect x="36" y="20" width="4" height="2" fill="#ffd34d"/><rect x="36" y="20" width="2" height="7" fill="#ffd34d"/><rect x="36" y="25" width="5" height="2" fill="#ffd34d"/>
    <rect x="56" y="20" width="4" height="2" fill="#ffd34d"/><rect x="58" y="20" width="2" height="7" fill="#ffd34d"/><rect x="55" y="25" width="5" height="2" fill="#ffd34d"/>
    <rect x="45" y="22" width="6" height="2" fill="#e0a500"/><rect x="46" y="24" width="4" height="3" fill="#e0a500"/>
  </g>
  <g class="cheer">${person(14, 28, '#4a7fd4', 'up')}</g>
  <g class="cheer late">${person(72, 28, '#c0392b', 'up')}</g>
  <g class="stars" fill="#fff6a8"><rect x="22" y="12" width="2" height="2"/><rect x="21" y="13" width="4" height="0.01"/><rect x="74" y="10" width="2" height="2"/><rect x="30" y="6" width="1" height="1"/><rect x="68" y="18" width="1" height="1"/></g>
  ${confetti}
</g>`
}

/** 16초 주기 애니메이션 CSS. 장면 k는 주기의 [25k%, 25(k+1)%]에 보이고, 앞뒤 2%에서 부드럽게 바뀐다. */
const CSS = `
.hero { width: 100%; max-width: 360px; margin: 4px auto; }
.hero-frame { position: relative; border-radius: 14px; overflow: hidden; border: 2px solid var(--line); background: #0c0f1a; box-shadow: 0 6px 24px #0008; }
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
@keyframes heroFlicker { 0% { fill: #1e6f8a; } 50% { fill: #2a8fb0; } }
.hero .beam { animation: heroBeam 1.4s linear infinite; }
@keyframes heroBeam { from { transform: translateY(0); } to { transform: translateY(10px); } }
.hero .bob, .hero .step { animation: heroBob 0.5s steps(2) infinite; }
@keyframes heroBob { 50% { transform: translateY(-1px); } }
.hero .blink { animation: heroBlink 1s steps(2) infinite; }
@keyframes heroBlink { 50% { opacity: 0; } }
.hero .walk { animation: heroWalk 16s infinite; }
@keyframes heroWalk { 0%, 25% { transform: translateX(-16px); } 38%, 100% { transform: translateX(22px); } }
.hero .spot { animation: heroSpot 2.4s ease-in-out infinite alternate; }
@keyframes heroSpot { from { opacity: 0.1; } to { opacity: 0.26; } }
.hero .hbar { transform-box: fill-box; transform-origin: left center; animation: heroBar 16s infinite; }
@keyframes heroBar { 0%, 50% { transform: scaleX(0.12); } 70%, 100% { transform: scaleX(1); } }
.hero .sweat { animation: heroSweat 1.2s linear infinite; }
.hero .sweat.late { animation-delay: 0.6s; }
@keyframes heroSweat { from { transform: translateY(0); opacity: 1; } to { transform: translateY(8px); opacity: 0; } }
.hero .trophy { animation: heroTrophy 16s infinite; }
@keyframes heroTrophy { 0%, 75% { transform: translateY(14px); } 82%, 100% { transform: translateY(0); } }
.hero .cheer { animation: heroCheer 0.45s steps(2) infinite; }
.hero .cheer.late { animation-delay: 0.22s; }
@keyframes heroCheer { 50% { transform: translateY(-2px); } }
.hero .conf { animation: heroConf 2.4s linear infinite; }
@keyframes heroConf { from { transform: translateY(0); } to { transform: translateY(66px); } }
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
  frame.innerHTML = `<svg viewBox="0 0 96 60" shape-rendering="crispEdges" role="img" aria-label="방구석에서 게임하던 겜돌이가 대회에 나가고 훈련해서 우승하는 도트 애니메이션">${sceneHome()}${sceneMatch()}${sceneTrain()}${sceneWin()}</svg>`
  return h(
    'div',
    { class: 'hero' },
    frame,
    h('div', { class: 'hero-captions', 'aria-hidden': 'true' }, h('span', { class: 'c1' }, '방구석에서 게임하던 겜돌이가'), h('span', { class: 'c2' }, '대회에 도전하고'), h('span', { class: 'c3' }, '훈련으로 실력을 키워서'), h('span', { class: 'c4' }, '월드 챔피언을 향해!')),
  )
}
