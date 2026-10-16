import endings from '../data/endings.json'
import genres from '../data/genres.json'
import { genrePower } from '../engine/power.ts'
import { earnedAchievements } from '../engine/achievements.ts'
import { acceptOffer, eventsFor, retire, settleSeason, stageName, type EventResult, type SeasonReport } from '../engine/season.ts'
import type { GameState } from '../engine/state.ts'
import { startNextSeason } from '../engine/turn.ts'
import { recordFinish, saveGame } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { h } from './dom.ts'
import { formatMoney, formatMoneyDelta } from './format.ts'
import { changeLine, statChangeBars } from './turnResult.ts'
import { showContract } from './contractScene.ts'
import { offerButton } from './offerView.ts'
import { LEVEL_TEXT } from '../engine/highlights.ts'
import { canNegotiate } from '../engine/negotiation.ts'
import { openNegotiation } from './negotiationView.ts'
import { openSheet } from './sheet.ts'

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
      const before = ctx.meta
      const isNew = !before.endings[state.finished]
      const achievements = earnedAchievements(state).map((id) => ({ id, isNew: !before.achievements[id] }))
      ctx.meta = recordFinish(ctx.storage, state)
      ctx.toEnding(state, { isNew, achievements })
      return
    }
    const next = startNextSeason(state)
    saveGame(ctx.storage, next)
    ctx.toHome(next)
    scrollTo(0, 0)
  }

  /** 튜토리얼은 월드 챔피언십 우승 전까지 중간 은퇴를 막는다 (나이가 다 차거나 월드 우승으로만 끝난다) */
  const canRetire = () => !state.finished && (state.mode !== 'tutorial' || state.worldTitles >= 1)

  /** 자진 은퇴: 지금까지의 기록으로 커리어를 마무리한다 (되돌릴 수 없어서 한 번 더 묻는다) */
  const askRetire = async () => {
    const yes = await openSheet<boolean>((close) =>
      h(
        'div',
        { class: 'stack-tight' },
        h('p', { class: 'eyebrow' }, '은퇴'),
        h('p', { class: 'event-text' }, '지금 은퇴하면 커리어가 끝나고 엔딩을 보게 된다. 되돌릴 수 없다.'),
        h('button', { class: 'btn primary', onclick: () => close(false) }, '계속 도전한다'),
        h('button', { class: 'btn ghost small', onclick: () => close(true) }, '은퇴한다'),
      ),
    )
    if (!yes) return
    state = retire(state)
    proceed()
  }

  const choose = async (index: number | null) => {
    const offer = index === null ? null : state.pendingOffers?.offers[index]
    const pending = state
    state = acceptOffer(state, index)
    if (offer && pending.pendingOffers) {
      const kind = pending.pendingOffers.kind
      await showContract(pending, offer, kind === 'scout' ? 'join' : kind, pending.pendingOffers.stage)
      // 새 계약을 맺었으니 월급을 협상할 수 있다
      state = await openNegotiation(state)
    }
    joined = offer ? `${offer.team.name}에 합류했다.` : pending.pendingOffers?.kind === 'callup' ? '콜업을 거절하고 프로 2부에 남기로 했다.' : '제안을 거절했다.'
    render()
  }

  /** 계약 중에도 시즌 결산 때 한 번 월급 인상을 요구해 볼 수 있다 */
  const negotiateCard = () =>
    !state.finished && !state.pendingOffers && canNegotiate(state)
      ? h('section', { class: 'card' }, h('h3', {}, '연봉 협상'), h('p', { class: 'muted small' }, '이번 시즌 성적을 근거로 월급 인상을 요구해 볼 수 있다. (시즌당 한 번)'), h('button', { class: 'btn small', onclick: async () => ((state = await openNegotiation(state)), render()) }, '연봉 협상하기'))
      : null

  /** 시즌 활약: 리그 성적, 평점·리그 내 수준, 평점 순위표, 수상 기록 */
  const highlightsCard = () => {
    const hl = report.highlights
    if (!hl.league && hl.awards.length === 0) return null
    return h(
      'section',
      { class: 'card' },
      h('h3', {}, '시즌 활약'),
      hl.league &&
        h(
          'div',
          { class: 'stack-tight' },
          h('p', { class: 'headline-title' }, `평점 ${hl.rating.toFixed(1)} · ${LEVEL_TEXT[hl.level]}`),
          h(
            'p',
            { class: 'muted small' },
            `${hl.league.name} ${hl.league.wins}승 ${hl.league.losses}패 · 팀 ${hl.league.placement}위 / ${hl.league.size}팀${hl.league.expected ? ` (기대 ${hl.league.expected}위)` : ''} · 선수 평점 ${hl.ratingRank}위 / ${hl.players}명`,
          ),
          ...hl.board.map((l) =>
            h('div', { class: `event-row${l.isPlayer ? ' mine' : ''}` }, h('div', { class: 'row' }, h('span', {}, `${l.rank}위 ${l.name}`), h('b', {}, l.rating.toFixed(1))), h('span', { class: 'muted small' }, l.team)),
          ),
        ),
      hl.awards.length > 0 ? h('div', { class: 'chips' }, ...hl.awards.map((a) => h('span', { class: 'chip award', title: a.desc }, `🏆 ${a.name}`))) : h('p', { class: 'muted small' }, '이번 시즌 수상 기록은 없다.'),
      ...hl.awards.map((a) => h('p', { class: 'muted small' }, `${a.name}: ${a.desc}`)),
    )
  }

  const offersCard = () => {
    const pending = state.pendingOffers
    if (!pending) return joined ? h('section', { class: 'card' }, h('h3', {}, '입단·이적'), h('p', { class: 'muted' }, joined)) : null
    return h(
      'section',
      { class: 'card' },
      h('h3', {}, pending.kind === 'scout' ? '입단 제안 (하나를 골라야 한다)' : pending.kind === 'callup' ? '1부 콜업 제안 (거절하면 2부에 남는다)' : '이적 제안 (거절할 수 있다)'),
      h(
        'div',
        { class: 'choices vertical' },
        ...pending.offers.map((o, i) => offerButton(state, o, () => choose(i))),
      ),
      pending.kind !== 'scout' && h('button', { class: 'btn ghost small', onclick: () => choose(null) }, pending.kind === 'callup' ? '콜업을 거절하고 2부에 남는다' : '이적하지 않는다'),
    )
  }

  function render() {
    const head = headline(before, report)
    const tags: string[] = []
    if (report.promoted) tags.push(`승급 ▲ ${stageName(report.stageBefore)} → ${stageName(report.stageAfter)}`)
    if (report.pendingOffers?.kind === 'callup') tags.push('1부 콜업 제안 도착')
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
        statChangeBars(startStats, before.stats),
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
            h('span', { class: 'muted small' }, `명성 ${signed(e.fame)}${e.money > 0 ? ` · 상금 +${formatMoney(e.money)}` : ''}`),
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
      highlightsCard(),
      h(
        'section',
        { class: 'card' },
        h('h3', {}, '이번 시즌 합계'),
        changeLine('명성', String(Math.round(before.fame)), String(Math.round(settled.fame)), fameGain === 0 ? '±0' : signed(fameGain), fameGain),
        changeLine('돈', formatMoney(before.money), formatMoney(settled.money), moneyGain === 0 ? '±0' : formatMoneyDelta(moneyGain), moneyGain),
      ),
      offersCard(),
      negotiateCard(),
      state.finished && h('section', { class: 'card' }, h('h3', {}, '기록'), h('p', { class: 'muted' }, state.rerolls > 0 ? `능력치 뽑기를 ${state.rerolls}번 다시 뽑았다.` : '능력치 뽑기를 한 번에 확정했다.')),
      h(
        'button',
        { class: 'btn primary', disabled: !!state.pendingOffers, onclick: proceed },
        state.finished ? '커리어 마무리' : state.pendingOffers ? '제안을 골라 주세요' : `${before.season + 1}시즌 시작`,
      ),
      canRetire() && h('button', { class: 'btn ghost small', onclick: askRetire }, '여기서 은퇴하기'),
    ]
    root.replaceChildren(...parts.filter((p): p is HTMLElement => !!p))
  }

  render()
  // 콜업 제안이 오면 알림을 띄운다
  if (report.pendingOffers?.kind === 'callup') {
    const n = report.pendingOffers.offers.length
    void openSheet<void>((close) =>
      h('div', { class: 'stack-tight' }, h('p', { class: 'eyebrow' }, '콜업 알림'), h('p', { class: 'event-text' }, `프로 1부 팀 ${n}곳에서 콜업 제안이 도착했다! 결과 화면 아래에서 확인하자.`), h('button', { class: 'btn primary', onclick: () => close() }, '확인')),
    )
  }
  return root
}
