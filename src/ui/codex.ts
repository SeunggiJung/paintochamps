import genres from '../data/genres.json'
import { ACHIEVEMENTS } from '../engine/achievements.ts'
import { ENDINGS } from '../engine/endings.ts'
import { stageName } from '../engine/season.ts'
import type { Ctx } from './app.ts'
import { h } from './dom.ts'
import { endingArt } from './ending.ts'
import { MODE_INFO } from './labels.ts'

/** 엔딩 도감. 본 엔딩은 설명과 마지막 기록을, 못 본 엔딩은 조건을 숨기고 ???로만 보여 준다. */
export function codexScreen(ctx: Ctx): HTMLElement {
  const { endings, achievements, finishedRuns, bestStage } = ctx.meta
  const found = ENDINGS.filter((e) => endings[e.id]).length

  const card = (e: (typeof ENDINGS)[number]) => {
    const rec = endings[e.id]
    if (!rec) {
      return h('section', { class: 'card codex-card locked' }, endingArt(e.id, true), h('div', { class: 'codex-body' }, h('b', {}, '???'), h('span', { class: 'muted small' }, '직접 플레이하며 찾아보세요.')))
    }
    const last = rec.last
    return h(
      'section',
      { class: 'card codex-card' },
      endingArt(e.id),
      h(
        'div',
        { class: 'codex-body' },
        h('div', { class: 'row' }, h('b', {}, e.name), h('span', { class: 'chip' }, `${rec.count}회`)),
        h('span', { class: 'muted small' }, e.desc),
        last && h('span', { class: 'muted small' }, `최근: ${last.name} · ${genres[last.genre].name} · ${MODE_INFO[last.mode]?.name ?? '정밀'} · ${last.age}세 · 최고 ${stageName(last.bestStage)}${last.rerolls > 0 ? ` · 뽑기 ${last.rerolls}번 다시` : ''}`),
      ),
    )
  }

  const achievementCard = (a: (typeof ACHIEVEMENTS)[number]) => {
    const rec = achievements[a.id]
    if (!rec) return h('section', { class: 'card codex-card locked' }, h('div', { class: 'ending-art thumb locked small-art' }, '?'), h('div', { class: 'codex-body' }, h('b', {}, '???'), h('span', { class: 'muted small' }, '직접 플레이하며 찾아보세요.')))
    return h('section', { class: 'card codex-card' }, h('div', { class: 'ending-art thumb small-art' }, '🏅'), h('div', { class: 'codex-body' }, h('div', { class: 'row' }, h('b', {}, a.name), h('span', { class: 'chip' }, `${rec.count}회`)), h('span', { class: 'muted small' }, a.desc)))
  }

  return h(
    'main',
    { class: 'screen codex' },
    h('p', { class: 'eyebrow' }, '엔딩 도감'),
    h('h2', {}, `${found} / ${ENDINGS.length} 발견`),
    h('p', { class: 'muted small' }, finishedRuns > 0 ? `완주 ${finishedRuns}회 · 지금까지 오른 최고 단계 ${stageName(bestStage)}` : '아직 완주한 판이 없습니다. 끝까지 플레이하면 여기에 기록됩니다.'),
    ...ENDINGS.map(card),
    h('h2', {}, `업적 ${ACHIEVEMENTS.filter((a) => achievements[a.id]).length} / ${ACHIEVEMENTS.length}`),
    ...ACHIEVEMENTS.map(achievementCard),
    h('button', { class: 'btn', onclick: () => ctx.toTitle() }, '타이틀로'),
  )
}
