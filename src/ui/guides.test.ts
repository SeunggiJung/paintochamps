// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import guideData from '../data/guides.json'
import { hasSeenGuide, loadMeta, META_KEY, type GuideId, type KeyValueStorage } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { GUIDE_IDS, guideHelp, listGuides, showGuide, showGuideOnce } from './guides.ts'

afterEach(() => {
  document.body.innerHTML = ''
})

function memory(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) }
}

function fakeCtx(): Ctx {
  const storage = memory()
  return { storage, meta: loadMeta(storage) } as unknown as Ctx
}

const overlays = () => document.querySelectorAll('.overlay').length
const closeSheet = () => [...document.querySelectorAll<HTMLButtonElement>('.overlay button')].find((b) => b.textContent === '알겠어요')!.click()

describe('가이드', () => {
  it('guides.json에 모든 GuideId가 있고 lines가 비어 있지 않다', () => {
    const ids: GuideId[] = ['start', 'plan', 'spend', 'contract', 'offers', 'event', 'injury', 'prep', 'turnResult', 'midOffer', 'ads', 'house', 'shop', 'tokenShop', 'broadcast', 'minigame']
    expect(GUIDE_IDS.slice().sort()).toEqual(ids.slice().sort())
    for (const id of ids) expect((guideData as Record<string, { lines: string[] }>)[id].lines.length).toBeGreaterThan(0)
  })

  it('showGuideOnce는 처음에만 뜨고, 열자마자 본 기록이 남는다', async () => {
    const ctx = fakeCtx()
    const first = showGuideOnce(ctx, 'plan')
    expect(overlays()).toBe(1)
    // 닫기 전(새로고침 상황)에도 이미 본 것으로 저장돼 있다
    expect(hasSeenGuide(loadMeta(ctx.storage as KeyValueStorage), 'plan')).toBe(true)
    closeSheet()
    await first
    await showGuideOnce(ctx, 'plan')
    expect(overlays()).toBe(0)
  })

  it('처음 자동으로 뜰 때는 핵심 줄만, 다시 볼 때는 전부 보여 준다', async () => {
    const all = (guideData as Record<string, { lines: string[] }>).plan.lines.length
    const ctx = fakeCtx()
    const first = showGuideOnce(ctx, 'plan')
    expect(document.querySelectorAll('.guide-lines li').length).toBe(3)
    expect(document.querySelector('.guide-sheet')?.textContent).toContain('나머지 설명은')
    closeSheet()
    await first
    const again = showGuide(ctx, 'plan')
    expect(document.querySelectorAll('.guide-lines li').length).toBe(all)
    closeSheet()
    await again
  })

  it('showGuide(다시 보기)는 이미 본 가이드를 열되 본 기록을 바꾸지 않는다', async () => {
    const ctx = fakeCtx()
    const p = showGuideOnce(ctx, 'spend')
    closeSheet()
    await p
    const before = JSON.stringify(loadMeta(ctx.storage).guidesSeen)
    const again = showGuide(ctx, 'spend')
    expect(overlays()).toBe(1)
    closeSheet()
    await again
    expect(JSON.stringify(loadMeta(ctx.storage).guidesSeen)).toBe(before)
  })

  it('listGuides는 16개를 돌려주고 본 것만 seen', async () => {
    const ctx = fakeCtx()
    const p = showGuideOnce(ctx, 'event')
    closeSheet()
    await p
    const list = listGuides(ctx)
    expect(list.length).toBe(16)
    expect(list.filter((g) => g.seen).map((g) => g.id)).toEqual(['event'])
  })

  it('옛 메타(guideDone:true)에서 start 가이드는 아무것도 띄우지 않는다', async () => {
    const storage = memory()
    storage.setItem(META_KEY, JSON.stringify({ version: 1, tutorialDone: true, guideDone: true, endings: {}, achievements: {}, bestStage: 'basement', finishedRuns: 0 }))
    const ctx = { storage, meta: loadMeta(storage) } as unknown as Ctx
    await showGuideOnce(ctx, 'start')
    expect(overlays()).toBe(0)
  })

  it('guideHelp는 ? 버튼이고 누르면 다시 보기 시트가 뜬다', () => {
    const ctx = fakeCtx()
    const btn = guideHelp(ctx, 'contract')
    document.body.append(btn)
    btn.click()
    expect(overlays()).toBe(1)
  })
})
