import { h } from './dom.ts'

export interface SegmentItem<T extends string> {
  id: T
  label: string
  /** 결정할 일이 남았다는 빨간 점 */
  dot?: boolean
}

/** 세그먼트 탭: 한 번에 하나만 보는 목록 전환 */
export function segmented<T extends string>(items: SegmentItem<T>[], active: T, onChange: (id: T) => void): HTMLElement {
  return h(
    'div',
    { class: 'segmented', role: 'tablist' },
    ...items.map((it) =>
      h(
        'button',
        { class: 'segmented-btn', type: 'button', role: 'tab', 'aria-selected': it.id === active ? 'true' : 'false', onclick: () => onChange(it.id) },
        it.label,
        it.dot ? h('span', { class: 'dot', 'aria-label': '할 일 있음' }) : null,
      ),
    ),
  )
}

/** 점 단계 표시: total개 중 active개가 켜짐 */
export function stepDots(total: number, active: number): HTMLElement {
  return h('div', { class: 'step-dots', role: 'img', 'aria-label': `${total}단계 중 ${active}단계` }, ...Array.from({ length: total }, (_, i) => h('i', { class: i < active ? 'on' : '' })))
}

export function chip(text: string, tone: 'default' | 'alert' | 'award' = 'default'): HTMLElement {
  return h('span', { class: `chip ${tone}` }, text)
}

export function sectionHeader(title: string, aside?: string | Node): HTMLElement {
  return h('div', { class: 'section-header' }, h('h3', {}, title), aside ? (typeof aside === 'string' ? h('span', { class: 'muted small' }, aside) : aside) : null)
}
