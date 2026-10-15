import endings from '../data/endings.json'
import genres from '../data/genres.json'
import { genrePower } from '../engine/power.ts'
import { acceptOffer, eventsFor, settleSeason, stageName, type EventResult, type SeasonReport } from '../engine/season.ts'
import type { GameState } from '../engine/state.ts'
import { startNextSeason } from '../engine/turn.ts'
import { STAT_KEYS } from '../engine/types.ts'
import { recordFinish, saveGame } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { h } from './dom.ts'
import { STAT_LABEL } from './labels.ts'
import { showContract } from './contractScene.ts'
import { offerButton } from './offerView.ts'

const ENDING_NAME = Object.fromEntries(endings.order.map((e) => [e.id, e.name]))

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))
const delta = (n: number) => h('b', { class: n > 0 ? 'up' : n < 0 ? 'down' : 'flat' }, n === 0 ? '±0' : signed(n))

/** 이번 시즌 대표 성적: 참가한 대회 중 상대 순위가 가장 높은 것 (같으면 나중 대회) */
function bestEvent(events: EventResult[]): EventResult | null {
  let best: EventResult | null = null
  for (const e of events) if (!best || e.placement / e.fieldSize <= best.placement / best.fieldSize) best = e
  return best
}

function headline(before: GameState, report: SeasonReport): { title: string; sub: string; tone: string } {
  const best = bestEvent(report.events)
  if (report.worldChampion) return { title: '🏆 월드 챔피언십 우승!', sub: '정점에 올랐다.', tone: 'gold' }
  const test = report.tests[report.tests.length - 1]
  if (!best && test) return { title: test.passed ? `✅ ${test.name} 합격` : `${test.name} 불합격`, sub: test.passed ? '새로운 무대가 열린다.' : '아쉽지만 길은 아직 남아 있다.', tone: test.passed ? 'gold' : '' }
  if (!best) return { title: '대회 없는 시즌', sub: '아직 무대에 서기 전, 실력을 쌓는 시간이었다.', tone: '' }
  const worldIds = new Set(eventsFor(before).filter((e) => e.world).map((e) => e.id))
  const medal = best.placement === 1 ? '🥇 우승' : best.placement === 2 ? '🥈 준우승' : best.placement === 3 ? '🥉 3위' : `${best.placement}위`
  const world = report.events.some((e) => worldIds.has(e.id))
  return {
    title: `${medal} · ${best.name}`,
    sub: `${best.fieldSize}팀 중 ${best.placement}위${world ? ' · 월드 챔피언십 진출' : ''}`,
    tone: best.placement === 1 ? 'gold' : best.placement <= 3 ? 'silver' : '',
  }
}

/** 시즌 결산 화면. 결산은 시드로 정해지므로, 다음 시즌을 시작하기 전까지는 저장하지 않아도 다시 열면 같은 결과가 나온다. */
export function seasonScreen(ctx: Ctx, before: GameState): HTMLElement {
  const { state: settled, report } = settleSeason(before)
  let state = settled
  let joined: string | null = null
  const root = h('main', { class: 'screen season' })

  const startStats = before.seasonStartStats ?? before.stats
  const genre = genres[before.genre].name
  const powerBefore = Math.round(genrePower(startStats, before.genre))
  const powerAfter = Math.round(genrePower(before.stats, before.genre))
  const fameGain = Math.round(settled.fame - before.fame)
  const moneyGain = Math.round(settled.money - before.money)

  const proceed = () => {
    if (state.finished) {
      recordFinish(ctx.storage, state)
      ctx.toTitle() // 엔딩 화면(2단계 ④)이 붙기 전까지는 타이틀로 돌아간다
      return
    }
    const next = startNextSeason(state)
    saveGame(ctx.storage, next)
    ctx.toHome(next)
    scrollTo(0, 0)
  }

  const choose = async (index: number | null) => {
    const offer = index === null ? null : state.pendingOffers?.offers[index]
    const pending = state
    state = acceptOffer(state, index)
    if (offer && pending.pendingOffers) await showContract(pending, offer, pending.pendingOffers.kind === 'transfer' ? 'transfer' : 'join')
    joined = offer ? `${offer.team.name}에 합류했다.` : '제안을 거절했다.'
    render()
  }

  const offersCard = () => {
    const pending = state.pendingOffers
    if (!pending) return joined ? h('section', { class: 'card' }, h('h3', {}, '입단·이적'), h('p', { class: 'muted' }, joined)) : null
    return h(
      'section',
      { class: 'card' },
      h('h3', {}, pending.kind === 'scout' ? '입단 제안 (하나를 골라야 한다)' : '이적 제안 (거절할 수 있다)'),
      h(
        'div',
        { class: 'choices vertical' },
        ...pending.offers.map((o, i) => offerButton(state, o, () => choose(i))),
      ),
      pending.kind === 'transfer' && h('button', { class: 'btn ghost small', onclick: () => choose(null) }, '이적하지 않는다'),
    )
  }

  function render() {
    const head = headline(before, report)
    const tags: string[] = []
    if (report.promoted) tags.push(`승급 ▲ ${stageName(report.stageBefore)} → ${stageName(report.stageAfter)}`)
    if (report.relegated) tags.push(`강등 ▼ ${stageName(report.stageBefore)} → ${stageName(report.stageAfter)}`)
    if (state.finished) tags.push(`엔딩: ${ENDING_NAME[state.finished]}`)

    const parts = [
      h('p', { class: 'eyebrow' }, `${before.season}시즌 결산`),
      h('h2', {}, `${before.name} · ${before.age}세`),
      h(
        'section',
        { class: `card headline ${head.tone}` },
        h('p', { class: 'headline-title' }, head.title),
        h('p', { class: 'muted' }, head.sub),
        tags.length > 0 && h('div', { class: 'chips' }, ...tags.map((t) => h('span', { class: 'chip' }, t))),
      ),
      report.routeNotes.length > 0 && h('section', { class: 'card' }, h('h3', {}, '진로'), ...report.routeNotes.map((n) => h('p', {}, n))),
      ...report.tests.map((t) =>
        h(
          'section',
          { class: 'card' },
          h('div', { class: 'row' }, h('h3', {}, t.name), h('span', { class: t.passed ? 'place top' : 'place' }, t.passed ? '합격' : '불합격')),
          ...t.items.map((it) =>
            h(
              'div',
              { class: 'stat-row compact' },
              h('span', { class: 'stat-name' }, it.label),
              h('div', { class: 'bar' }, h('div', { class: `bar-fill${it.ratio < 0.8 ? ' low' : ''}`, style: `width:${Math.min(100, (it.ratio / 1.5) * 100)}%` })),
              h('span', { class: 'stat-value' }, `${Math.round(it.ratio * 100)}%`),
              h('span', {}),
            ),
          ),
          h('p', { class: 'muted small' }, `종합 ${Math.round(t.score * 100)}점 (합격선 100점${t.prep ? ' · 시험 준비 반영' : ''})`),
        ),
      ),
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'row' }, h('h3', {}, '능력치 변동'), h('span', { class: 'power' }, `${genre} 실력치 `, h('b', {}, `${powerBefore} → ${powerAfter} `), delta(powerAfter - powerBefore))),
        ...STAT_KEYS.map((k) => {
          const from = Math.round(startStats[k])
          const to = Math.round(before.stats[k])
          return h('div', { class: 'delta-row' }, h('span', { class: 'stat-name' }, STAT_LABEL[k]), h('span', { class: 'delta-vals muted' }, `${from} → ${to}`), delta(to - from))
        }),
      ),
      h(
        'section',
        { class: 'card' },
        h('h3', {}, '대회 성적'),
        report.events.length === 0 && h('p', { class: 'muted' }, '이번 시즌은 참가한 대회가 없다.'),
        ...report.events.map((e) =>
          h(
            'div',
            { class: 'event-row' },
            h('div', { class: 'row' }, h('b', {}, e.name), h('span', { class: e.placement <= 3 ? 'place top' : 'place' }, `${e.placement}위 / ${e.fieldSize}팀`)),
            h('span', { class: 'muted small' }, `명성 ${signed(e.fame)}${e.money > 0 ? ` · 상금 +${e.money}만` : ''}`),
          ),
        ),
        report.rival &&
          h(
            'div',
            { class: 'event-row' },
            h('div', { class: 'row' }, h('b', {}, '라이벌전'), h('span', { class: report.rival.won ? 'place top' : 'place' }, report.rival.won ? '승리' : '패배')),
            h('span', { class: 'muted small' }, report.rival.won ? '명성 보너스를 얻었다.' : '아쉽게 졌다.'),
          ),
      ),
      h(
        'section',
        { class: 'card' },
        h('h3', {}, '이번 시즌 합계'),
        h('div', { class: 'delta-row' }, h('span', { class: 'stat-name' }, '명성'), h('span', { class: 'delta-vals muted' }, `${Math.round(before.fame)} → ${Math.round(settled.fame)}`), delta(fameGain)),
        h('div', { class: 'delta-row' }, h('span', { class: 'stat-name' }, '돈'), h('span', { class: 'delta-vals muted' }, `${Math.round(before.money)}만 → ${Math.round(settled.money)}만`), delta(moneyGain)),
      ),
      offersCard(),
      state.finished && h('section', { class: 'card' }, h('h3', {}, '기록'), h('p', { class: 'muted' }, state.rerolls > 0 ? `능력치 뽑기를 ${state.rerolls}번 다시 뽑았다.` : '능력치 뽑기를 한 번에 확정했다.')),
      h(
        'button',
        { class: 'btn primary', disabled: !!state.pendingOffers, onclick: proceed },
        state.finished ? '커리어 마무리' : state.pendingOffers ? '제안을 골라 주세요' : `${before.season + 1}시즌 시작`,
      ),
    ]
    root.replaceChildren(...parts.filter((p): p is HTMLElement => !!p))
  }

  render()
  return root
}
