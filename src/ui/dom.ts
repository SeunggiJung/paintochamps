type Child = Node | string | null | false | undefined

/** 아주 작은 DOM 헬퍼. h('button', { class: 'btn', onclick }, '확인') */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value as EventListener)
    } else if (key === 'class') {
      el.className = String(value)
    } else if (key in el) {
      ;(el as unknown as Record<string, unknown>)[key] = value
    } else {
      el.setAttribute(key, String(value))
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue
    el.append(typeof c === 'string' ? document.createTextNode(c) : c)
  }
  return el
}
