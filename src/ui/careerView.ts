import { stageName } from '../engine/season.ts'
import { leagueDef } from '../engine/leagues.ts'
import type { Career } from '../engine/career.ts'
import { h } from './dom.ts'
import { openSheet } from './sheet.ts'

const RANK_ICON = { 3: '🏆', 2: '🥇', 1: '⭐' } as const

/** 같은 수상은 묶어서 "월드 챔피언십 우승 ×2 (24세 · 27세)"처럼 보여 준다 */
function groupedHonors(career: Career) {
  const map = new Map<string, { title: string; rank: 1 | 2 | 3; ages: number[] }>()
  for (const hn of career.honors) {
    const key = `${hn.rank}|${hn.title}`
    const cur = map.get(key) ?? { title: hn.title, rank: hn.rank, ages: [] }
    cur.ages.push(hn.age)
    map.set(key, cur)
  }
  return [...map.values()].sort((a, b) => b.rank - a.rank || b.ages.length - a.ages.length)
}

/** 경력 화면 내용을 부분별로 나눠 돌려준다 (엔딩 화면은 탭으로 하나씩 보여 준다) */
export function careerParts(career: Career): { totals: HTMLElement; awards: HTMLElement; clubs: HTMLElement } {
  const t = career.totals
  const kv = (label: string, value: string) => h('div', { class: 'kv-row' }, h('span', { class: 'muted' }, label), h('b', {}, value))
  const honors = groupedHonors(career)
  return {
    totals: h(
      'section',
      { class: 'card' },
      h('h3', {}, '통산 기록'),
      kv('활동', `${t.seasons}시즌`),
      kv('거친 구단', `${t.teams}곳`),
      kv('우승', `${t.titles}회 (월드 챔피언십 ${t.worldTitles}회)`),
      kv('월드 챔피언십 진출', `${t.worldAppearances}회`),
      kv('개인 수상', `${t.awards}회`),
      t.bestRating !== null && kv('최고 시즌 평점', t.bestRating.toFixed(1)),
    ),
    awards: h(
      'section',
      { class: 'card' },
      h('h3', {}, '수상 경력'),
      honors.length === 0
        ? h('p', { class: 'muted small' }, '아직 수상 기록이 없어요.')
        : h('div', { class: 'stack-tight' }, ...honors.map((g) => h('div', { class: 'event-row' }, h('div', { class: 'row' }, h('b', {}, `${RANK_ICON[g.rank]} ${g.title}${g.ages.length > 1 ? ` ×${g.ages.length}` : ''}`)), h('span', { class: 'muted small' }, g.ages.map((a) => `${a}세`).join(' · '))))),
    ),
    clubs: h(
      'section',
      { class: 'card' },
      h('h3', {}, '거쳐 간 구단'),
      career.stints.length === 0
        ? h('p', { class: 'muted small' }, '아직 소속된 구단이 없어요.')
        : h(
            'div',
            { class: 'stack-tight' },
            ...career.stints.map((s) => {
              const lg = s.league ? leagueDef(s.league) : null
              const span = s.fromAge === s.toAge ? `${s.fromAge}세` : `${s.fromAge}~${s.toAge}세`
              return h('div', { class: 'event-row' }, h('div', { class: 'row' }, h('b', {}, s.teamName), h('span', { class: 'chip' }, s.current ? '현재' : `${s.seasons}시즌`)), h('span', { class: 'muted small' }, `${span} · ${stageName(s.stage)}${lg && !lg.domestic ? ` · ${lg.name}` : ''}`))
            }),
          ),
    ),
  }
}

/** 경력 화면 내용: 통산 숫자, 수상 경력, 거쳐 간 구단. 육성 중 팝업·명예의 전당이 같이 쓴다. */
export function careerSections(career: Career): HTMLElement[] {
  const p = careerParts(career)
  return [p.totals, p.awards, p.clubs]
}

/** 육성 중에 경력을 보는 팝업 */
export function openCareer(career: Career, title = '내 경력'): Promise<void> {
  return openSheet<void>((close) => h('div', { class: 'stack-tight career-sheet' }, h('h3', {}, title), ...careerSections(career), h('button', { class: 'btn', onclick: () => close() }, '닫기')))
}
