import guideData from '../data/guides.json'
import { hasSeenGuide, markGuideSeen, type GuideId } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { h } from './dom.ts'
import { openSheet } from './sheet.ts'

interface GuideDef {
  title: string
  lines: string[]
  /** 어디서 처음 보이는지 (가이드 모아 보기에 표시) */
  where: string
}

const GUIDES = guideData as Record<GuideId, GuideDef>
export const GUIDE_IDS = Object.keys(GUIDES) as GuideId[]

/** 가이드 시트를 연다. 본 기록은 건드리지 않는다. */
export function showGuide(_ctx: Ctx, id: GuideId): Promise<void> {
  const g = GUIDES[id]
  return openSheet<void>(
    (close) =>
      h(
        'div',
        { class: 'stack-tight guide-sheet' },
        h('p', { class: 'eyebrow' }, '가이드'),
        h('h2', {}, g.title),
        h('ul', { class: 'guide-lines' }, ...g.lines.map((l) => h('li', {}, l))),
        h('button', { class: 'btn primary', type: 'button', onclick: () => close() }, '알겠어요'),
      ),
    { variant: 'decision' },
  )
}

/**
 * 그 상황이 처음 나타났을 때 한 번만 보여 준다. 본 기록을 **보여 주기 전에** 남기므로
 * 닫지 않고 새로고침해도 다시 뜨지 않는다.
 */
export async function showGuideOnce(ctx: Ctx, id: GuideId): Promise<void> {
  if (hasSeenGuide(ctx.meta, id)) return
  ctx.meta = markGuideSeen(ctx.storage, id)
  await showGuide(ctx, id)
}

/** 제목 옆 ? 버튼: 언제든 그 가이드를 다시 본다 */
export function guideHelp(ctx: Ctx, id: GuideId): HTMLElement {
  return h('button', { class: 'guide-help', type: 'button', 'aria-label': `${GUIDES[id].title} 가이드 보기`, onclick: () => void showGuide(ctx, id) }, '?')
}

/** 가이드 모아 보기용 목록 */
export function listGuides(ctx: Ctx): { id: GuideId; title: string; where: string; seen: boolean }[] {
  return GUIDE_IDS.map((id) => ({ id, title: GUIDES[id].title, where: GUIDES[id].where, seen: hasSeenGuide(ctx.meta, id) }))
}
