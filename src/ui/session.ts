import modes from '../data/modes.json'
import { AD_TYPES, dueShoots, performShoot, type AdType } from '../engine/ads.ts'
import { buildCareer } from '../engine/career.ts'
import { rollEvent, turnRng } from '../engine/events.ts'
import { facilityEffectLines } from '../engine/facilities.ts'
import { rollMiniGame } from '../engine/minigame.ts'
import { canNegotiate } from '../engine/negotiation.ts'
import { autoTurn } from '../engine/plan.ts'
import { genrePower } from '../engine/power.ts'
import { acceptOffer, requestTransfer, rollMidSeasonOffer, rollMidSeasonPromotion, stageName, transferBlocker } from '../engine/season.ts'
import type { ActionId, GameState } from '../engine/state.ts'
import { applyCoachSwap, coachSwapOffer, trainingValue, type CoachOffer } from '../engine/training.ts'
import { ACTIONS, ageShiftPerTurn, turnsPerSeason } from '../engine/turn.ts'
import type { StatKey } from '../engine/types.ts'
import { saveGame } from '../save/storage.ts'
import { playAdShoot } from './adShoot.ts'
import type { Ctx } from './app.ts'
import { playTimeline } from './calendarUi.ts'
import { openCareer } from './careerView.ts'
import { confirmSheet } from './confirm.ts'
import { showContract } from './contractScene.ts'
import { h } from './dom.ts'
import { runEvent } from './eventFlow.ts'
import { offerMiniGame } from './miniGame.ts'
import { openNegotiation } from './negotiationView.ts'
import { confirmOffer, offerButton } from './offerView.ts'
import { actionTags } from './preview.ts'
import { outfitLook } from './roomScene.ts'
import { openSheet } from './sheet.ts'
import { openShop as openShopSheet } from './shopSheet.ts'
import { playSfx, vibrate } from './sound.ts'
import { showGuideOnce } from './guides.ts'
import { askCafeTeamName } from './teamNameSheet.ts'
import { turnChangeGraph } from './turnResult.ts'

/** 계약 유형별 촬영 횟수 */
const AD_SHOOTS = Object.fromEntries(Object.entries(AD_TYPES).map(([k, v]) => [k, v.shoots])) as Record<AdType, number>

/** 직전에 화면에 보여 준 값: 달라진 숫자는 이 값에서 새 값으로 올라가는(내려가는) 연출을 한다 */
export interface Shown {
  money: number
  fame: number
  power: number
  stats: Record<StatKey, number>
}

const shownOf = (s: GameState): Shown => ({ money: s.money, fame: s.fame, power: Math.round(genrePower(s.stats, s.genre)), stats: { ...s.stats } })

/**
 * 육성 중인 판의 상태와 행동. 탭 뷰들이 같은 세션을 구독해 다시 그린다.
 * 상태가 바뀌면 `commit`으로 저장하고 구독자에게 알린다.
 */
export class GameSession {
  state: GameState
  busy = false
  /** 마지막으로 보여 준 에러 문구 (다음 그리기에서 한 번 보인다) */
  error = ''
  shown: Shown
  private listeners = new Set<() => void>()

  readonly ctx: Ctx

  constructor(ctx: Ctx, initial: GameState) {
    this.ctx = ctx
    this.state = initial
    this.shown = shownOf(initial)
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }

  /** 저장 없이 다시 그리게만 한다 (진행 중 busy 표시 등) */
  refresh(): void {
    for (const fn of [...this.listeners]) fn()
  }

  /** 상태를 바꾸고 저장하고 구독자를 부른다. 구독자가 그린 뒤 `shown`이 새 값으로 바뀐다. */
  commit(next: GameState): void {
    this.state = next
    saveGame(this.ctx.storage, next)
    this.refresh()
    this.error = ''
    this.shown = shownOf(next)
  }

  seasonOver(): boolean {
    return this.state.turnInSeason >= turnsPerSeason(this.state.mode)
  }

  /** 다음 턴: 계획대로 자동으로 진행하고, 결과·대회·이벤트·제안만 플레이어에게 보여 준다. */
  async playTurn(): Promise<void> {
    if (this.busy || !this.state.seasonTraining) return
    // PC방 대회는 시즌 중간에 열리므로, 출전 전에 팀 이름을 정한다
    this.busy = true
    await this.askTeamName()
    const before = this.state
    const { result: r, choice } = autoTurn(this.state)
    if (!r.ok) {
      this.busy = false
      this.error = r.error
      this.refresh()
      return
    }
    this.refresh()
    let next = r.state
    // 시간이 흘러가는 연출 (대회가 끝나는 시점마다 결과 카드)
    await playTimeline({ before, calendar: r.calendar, actions: choice.map((c) => ACTIONS[c.id].name), beforeBroadcast: () => showGuideOnce(this.ctx, 'broadcast') })
    if (next.injuredMonths > before.injuredMonths) {
      playSfx('hurt')
      vibrate([120, 60, 120])
    }
    await showGuideOnce(this.ctx, 'turnResult')
    await openSheet<void>((close) =>
      h(
        'div',
        { class: 'stack-tight' },
        h('p', { class: 'eyebrow' }, `${modes[before.mode].turnMonths}개월이 지났다`),
        ...r.notes.map((n) => h('p', { class: 'risk' }, `⚠ ${n}`)),
        turnChangeGraph(before, next, { ageShift: ageShiftPerTurn(before) }),
        facilityEffectLines(next).length > 0 &&
          h('div', { class: 'stack-tight facility-effects' }, h('p', { class: 'eyebrow' }, '시설 덕분에'), ...facilityEffectLines(next).map((line) => h('p', { class: 'muted small' }, line))),
        h('button', { class: 'btn primary', onclick: () => close() }, '다음'),
      ), { variant: 'result' })
    const coach = coachSwapOffer(next, r.calendar.beats)
    if (coach) next = await this.askCoachSwap(next, coach)
    const event = rollEvent(next, turnRng(next))
    if (event) {
      await showGuideOnce(this.ctx, 'event')
      next = await runEvent(next, event)
    }
    next = await this.runAdShoots(next)
    next = await this.askPromotion(rollMidSeasonPromotion(next))
    next = await this.askMidSeasonOffer(rollMidSeasonOffer(next))
    // 시즌이 이어질 때 가끔(약 30%): 쉬는 시간 미니게임(건너뛰어도 되고, 잘하면 다음 턴 훈련 효율이 조금 오른다)
    const mini = !next.finished && !next.pendingOffers && next.turnInSeason < turnsPerSeason(next.mode) ? rollMiniGame(next) : null
    if (mini) {
      await showGuideOnce(this.ctx, 'minigame')
      next = await offerMiniGame(next, mini)
    }
    this.busy = false
    this.commit(next)
    scrollTo(0, 0)
  }

  /** 합류하고 한 턴이 지난 뒤, 시즌당 한 번 월급 인상을 요구한다 */
  async negotiate(): Promise<void> {
    if (this.busy || !canNegotiate(this.state)) return
    this.busy = true
    const next = await openNegotiation(this.state)
    this.busy = false
    this.commit(next)
  }

  /** 시즌 중간에 플레이어가 이적을 요청한다. 다른 팀 제안을 받아 보고, 거절하면 남는다. */
  async requestMidTransfer(): Promise<void> {
    if (this.busy || transferBlocker(this.state, 'mid')) return
    const ok = await confirmSheet({
      title: '이적 요청',
      message: `${this.state.team?.name ?? '지금 팀'}에 이적을 요청할까요? 다른 팀의 제안을 받아 보고, 마음에 안 들면 남을 수 있어요. (시즌 중간 요청은 시즌당 한 번)`,
      ok: '이적 요청하기',
    })
    if (!ok) return
    const r = requestTransfer(this.state, 'mid')
    if (!r.ok) {
      this.error = r.error
      this.refresh()
      return
    }
    this.busy = true
    let next: GameState
    if (r.success) next = await this.askMidSeasonOffer(r.state, true)
    else {
      next = r.state
      await confirmSheet({ title: '이적 요청', message: '아직 관심을 보이는 팀이 없다. 이번 시즌 중간 요청은 여기까지다. 성적과 명성을 더 쌓으면 기회가 온다.', ok: '확인', cancel: '닫기' })
    }
    this.busy = false
    this.commit(next)
  }

  async openShop(): Promise<void> {
    if (this.busy) return
    this.busy = true
    await showGuideOnce(this.ctx, 'shop')
    const next = await openShopSheet(this.state)
    this.busy = false
    this.commit(next)
  }

  async showCareer(): Promise<void> {
    await openCareer(buildCareer(this.state))
  }

  /** PC방 대회에 처음 나가기 전에 팀 이름을 직접 짓게 한다. */
  async askTeamName(): Promise<void> {
    this.state = await askCafeTeamName(this.ctx.storage, this.state)
  }

  /** 코치의 훈련 교체 제안: 부족한 능력치를 채워 주는 후보 중 하나로 바꾸거나 지금 훈련을 유지한다. 어느 쪽이든 이번 시즌 제안은 끝난다. */
  private async askCoachSwap(s: GameState, offer: CoachOffer): Promise<GameState> {
    const picked = await openSheet<ActionId | null>((close) =>
      h(
        'div',
        { class: 'stack-tight' },
        h('p', { class: 'eyebrow' }, '코치의 제안'),
        h('p', { class: 'event-text' }, `${offer.eventName}에서 지금 ${offer.rank}위야. 우리 전력과 네 실력이면 ${offer.expected}위권은 해야 하는데... 지금 하는 ${ACTIONS[s.seasonTraining!].name}을(를) 다른 훈련으로 바꿔 볼래?`),
        h(
          'div',
          { class: 'choices vertical' },
          ...offer.options.map((t) => {
            // 지금 훈련보다 실력치를 더 많이 올려 주는 제안은 강조한다
            const better = trainingValue(s, t) > trainingValue(s, s.seasonTraining!)
            return h(
              'button',
              { class: `choice${better ? ' best' : ''}`, onclick: () => close(t) },
              h('strong', {}, better && h('span', { class: 'best-star' }, '★ '), `${ACTIONS[t].name}으로 바꾼다`, better && h('span', { class: 'best-tag' }, '지금보다 도움')),
              h('span', { class: 'muted small' }, actionTags({ id: t }, s).join(' · ')),
            )
          }),
        ),
        h('button', { class: 'btn ghost small', onclick: () => close(null) }, `지금 훈련(${ACTIONS[s.seasonTraining!].name})을 유지한다`),
      ), { variant: 'decision' })
    return applyCoachSwap(s, picked)
  }

  /** 시즌 도중 승급 제안: 실력과 성적이 되면 시즌이 끝나길 기다리지 않고 위 단계 팀에서 연락이 온다. 받으면 바로 올라간다. */
  private async askPromotion(s: GameState): Promise<GameState> {
    const pending = s.pendingOffers
    if (!pending || pending.kind !== 'callup') return s
    await showGuideOnce(this.ctx, 'midOffer')
    const stage = pending.stage ?? 'pro1'
    const index = await openSheet<number | null>((close) =>
      h(
        'div',
        { class: 'stack-tight' },
        h('p', { class: 'eyebrow' }, `${stageName(stage)} 승급 제안`),
        h('p', { class: 'event-text' }, `이번 시즌 활약을 본 ${stageName(stage)} 팀들에서 연락이 왔다. 시즌이 끝나길 기다리지 않고 지금 올라갈까?`),
        h('div', { class: 'choices vertical' }, ...pending.offers.map((o, i) => offerButton(s, o, () => close(i), stage, true))),
        h('button', { class: 'btn ghost small', onclick: () => close(null) }, `지금 팀에 남는다`),
      ), { variant: 'decision' })
    if (index !== null) await showContract(s, pending.offers[index], 'callup', stage)
    return acceptOffer(s, index)
  }

  /** 시즌 도중 다른 팀에서 온 이적 제안. 하나를 골라 옮기거나 남는다. */
  private async askMidSeasonOffer(s: GameState, requested = false): Promise<GameState> {
    const pending = s.pendingOffers
    if (!pending) return s
    await showGuideOnce(this.ctx, 'midOffer')
    // 손해가 있는 제안을 골랐다가 '다시 생각한다'를 누르면 제안 목록으로 돌아간다
    let index: number | null
    for (;;) {
      index = await this.pickMidSeasonOffer(s, pending, requested)
      if (index === null || (await confirmOffer(s, pending.offers[index]))) break
    }
    if (index !== null) await showContract(s, pending.offers[index], 'transfer')
    // 새 계약 직후에는 월급을 협상할 수 없다. 한 턴이 지나면 '연봉 협상'이 열린다.
    return acceptOffer(s, index)
  }

  private pickMidSeasonOffer(s: GameState, pending: NonNullable<GameState['pendingOffers']>, requested: boolean): Promise<number | null> {
    return openSheet<number | null>((close) =>
      h(
        'div',
        { class: 'stack-tight' },
        h('p', { class: 'eyebrow' }, '이적 제안'),
        h('p', { class: 'event-text' }, requested ? `이적을 요청하자 다른 팀들이 관심을 보인다. 지금 ${s.team?.name ?? '팀'}을(를) 떠날까?` : `시즌 도중에 다른 팀에서 연락이 왔다. 지금 ${s.team?.name ?? '팀'}을(를) 떠날까?`),
        h('div', { class: 'choices vertical' }, ...pending.offers.map((o, i) => offerButton(s, o, () => close(i), undefined, true))),
        h('button', { class: 'btn ghost small', onclick: () => close(null) }, '지금 팀에 남는다'),
      ), { variant: 'decision' })
  }

  /** 일정이 된 광고 촬영을 연출과 함께 치른다 */
  private async runAdShoots(s: GameState): Promise<GameState> {
    if (s.finished || s.pendingOffers) return s
    let cur = s
    for (const due of dueShoots(s)) {
      const result = performShoot(cur, due.contract.id)
      await playAdShoot({ brand: due.contract.brand, category: due.contract.category, type: due.contract.type, index: due.index, shoots: AD_SHOOTS[due.contract.type], paid: result.paid, look: outfitLook(cur) })
      cur = result.state
    }
    return cur
  }
}
