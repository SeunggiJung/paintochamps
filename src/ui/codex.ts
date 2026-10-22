import genres from '../data/genres.json'
import { ACHIEVEMENTS } from '../engine/achievements.ts'
import { endingDef, ENDINGS } from '../engine/endings.ts'
import { stageName } from '../engine/season.ts'
import type { FinishSummary } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { openCareer } from './careerView.ts'
import { segmented } from './components.ts'
import { h } from './dom.ts'
import { endingArt } from './ending.ts'
import { MODE_INFO } from './labels.ts'
import type { CodexView } from './prefs.ts'
import { openSheet } from './sheet.ts'

type Tab = 'endings' | 'achievements' | 'hall'

const lastLine = (last: FinishSummary) => `최근: ${last.name} · ${genres[last.genre].name} · ${MODE_INFO[last.mode]?.name ?? '정밀'} · ${last.age}세 · 최고 ${stageName(last.bestStage)}${last.rerolls > 0 ? ` · 뽑기 ${last.rerolls}번 다시` : ''}`

/**
 * 도감: 엔딩 / 업적 / 명예의 전당. 엔딩·업적은 타일·리스트 두 보기.
 * 본 항목은 설명과 마지막 기록을, 못 본 항목은 조건을 숨기고 ???로만 보여 준다.
 */
export function codexScreen(ctx: Ctx, back: () => void): HTMLElement {
  const { endings, achievements, finishedRuns, bestStage } = ctx.meta
  const found = ENDINGS.filter((e) => endings[e.id]).length
  const achieved = ACHIEVEMENTS.filter((a) => achievements[a.id]).length
  let tab: Tab = 'endings'
  const root = h('main', { class: 'screen codex' })

  const detail = (title: string, art: HTMLElement, desc: string, count: number, last?: FinishSummary) =>
    openSheet<void>(
      () => h('div', { class: 'stack-tight' }, art, h('div', { class: 'row' }, h('h2', {}, title), h('span', { class: 'chip' }, `${count}회`)), h('p', { class: 'muted' }, desc), last && h('p', { class: 'muted small' }, lastLine(last))),
      { variant: 'info' },
    )

  const lockedBody = () => h('div', { class: 'codex-body' }, h('b', {}, '???'), h('span', { class: 'muted small' }, '직접 플레이하며 찾아보세요.'))
  const badge = (locked: boolean) => h('div', { class: `ending-art thumb small-art${locked ? ' locked' : ''}` }, locked ? '?' : '🏅')

  const items = (): HTMLElement[] => {
    const view: CodexView = ctx.prefs.codexView
    if (tab === 'endings') {
      return ENDINGS.map((e) => {
        const rec = endings[e.id]
        if (!rec) return h('div', { class: 'codex-item locked' }, endingArt(e.id, true, view === 'tile' ? 'hero' : 'thumb'), lockedBody())
        return h(
          'button',
          { class: 'codex-item', type: 'button', onclick: () => void detail(e.name, endingArt(e.id, false, 'hero'), e.desc, rec.count, rec.last) },
          endingArt(e.id, false, view === 'tile' ? 'hero' : 'thumb'),
          h('div', { class: 'codex-body' }, h('div', { class: 'row' }, h('b', {}, e.name), h('span', { class: 'chip' }, `${rec.count}회`)), view === 'list' && h('span', { class: 'muted small' }, e.desc)),
        )
      })
    }
    return ACHIEVEMENTS.map((a) => {
      const rec = achievements[a.id]
      if (!rec) return h('div', { class: 'codex-item locked' }, badge(true), lockedBody())
      return h(
        'button',
        { class: 'codex-item', type: 'button', onclick: () => void detail(a.name, badge(false), a.desc, rec.count, rec.last) },
        badge(false),
        h('div', { class: 'codex-body' }, h('div', { class: 'row' }, h('b', {}, a.name), h('span', { class: 'chip' }, `${rec.count}회`)), view === 'list' && h('span', { class: 'muted small' }, a.desc)),
      )
    })
  }

  const hall = (): HTMLElement[] =>
    ctx.meta.careers.length === 0
      ? [h('p', { class: 'muted' }, '아직 끝낸 판이 없어요. 끝까지 플레이하면 경력이 여기에 남아요.')]
      : ctx.meta.careers.map((c) =>
          h(
            'section',
            { class: 'card' },
            h('div', { class: 'row' }, h('b', {}, `${c.name} · ${genres[c.genre].name}`), h('span', { class: 'chip' }, endingDef(c.ending).name)),
            h('span', { class: 'muted small' }, `${c.age}세 · 우승 ${c.career.totals.titles}회(월드 ${c.career.totals.worldTitles}회) · 구단 ${c.career.totals.teams}곳 · 수상 ${c.career.totals.awards}회`),
            h('button', { class: 'btn small', onclick: () => void openCareer(c.career, `${c.name}의 경력`) }, '경력 보기'),
          ),
        )

  const toggle = () => {
    const mk = (id: CodexView, label: string, name: string) =>
      h('button', { type: 'button', class: `vt-btn${ctx.prefs.codexView === id ? ' on' : ''}`, 'aria-label': name, 'aria-pressed': String(ctx.prefs.codexView === id), onclick: () => (ctx.updatePrefs({ codexView: id }), render()) }, label)
    return h('div', { class: 'view-toggle' }, mk('tile', '▦', '타일 보기'), mk('list', '☰', '리스트 보기'))
  }

  function render() {
    const view = ctx.prefs.codexView
    root.replaceChildren(
      h('button', { class: 'btn ghost small back-btn', type: 'button', onclick: back }, '‹ 뒤로'),
      ...(tab !== 'hall' ? [toggle()] : []),
      h('p', { class: 'eyebrow' }, '도감'),
      h('h2', {}, `${found} / ${ENDINGS.length} 발견`),
      h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: `width:${(found / ENDINGS.length) * 100}%` })),
      h('p', { class: 'muted small' }, finishedRuns > 0 ? `완주 ${finishedRuns}회 · 지금까지 오른 최고 단계 ${stageName(bestStage)}` : '아직 완주한 판이 없습니다. 끝까지 플레이하면 여기에 기록됩니다.'),
      segmented<Tab>(
        [
          { id: 'endings', label: '엔딩' },
          { id: 'achievements', label: `업적 ${achieved}/${ACHIEVEMENTS.length}` },
          { id: 'hall', label: '명예의 전당' },
        ],
        tab,
        (id) => ((tab = id), render()),
      ),
      tab === 'hall' ? h('div', { class: 'stack-tight' }, ...hall()) : h('div', { class: `codex-grid ${view}` }, ...items()),
    )
  }
  render()
  return root
}
