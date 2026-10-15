/**
 * 도트 캐릭터 스프라이트 생성기 (메이플스토리풍 2.5등신).
 * 큰 머리와 단순한 점 눈, 굵은 눈썹, 윤기 나는 머리카락을 도형으로 그린 뒤
 * 진한 갈색 윤곽선과 음영(아래·오른쪽은 어둡게, 위·왼쪽은 밝게)을 자동으로 입혀 SVG 사각형으로 만든다.
 * 같은 설정이면 늘 같은 그림이고, 에셋 파일이 없다.
 */

type Grid = (string | null)[][]

export const SPRITE_W = 32
export const SPRITE_H = 42

export interface SpriteLook {
  /** 셔츠 색 */
  shirt: string
  hair?: string
  pants?: string
  skin?: string
  /** 헤드셋 색 (있으면 머리에 씌운다) */
  headset?: string
}

export type SpritePose = 'stand' | 'cheer'

/** 윤곽선 색: 순검정이 아니라 진한 갈색이라 따뜻해 보인다 */
export const OUTLINE = '#3b2418'

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function toHex([r, g, b]: [number, number, number]): string {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${f(r)}${f(g)}${f(b)}`
}
/** 색을 어둡게(f<1)·밝게(f>1) */
export function shade(c: string, f: number): string {
  const [r, g, b] = hex(c)
  return f < 1 ? toHex([r * f, g * f, b * f]) : toHex([r + (255 - r) * (f - 1), g + (255 - g) * (f - 1), b + (255 - b) * (f - 1)])
}

const blank = (): Grid => Array.from({ length: SPRITE_H }, () => Array<string | null>(SPRITE_W).fill(null))

/** 위쪽 여백(윤곽선·머리 삐침용)만큼 모든 y를 내려서 그린다 */
const OY = 2

function makePainter(g: Grid) {
  const put = (x: number, y: number, c: string | null) => {
    const yy = y + OY
    if (x >= 0 && yy >= 0 && x < SPRITE_W && yy < SPRITE_H) g[yy][x] = c
  }
  const get = (x: number, y: number) => (x >= 0 && y + OY >= 0 && x < SPRITE_W && y + OY < SPRITE_H ? g[y + OY][x] : null)
  const rect = (x: number, y: number, w: number, h: number, c: string | null) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c)
  }
  const ellipse = (cx: number, cy: number, rx: number, ry: number, c: string | null) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx
        const dy = (y + 0.5 - cy) / ry
        if (dx * dx + dy * dy <= 1) put(x, y, c)
      }
  }
  const line = (x0: number, y0: number, x1: number, y1: number, t: number, c: string) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2
    for (let i = 0; i <= steps; i++) rect(Math.round(x0 + ((x1 - x0) * i) / steps - t / 2), Math.round(y0 + ((y1 - y0) * i) / steps - t / 2), t, t, c)
  }
  return { put, get, rect, ellipse, line }
}

/** 앞머리가 내려오는 y(열마다, x=6..26): 가운데 가르마에서 양옆으로 쓸어내린 모양 */
const FRINGE = [15, 15, 14, 13, 13, 13, 12, 12, 11, 10, 11, 11, 12, 13, 13, 13, 13, 14, 15, 15, 15]

function drawBody(g: Grid, look: Required<SpriteLook>, pose: SpritePose) {
  const { put, get, rect, ellipse, line } = makePainter(g)
  const { shirt, hair, pants, skin } = look
  const skinDark = shade(skin, 0.86)
  const hairLight = shade(hair, 1.55)

  // 귀와 얼굴 (머리가 몸의 절반 이상인 2.5등신)
  rect(4, 14, 2, 4, skin)
  rect(26, 14, 2, 4, skin)
  ellipse(16, 14, 11.2, 9.8, skin)

  // 머리카락: 둥근 덩어리 + 옆머리 + 앞머리 + 삐침
  ellipse(16, 11, 12, 9.2, hair)
  rect(4, 12, 3, 8, hair)
  rect(25, 12, 3, 8, hair)
  FRINGE.forEach((bottom, i) => {
    const x = 6 + i
    for (let y = bottom + 1; y < 22; y++) if (get(x, y) === hair && x > 6 && x < 26) put(x, y, Math.hypot(x + 0.5 - 16, y + 0.5 - 14) <= 11.2 ? skin : null)
  })
  rect(14, 1, 4, 2, hair)
  rect(15, 0, 2, 1, hair)
  rect(20, 2, 3, 1, hair)
  rect(9, 2, 3, 1, hair)
  // 윤기: 머리 위쪽에 밝은 띠
  for (const [x, y] of [[9, 6], [10, 5], [11, 4], [12, 4], [13, 4], [14, 3], [15, 3], [19, 4], [20, 5], [21, 6], [8, 8], [9, 9]]) if (get(x, y) === hair) put(x, y, hairLight)
  rect(9, 12, 2, 1, shade(hair, 0.8))
  rect(21, 12, 2, 1, shade(hair, 0.8))

  // 눈: 작고 단순한 점 눈 + 하이라이트 한 점, 굵은 눈썹 (남성 캐릭터 느낌), 볼터치 없음
  for (const ex of [11, 19]) {
    rect(ex, 16, 2, 3, '#1b1410')
    put(ex, 16, '#ffffff')
  }
  const brow = shade(hair, 0.65)
  rect(10, 14, 4, 1, brow)
  put(13, 13, brow)
  rect(18, 14, 4, 1, brow)
  put(18, 13, brow)
  // 입
  if (pose === 'cheer') {
    rect(14, 21, 5, 2, '#6a1f28')
    rect(15, 22, 3, 1, '#d9606a')
  } else {
    rect(15, 21, 3, 1, '#a94f45')
  }

  // 헤드셋: 머리 위를 지나는 띠와 양쪽 귀 덮개
  if (look.headset) {
    for (let t = Math.PI; t <= 2 * Math.PI; t += 0.05) put(Math.round(16 + 11.6 * Math.cos(t)), Math.round(11 + 9.8 * Math.sin(t)), look.headset)
    rect(2, 13, 3, 6, look.headset)
    rect(27, 13, 3, 6, look.headset)
    rect(4, 18, 5, 1, shade(look.headset, 0.8))
  }

  // 목, 몸통(짧고 통통하게), 팔, 다리, 신발
  rect(14, 24, 4, 1, skinDark)
  rect(11, 25, 10, 7, shirt)
  rect(12, 24, 8, 1, shirt)
  rect(15, 24, 2, 1, '#ffffff')
  rect(14, 25, 4, 1, shade(shirt, 1.4))
  rect(15, 28, 2, 2, shade(shirt, 1.45))
  rect(12, 31, 8, 1, shade(shirt, 0.85))
  if (pose === 'cheer') {
    line(11, 27, 6, 21, 3, shirt)
    line(6, 21, 5, 16, 3, skin)
    ellipse(5, 14, 2.4, 2.4, skin)
    line(21, 27, 26, 21, 3, shirt)
    line(26, 21, 27, 16, 3, skin)
    ellipse(27, 14, 2.4, 2.4, skin)
  } else {
    rect(8, 26, 3, 4, shirt)
    rect(8, 30, 3, 3, skin)
    rect(21, 26, 3, 4, shirt)
    rect(21, 30, 3, 3, skin)
  }
  rect(12, 32, 3, 3, pants)
  rect(17, 32, 3, 3, pants)
  rect(11, 35, 5, 2, '#f4f4fa')
  rect(17, 35, 5, 2, '#f4f4fa')
  rect(11, 36, 5, 1, '#9a9ab0')
  rect(17, 36, 5, 1, '#9a9ab0')
}

/** 윤곽선과 음영을 입힌다 */
function finish(g: Grid): Grid {
  const out = blank()
  for (let y = 0; y < SPRITE_H; y++)
    for (let x = 0; x < SPRITE_W; x++) {
      const c = g[y][x]
      if (!c) continue
      const up = y > 0 ? g[y - 1][x] : null
      const left = x > 0 ? g[y][x - 1] : null
      const down = y < SPRITE_H - 1 ? g[y + 1][x] : null
      const right = x < SPRITE_W - 1 ? g[y][x + 1] : null
      out[y][x] = !down || !right ? shade(c, 0.82) : !up || !left ? shade(c, 1.1) : c
    }
  for (let y = 0; y < SPRITE_H; y++)
    for (let x = 0; x < SPRITE_W; x++) {
      if (out[y][x]) continue
      const near = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => {
        const nx = x + dx
        const ny = y + dy
        return nx >= 0 && ny >= 0 && nx < SPRITE_W && ny < SPRITE_H && g[ny][nx]
      })
      if (near) out[y][x] = OUTLINE
    }
  return out
}

const cache = new Map<string, string>()

/** 스프라이트를 SVG 사각형 묶음(문자열)으로 만든다. 좌표는 0~SPRITE_W × 0~SPRITE_H. */
export function spriteMarkup(look: SpriteLook, pose: SpritePose = 'stand'): string {
  const full: Required<SpriteLook> = { hair: '#7a4426', pants: '#3a4a8a', skin: '#ffd9b3', headset: '', ...look }
  const key = `${full.shirt}|${full.hair}|${full.pants}|${full.skin}|${full.headset}|${pose}`
  const hit = cache.get(key)
  if (hit) return hit
  const g = blank()
  drawBody(g, full, pose)
  const done = finish(g)
  // 가로로 같은 색이 이어지면 하나의 사각형으로 합친다
  const rects: string[] = []
  for (let y = 0; y < SPRITE_H; y++) {
    let x = 0
    while (x < SPRITE_W) {
      const c = done[y][x]
      if (!c) {
        x++
        continue
      }
      let w = 1
      while (x + w < SPRITE_W && done[y][x + w] === c) w++
      rects.push(`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`)
      x += w
    }
  }
  const svg = rects.join('')
  cache.set(key, svg)
  return svg
}

/** 장면에 놓을 캐릭터: (x, footY)는 발 밑 중앙, height는 화면에서의 키(SVG 단위) */
export function placeSprite(look: SpriteLook, pose: SpritePose, x: number, footY: number, height: number, cls = ''): string {
  const s = height / (SPRITE_H - 3)
  return `<g class="${cls}" transform="translate(${(x - 16 * s).toFixed(2)} ${(footY - (SPRITE_H - 3) * s).toFixed(2)}) scale(${s.toFixed(3)})">${spriteMarkup(look, pose)}</g>`
}
