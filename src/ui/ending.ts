import genres from '../data/genres.json'
import { achievementDef } from '../engine/achievements.ts'
import { buildCareer } from '../engine/career.ts'
import { endingDef } from '../engine/endings.ts'
import { assetGrade, homeEpilogue, netWorth } from '../engine/life.ts'
import { stageName } from '../engine/season.ts'
import type { EndingId, GameState } from '../engine/state.ts'
import { bestStageOf } from '../save/storage.ts'
import type { Ctx, EndingInfo } from './app.ts'
import { careerParts } from './careerView.ts'
import { segmented } from './components.ts'
import { openSheet } from './sheet.ts'
import { celebrate } from './confetti.ts'
import { h } from './dom.ts'
import { endingSceneSvg } from './endingScenes.ts'
import { MODE_INFO } from './labels.ts'
import { formatMoney } from './format.ts'
import { openResultCard } from './resultCard.ts'
import { dismissAllSheets } from './confirm.ts'
import { endingSupportCard } from './support.ts'

/**
 * 엔딩 그림 자리. 지금은 코드로 그린 도트 장면(`endingScenes.ts`)이고, 일러스트가 준비되면 이미지로 바꾼다.
 * data-art 값(ending_<id>)이 이미지 파일 이름이다. 필요한 장면 목록은 docs/ending-images.md.
 * hero는 엔딩 화면의 큰 그림, thumb는 도감의 작은 그림. 못 본 엔딩(locked)은 ?로 가린다.
 */
/** 월드 우승 엔딩들 (폭죽·금색 카드) */
const CHAMPION_ENDINGS: EndingId[] = ['hidden_loyal', 'goat', 'emperor', 'two_time', 'legend']

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

type RecordTab = 'summary' | 'awards' | 'clubs' | 'seasons'

/** 시즌별 타임라인에 먼저 보이는 최근 시즌 수 */
const RECENT_SEASONS = 6

/** 커리어가 끝났을 때 보는 엔딩 화면: 한 화면 + 기록 탭(요약·수상·구단·시즌별). */
export function endingScreen(ctx: Ctx, state: GameState, { isNew, achievements, tokens }: EndingInfo): HTMLElement {
  const id = state.finished
  if (!id) throw new Error('끝나지 않은 판이다')
  dismissAllSheets()
  const def = endingDef(id)
  const best = bestStageOf(state)
  const parts = careerParts(buildCareer(state))
  let tab: RecordTab = 'summary'
  let showAllSeasons = false

  if (CHAMPION_ENDINGS.includes(id) || achievements.length > 0) requestAnimationFrame(() => celebrate('UR'))
  else if (id === 'world_finalist') requestAnimationFrame(() => celebrate('SR'))

  const row = (label: string, value: string) => h('div', { class: 'kv-row' }, h('span', { class: 'muted' }, label), h('b', {}, value))
  const root = h('main', { class: 'screen ending' })

  const openAchievements = () =>
    openSheet<void>(
      () =>
        h(
          'div',
          { class: 'stack-tight' },
          h('h2', {}, '이번 판의 업적'),
          ...achievements.map((a) => {
            const d = achievementDef(a.id)
            return h('section', { class: 'card achievement' }, h('p', { class: 'eyebrow' }, a.isNew ? '업적 달성!' : '업적 (재달성)'), h('p', { class: 'headline-title' }, `🏅 ${d.name}`), h('p', { class: 'muted' }, d.desc))
          }),
          tokens > 0 && h('p', { class: 'muted small' }, '타이틀의 업적 상점에서 다음 판을 도와줄 물건을 살 수 있어요.'),
        ),
      { variant: 'info' },
    )

  const seasonRow = (r: GameState['history'][number]) =>
    h('div', { class: 'event-row timeline-row' }, h('div', { class: 'row' }, h('b', {}, `${r.age}세 · ${stageName(r.stage)}`)), h('span', { class: 'muted small' }, bestOfSeason(r.events) + (r.highlights ? ` · 평점 ${r.highlights.rating.toFixed(1)}${r.highlights.awards.length ? ` · 🏆 ${r.highlights.awards.join(', ')}` : ''}` : '')))

  const tabBody = (): HTMLElement => {
    if (tab === 'awards') return parts.awards
    if (tab === 'clubs') return parts.clubs
    if (tab === 'seasons') {
      const all = state.history
      const hidden = showAllSeasons ? 0 : Math.max(0, all.length - RECENT_SEASONS)
      return h(
        'section',
        { class: 'card' },
        h('h3', {}, '시즌별 기록'),
        all.length === 0 && h('p', { class: 'muted small' }, '남은 시즌 기록이 없어요.'),
        hidden > 0 && h('button', { class: 'btn ghost small', type: 'button', onclick: () => ((showAllSeasons = true), draw()) }, `이전 ${hidden}시즌 더 보기`),
        ...all.slice(hidden).map(seasonRow),
      )
    }
    return h(
      'div',
      { class: 'stack-tight' },
      parts.totals,
      h(
        'section',
        { class: 'card' },
        h('h3', {}, '커리어 요약'),
        row('선수', `${state.name} · ${genres[state.genre].name} · ${MODE_INFO[state.mode].name}`),
        row('마지막 나이', `${state.age}세 (${state.season}시즌)`),
        row('가장 높이 오른 곳', stageName(best)),
        row('월드 챔피언십', state.worldTitles > 0 ? `우승 ${state.worldTitles}회` : state.worldAppearances > 0 ? `진출 ${state.worldAppearances}회` : '진출 없음'),
        row('최종 자산', `${assetGrade(state)} (${formatMoney(Math.round(netWorth(state)))})`),
        row('능력치 뽑기', state.rerolls > 0 ? `${state.rerolls}번 다시 뽑음` : '한 번에 확정'),
      ),
    )
  }

  function draw() {
    root.replaceChildren(
      h('p', { class: 'eyebrow' }, '커리어 종료'),
      h(
        'section',
        { class: `card headline ${CHAMPION_ENDINGS.includes(id!) ? 'gold' : ''}` },
        endingArt(id!, false, 'hero'),
        isNew && h('span', { class: 'chip new-chip' }, '도감에 새로 기록!'),
        h('p', { class: 'headline-title' }, def.name),
        h('p', { class: 'event-text' }, def.epilogue.replaceAll('{name}', state.name)),
        homeEpilogue(state) && h('p', { class: 'muted small' }, homeEpilogue(state)),
      ),
      achievements.length > 0
        ? h('div', { class: 'card achievement-line' }, h('span', {}, `🏅 업적 ${achievements.length}개${tokens > 0 ? ` · 🪙 +${tokens}` : ''}`), h('button', { class: 'link-btn', type: 'button', onclick: () => void openAchievements() }, '전체 보기 ›'))
        : '',
      segmented<RecordTab>(
        [
          { id: 'summary', label: '요약' },
          { id: 'awards', label: '수상' },
          { id: 'clubs', label: '구단' },
          { id: 'seasons', label: '시즌별' },
        ],
        tab,
        (t) => ((tab = t), draw()),
      ),
      tabBody(),
      h(
        'div',
        { class: 'plan-cta' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => void openResultCard(state) }, '결과 카드 만들기'),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: () => ctx.toCodex(() => ctx.toTitle()) }, '엔딩 도감 보기'), h('button', { class: 'btn', type: 'button', onclick: () => ctx.toTitle() }, '타이틀로')),
      ),
      endingSupportCard() ?? '',
    )
  }
  draw()
  return root
}
