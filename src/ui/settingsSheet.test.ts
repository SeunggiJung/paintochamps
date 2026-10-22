// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyMeta } from '../save/storage.ts'
import { defaultPrefs, type Prefs } from './prefs.ts'
import { openSettings } from './settingsSheet.ts'
import type { Ctx } from './app.ts'

afterEach(() => {
  document.body.innerHTML = ''
})

function fakeCtx() {
  const patches: Partial<Prefs>[] = []
  const ctx = {
    prefs: { ...defaultPrefs },
    meta: emptyMeta(),
    updatePrefs: (p: Partial<Prefs>) => {
      patches.push(p)
      ctx.prefs = { ...ctx.prefs, ...p }
    },
    toTitle: vi.fn(),
  } as unknown as Ctx
  return { ctx, patches }
}

const click = (text: string) => {
  const btn = [...document.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent?.trim().startsWith(text))
  if (!btn) throw new Error(`버튼 없음: ${text}`)
  btn.click()
}

describe('설정 시트', () => {
  it('테마·글자·움직임을 고르면 updatePrefs가 불린다', () => {
    const { ctx, patches } = fakeCtx()
    void openSettings(ctx, { inGame: false })
    click('크림+도트')
    click('갈무리')
    click('차분')
    expect(patches).toEqual([{ theme: 'cozy' }, { font: 'galmuri' }, { motion: 'calm' }])
  })

  it("'자동'은 theme·motion을 auto로 되돌린다", () => {
    const { ctx, patches } = fakeCtx()
    void openSettings(ctx, { inGame: false })
    const autos = [...document.querySelectorAll<HTMLElement>('button')].filter((b) => b.textContent === '자동')
    expect(autos.length).toBe(2)
    autos.forEach((b) => b.click())
    expect(patches).toEqual([{ theme: 'auto' }, { motion: 'auto' }])
  })

  it('inGame이 아니면 타이틀로 행이 없고, inGame이면 toTitle을 부른다', () => {
    const a = fakeCtx()
    void openSettings(a.ctx, { inGame: false })
    expect(document.body.textContent).not.toContain('타이틀로')
    document.body.innerHTML = ''
    const b = fakeCtx()
    void openSettings(b.ctx, { inGame: true })
    click('타이틀로')
    expect(b.ctx.toTitle).toHaveBeenCalled()
  })

  it('고른 항목이 활성으로 다시 그려진다', () => {
    const { ctx } = fakeCtx()
    void openSettings(ctx, { inGame: false })
    click('다크')
    const active = [...document.querySelectorAll('[aria-selected="true"]')].map((e) => e.textContent)
    expect(active).toContain('다크')
  })
})
