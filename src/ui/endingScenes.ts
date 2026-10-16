import type { EndingId } from '../engine/state.ts'
import { OUTLINE, placeSprite, shade, type SpriteLook } from './sprite.ts'

/**
 * 엔딩 일러스트 (임시): 타이틀·계약 연출과 같은 도트 스타일의 SVG 장면 8장.
 * 에셋 파일 없이 코드로 그린 자리표시 그림이고, 퀄리티 있는 일러스트가 준비되면 이 파일 대신 이미지를 쓴다.
 * 필요한 장면 설명은 docs/ending-images.md. 좌표는 모두 160×100.
 */

export const SCENE_W = 160
export const SCENE_H = 100

const r = (x: number, y: number, w: number, h: number, c: string, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" ${extra}/>`

/** 윤곽선 + 윗면 하이라이트 + 아랫면 그림자가 있는 상자 */
function box(x: number, y: number, w: number, h: number, c: string): string {
  return r(x - 1, y - 1, w + 2, h + 2, OUTLINE) + r(x, y, w, h, c) + r(x, y, w, 1, shade(c, 1.28)) + r(x, y + h - 1, w, 1, shade(c, 0.78))
}

function person(x: number, foot: number, height: number, look: SpriteLook, pose: 'stand' | 'cheer' = 'stand'): string {
  return placeSprite(look, pose, x, foot, height)
}

function text(x: number, y: number, size: number, fill: string, s: string, weight = 700): string {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="middle" font-family="sans-serif" shape-rendering="auto">${s}</text>`
}

/** 시드가 고정된 색종이: 같은 장면은 늘 같은 모양이다 */
function confetti(n: number, palette: string[], yMax: number, seed = 1): string {
  let out = ''
  for (let i = 0; i < n; i++) {
    const x = (i * 37 + seed * 11) % SCENE_W
    const y = (i * 53 + seed * 7) % yMax
    out += r(x, y, i % 3 === 0 ? 1 : 2, i % 2 === 0 ? 2 : 3, palette[i % palette.length])
  }
  return out
}

/** 관중석: 색깔 점들이 줄지어 있다 */
function crowd(y0: number, rows: number, palette: string[], dim = 1): string {
  let out = ''
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i < 40; i++) {
      const c = palette[(i * 7 + row * 3) % palette.length]
      out += r(i * 4 + (row % 2) * 2, y0 + row * 5, 3, 4, shade(c, dim))
    }
  }
  return out
}

function trophy(cx: number, y: number): string {
  return (
    box(cx - 5, y + 17, 10, 3, '#b8860b') +
    box(cx - 1, y + 10, 3, 8, '#e6b422') +
    box(cx - 6, y, 12, 11, '#ffd34d') +
    r(cx - 9, y + 2, 3, 5, OUTLINE) +
    r(cx - 8, y + 3, 1, 3, '#ffd34d') +
    r(cx + 6, y + 2, 3, 5, OUTLINE) +
    r(cx + 7, y + 3, 1, 3, '#ffd34d') +
    r(cx - 4, y + 2, 2, 6, '#fff3b0')
  )
}

function beams(color: string, opacity: number): string {
  return [20, 55, 105, 140].map((x) => `<polygon points="${x},0 ${x + 14},0 ${x + 40},100 ${x - 26},100" fill="${color}" opacity="${opacity}"/>`).join('')
}

const SKIN_HAIR = { hair: '#7a4426' }

/** 엔딩 id → 장면 안쪽 SVG */
const SCENES: Record<EndingId, () => string> = {
  // 홈 경기장: 영구결번 유니폼, "영원한 에이스" 플래카드, 데뷔 때 유니폼 그대로 트로피를 든 선수
  hidden_loyal: () =>
    r(0, 0, 160, 100, '#241a3d') +
    beams('#ffd34d', 0.16) +
    crowd(40, 7, ['#ff6b6b', '#ffd34d', '#5fd1ff', '#ffffff', '#b980ff'], 0.55) +
    box(28, 6, 104, 18, '#ffcf4d') +
    text(80, 19, 10, '#5a3200', '영원한 에이스') +
    box(6, 14, 16, 24, '#4f8dff') +
    r(11, 20, 6, 10, '#ffffff') +
    text(14, 30, 9, '#4f8dff', '1') +
    box(138, 14, 16, 24, '#4f8dff') +
    r(143, 20, 6, 10, '#ffffff') +
    text(146, 30, 9, '#4f8dff', '1') +
    r(0, 78, 160, 22, '#2e8b57') +
    r(0, 78, 160, 2, '#46b073') +
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => r(i * 22, 80, 11, 20, '#349462')).join('') +
    confetti(46, ['#ffd34d', '#ffffff', '#ff8fb3', '#5fd1ff'], 70, 3) +
    trophy(80, 26) +
    person(80, 96, 44, { shirt: '#4f8dff', ...SKIN_HAIR }, 'cheer'),

  // 월드 결승 무대: 금빛 폭죽과 우승 트로피, 환호하는 팀원들
  legend: () =>
    r(0, 0, 160, 100, '#101a3a') +
    beams('#fff3b0', 0.14) +
    box(24, 6, 112, 28, '#0b1230') +
    r(28, 10, 104, 20, '#1b2e6b') +
    `<polygon points="80,12 83,20 91,20 85,25 87,33 80,28 73,33 75,25 69,20 77,20" fill="#ffd34d"/>` +
    crowd(52, 4, ['#ffd34d', '#ffffff', '#5fd1ff', '#ff8fb3'], 0.5) +
    r(0, 78, 160, 22, '#2a2f5a') +
    box(58, 74, 44, 20, '#ffd34d') +
    box(14, 80, 36, 14, '#c9d3ff') +
    box(110, 80, 36, 14, '#e0a96d') +
    person(32, 80, 36, { shirt: '#ff7ab6', hair: '#3a2a20' }, 'cheer') +
    person(128, 80, 36, { shirt: '#7ad1ff', hair: '#5a3a2a' }, 'cheer') +
    person(80, 74, 42, { shirt: '#ffcf4d', ...SKIN_HAIR }, 'cheer') +
    trophy(80, 8) +
    confetti(90, ['#ffd34d', '#ffffff', '#ff8fb3', '#5fd1ff', '#9dff9d'], 90, 5),

  // 결승 뒤의 무대: 은메달을 건 선수, 환호하는 우승팀, 박수 치는 관중
  world_finalist: () =>
    r(0, 0, 160, 100, '#1b2238') +
    beams('#c9d3ff', 0.12) +
    crowd(46, 5, ['#9aa1bd', '#c9d3ff', '#5fd1ff', '#ffffff'], 0.45) +
    r(0, 78, 160, 22, '#2a3150') +
    box(60, 76, 40, 18, '#c9d3ff') +
    person(24, 82, 30, { shirt: '#ff6b6b', hair: '#3a2a20' }, 'cheer') +
    person(46, 82, 30, { shirt: '#ff6b6b', hair: '#5a3a2a' }, 'cheer') +
    person(116, 82, 30, { shirt: '#ff6b6b', hair: '#222222' }, 'cheer') +
    person(138, 82, 30, { shirt: '#ff6b6b', hair: '#7a4426' }, 'cheer') +
    confetti(30, ['#ff6b6b', '#ffffff', '#ffd34d'], 60, 2) +
    person(80, 76, 42, { shirt: '#4f8dff', ...SKIN_HAIR }) +
    `<circle cx="80" cy="58" r="3.4" fill="#e8ecff" stroke="${OUTLINE}" stroke-width="1"/>` +
    r(78, 50, 4, 5, '#4f8dff'),

  // 은퇴식: 꽃다발, 응원봉, 전광판의 "수고했어요"
  pro1_regular: () =>
    r(0, 0, 160, 100, '#f2a25f') +
    r(0, 0, 160, 40, '#f7c27a') +
    box(30, 6, 100, 24, '#1f2747') +
    text(80, 23, 11, '#ffe9a8', '수고했어요') +
    crowd(44, 4, ['#6b3a2a', '#8a4a35', '#a55a3d'], 1) +
    [...Array(26)].map((_, i) => r(4 + i * 6, 40 + (i % 3) * 3, 1, 8, ['#ff4f9a', '#4fd0ff', '#ffe14f'][i % 3])).join('') +
    r(0, 76, 160, 24, '#c98f55') +
    r(0, 76, 160, 2, '#e2b27a') +
    person(80, 92, 46, { shirt: '#4f8dff', ...SKIN_HAIR }) +
    box(70, 74, 8, 8, '#ff6fa5') +
    box(76, 70, 8, 8, '#ffd34d') +
    box(82, 74, 8, 8, '#ff9f4d') +
    r(76, 78, 8, 6, '#5fbf6a'),

  // 2부 리그 대기실: 낡은 장비, 후배들의 인사, 벽의 오랜 사진
  pro2_veteran: () =>
    r(0, 0, 160, 100, '#8f9fb8') +
    r(0, 64, 160, 36, '#6d5a47') +
    r(0, 64, 160, 2, '#8a7560') +
    box(4, 12, 24, 50, '#5f7aa3') +
    box(32, 12, 24, 50, '#5f7aa3') +
    r(8, 18, 16, 2, '#3d5373') +
    r(36, 18, 16, 2, '#3d5373') +
    box(104, 14, 14, 18, '#f3e3b0') +
    box(122, 14, 14, 18, '#f3e3b0') +
    box(140, 14, 14, 18, '#f3e3b0') +
    r(107, 18, 8, 10, '#8fb0d9') +
    r(125, 18, 8, 10, '#d9a98f') +
    r(143, 18, 8, 10, '#a8d98f') +
    box(66, 62, 54, 10, '#8a6a43') +
    box(76, 56, 26, 6, '#cfcfd6') +
    r(78, 58, 22, 1, '#8a8a95') +
    box(108, 58, 8, 4, '#cfcfd6') +
    person(22, 94, 32, { shirt: '#7ad1ff', hair: '#3a2a20' }, 'cheer') +
    person(138, 94, 32, { shirt: '#ffb86b', hair: '#5a3a2a' }, 'cheer') +
    person(82, 94, 44, { shirt: '#4f8dff', hair: '#6a5a50' }),

  // 코치석: 전술판을 가리키는 코치, 연습 중인 팀원들
  coach: () =>
    r(0, 0, 160, 100, '#cfe3f7') +
    r(0, 70, 160, 30, '#4f7fb3') +
    r(0, 70, 160, 2, '#6a9ad0') +
    box(10, 8, 62, 44, '#2d6b4a') +
    r(14, 12, 54, 36, '#357c56') +
    text(26, 28, 10, '#ffffff', '✕') +
    text(44, 38, 10, '#ffe14f', '○') +
    text(58, 24, 10, '#ffffff', '✕') +
    `<path d="M24 40 Q40 22 58 28" stroke="#ffe14f" stroke-width="1" fill="none" stroke-dasharray="2 2"/>` +
    box(92, 44, 26, 3, '#2b3250') +
    box(94, 28, 22, 16, '#3a4268') +
    r(97, 31, 16, 10, '#5fd1ff') +
    box(124, 44, 26, 3, '#2b3250') +
    box(126, 28, 22, 16, '#3a4268') +
    r(129, 31, 16, 10, '#9dff9d') +
    person(105, 46, 26, { shirt: '#ff7ab6', hair: '#3a2a20', headset: '#444a6a' }) +
    person(137, 46, 26, { shirt: '#ffcf4d', hair: '#5a3a2a', headset: '#444a6a' }) +
    person(78, 92, 46, { shirt: '#2b3250', hair: '#6a5a50', pants: '#2b3250' }) +
    r(64, 72, 12, 2, OUTLINE),

  // 방송 세팅: 네온 조명, 링라이트, 채팅창과 후원 하트
  streamer: () =>
    r(0, 0, 160, 100, '#1a1038') +
    r(0, 0, 160, 3, '#ff4fd8') +
    r(0, 97, 160, 3, '#4fd0ff') +
    r(0, 3, 3, 94, '#b980ff') +
    r(157, 3, 3, 94, '#b980ff') +
    box(104, 10, 46, 62, '#14102a') +
    [0, 1, 2, 3, 4, 5, 6].map((i) => r(108, 14 + i * 8, 14 + ((i * 7) % 24), 2, ['#ff8fb3', '#5fd1ff', '#ffd34d', '#9dff9d'][i % 4]) + r(108, 17 + i * 8, 28 - ((i * 5) % 14), 2, '#6a5f9a')).join('') +
    `<circle cx="38" cy="30" r="14" fill="none" stroke="#fff3b0" stroke-width="3"/><circle cx="38" cy="30" r="14" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.7"/>` +
    box(35, 28, 6, 5, '#2b3250') +
    r(37, 34, 2, 40, '#555b7a') +
    r(30, 74, 16, 2, '#555b7a') +
    box(52, 62, 46, 4, '#2b3250') +
    box(58, 46, 34, 16, '#3a4268') +
    r(61, 49, 28, 10, '#b980ff') +
    person(76, 70, 44, { shirt: '#ff7ab6', hair: '#3a2a20', headset: '#ffd34d' }, 'cheer') +
    text(96, 28, 14, '#ff5fa0', '♥') +
    text(122, 80, 12, '#ff5fa0', '♥') +
    text(20, 66, 10, '#ffd34d', '★') +
    text(130, 90, 10, '#5fd1ff', '★') +
    confetti(26, ['#ff4fd8', '#4fd0ff', '#ffd34d'], 90, 4),

  // 퇴근 후 방: 노을, 게임 화면, 선반 위 옛 대회 트로피와 사진
  hobbyist: () =>
    r(0, 0, 160, 100, '#f6b57a') +
    r(0, 0, 160, 34, '#ffd89a') +
    box(96, 8, 50, 34, '#ff9f5a') +
    r(98, 10, 46, 14, '#ffd27a') +
    r(98, 24, 46, 16, '#ff7f50') +
    r(119, 8, 2, 34, OUTLINE) +
    `<circle cx="112" cy="30" r="7" fill="#fff0a8"/>` +
    r(0, 70, 160, 30, '#a56b3c') +
    r(0, 70, 160, 2, '#c98f55') +
    box(8, 28, 70, 3, '#7a4f2a') +
    box(14, 14, 10, 14, '#f3e3b0') +
    r(16, 17, 6, 8, '#8fb0d9') +
    box(28, 18, 16, 10, '#f3e3b0') +
    r(30, 20, 12, 6, '#d9a98f') +
    box(52, 8, 8, 9, '#ffd34d') +
    box(50, 17, 12, 11, '#e6b422') +
    box(26, 62, 88, 6, '#8a5a30') +
    box(34, 68, 4, 30, '#8a5a30') +
    box(102, 68, 4, 30, '#8a5a30') +
    box(60, 40, 40, 22, '#2b3250') +
    r(63, 43, 34, 16, '#5fd1ff') +
    r(66, 46, 10, 3, '#ffffff') +
    r(80, 50, 12, 6, '#ffd34d') +
    box(76, 62, 8, 2, '#2b3250') +
    person(130, 94, 40, { shirt: '#9aa1bd', hair: '#7a4426', headset: '#444a6a' }),
}

/** 엔딩 id의 장면을 SVG 문자열로 (viewBox 160×100) */
export function endingSceneSvg(id: EndingId): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCENE_W} ${SCENE_H}" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${SCENES[id]()}</svg>`
}
