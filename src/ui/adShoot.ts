import adData from '../data/ads.json'
import { adTypeName, type AdType } from '../engine/ads.ts'
import { OUTLINE, placeSprite, shade, type SpriteLook } from './sprite.ts'
import { h } from './dom.ts'
import { formatMoney } from './format.ts'
import { openSheet } from './sheet.ts'
import { playSfx, vibrate } from './sound.ts'

/**
 * 광고 촬영 연출(도트 SVG + CSS, 스킵 가능): 촬영장 도착 → 의상·메이크업 → 촬영(플래시) → 컷! OK 사인 → 결과.
 * 브랜드는 가상이고, 카테고리마다 선수 옆 소품과 배경색이 달라진다.
 */
const r = (x: number, y: number, w: number, h: number, c: string, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" ${extra}/>`

const CATEGORY_COLOR: Record<string, string> = {
  식음료: '#2f9d8f',
  주변기기: '#5b6bff',
  의류: '#d0527a',
  '금융·통신': '#3d8bd9',
  '모바일 게임': '#8a54d6',
  자동차: '#c9772f',
}

/** 카테고리별 소품 (선수 오른쪽, 약 20×20) */
function prop(category: string, x: number, y: number): string {
  switch (category) {
    case '식음료':
      return r(x + 6, y, 6, 3, '#cfd6e6') + r(x + 4, y + 3, 10, 15, '#7fe0d0') + r(x + 4, y + 3, 10, 2, '#fff') + r(x + 6, y + 9, 6, 4, '#fff') + r(x + 3, y + 17, 12, 2, OUTLINE)
    case '주변기기':
      return r(x + 3, y + 4, 12, 14, '#2b3250') + r(x + 4, y + 5, 10, 6, '#7a86ff') + r(x + 8, y + 5, 2, 5, '#fff') + r(x + 2, y + 18, 14, 1, OUTLINE)
    case '의류':
      return r(x + 2, y + 3, 14, 15, '#ff7aa8') + r(x - 1, y + 3, 4, 7, '#ff7aa8') + r(x + 15, y + 3, 4, 7, '#ff7aa8') + r(x + 7, y + 3, 4, 2, '#fff') + r(x + 5, y + 11, 8, 2, '#fff')
    case '금융·통신':
      return r(x + 3, y + 3, 13, 13, '#ffd34d') + r(x + 4, y + 4, 11, 11, '#f3b81e') + r(x + 8, y + 6, 3, 7, '#fff3b0') + r(x + 5, y + 8, 9, 2, '#fff3b0')
    case '모바일 게임':
      return r(x + 5, y, 9, 18, '#1d2038') + r(x + 6, y + 2, 7, 12, '#b48cff') + r(x + 8, y + 5, 3, 3, '#fff') + r(x + 8, y + 15, 3, 1, '#fff')
    default:
      return r(x, y + 9, 20, 7, '#ff9d3d') + r(x + 4, y + 4, 11, 6, '#ffbf73') + r(x + 5, y + 5, 4, 4, '#bfe6ff') + r(x + 10, y + 5, 4, 4, '#bfe6ff') + r(x + 3, y + 15, 4, 4, OUTLINE) + r(x + 13, y + 15, 4, 4, OUTLINE)
  }
}

function sceneSvg(brand: string, category: string, look: SpriteLook): string {
  const color = CATEGORY_COLOR[category] ?? '#5b6bff'
  const backdrop = r(14, 8, 132, 52, OUTLINE) + r(15, 9, 130, 50, color) + r(15, 9, 130, 8, shade(color, 1.25)) + r(15, 52, 130, 7, shade(color, 0.8))
  const sign = r(46, 16, 68, 14, '#10162a') + r(47, 17, 66, 12, shade(color, 0.55)) + `<text x="80" y="26.5" font-size="7" fill="#fff" font-weight="800" text-anchor="middle" font-family="sans-serif" shape-rendering="auto">${brand}</text>`
  const floor = r(0, 60, 160, 40, '#2a2f4a') + r(0, 60, 160, 2, '#3a4166') + r(0, 78, 160, 1, '#232844')
  const stand = (x: number) => r(x, 32, 2, 52, '#9aa1bd') + r(x - 4, 82, 10, 2, '#3a4166') + r(x - 4, 24, 10, 9, '#fff3b0') + r(x - 3, 25, 8, 7, '#ffe27a')
  const beam = (x: number, dir: number) => `<polygon class="ad-beam" points="${x},30 ${x + dir * 6},30 ${x + dir * 38},78 ${x + dir * 2},78" fill="#fff3b0"/>`
  const camera = r(6, 58, 2, 28, '#9aa1bd') + r(2, 84, 10, 2, '#3a4166') + r(0, 50, 16, 10, '#1d2038') + r(10, 52, 8, 6, '#3a4166') + r(14, 53, 5, 4, '#9ad1ff') + `<circle class="ad-rec" cx="3" cy="52.5" r="1.4" fill="#ff3b3b"/>`
  const clapper = r(124, 84, 16, 9, '#1d2038') + r(124, 80, 16, 4, '#fff') + r(127, 80, 3, 4, '#1d2038') + r(133, 80, 3, 4, '#1d2038') + r(125, 86, 14, 1, '#fff')
  const chair = r(143, 70, 12, 3, '#5a3b22') + r(144, 73, 2, 14, '#3a2818') + r(152, 73, 2, 14, '#3a2818') + r(143, 62, 3, 10, '#3a2818')
  const player = `<g class="ad-pose-a">${placeSprite(look, 'stand', 80, 92, 46)}</g><g class="ad-pose-b">${placeSprite(look, 'cheer', 80, 92, 46)}</g>`
  const flash = ['ad-flash f1', 'ad-flash f2', 'ad-flash f3'].map((c) => r(0, 0, 160, 100, '#ffffff', `class="${c}"`)).join('')
  const cut = `<g class="ad-cut"><rect x="52" y="32" width="56" height="13" fill="#10162a" stroke="#ffd34d" stroke-width="1"/><text x="80" y="42" font-size="9" fill="#ffd34d" font-weight="900" text-anchor="middle" font-family="sans-serif" shape-rendering="auto">컷! OK</text></g>`
  return (
    `<svg class="ad-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" shape-rendering="crispEdges" role="img" aria-label="광고 촬영장">` +
    r(0, 0, 160, 100, '#12162a') +
    backdrop +
    sign +
    floor +
    beam(30, 1) +
    beam(130, -1) +
    stand(30) +
    stand(130) +
    camera +
    chair +
    clapper +
    player +
    prop(category, 104, 70) +
    flash +
    cut +
    '</svg>'
  )
}

export interface AdShootInfo {
  brand: string
  category: string
  type: AdType
  /** 이 계약에서 몇 번째 촬영인지(0부터)와 전체 촬영 수 */
  index: number
  shoots: number
  paid: number
  look: SpriteLook
}

const CAPTIONS: [number, string][] = [
  [0, '촬영장에 도착했다'],
  [1000, '의상을 갈아입고 메이크업을 받는다'],
  [2000, '촬영 시작! 플래시가 터진다'],
  [3500, '컷! OK 사인이 났다']
]

/** 광고 촬영 연출. 확인(또는 스킵 뒤 확인)을 누르면 닫힌다. */
export function playAdShoot(info: AdShootInfo): Promise<void> {
  return openSheet<void>(
    (close) => {
      const root = h('div', { class: 'ad-shoot stack-tight' })
      root.innerHTML = sceneSvg(info.brand, info.category, info.look)
      const caption = h('p', { class: 'ad-caption muted' }, CAPTIONS[0][1])
      const timers: number[] = []
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        timers.forEach((t) => clearTimeout(t))
        caption.textContent = CAPTIONS[CAPTIONS.length - 1][1]
        playSfx('stamp')
        vibrate(40)
      }
      CAPTIONS.slice(1).forEach(([ms, text]) => timers.push(window.setTimeout(() => (caption.textContent = text), ms)))
      timers.push(window.setTimeout(finish, 3500))
      const skip = () => {
        root.classList.add('skip')
        finish()
      }
      root.addEventListener('click', skip)
      root.append(
        caption,
        h('button', { class: 'btn ghost small skip-btn', onclick: skip }, '스킵하기 ', h('span', { 'aria-hidden': 'true' }, '⏩')),
        h(
          'div',
          { class: 'ad-result stack-tight' },
          h('p', { class: 'eyebrow' }, `${adTypeName(info.type)} · ${info.brand} (${info.category}) 촬영 ${info.index + 1}/${info.shoots}`),
          h('h2', {}, info.paid > 0 ? `+${formatMoney(info.paid)}` : '촬영 완료'),
          h('p', { class: 'muted small' }, `명성 +${adData.shoot.fame} · 컨디션 ${adData.shoot.condition}`),
          h('button', { class: 'btn primary', onclick: () => (timers.forEach((t) => clearTimeout(t)), close()) }, '확인'),
        ),
      )
      return root
    },
    { variant: 'cinema' })
}
