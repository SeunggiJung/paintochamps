import genres from '../data/genres.json'
import { endingDef } from '../engine/endings.ts'
import { stageName } from '../engine/season.ts'
import type { EndingId, GameState } from '../engine/state.ts'
import { bestStageOf } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { celebrate } from './confetti.ts'
import { h } from './dom.ts'
import { MODE_INFO } from './labels.ts'

/**
 * 엔딩별 임시 그림. 엔딩 일러스트가 준비되면 data-art 값(ending_<id>)으로 이미지를 붙인다.
 * 필요한 장면 목록은 docs/ending-images.md.
 */
export const ENDING_ICON: Record<EndingId, string> = {
  hidden_loyal: '🏟️',
  legend: '🏆',
  world_finalist: '🥈',
  pro1_regular: '🎖️',
  pro2_veteran: '🛠️',
  coach: '📋',
  streamer: '📺',
  hobbyist: '🎮',
}

/** 엔딩 그림 자리. 일러스트가 들어오기 전까지 아이콘으로 대신한다. */
export function endingArt(id: EndingId, locked = false): HTMLElement {
  return h('div', { class: `ending-art${locked ? ' locked' : ''}`, 'data-art': `ending_${id}`, role: 'img', 'aria-label': locked ? '아직 보지 못한 엔딩' : endingDef(id).name }, locked ? '?' : ENDING_ICON[id])
}

/** 시즌 하나의 대표 성적: 참가 팀 수 대비 순위가 가장 높은 대회 */
function bestOfSeason(events: GameState['history'][number]['events']): string {
  if (events.length === 0) return '대회 없음'
  const best = events.reduce((a, b) => (b.placement / b.fieldSize < a.placement / a.fieldSize ? b : a))
  return `${best.name} ${best.placement}위 / ${best.fieldSize}팀`
}

/** 커리어가 끝났을 때 보는 엔딩 화면. isNew면 도감에 처음 기록된 엔딩이다. */
export function endingScreen(ctx: Ctx, state: GameState, isNew: boolean): HTMLElement {
  const id = state.finished
  if (!id) throw new Error('끝나지 않은 판이다')
  const def = endingDef(id)
  const best = bestStageOf(state)

  if (id === 'legend' || id === 'hidden_loyal') requestAnimationFrame(() => celebrate('UR'))
  else if (id === 'world_finalist') requestAnimationFrame(() => celebrate('SR'))

  const row = (label: string, value: string) => h('div', { class: 'kv-row' }, h('span', { class: 'muted' }, label), h('b', {}, value))

  return h(
    'main',
    { class: 'screen ending' },
    h('p', { class: 'eyebrow' }, '커리어 종료'),
    h(
      'section',
      { class: `card headline ${id === 'legend' || id === 'hidden_loyal' ? 'gold' : ''}` },
      endingArt(id),
      isNew && h('span', { class: 'chip new-chip' }, '도감에 새로 기록!'),
      h('p', { class: 'headline-title' }, def.name),
      h('p', { class: 'event-text' }, def.epilogue.replaceAll('{name}', state.name)),
    ),
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
