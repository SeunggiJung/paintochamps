import { createRng } from '../engine/rng.ts'
import { hashId } from '../engine/field.ts'
import { h } from './dom.ts'

/** 팀 이름에서 정해지는 고유 색상(0~359) */
export function teamHue(teamId: string): number {
  // 하위 비트는 비슷한 이름끼리 몰려서, 곱해서 섞은 뒤 쓴다
  return Math.floor(((Math.imul(hashId(teamId), 2654435761) >>> 0) / 4294967296) * 360)
}

/** 아이콘 한 변의 도트 수 */
const GRID = 8

/**
 * 팀 아이콘의 도트 칸들. 8×8 좌우 대칭 무늬를 팀 id로 정하고 두 가지 색(주색·보조색)을 섞는다.
 * 같은 id는 항상 같은 아이콘이다.
 */
export function teamIconCells(teamId: string): { x: number; y: number; accent: boolean }[] {
  const rng = createRng(hashId(teamId))
  const cells: { x: number; y: number; accent: boolean }[] = []
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID / 2; x++) {
      // 가운데로 갈수록, 위쪽일수록 조금 더 채워서 방패·문장 같은 실루엣이 되게 한다
      const fill = 0.35 + 0.35 * (x / (GRID / 2 - 1)) + (y < 2 ? 0.1 : 0)
      if (rng() < fill) {
        const accent = rng() < 0.28
        cells.push({ x, y, accent }, { x: GRID - 1 - x, y, accent })
      } else rng()
    }
  }
  return cells
}

/** svg 안에 넣을 사각형들 (cell: 한 칸 크기, ox·oy: 왼쪽 위 좌표) */
export function teamIconMarkup(teamId: string, cell: number, ox = 0, oy = 0): string {
  const hue = teamHue(teamId)
  const main = `hsl(${hue} 72% 60%)`
  const accent = `hsl(${(hue + 55) % 360} 85% 72%)`
  return teamIconCells(teamId)
    .map((c) => `<rect x="${ox + c.x * cell}" y="${oy + c.y * cell}" width="${cell}" height="${cell}" fill="${c.accent ? accent : main}"/>`)
    .join('')
}

/** 팀 아이콘 요소 (정사각형 도트, 크기 px) */
export function teamIcon(teamId: string, size = 36): HTMLElement {
  const hue = teamHue(teamId)
  const el = h('span', { class: 'team-icon', 'aria-hidden': 'true', style: `width:${size}px;height:${size}px` })
  el.innerHTML =
    `<svg viewBox="0 0 ${GRID + 2} ${GRID + 2}" width="${size}" height="${size}" shape-rendering="crispEdges">` +
    `<rect width="${GRID + 2}" height="${GRID + 2}" rx="1" fill="hsl(${hue} 40% 18%)"/>` +
    `<rect x=".5" y=".5" width="${GRID + 1}" height="${GRID + 1}" fill="none" stroke="hsl(${hue} 60% 45%)" stroke-width="1"/>` +
    teamIconMarkup(teamId, 1, 1, 1) +
    `</svg>`
  return el
}

export { GRID as TEAM_ICON_GRID }
