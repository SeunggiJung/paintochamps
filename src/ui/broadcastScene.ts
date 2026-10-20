import { OUTLINE, placeSprite, shade, type SpriteLook } from './sprite.ts'

/**
 * 결승 중계 장면 (임시 도트 SVG): 양쪽에 5대5로 앉은 선수, 가운데 큰 화면의 교전, 아래쪽 해설석.
 * 에셋 파일이 없고 코드로 그린다. 움직임은 style.css의 .bs-* 애니메이션이고, 바깥 요소의 data-mood로 조절한다
 * (idle: 대기, fight: 교전, win/lose: 결과 — 이긴 쪽 선수석이 환호한다). 좌표는 모두 160×100.
 *
 * kind: 'aos'는 협곡 한타 장면, 'fps'는 폭탄 설치 지점 교전 장면.
 */
export type BroadcastKind = 'aos' | 'fps'

const W = 160
const H = 100

const BLUE = '#4a7dff'
const RED = '#ff5a5a'

const r = (x: number, y: number, w: number, h: number, c: string, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" ${extra}/>`

function box(x: number, y: number, w: number, h: number, c: string): string {
  return r(x - 1, y - 1, w + 2, h + 2, OUTLINE) + r(x, y, w, h, c) + r(x, y, w, 1, shade(c, 1.28)) + r(x, y + h - 1, w, 1, shade(c, 0.78))
}

const HAIRS = ['#3b2a1c', '#6b3a1f', '#222222', '#a0522d', '#d4a017', '#4b3b6b']

/** 선수 한 명: 스프라이트 + 책상 + 키보드 불빛. 바깥 g에 CSS 애니메이션을 건다(스프라이트 자체가 transform을 쓰므로 한 겹 더 싼다). */
function player(cx: number, foot: number, color: string, i: number, side: 'l' | 'r'): string {
  const look: SpriteLook = { shirt: color, hair: HAIRS[(i + (side === 'l' ? 0 : 3)) % HAIRS.length], headset: '#222831' }
  const delay = (-(i * 0.17 + (side === 'l' ? 0 : 0.08))).toFixed(2)
  return (
    `<g class="bs-p" style="animation-delay:${delay}s">${placeSprite(look, 'stand', cx, foot, 20)}</g>` +
    box(cx - 8, foot - 8, 16, 6, shade(color, 0.7)) +
    r(cx - 5, foot - 7, 10, 1, '#222831') +
    r(cx - 5 + (i % 3) * 3, foot - 7, 2, 1, '#8affc1', `class="bs-key" style="animation-delay:${delay}s"`)
  )
}

function team(side: 'l' | 'r'): string {
  const color = side === 'l' ? BLUE : RED
  const xs = side === 'l' ? [10, 27, 10, 27, 18] : [133, 150, 133, 150, 142]
  const feet = [27, 27, 48, 48, 69]
  return `<g class="bs-team bs-${side}">${xs.map((x, i) => player(x, feet[i], color, i, side)).join('')}</g>`
}

function caster(cx: number, shirt: string, hair: string): string {
  const look: SpriteLook = { shirt, hair, headset: '#ffb740' }
  return `<g class="bs-caster">${placeSprite(look, 'stand', cx, 88, 26)}</g>` + r(cx + 3, 77, 1, 4, OUTLINE) + r(cx + 2, 76, 3, 2, '#555b73')
}

/** 가운데 큰 화면 틀 (x 40~120, y 6~54) */
const SCREEN = { x: 40, y: 6, w: 80, h: 48 }

function frame(content: string): string {
  const { x, y, w, h } = SCREEN
  return (
    r(x - 3, y - 3, w + 6, h + 6, OUTLINE) +
    r(x - 2, y - 2, w + 4, h + 4, '#3a4070') +
    `<rect class="bs-led" x="${x - 2}" y="${y - 2}" width="${w + 4}" height="1" fill="#8cc4ff"/>` +
    `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="hidden">${content}</svg>`
  )
}

/** 화면 속 한 점: 반투명 효과가 쓰는 공용 도형 */
const ring = (cx: number, cy: number, c: string, delay: number, big = 1) => `<circle class="bs-ring bs-act" cx="${cx}" cy="${cy}" r="${4 * big}" fill="none" stroke="${c}" stroke-width="1" style="animation-delay:${delay}s"/>`

/** AOS: 협곡 한타. 강과 수풀, 푸른 팀 5명 대 붉은 팀 5명, 스킬 이펙트와 체력바. */
function aosScreen(): string {
  const { w, h } = SCREEN
  const rocks = [r(0, 0, w, 3, '#5b5f6e'), r(0, h - 3, w, 3, '#5b5f6e'), r(0, 0, 3, h, '#5b5f6e'), r(w - 3, 0, 3, h, '#5b5f6e'), r(10, 8, 6, 5, '#4a4e5c'), r(62, 34, 7, 5, '#4a4e5c')].join('')
  const terrain =
    r(0, 0, w, h, '#2f6b4a') +
    `<polygon points="0,${h - 6} ${w - 20},0 ${w},0 ${w},8 14,${h} 0,${h}" fill="#3b8fb0"/>` +
    `<polygon points="0,${h - 3} ${w - 24},0 ${w - 20},0 6,${h}" fill="#6cc7e6" opacity="0.5"/>` +
    [r(8, 28, 9, 6, '#245a3c'), r(60, 6, 10, 6, '#245a3c'), r(46, 40, 8, 5, '#245a3c')].join('')
  // 챔피언: 5×7 도트 몸 + 체력바 + 직업 표시
  const champ = (x: number, y: number, c: string, i: number, side: 'l' | 'r') => {
    const dir = side === 'l' ? 1 : -1
    const body = shade(c, 0.85)
    return (
      `<g class="bs-champ bs-act" style="animation-delay:${(-i * 0.21).toFixed(2)}s;--dx:${3 * dir}px">` +
      r(x - 1, y - 1, 7, 9, OUTLINE) +
      r(x, y, 5, 3, '#ffd9b3') +
      r(x, y + 3, 5, 4, body) +
      r(x + (i % 2 === 0 ? 0 : 3), y + 3, 2, 3, c) +
      r(x - 1, y - 4, 7, 1, '#222') +
      r(x - 1, y - 4, 2 + (i * 2) % 5, 1, '#5cdc7a') +
      `</g>`
    )
  }
  const blue = [champ(22, 20, BLUE, 0, 'l'), champ(28, 30, BLUE, 1, 'l'), champ(34, 14, BLUE, 2, 'l'), champ(18, 36, BLUE, 3, 'l'), champ(38, 26, BLUE, 4, 'l')]
  const red = [champ(50, 22, RED, 0, 'r'), champ(56, 32, RED, 1, 'r'), champ(46, 38, RED, 2, 'r'), champ(58, 14, RED, 3, 'r'), champ(52, 28, RED, 4, 'r')]
  const fx =
    ring(40, 26, '#ffe066', 0, 1.4) +
    ring(48, 30, '#b980ff', -0.5) +
    ring(36, 22, '#8cc4ff', -0.9) +
    ring(54, 24, '#ff8a8a', -0.3, 1.2) +
    `<rect class="bs-beam bs-act" x="26" y="26" width="22" height="2" fill="#8cc4ff"/>` +
    `<rect class="bs-beam bs-act" x="46" y="33" width="18" height="2" fill="#ff8a8a" style="animation-delay:-0.4s"/>` +
    `<rect class="bs-spark bs-act" x="43" y="24" width="3" height="3" fill="#fff3c4"/>` +
    `<rect class="bs-spark bs-act" x="50" y="31" width="3" height="3" fill="#fff3c4" style="animation-delay:-0.35s"/>`
  const dragon = r(66, 10, 10, 8, OUTLINE) + r(67, 11, 8, 6, '#8b5fd6') + r(69, 12, 2, 2, '#ffeb99') + r(72, 12, 2, 2, '#ffeb99')
  return terrain + rocks + dragon + blue.join('') + red.join('') + fx
}

/** FPS: 폭탄 설치 지점 교전. 벽과 사이트, 연막, 총구 불꽃과 예광탄, 푸른 팀 대 붉은 팀. */
function fpsScreen(): string {
  const { w, h } = SCREEN
  const floor = r(0, 0, w, h, '#454b59') + r(0, 0, w, 3, '#1f232b') + r(0, h - 3, w, 3, '#1f232b') + r(0, 0, 3, h, '#1f232b') + r(w - 3, 0, 3, h, '#1f232b')
  const walls = [r(24, 3, 4, 20, '#1f232b'), r(50, 18, 4, 27, '#1f232b'), r(8, 30, 16, 4, '#1f232b'), r(54, 30, 18, 4, '#1f232b'), r(34, 38, 10, 4, '#2b303b')].join('')
  const site = r(6, 6, 18, 18, '#ffb74055') + `<text x="15" y="19" font-size="9" fill="#ffd98a" font-weight="900" text-anchor="middle" font-family="sans-serif" shape-rendering="auto">A</text>`
  const spike = `<g class="bs-spike bs-act">${r(12, 12, 4, 4, '#ff3b3b')}${r(13, 13, 2, 2, '#fff')}</g>`
  const agent = (x: number, y: number, c: string, i: number, side: 'l' | 'r') => {
    const dir = side === 'l' ? 1 : -1
    return (
      `<g class="bs-agent bs-act" style="animation-delay:${(-i * 0.19).toFixed(2)}s;--dx:${2 * dir}px">` +
      r(x - 1, y - 1, 6, 6, OUTLINE) +
      r(x, y, 4, 4, c) +
      r(x + 1, y + 1, 2, 1, shade(c, 1.4)) +
      r(side === 'l' ? x + 4 : x - 3, y + 1, 3, 1, '#d8dbe6') +
      `</g>`
    )
  }
  const blue = [agent(34, 8, BLUE, 0, 'l'), agent(36, 24, BLUE, 1, 'l'), agent(32, 36, BLUE, 2, 'l'), agent(30, 14, BLUE, 3, 'l'), agent(40, 32, BLUE, 4, 'l')]
  const red = [agent(12, 10, RED, 0, 'r'), agent(18, 26, RED, 1, 'r'), agent(6, 28, RED, 2, 'r'), agent(10, 38, RED, 3, 'r'), agent(60, 20, RED, 4, 'r')]
  const flashes = [
    r(28, 11, 3, 2, '#ffe066', 'class="bs-muzzle bs-act"'),
    r(30, 26, 3, 2, '#ffe066', 'class="bs-muzzle bs-act" style="animation-delay:-0.25s"'),
    r(26, 38, 3, 2, '#ffe066', 'class="bs-muzzle bs-act" style="animation-delay:-0.4s"'),
    r(22, 12, 3, 2, '#ffe066', 'class="bs-muzzle bs-act" style="animation-delay:-0.1s"'),
    r(46, 22, 3, 2, '#ffe066', 'class="bs-muzzle bs-act" style="animation-delay:-0.3s"'),
  ].join('')
  const tracers = [
    `<line class="bs-tracer bs-act" x1="30" y1="10" x2="16" y2="12" stroke="#ffe9a0" stroke-width="0.8"/>`,
    `<line class="bs-tracer bs-act" x1="32" y1="26" x2="20" y2="27" stroke="#ffe9a0" stroke-width="0.8" style="animation-delay:-0.3s"/>`,
    `<line class="bs-tracer bs-act" x1="14" y1="12" x2="33" y2="9" stroke="#ff9a9a" stroke-width="0.8" style="animation-delay:-0.15s"/>`,
  ].join('')
  const smoke = `<circle class="bs-smoke bs-act" cx="44" cy="20" r="7" fill="#c9ced8" opacity="0.55"/><circle class="bs-smoke bs-act" cx="38" cy="30" r="5" fill="#c9ced8" opacity="0.45" style="animation-delay:-0.6s"/>`
  const hud = r(w - 22, h - 9, 20, 6, '#000a') + r(w - 21, h - 8, 14, 1, '#5cdc7a') + r(w - 21, h - 6, 8, 1, '#ffd98a')
  return floor + walls + site + spike + smoke + blue.join('') + red.join('') + flashes + tracers + hud
}

/** 결과 때 화면 위에 덮는 번쩍임과 글자 (이긴 쪽 색) */
function resultOverlay(): string {
  const { x, y, w, h } = SCREEN
  const label = (cls: string, color: string, text: string) =>
    `<g class="${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" opacity="0.45"/><text x="${x + w / 2}" y="${y + h / 2 + 5}" font-size="14" font-weight="900" fill="#fff" stroke="${OUTLINE}" stroke-width="0.6" text-anchor="middle" font-family="sans-serif" shape-rendering="auto">${text}</text></g>`
  return label('bs-over-win', BLUE, 'VICTORY') + label('bs-over-lose', RED, 'DEFEAT')
}

/** 무대 배경: 어두운 바닥, 조명 빔, 관중석 불빛 */
function background(): string {
  const beams = [
    `<polygon class="bs-beam-light" points="30,0 40,0 70,62 20,62" fill="#8cc4ff" opacity="0.07"/>`,
    `<polygon class="bs-beam-light" points="130,0 120,0 90,62 140,62" fill="#ff8a8a" opacity="0.07" style="animation-delay:-1.2s"/>`,
  ].join('')
  let dots = ''
  for (let i = 0; i < 28; i++) dots += r((i * 23) % W, 94 + ((i * 7) % 6), 2, 2, i % 2 ? '#2f3560' : '#3b4275')
  return r(0, 0, W, H, '#161a30') + r(0, 62, W, 38, '#1d2240') + r(0, 62, W, 1, '#2f3560') + beams + dots
}

/** 중계 장면 전체 SVG 문자열 */
export function broadcastSceneSvg(kind: BroadcastKind): string {
  const screen = frame(kind === 'aos' ? aosScreen() : fpsScreen())
  const desk = box(48, 86, 64, 10, '#3a3f66') + r(52, 88, 56, 1, '#6b73b0')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid slice" aria-hidden="true">` +
    background() +
    screen +
    resultOverlay() +
    team('l') +
    team('r') +
    caster(68, '#e8e8f0', '#3b2a1c') +
    caster(92, '#ffb740', '#6b3a1f') +
    desk +
    `</svg>`
  )
}
