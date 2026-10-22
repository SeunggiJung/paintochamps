// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { h } from './dom.ts'
import { createShell, type TabId } from './shell.ts'

function make() {
  const host = document.createElement('div')
  const tabs: TabId[] = []
  let settings = 0
  const shell = createShell(host, { onTab: (t) => tabs.push(t), onSettings: () => settings++ })
  return { host, shell, tabs, settings: () => settings }
}

describe('shell', () => {
  it('showFull이면 탭 바가 숨겨지고 currentTab은 null', () => {
    const { host, shell } = make()
    shell.showFull(h('p', {}, '전체'))
    expect(host.querySelector<HTMLElement>('.tabbar')?.hidden ?? true).toBe(true)
    expect(shell.currentTab).toBeNull()
    expect(host.textContent).toContain('전체')
  })

  it('showTab이면 탭 바가 보이고 그 탭이 aria-current', () => {
    const { host, shell } = make()
    shell.showTab('season', h('p', {}, '시즌'))
    expect(host.querySelector<HTMLElement>('.tabbar')!.hidden).toBe(false)
    expect(host.querySelectorAll('.tabbar button').length).toBe(4)
    const cur = host.querySelectorAll('.tabbar [aria-current="page"]')
    expect(cur.length).toBe(1)
    expect(cur[0].textContent).toContain('시즌')
    expect(shell.currentTab).toBe('season')
  })

  it('같은 탭을 다시 눌러도 onTab이 호출된다', () => {
    const { host, shell, tabs } = make()
    shell.showTab('home', h('p', {}, 'x'))
    const btns = host.querySelectorAll<HTMLElement>('.tabbar button')
    btns[0].click()
    btns[2].click()
    expect(tabs).toEqual(['home', 'player'])
  })

  it('setBadge는 해당 탭에 점을 켜고 끈다', () => {
    const { host, shell } = make()
    shell.showTab('home', h('p', {}, 'x'))
    shell.setBadge('player', true)
    expect(host.querySelectorAll('.tabbar .dot').length).toBe(1)
    shell.setBadge('player', false)
    expect(host.querySelectorAll('.tabbar .dot').length).toBe(0)
  })

  it('⚙ 클릭이 onSettings를 부른다', () => {
    const { host, settings } = make()
    host.querySelector<HTMLElement>('button.gear')!.click()
    expect(settings()).toBe(1)
  })
})
