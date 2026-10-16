import genres from '../data/genres.json'
import { achievementDef } from '../engine/achievements.ts'
import { endingDef } from '../engine/endings.ts'
import { stageName } from '../engine/season.ts'
import type { EndingId, GameState } from '../engine/state.ts'
import { bestStageOf } from '../save/storage.ts'
import type { Ctx, EndingInfo } from './app.ts'
import { celebrate } from './confetti.ts'
import { h } from './dom.ts'
import { endingSceneSvg } from './endingScenes.ts'
import { MODE_INFO } from './labels.ts'

/**
 * 엔딩 그림 자리. 지금은 코드로 그린 도트 장면(`endingScenes.ts`)이고, 일러스트가 준비되면 이미지로 바꾼다.
 * data-art 값(ending_<id>)이 이미지 파일 이름이다. 필요한 장면 목록은 docs/ending-images.md.
 * hero는 엔딩 화면의 큰 그림, thumb는 도감의 작은 그림. 못 본 엔딩(locked)은 ?로 가린다.
 */
export function endingArt(id: EndingId, locked = false, size: 'hero' | 'thumb' = 'thumb'): HTMLElement {
  const el = h('div', { class: `ending-art ${size}${locked ? ' locked' : ' scene'}`, 'data-art': `ending_${id}`, role: 'img', 'aria-label': locked ? '아직 보지 못한 엔딩' : endingDef(id).name })
  if (locked) el.textContent = '?'
  else el.innerHTML = endingSceneSvg(id)
  return el
}

/** 시즌 하나의 대표 성적: 참가 팀 수 대비 순위가 가장 높은 대회 */
function bestOfSeason(events: GameState['history'][number]['events']): string {
  if (events.length === 0) return '대회 없음'
  const best = events.reduce((a, b) => (b.placement / b.fieldSize < a.placement / a.fieldSize ? b : a))
  return `${best.name} ${best.placement}위 / ${best.fieldSize}팀`
}

/** 커리어가 끝났을 때 보는 엔딩 화면. */
export function endingScreen(ctx: Ctx, state: GameState, { isNew, achievements }: EndingInfo): HTMLElement {
  const id = state.finished
  if (!id) throw new Error('끝나지 않은 판이다')
  const def = endingDef(id)
  const best = bestStageOf(state)

  if (id === 'legend' || id === 'hidden_loyal' || achievements.length > 0) requestAnimationFrame(() => celebrate('UR'))
  else if (id === 'world_finalist') requestAnimationFrame(() => celebrate('SR'))

  const row = (label: string, value: string) => h('div', { class: 'kv-row' }, h('span', { class: 'muted' }, label), h('b', {}, value))

  return h(
    'main',
    { class: 'screen ending' },
    h('p', { class: 'eyebrow' }, '커리어 종료'),
    h(
      'section',
      { class: `card headline ${id === 'legend' || id === 'hidden_loyal' ? 'gold' : ''}` },
      endingArt(id, false, 'hero'),
      isNew && h('span', { class: 'chip new-chip' }, '도감에 새로 기록!'),
      h('p', { class: 'headline-title' }, def.name),
      h('p', { class: 'event-text' }, def.epilogue.replaceAll('{name}', state.name)),
    ),
    ...achievements.map((a) => {
      const def = achievementDef(a.id)
      return h('section', { class: 'card achievement' }, h('p', { class: 'eyebrow' }, a.isNew ? '업적 달성!' : '업적 (재달성)'), h('p', { class: 'headline-title' }, `🏅 ${def.name}`), h('p', { class: 'muted' }, def.desc))
    }),
    h(
      'section',
      { class: 'card' },
      h('h3', {}, '커리어 요약'),
      row('선수', `${state.name} · ${genres[state.genre].name} · ${MODE_INFO[state.mode].name}`),
      row('마지막 나이', `${state.age}세 (${state.season}시즌)`),
      row('가장 높이 오른 곳', stageName(best)),
      row('월드 챔피언십', state.worldTitles > 0 ? `우승 ${state.worldTitles}회` : state.worldAppearances > 0 ? `진출 ${state.worldAppearances}회` : '진출 없음'),
      row('능력치 뽑기', state.rerolls > 0 ? `${state.rerolls}번 다시 뽑음` : '한 번에 확정'),
    ),
    state.history.length > 0 &&
      h(
        'section',
        { class: 'card' },
        h('h3', {}, '시즌별 기록'),
        ...state.history.map((r) => h('div', { class: 'event-row' }, h('div', { class: 'row' }, h('b', {}, `${r.age}세 · ${stageName(r.stage)}`)), h('span', { class: 'muted small' }, bestOfSeason(r.events)))),
      ),
    h('div', { class: 'stack' }, h('button', { class: 'btn primary', onclick: () => ctx.toCodex() }, '엔딩 도감 보기'), h('button', { class: 'btn', onclick: () => ctx.toTitle() }, '타이틀로')),
  )
}
