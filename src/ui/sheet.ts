import { h } from './dom.ts'

/**
 * 화면 위에 뜨는 팝업. build가 만든 내용을 보여 주고, close(값)을 부르면 닫히면서 그 값으로 resolve된다.

 * 바깥을 눌러도 닫히지 않는다. (이벤트 선택처럼 반드시 답해야 하는 팝업이 많다.)
 * 기본은 화면 중앙에 뜬다. center: false를 주면 아래에서 올라오는 시트가 된다.
 */
export function openSheet<T>(build: (close: (value: T) => void) => HTMLElement, options: { center?: boolean } = {}): Promise<T> {
  return new Promise((resolve) => {
    const previous = document.activeElement as HTMLElement | null
    const overlay = h('div', { class: `overlay${options.center === false ? '' : ' center'}` })
    const close = (value: T) => {
      overlay.remove()
      previous?.focus?.()
      resolve(value)
    }
    const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, build(close))
    overlay.append(panel)
    document.body.append(overlay)
    // 키보드 사용자를 위해 첫 버튼에 포커스를 준다
    panel.querySelector<HTMLElement>('button:not(:disabled)')?.focus()
  })
}
