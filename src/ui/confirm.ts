import { h } from './dom.ts'
import { openSheet } from './sheet.ts'

/** 되돌릴 수 없거나 놓치기 쉬운 행동 앞의 확인 팝업. 확인하면 true, 취소하면 false. */
export function confirmSheet(opts: { title: string; message: string; ok: string; cancel?: string }): Promise<boolean> {
  return openSheet<boolean>(
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
}
