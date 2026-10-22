// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { h } from './dom.ts'
import { openSheet } from './sheet.ts'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('openSheet', () => {
  it('variant 없이는 가운데 카드, center:false는 결정 시트', () => {
    void openSheet(() => h('p', {}, 'a'))
    expect(document.querySelector('.overlay.center')).not.toBeNull()
    document.body.innerHTML = ''
    void openSheet(() => h('p', {}, 'a'), { center: false })
    expect(document.querySelector('.overlay.decision')).not.toBeNull()
  })

  it('결정 시트는 바깥을 눌러도 닫히지 않고 close로만 resolve된다', async () => {
    let done: (v: string) => void = () => {}
    const p = openSheet<string>((close) => ((done = close), h('p', {}, 'a')), { variant: 'decision' })
    const overlay = document.querySelector<HTMLElement>('.overlay')!
    overlay.click()
    expect(document.querySelector('.overlay')).not.toBeNull()
    done('ok')
    expect(await p).toBe('ok')
    expect(document.querySelector('.overlay')).toBeNull()
  })

  it('정보 시트는 ✕로 닫힌다', async () => {
    const p = openSheet<void>(() => h('p', {}, 'info'), { variant: 'info' })
    document.querySelector<HTMLElement>('.sheet-close')!.click()
    await p
    expect(document.querySelector('.overlay')).toBeNull()
  })

  it('정보 시트는 바깥을 눌러도 닫힌다', async () => {
    const p = openSheet<void>(() => h('p', {}, 'info'), { variant: 'info' })
    document.querySelector<HTMLElement>('.overlay')!.click()
    await p
    expect(document.querySelector('.overlay')).toBeNull()
  })

  it('연출 틀은 title을 칩으로 보인다', () => {
    void openSheet(() => h('p', {}, 'x'), { variant: 'cinema', title: 'MSI' })
    expect(document.querySelector('.cin-chip')?.textContent).toBe('MSI')
    expect(document.querySelector('.overlay.cinema')).not.toBeNull()
  })

  it('닫은 뒤 이전 포커스가 복원된다', async () => {
    const btn = h('button', {}, 'open')
    document.body.append(btn)
    btn.focus()
    let done: (v: number) => void = () => {}
    const p = openSheet<number>((close) => ((done = close), h('button', {}, 'inner')), { variant: 'result' })
    expect(document.activeElement).not.toBe(btn)
    done(1)
    await p
    expect(document.activeElement).toBe(btn)
  })
})
