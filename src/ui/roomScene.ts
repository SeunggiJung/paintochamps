import { cosmeticDef, equippedOf, type CosmeticDef } from '../engine/cosmetics.ts'
import type { GameState } from '../engine/state.ts'
import { OUTLINE, placeSprite, shade, type SpriteLook } from './sprite.ts'
import { playerLook } from './look.ts'

/**
 * 내 방 도트 장면(SVG, 160×100). 장착한 방 배경·책상 소품·의상·명찰이 그대로 그려진다.
 * 에셋 파일 없이 코드로 그린 그림이고, 상점 상품 카드의 작은 그림도 같은 함수를 쓴다.
 */
const r = (x: number, y: number, w: number, h: number, c: string, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" ${extra}/>`
const text = (x: number, y: number, size: number, fill: string, s: string, weight = 800) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="middle" font-family="sans-serif" shape-rendering="auto">${s}</text>`

/** 방 배경: 벽·바닥과 테마 장식 */
function backdrop(art: Record<string, string>): string {
  const { wall, wall2, floor, accent, deco } = art
  let s = r(0, 0, 160, 100, wall) + r(0, 52, 160, 18, wall2) + r(0, 70, 160, 30, floor) + r(0, 70, 160, 2, shade(floor, 1.3)) + r(0, 69, 160, 1, OUTLINE)
  switch (deco) {
    case 'string':
      s += r(0, 0, 160, 3, '#3a2a1e') + Array.from({ length: 16 }, (_, i) => r(5 + i * 10, 4 + (i % 2), 3, 3, i % 3 === 0 ? '#ffd34d' : '#fff3b0')).join('') + r(10, 18, 30, 24, '#8fb0d9') + r(11, 19, 28, 22, '#c9e3ff') + r(24, 19, 2, 22, '#8fb0d9')
      break
    case 'neon':
      s += r(10, 14, 60, 2, '#ff4dd2') + r(10, 14, 2, 22, '#ff4dd2') + r(68, 14, 2, 22, '#4dd2ff') + r(10, 34, 60, 2, '#4dd2ff') + r(112, 12, 36, 2, '#ffd34d') + r(112, 12, 2, 26, '#ffd34d') + text(130, 33, 14, '#ff4dd2', 'GG', 900)
      break
    case 'shelf':
      s += r(8, 10, 54, 3, '#3a2818') + r(8, 28, 54, 3, '#3a2818') + r(8, 46, 54, 3, '#3a2818') + Array.from({ length: 9 }, (_, i) => r(10 + i * 6, 14 + (i % 3), 4, 14 - (i % 3), ['#e84a4a', '#5b8cff', '#ffd34d', '#5ab26a'][i % 4])).join('') + Array.from({ length: 8 }, (_, i) => r(10 + i * 6, 32 + (i % 2), 4, 14 - (i % 2), ['#c9b8ff', '#ff9d3d', '#7fe0d0', '#e84a4a'][i % 4])).join('')
      break
    case 'stars':
      s += Array.from({ length: 28 }, (_, i) => r((i * 37) % 158, (i * 23) % 62, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1, i % 3 === 0 ? '#fff3b0' : '#9ad1ff')).join('') + `<circle cx="132" cy="22" r="11" fill="#c97a4a"/><circle cx="128" cy="19" r="3" fill="#e0a070"/><rect x="118" y="21" width="28" height="2" fill="#ffd9a0" opacity="0.7"/>`
      break
    case 'city':
      s += r(8, 8, 144, 54, '#0b1230') + r(9, 9, 142, 52, '#27407a') + [14, 30, 46, 62, 80, 98, 114, 130].map((x, i) => r(x, 30 - ((i * 7) % 14), 12, 31 + ((i * 7) % 14), '#16224a') + r(x + 2, 34 - ((i * 7) % 14), 2, 2, accent) + r(x + 7, 40 - ((i * 7) % 14), 2, 2, accent)).join('') + r(80, 9, 1, 52, '#0b1230')
      break
    default:
      s += r(14, 16, 28, 22, '#16224a') + r(15, 17, 26, 20, '#27407a') + r(28, 17, 1, 20, '#16224a') + r(104, 16, 40, 24, shade(wall, 0.8)) + r(108, 20, 14, 6, accent) + r(126, 20, 14, 10, '#ffd34d')
  }
  return s
}

/** 책상과 모니터 */
function desk(): string {
  return (
    r(40, 66, 82, 6, OUTLINE) + r(41, 66, 80, 4, '#8a5a30') + r(41, 66, 80, 1, '#c98f55') + r(44, 72, 4, 24, '#6b4423') + r(114, 72, 4, 24, '#6b4423') +
    r(64, 46, 34, 20, OUTLINE) + r(65, 47, 32, 17, '#5fd1ff') + r(68, 50, 10, 2, '#fff') + r(80, 54, 12, 5, '#ffd34d') + r(78, 64, 6, 3, '#2b3250') +
    r(58, 62, 12, 3, '#2b3250') + r(86, 63, 6, 2, '#2b3250')
  )
}

/** 책상 소품 하나 (왼쪽 위 모서리 기준 약 22×22) */
export function deskProp(kind: string, x: number, y: number): string {
  switch (kind) {
    case 'plant':
      return r(x + 6, y + 13, 8, 7, '#b5651d') + r(x + 5, y + 12, 10, 2, '#8a4a14') + r(x + 9, y + 5, 2, 8, '#3a9d4a') + r(x + 4, y + 4, 6, 4, '#5ab26a') + r(x + 10, y + 2, 6, 4, '#5ab26a')
    case 'cactus':
      return r(x + 6, y + 14, 8, 6, '#b5651d') + r(x + 8, y + 3, 4, 12, '#3a9d4a') + r(x + 4, y + 7, 4, 2, '#3a9d4a') + r(x + 4, y + 5, 2, 4, '#3a9d4a') + r(x + 12, y + 8, 4, 2, '#3a9d4a') + r(x + 14, y + 6, 2, 4, '#3a9d4a') + r(x + 9, y + 3, 2, 1, '#ff7aa8')
    case 'lamp':
      return r(x + 7, y + 17, 8, 3, '#2b3250') + r(x + 10, y + 7, 2, 11, '#9aa1bd') + r(x + 4, y + 2, 12, 6, '#ffd34d') + r(x + 5, y + 3, 10, 2, '#fff3b0') + `<polygon points="${x + 4},${y + 8} ${x + 16},${y + 8} ${x + 20},${y + 20} ${x},${y + 20}" fill="#fff3b0" opacity="0.18"/>`
    case 'cat':
      return r(x + 4, y + 8, 12, 11, '#f1d9b5') + r(x + 3, y + 4, 4, 5, '#f1d9b5') + r(x + 13, y + 4, 4, 5, '#f1d9b5') + r(x + 6, y + 11, 2, 2, OUTLINE) + r(x + 12, y + 11, 2, 2, OUTLINE) + r(x + 9, y + 14, 2, 1, '#e84a4a') + r(x + 15, y + 15, 5, 3, '#f1d9b5')
    case 'figure':
      return r(x + 6, y + 17, 9, 3, '#2b3250') + r(x + 8, y + 9, 5, 8, '#e84a4a') + r(x + 7, y + 3, 7, 6, '#ffd9b3') + r(x + 6, y + 2, 9, 3, '#5b8cff') + r(x + 4, y + 10, 3, 2, '#ffd9b3') + r(x + 14, y + 10, 3, 2, '#ffd9b3')
    case 'rgb':
      return r(x, y + 15, 22, 4, '#2b3250') + ['#ff4d4d', '#ffb340', '#ffe94d', '#5ae06a', '#4dd2ff', '#7a86ff', '#c46bff'].map((c, i) => r(x + 1 + i * 3, y + 16, 3, 2, c)).join('')
    case 'trophy':
      return r(x + 6, y + 17, 10, 3, '#b8860b') + r(x + 10, y + 11, 2, 7, '#e6b422') + r(x + 5, y + 3, 12, 9, '#ffd34d') + r(x + 3, y + 5, 2, 4, '#e6b422') + r(x + 17, y + 5, 2, 4, '#e6b422') + r(x + 7, y + 4, 2, 6, '#fff3b0')
    case 'neon':
      return r(x - 2, y + 2, 24, 14, '#10162a') + text(x + 10, y + 13, 11, '#ff4dd2', 'GG', 900) + r(x - 2, y + 2, 24, 1, '#ff4dd2') + r(x - 2, y + 15, 24, 1, '#4dd2ff')
    case 'goods':
      return r(x, y + 17, 22, 3, '#6b4423') + r(x + 1, y + 8, 6, 9, '#ff7aa8') + r(x + 8, y + 5, 6, 12, '#7fe0d0') + r(x + 15, y + 9, 6, 8, '#ffd34d') + r(x + 3, y + 10, 2, 2, '#fff') + r(x + 10, y + 8, 2, 2, '#fff') + r(x + 17, y + 11, 2, 2, '#fff')
    default:
      return ''
  }
}

/** 명찰 */
function badgeTag(textStr: string, color: string, x: number, y: number): string {
  if (!textStr) return ''
  const w = Math.max(18, textStr.length * 6 + 6)
  return r(x - w / 2 - 1, y - 1, w + 2, 10, OUTLINE) + r(x - w / 2, y, w, 8, color) + r(x - w / 2, y, w, 1, shade(color, 1.3)) + text(x, y + 6.4, 5.4, '#fff', textStr, 900)
}

/** 장착한 상품 정의 */
function equippedDefs(state: Pick<GameState, 'equipped'>) {
  const e = equippedOf(state)
  return { room: cosmeticDef(e.room)!, desk: cosmeticDef(e.desk)!, outfit: cosmeticDef(e.outfit)!, badge: cosmeticDef(e.badge)! }
}

/** 장착한 의상의 스프라이트 모습 */
export function outfitLook(state: Pick<GameState, 'equipped' | 'genre'>): SpriteLook {
  const o = equippedDefs(state).outfit.art
  return playerLook(state, { shirt: o.shirt, pants: o.pants, headset: o.headset })
}

/** 내 방 장면 (장착한 상품 반영) */
export function roomSceneSvg(state: Pick<GameState, 'equipped' | 'genre'>): string {
  const d = equippedDefs(state)
  return (
    `<svg class="room-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100" shape-rendering="crispEdges" role="img" aria-label="내 방">` +
    backdrop(d.room.art) +
    desk() +
    deskProp(d.desk.art.kind, 104, 46) +
    placeSprite(outfitLook(state), 'stand', 30, 94, 46) +
    badgeTag(d.badge.art.text, d.badge.art.color, 30, 40) +
    '</svg>'
  )
}

/** 상품 카드의 작은 그림 */
export function itemArtSvg(def: CosmeticDef): string {
  const open = (vb: string) => `<svg class="item-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" shape-rendering="crispEdges" aria-hidden="true">`
  switch (def.slot) {
    case 'room':
      return open('0 0 160 100') + backdrop(def.art) + desk() + '</svg>'
    case 'desk':
      return open('-4 -2 30 28') + r(-4, 17, 30, 7, '#8a5a30') + deskProp(def.art.kind, 0, 0) + '</svg>'
    case 'outfit':
      return open('0 0 48 60') + r(0, 0, 48, 60, '#232944') + placeSprite({ shirt: def.art.shirt, pants: def.art.pants, headset: def.art.headset }, 'stand', 24, 57, 54) + '</svg>'
    default:
      return open('0 0 60 24') + r(0, 0, 60, 24, '#232944') + badgeTag(def.art.text || '없음', def.art.color, 30, 8) + '</svg>'
  }
}
