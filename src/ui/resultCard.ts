import genres from '../data/genres.json'
import { endingDef } from '../engine/endings.ts'
import { assetGrade } from '../engine/life.ts'
import { stageName } from '../engine/season.ts'
import type { GameState } from '../engine/state.ts'
import { bestStageOf } from '../save/storage.ts'
import { h } from './dom.ts'
import { endingSceneSvg } from './endingScenes.ts'
import { MODE_INFO } from './labels.ts'
import { openSheet } from './sheet.ts'

const W = 1080
const H = 1350
const SCENE_H = 675

/** SVG 문자열을 이미지로 읽는다 (캔버스에 그리기 위해) */
function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('엔딩 그림을 읽지 못했다'))
    }
    img.src = url
  })
}

/** 엔딩 결과 카드를 캔버스로 그린다 (1080×1350, 인스타 세로 비율) */
export async function drawResultCard(state: GameState): Promise<HTMLCanvasElement> {
  const id = state.finished
  if (!id) throw new Error('끝나지 않은 판이다')
  const def = endingDef(id)
  const font = getComputedStyle(document.body).fontFamily || 'sans-serif'

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 쓸 수 없다')

  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#1c2030')
  bg.addColorStop(1, '#12141c')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // 엔딩 그림: 도트가 번지지 않게 확대 보간을 끈다
  try {
    const scene = await loadSvg(endingSceneSvg(id))
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(scene, 0, 0, W, SCENE_H)
  } catch {
    ctx.fillStyle = '#232a47'
    ctx.fillRect(0, 0, W, SCENE_H)
  }
  ctx.strokeStyle = '#ffb740'
  ctx.lineWidth = 8
  ctx.strokeRect(4, 4, W - 8, SCENE_H - 8)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#9aa1bd'
  ctx.font = `600 34px ${font}`
  ctx.fillText('방구석 겜돌이에서 프로게이머되기', W / 2, SCENE_H + 60)

  ctx.fillStyle = '#ffb740'
  ctx.font = `900 76px ${font}`
  ctx.fillText(def.name, W / 2, SCENE_H + 150)

  ctx.fillStyle = '#eceef7'
  ctx.font = `600 40px ${font}`
  ctx.fillText(`${state.name} · ${genres[state.genre].name} · ${state.age}세`, W / 2, SCENE_H + 215)

  const best = stageName(bestStageOf(state))
  const rows: [string, string][] = [
    ['가장 높이 오른 곳', best],
    ['월드 챔피언십', state.worldTitles > 0 ? `우승 ${state.worldTitles}회` : state.worldAppearances > 0 ? `진출 ${state.worldAppearances}회` : '진출 없음'],
    ['최종 자산', assetGrade(state)],
    ['모드 · 시즌', `${MODE_INFO[state.mode].name} · ${state.season}시즌`],
  ]
  ctx.font = `500 34px ${font}`
  rows.forEach(([label, value], i) => {
    const y = SCENE_H + 290 + i * 56
    ctx.textAlign = 'left'
    ctx.fillStyle = '#9aa1bd'
    ctx.fillText(label, 150, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = '#eceef7'
    ctx.fillText(value, W - 150, y)
  })

  ctx.textAlign = 'center'
  ctx.fillStyle = '#5b8cff'
  ctx.font = `600 30px ${font}`
  ctx.fillText(location.host || 'paintochamps', W / 2, H - 30)
  return canvas
}

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))

/** 결과 카드 팝업: 미리보기와 이미지 저장·공유 버튼 */
export async function openResultCard(state: GameState): Promise<void> {
  let canvas: HTMLCanvasElement
  try {
    canvas = await drawResultCard(state)
  } catch {
    await openSheet<void>((close) => h('div', { class: 'stack-tight' }, h('p', { class: 'event-text' }, '결과 카드를 만들지 못했어요.'), h('button', { class: 'btn primary', onclick: () => close() }, '닫기')), { variant: 'info' })
    return
  }
  const fileName = `paintochamps-${state.name}.png`
  await openSheet<void>((close) => {
    const status = h('p', { class: 'muted small', 'aria-live': 'polite' }, '')
    canvas.className = 'result-card-img'
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', `${endingDef(state.finished!).name} 결과 카드`)
    const save = async () => {
      const blob = await toBlob(canvas)
      if (!blob) return void (status.textContent = '이미지를 만들지 못했어요.')
      const url = URL.createObjectURL(blob)
      const a = h('a', { href: url, download: fileName })
      document.body.append(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      status.textContent = '이미지를 저장했어요.'
    }
    const share = async () => {
      const blob = await toBlob(canvas)
      if (!blob) return void (status.textContent = '이미지를 만들지 못했어요.')
      const file = new File([blob], fileName, { type: 'image/png' })
      try {
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: '방구석 겜돌이에서 프로게이머되기' })
        else status.textContent = '이 기기에서는 공유를 지원하지 않아요. 이미지 저장을 써 주세요.'
      } catch {
        // 공유 창을 닫은 경우 등: 조용히 넘어간다
      }
    }
    return h(
      'div',
      { class: 'stack-tight' },
      h('p', { class: 'eyebrow' }, '결과 카드'),
      canvas,
      status,
      h('button', { class: 'btn primary', onclick: () => void save() }, '이미지로 저장'),
      typeof navigator.share === 'function' && h('button', { class: 'btn', onclick: () => void share() }, '공유하기'),
      h('button', { class: 'btn ghost small', onclick: () => close() }, '닫기'),
    )
  }, { variant: 'info' })
}
