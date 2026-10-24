import { h } from './dom.ts'
import { openSheet } from './sheet.ts'

/** 지금 떠 있는 확인 팝업. 같은 버튼을 연달아 눌러도(더블탭) 팝업이 겹쳐 쌓이지 않도록 하나만 둔다. */
let pending: Promise<boolean> | null = null

/**
 * 되돌릴 수 없거나 놓치기 쉬운 행동 앞의 확인 팝업. 확인하면 true, 취소하면 false.
 * 이미 떠 있으면 새로 열지 않고, 겹친 호출은 끝나지 않는 Promise를 돌려준다(확인·취소 어느 쪽 흐름도 두 번 실행되지 않게).
 */
export function confirmSheet(opts: { title: string; message: string; ok: string; cancel?: string }): Promise<boolean> {
  if (pending) return new Promise<boolean>(() => {})
  const result = openSheet<boolean>(
    (close) =>
      h(
        'div',
        { class: 'stack-tight' },
        h('h3', {}, opts.title),
        h('p', { class: 'event-text' }, opts.message),
        h('button', { class: 'btn primary', onclick: () => close(true) }, opts.ok),
        h('button', { class: 'btn ghost', onclick: () => close(false) }, opts.cancel ?? '취소'),
      ),
    { variant: 'decision', autofocus: false })
  pending = result
  void result.finally(() => {
    pending = null
  })
  return result
}

/** 엔딩처럼 화면이 완전히 바뀔 때, 남아 있는 팝업을 모두 치운다. */
export function dismissAllSheets(): void {
  document.querySelectorAll('.overlay').forEach((o) => o.remove())
  pending = null
}
