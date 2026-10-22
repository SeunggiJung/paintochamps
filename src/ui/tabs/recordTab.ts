import { ACHIEVEMENTS } from '../../engine/achievements.ts'
import { ENDINGS } from '../../engine/endings.ts'
import { h } from '../dom.ts'
import type { GameSession } from '../session.ts'

/** 기록 탭: 도감·업적 상점·명예의 전당과 지금까지의 기록 */
export function recordTab(session: GameSession): HTMLElement {
  const ctx = session.ctx
  const meta = ctx.meta
  const row = (label: string, note: string, onclick: () => void) => h('button', { class: 'settings-link', type: 'button', onclick }, h('span', {}, label), h('span', { class: 'muted' }, note))
  const seenEndings = ENDINGS.filter((e) => meta.endings[e.id]).length
  const seenAchievements = ACHIEVEMENTS.filter((a) => meta.achievements[a.id]).length
  return h(
    'main',
    { class: 'screen' },
    h('h2', {}, '기록'),
    row('엔딩·업적 도감', `엔딩 ${seenEndings}/${ENDINGS.length} · 업적 ${seenAchievements}/${ACHIEVEMENTS.length}`, () => ctx.toCodex()),
    row('업적 상점', `🪙 ${meta.tokens}`, () => ctx.toShop()),
    row('명예의 전당', `지난 판 ${meta.careers.length}개`, () => ctx.toCodex()),
    h('section', { class: 'card' }, h('h3', {}, '지금까지'), h('p', { class: 'small' }, `완주 ${meta.finishedRuns}판`)),
  )
}
