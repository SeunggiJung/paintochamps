import { h } from './dom.ts'

export type TabId = 'home' | 'season' | 'player' | 'record'

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'home', icon: '🏠', label: '홈' },
  { id: 'season', icon: '📅', label: '시즌' },
  { id: 'player', icon: '🧑', label: '선수' },
  { id: 'record', icon: '🏆', label: '기록' },
]

export interface Shell {
  readonly root: HTMLElement
  /** 탭 바 없는 전체 화면 */
  showFull(el: HTMLElement): void
  /** 하단 탭 바와 함께 보이는 탭 화면 */
  showTab(tab: TabId, el: HTMLElement): void
  readonly currentTab: TabId | null
  setBadge(tab: TabId, on: boolean): void
}

/** 모든 화면의 틀: 오른쪽 위 ⚙, 화면 영역, 하단 탭 바(탭 화면에서만 보임) */
export function createShell(host: HTMLElement, hooks: { onTab(tab: TabId): void; onSettings(): void }): Shell {
  let current: TabId | null = null
  const badges = new Set<TabId>()
  const body = h('div', { class: 'shell-body' })
  const gear = h('button', { class: 'gear', type: 'button', 'aria-label': '설정', 'data-guide': 'gear', onclick: () => hooks.onSettings() }, '⚙')
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': '메뉴', 'data-guide': 'tabs' })
  tabbar.hidden = true
  const root = h('div', { 'data-shell': '' }, body, tabbar, gear)
  host.replaceChildren(root)

  const paintTabs = () => {
    tabbar.replaceChildren(
      ...TABS.map((t) =>
        h(
          'button',
          { type: 'button', class: 'tab', 'aria-current': t.id === current ? 'page' : null, onclick: () => hooks.onTab(t.id) },
          h('span', { class: 'tab-icon' }, t.icon),
          h('span', { class: 'tab-label' }, t.label),
          badges.has(t.id) ? h('span', { class: 'dot' }) : null,
        ),
      ),
    )
  }
  const swap = (el: HTMLElement, keepScroll = false) => {
    body.replaceChildren(el)
    if (!keepScroll) scrollTo(0, 0)
  }

  return {
    root,
    showFull(el) {
      current = null
      tabbar.hidden = true
      root.classList.remove('has-tabs')
      swap(el)
    },
    showTab(tab, el) {
      const same = current === tab
      current = tab
      tabbar.hidden = false
      root.classList.add('has-tabs')
      paintTabs()
      swap(el, same)
    },
    get currentTab() {
      return current
    },
    setBadge(tab, on) {
      if (on) badges.add(tab)
      else badges.delete(tab)
      if (current) paintTabs()
    },
  }
}
