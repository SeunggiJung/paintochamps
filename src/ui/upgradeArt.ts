/**
 * 장비·시설의 단계별 도트 그림. 에셋 파일 없이 SVG로 그리고, 단계가 오르면 색 등급(회색→동→강철→금→네온)이 바뀌며
 * 모니터·팬·집 같은 부품이 늘어난다. 0단계는 흐린 자리표시 그림이다.
 */
import type { EquipmentId, FacilityId } from '../engine/state.ts'

export type UpgradeKind = EquipmentId | FacilityId

interface Tier {
  main: string
  light: string
  dark: string
}

const TIERS: Tier[] = [
  { main: '#8b8f99', light: '#b9bdc7', dark: '#4d515b' },
  { main: '#c07a3a', light: '#e3a465', dark: '#7a4a1f' },
  { main: '#5f93d6', light: '#9cc3f0', dark: '#2f5a94' },
  { main: '#f0be3c', light: '#ffe48a', dark: '#a8771a' },
  { main: '#a95cff', light: '#d6a8ff', dark: '#5f2aa8' },
]

/** 단계 → 색 등급(0~4) */
function tierOf(level: number, max: number): Tier {
  const i = Math.min(TIERS.length - 1, Math.max(0, Math.ceil((Math.max(1, level) * TIERS.length) / max) - 1))
  return TIERS[i]
}

const r = (x: number, y: number, w: number, h: number, fill: string, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`
const rgb = (x: number, y: number, w: number, h: number) => r(x, y, w, h, '#ff3b3b', 'class="rgb"')

function keyboard(l: number, t: Tier): string {
  let s = r(3, 12, 26, 13, t.dark) + r(4, 13, 24, 11, t.main)
  for (let row = 0; row < 3; row++) for (let c = 0; c < 6; c++) s += r(5 + c * 4, 14 + row * 3, 3, 2, t.light)
  s += r(8, 22, 16, 1, t.light)
  if (l >= 5) s += rgb(3, 25, 26, 1)
  if (l >= 9) s += rgb(3, 11, 26, 1)
  return s
}

function mouse(l: number, t: Tier): string {
  let s = ''
  if (l < 7) s += r(15, 2, 2, 7, t.dark)
  s += `<rect x="10" y="8" width="12" height="18" rx="5" fill="${t.dark}"/><rect x="11" y="9" width="10" height="16" rx="4" fill="${t.main}"/>`
  s += r(15, 9, 2, 6, t.dark) + r(15, 10, 2, 3, t.light)
  if (l >= 3) s += r(9, 15, 2, 4, t.light)
  if (l >= 5) s += rgb(11, 24, 10, 1)
  if (l >= 7) s += r(15, 3, 2, 2, t.light) + r(13, 5, 6, 1, t.light)
  if (l >= 9) s += rgb(11, 9, 1, 14) + rgb(20, 9, 1, 14)
  return s
}

function monitor(l: number, t: Tier): string {
  const n = l >= 8 ? 3 : l >= 4 ? 2 : 1
  const w = n === 1 ? 24 : n === 2 ? 13 : 9
  const total = n * w + (n - 1)
  const x0 = Math.floor((32 - total) / 2)
  let s = ''
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (w + 1)
    s += r(x, 6, w, 15, t.dark) + r(x + 1, 7, w - 2, 13, '#111a2c')
    s += r(x + 2, 9, Math.max(2, w - 6), 1, t.light) + r(x + 2, 12, Math.max(2, w - 8), 1, t.main) + r(x + 2, 15, Math.max(2, w - 5), 1, t.light)
    s += r(x + Math.floor(w / 2) - 1, 21, 2, 3, t.dark)
  }
  s += r(11, 24, 10, 2, t.dark)
  if (l >= 6) s += rgb(x0, 21, total, 1)
  return s
}

function pc(l: number, t: Tier): string {
  const fans = l >= 8 ? 3 : l >= 4 ? 2 : 1
  let s = r(9, 3, 14, 26, t.dark) + r(10, 4, 12, 24, l >= 5 ? '#1a2238' : t.main)
  for (let i = 0; i < fans; i++) {
    const cy = fans === 1 ? 14 : 8 + i * (fans === 2 ? 8 : 6)
    s += `<circle cx="16" cy="${cy}" r="${fans === 3 ? 2.6 : 3.4}" fill="${t.dark}"/>`
    s += `<circle cx="16" cy="${cy}" r="1" fill="${t.light}" class="spin"/>`
  }
  s += r(12, 25, 8, 1, t.light) + r(20, 5, 1, 1, '#5dff8a')
  if (l >= 7) s += rgb(10, 27, 12, 1) + rgb(10, 4, 1, 24)
  if (l >= 9) s += rgb(21, 4, 1, 24)
  return s
}

function housing(l: number, t: Tier): string {
  const w = 12 + l * 2
  const hgt = 7 + l * 2
  const x = 16 - w / 2
  const top = 28 - hgt
  let s = r(x, top, w, hgt, t.main) + r(x, top, w, 1, t.light)
  s += `<polygon points="${x - 2},${top} ${16},${top - 6} ${x + w + 2},${top}" fill="${t.dark}"/>`
  s += r(14, 22, 4, 6, t.dark)
  const winRows = l >= 4 ? 2 : 1
  for (let row = 0; row < winRows; row++) {
    const wy = top + 3 + row * 6
    if (wy + 3 > 21) continue
    s += r(x + 2, wy, 3, 3, '#ffe9a0') + r(x + w - 5, wy, 3, 3, '#ffe9a0')
  }
  if (l >= 3) s += r(x + w - 4, top - 6, 2, 5, t.dark)
  if (l >= 5) s += r(16, top - 11, 1, 6, t.light) + r(17, top - 11, 4, 3, '#ff4d4d')
  return s
}

function coach(l: number, t: Tier): string {
  let s = r(11, 14, 10, 12, t.main) + r(11, 14, 10, 2, t.light) + r(12, 26, 3, 4, t.dark) + r(17, 26, 3, 4, t.dark)
  s += r(12, 6, 8, 8, '#f2c9a0') + r(13, 9, 2, 2, '#222') + r(17, 9, 2, 2, '#222')
  s += r(11, 4, 10, 3, t.dark) + r(11, 6, 12, 1, t.dark)
  s += r(20, 16, 2, 5, t.light) + r(12, 17, 4, 1, '#fff')
  if (l >= 2) s += r(21, 18, 6, 8, '#f4f1e6') + r(22, 20, 4, 1, '#888') + r(22, 22, 4, 1, '#888')
  for (let i = 0; i < l; i++) s += r(5 + i * 5, 1, 3, 3, '#ffd34d')
  return s
}

function medic(l: number, t: Tier): string {
  let s = r(5, 11, 22, 16, t.dark) + r(6, 12, 20, 14, t.main) + r(12, 8, 8, 3, t.dark)
  s += r(14, 14, 4, 10, '#fff') + r(11, 17, 10, 4, '#fff')
  if (l >= 2) s += r(7, 14, 3, 1, '#fff') + r(22, 14, 3, 1, '#fff') + r(7, 23, 3, 1, '#ffd0d0') + r(22, 23, 3, 1, '#ffd0d0')
  if (l >= 3) s += r(10, 4, 12, 1, '#ffd34d') + r(10, 2, 2, 2, '#ffd34d') + r(15, 1, 2, 3, '#ffd34d') + r(20, 2, 2, 2, '#ffd34d')
  return s
}

function pr(l: number, t: Tier): string {
  let s = `<polygon points="6,12 18,6 18,24 6,18" fill="${t.main}"/><polygon points="6,12 18,6 18,9 6,14" fill="${t.light}"/>`
  s += r(3, 12, 4, 6, t.dark) + r(8, 19, 3, 6, t.dark)
  for (let i = 0; i < l; i++) {
    const x = 20 + i * 2
    const hh = 4 + i * 3
    s += r(x, 15 - hh / 2, 1, hh, i % 2 ? t.light : '#fff')
  }
  return s
}

const DRAW: Record<UpgradeKind, (l: number, t: Tier) => string> = { keyboard, mouse, monitor, pc, housing, coach, medic, pr }

/** 단계별 그림(SVG 문자열). level 0이면 흐린 자리표시. 부모에서 크기를 CSS로 정한다. */
export function upgradeArtSvg(kind: UpgradeKind, level: number, max: number): string {
  const shown = Math.max(1, level)
  const body = DRAW[kind](shown, tierOf(shown, max))
  const pips = Array.from({ length: max }, (_, i) => r(Math.floor((32 - max * 3) / 2) + i * 3, 30, 2, 1, i < level ? '#ffd34d' : '#3a4256')).join('')
  return `<svg viewBox="0 0 32 32" shape-rendering="crispEdges" class="upg-svg${level <= 0 ? ' empty' : ''}" aria-hidden="true"><g>${body}</g>${pips}</svg>`
}

export function upgradeArt(kind: UpgradeKind, level: number, max: number, cls = ''): HTMLElement {
  const el = document.createElement('div')
  el.className = `upg-art ${cls}`.trim()
  el.innerHTML = upgradeArtSvg(kind, level, max)
  return el
}
