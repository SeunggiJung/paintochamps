import { h } from './dom.ts'

/**
 * 팝업 종류.
 * - decision·result: 아래에서 올라오는 시트. 바깥을 눌러도 안 닫힌다.
 * - info: 큰 아래 시트. ✕·바깥·손잡이 끌기로 닫힌다.
 * - center: 화면 가운데 카드(대회 결과).
 * - cinema: 전체 화면 연출.
 */
export type SheetVariant = 'decision' | 'result' | 'info' | 'center' | 'cinema'

export interface SheetOptions {
  variant?: SheetVariant
  /** 옛 옵션: variant가 없을 때 false면 decision, 아니면 center */
  center?: boolean
  autofocus?: boolean
  /** cinema의 왼쪽 위 칩 글자 */
  title?: string
}

/** 손잡이를 이만큼 아래로 끌면 정보 시트가 닫힌다 */
const DRAG_CLOSE_PX = 80

/**
 * 화면 위에 뜨는 팝업. build가 만든 내용을 보여 주고, close(값)을 부르면 닫히면서 그 값으로 resolve된다.
 * info는 ✕·바깥·끌기로 닫히며 값 없이(undefined) resolve된다.
 */
export function openSheet<T>(build: (close: (value: T) => void) => HTMLElement, options: SheetOptions = {}): Promise<T> {
  return new Promise((resolve) => {
    const variant: SheetVariant = options.variant ?? (options.center === false ? 'decision' : 'center')
    const previous = document.activeElement as HTMLElement | null
    const overlay = h('div', { class: `overlay ${variant}` })
    const close = (value: T) => {
      overlay.remove()
      previous?.focus?.()
      resolve(value)
    }
    const dismiss = () => close(undefined as T)
    const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' })
    if (variant === 'info') {
      const grab = h('div', { class: 'sheet-grab' }, h('span', {}))
      let startY: number | null = null
      grab.addEventListener('pointerdown', (e) => {
        startY = e.clientY
      })
      grab.addEventListener('pointermove', (e) => {
        if (startY !== null && e.clientY - startY >= DRAG_CLOSE_PX) {
          startY = null
          dismiss()
        }
      })
      grab.addEventListener('pointerup', () => {
        startY = null
      })
      panel.append(grab, h('button', { class: 'sheet-close', type: 'button', 'aria-label': '닫기', onclick: dismiss }, '✕'))
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) dismiss()
      })
    }
    if (variant === 'cinema' && options.title) panel.append(h('div', { class: 'cin-top' }, h('span', { class: 'cin-chip' }, options.title)))
    panel.append(build(close))
    overlay.append(panel)
    document.body.append(overlay)
    // 키보드 사용자를 위해 첫 버튼에 포커스를 준다 (선택 상태가 있는 시트처럼 첫 버튼이 선택된 것처럼 보이면 안 되는 곳은 autofocus: false)
    if (options.autofocus !== false) panel.querySelector<HTMLElement>('button:not(:disabled):not(.sheet-close)')?.focus()
  })
}
