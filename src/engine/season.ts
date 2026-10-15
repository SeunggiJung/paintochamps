import competitions from '../data/competitions.json'
import rules from '../data/rules.json'
import stageData from '../data/stages.json'
import { evaluateEnding } from './endings.ts'
import { academyName, makeOpponents, pickTeams, type NamePool } from './field.ts'
import { mentalAdjusted, playSeries } from './match.ts'
import { genrePower } from './power.ts'
import { createRng, gaussian, mixSeed, type Rng } from './rng.ts'
import type { EndingId, EventRecord, GameState, ModeId, Offer, PendingOffers, SeasonRecord, StageId } from './state.ts'
import { runElimination, runLeague, type Team } from './tournament.ts'
import { isCareerOver, isSettled, turnScale, turnsPerSeason } from './turn.ts'
import type { GenreId } from './types.ts'

interface Reward {
  upTo: number
  fame: number
  money: number
}

export interface EventDef {
  id: string
  name: string
  /** 이 모드에서만 열린다 (없으면 모든 모드). 튜토리얼에서 빼려면 표준·정밀만 적는다. */
  modes?: ModeId[]
  format: 'league' | 'elimination'
  field?: { names: NamePool; tier: string; size: number }
  /** 앞선 이벤트 순위표의 상위 top팀으로 치른다 (플레이어가 거기 못 들면 열리지 않는다) */
  from?: { event: string; top: number }
  /** 이 진출권을 얻어야 열린다 */
  needs?: string
  rounds?: number
  k?: number
  bestOf: number
  /** 큰 경기: 플레이어 실력치에 멘탈 보정을 더한다 */
  big?: boolean
  /** 시즌 순위로 쓴다: 하위권이면 강등 */
  rank?: boolean
  /** 월드 챔피언십 */
  world?: boolean
  rewards: Reward[]
  qualifies?: { to: string; top: number }[]
  points?: number[]
  pointsQualify?: { to: string; minPoints: number }
}

interface StageDef {
  name: string
  next?: { minPower: number; minFame?: number; scout?: 'amateur' | 'pro' }
}

const STAGE_ORDER = stageData.order as StageId[]
const STAGES = stageData.stages as Record<StageId, StageDef>
const OFFERS = stageData.offers

/** 1부 일정의 모양: AOS형(리그 → 선발전 → 국제전 → 플레이오프 → 월드), FPS형(킥오프 → 스테이지 1·2 → 마스터즈 → 챔피언스) */
const CALENDAR_OF: Record<GenreId, 'aos' | 'fps'> = { aos: 'aos', rts: 'aos', fps: 'fps', fighting: 'fps' }

export function stageName(stage: StageId): string {
  return STAGES[stage].name
}

/** 이번 시즌에 치르는 대회 목록 */
export function eventsFor(state: Pick<GameState, 'stage' | 'genre' | 'mode'>): EventDef[] {
  const all = (state.stage === 'pro1' ? competitions.stages.pro1[CALENDAR_OF[state.genre]] : competitions.stages[state.stage]) as EventDef[]
  return all.filter((e) => !e.modes || e.modes.includes(state.mode))
}

/** 플레이어의 지금 장르 실력치. 큰 경기면 멘탈 보정을 더한다. */
export function playerPower(state: GameState, big: boolean): number {
  const r = genrePower(state.stats, state.genre)
  return big ? mentalAdjusted(r, state.stats.mental) : r
}

export interface EventResult extends EventRecord {
  fame: number
  money: number
}

export interface SeasonReport {
  stageBefore: StageId
  stageAfter: StageId
  events: EventResult[]
  rival: { won: boolean } | null
  relegated: boolean
  promoted: boolean
  /** 이번 시즌 얻은 진출권 id */
  qualified: string[]
  worldChampion: boolean
  finished: EndingId | null
  pendingOffers: PendingOffers | null
}

interface Outcome {
  order: Team[]
  placement: number
}

interface Ctx {
  rng: Rng
  outcomes: Map<string, Outcome>
  qualified: Set<string>
  points: number
}

function playerTeam(state: GameState, ev: EventDef, power: number): Team {
  const base = state.team ?? { id: 'player', name: state.name }
  const name = ev.field?.names === 'academy' ? academyName(base) : ev.field?.names === 'cafe' ? (state.cafeTeamName ?? `${state.name}팀`) : base.name
  return { id: base.id, name, power, isPlayer: true }
}

function runEvent(state: GameState, ev: EventDef, ctx: Ctx): Outcome | null {
  if (ev.needs && !ctx.qualified.has(ev.needs)) return null
  const power = playerPower(state, ev.big ?? false)

  let teams: Team[]
  if (ev.from) {
    const prev = ctx.outcomes.get(ev.from.event)
    if (!prev) return null
    const top = prev.order.slice(0, ev.from.top)
    if (!top.some((t) => t.isPlayer)) return null
    teams = top.map((t) => (t.isPlayer ? { ...t, power } : t))
  } else {
    const f = ev.field!
    const me = playerTeam(state, ev, power)
    teams = [me, ...makeOpponents(ctx.rng, f.names, f.tier, f.size - 1, new Set([me.id]))]
  }

  const order =
    ev.format === 'league'
      ? runLeague(ctx.rng, teams, ev.rounds ?? 1, ev.bestOf).map((s) => s.team)
      : runElimination(ctx.rng, [...teams].sort((a, b) => b.power - a.power), ev.k ?? 1, ev.bestOf)
  const placement = order.findIndex((t) => t.isPlayer) + 1
  const outcome = { order, placement }
  ctx.outcomes.set(ev.id, outcome)

  for (const q of ev.qualifies ?? []) if (placement <= q.top) ctx.qualified.add(q.to)
  if (ev.points) ctx.points += ev.points[placement - 1] ?? 0
  if (ev.pointsQualify && ctx.points >= ev.pointsQualify.minPoints) ctx.qualified.add(ev.pointsQualify.to)
  return outcome
}

function makeScoutOffers(rng: Rng, kind: 'amateur' | 'pro', exclude: Set<string>): PendingOffers {
  const offers: Offer[] = pickTeams(rng, kind, OFFERS.count, exclude).map((team) => ({
    team,
    perk: rng() < 0.5 ? 'salary' : 'playtime',
  }))
  return { kind: 'scout', offers }
}

/**
 * 시즌 중간 이적 제안. 팀에 소속된 선수가 명성을 쌓으면 한 턴을 마칠 때마다 다른 팀에서 연락이 올 수 있다.
 * 시즌당 한 번, 마지막 턴 뒤에는 오지 않는다(결산이 따로 있다). 거절할 수 있다(kind: 'transfer').
 */
export function rollMidSeasonOffer(state: GameState): GameState {
  if (state.finished || state.pendingOffers || !state.team) return state
  if (state.midOfferSeason === state.season) return state
  if (state.turnInSeason >= turnsPerSeason(state.mode)) return state
  if (state.fame < OFFERS.midMinFame) return state
  const kind = state.stage === 'amateur_team' ? 'amateur' : state.stage === 'pro2' || state.stage === 'pro1' ? 'pro' : null
  if (!kind) return state
  const rng = createRng(mixSeed(state.seed, state.turnCount, 0x0ff3))
  if (rng() >= 1 - (1 - OFFERS.midChance) ** turnScale(state.mode)) return state
  const offers = makeScoutOffers(rng, kind, new Set([state.team.id])).offers.slice(0, 2)
  return { ...state, pendingOffers: { kind: 'transfer', offers }, midOfferSeason: state.season }
}

/** 하위 20%(최소 1팀)에 들면 강등 */
function isRelegated(placement: number, size: number): boolean {
  return placement > size - Math.max(1, Math.round(size * rules.relegationRatio))
}

/**
 * 시즌 결산: 이번 시즌 대회를 치르고(상금·명성 반영), 라이벌전, 승급·강등, 월드 우승·커리어 종료를 판정한다.
 * 스카우트 제안이 생기면 state.pendingOffers에 담기며, 하나를 고른 뒤(acceptOffer) startNextSeason으로 넘어간다.
 */
export function settleSeason(state: GameState): { state: GameState; report: SeasonReport } {
  if (state.finished) throw new Error('이미 끝난 커리어다')
  if (state.turnInSeason < turnsPerSeason(state.mode)) throw new Error('시즌이 아직 끝나지 않았다')
  if (isSettled(state)) throw new Error('이미 결산한 시즌이다')

  const rng = createRng(mixSeed(state.seed, state.season, 0x5ea5))
  const ctx: Ctx = { rng, outcomes: new Map(), qualified: new Set(), points: 0 }
  const stageBefore = state.stage

  let next: GameState = { ...state, seasonsInPro1: state.seasonsInPro1 + (state.stage === 'pro1' ? 1 : 0) }
  const results: EventResult[] = []
  let rank: { placement: number; size: number } | null = null
  let worldChampion = false

  for (const ev of eventsFor(state)) {
    const outcome = runEvent(state, ev, ctx)
    if (!outcome) continue
    const reward = ev.rewards.find((r) => outcome.placement <= r.upTo) ?? ev.rewards[ev.rewards.length - 1]
    next = { ...next, fame: next.fame + reward.fame, money: next.money + reward.money }
    results.push({ id: ev.id, name: ev.name, placement: outcome.placement, fieldSize: outcome.order.length, fame: reward.fame, money: reward.money })
    if (ev.rank) rank = { placement: outcome.placement, size: outcome.order.length }
    if (ev.world) {
      next = { ...next, worldAppearances: next.worldAppearances + 1 }
      if (outcome.placement === 1) {
        next = { ...next, worldTitles: next.worldTitles + 1 }
        worldChampion = true
      }
    }
  }

  // 라이벌전: 같은 라이벌과 시즌마다 맞대결, 이기면 명성이 오른다
  let rival: SeasonReport['rival'] = null
  if (state.stage !== 'basement') {
    const power = genrePower(state.stats, state.genre)
    const won = playSeries(rng, power, power + rules.rival.powerNoise * gaussian(rng), 1)
    rival = { won }
    if (won) next = { ...next, fame: next.fame + rules.rival.fameWin }
  }

  // 승급·강등
  let relegated = false
  let promoted = false
  let pendingOffers: PendingOffers | null = null
  const idx = STAGE_ORDER.indexOf(state.stage)
  if (!worldChampion && rank && idx >= 2 && isRelegated(rank.placement, rank.size)) {
    relegated = true
    const lower = STAGE_ORDER[idx - 1]
    let team = next.team
    if (state.stage === 'amateur_team') team = null
    if (state.stage === 'pro2') team = pickTeams(rng, 'amateur', 1, new Set())[0]
    next = { ...next, stage: lower, team }
  } else if (!worldChampion && STAGES[state.stage].next) {
    const cond = STAGES[state.stage].next!
    const power = genrePower(state.stats, state.genre)
    if (power >= cond.minPower && next.fame >= (cond.minFame ?? 0)) {
      promoted = true
      const upper = STAGE_ORDER[idx + 1]
      next = { ...next, stage: upper, everPro: next.everPro || upper === 'pro2' }
      if (upper === 'pro1' && next.debutTeamId === null && next.team) next = { ...next, debutTeamId: next.team.id }
      if (cond.scout) pendingOffers = makeScoutOffers(rng, cond.scout, new Set(next.team ? [next.team.id] : []))
    }
  }
  if (!pendingOffers && !worldChampion && next.stage === 'pro1' && next.team && next.fame >= OFFERS.transferMinFame && rng() < OFFERS.transferChance) {
    pendingOffers = { kind: 'transfer', offers: makeScoutOffers(rng, 'pro', new Set([next.team.id])).offers.slice(0, 2) }
  }
  next = { ...next, pendingOffers }

  const record: SeasonRecord = {
    season: state.season,
    age: state.age,
    stage: stageBefore,
    events: results.map(({ id, name, placement, fieldSize }) => ({ id, name, placement, fieldSize })),
  }
  next = { ...next, history: [...state.history, record] }

  let finished: EndingId | null = null
  if (worldChampion || isCareerOver(next)) {
    finished = evaluateEnding(next)
    next = { ...next, finished, pendingOffers: null }
  }

  return {
    state: next,
    report: { stageBefore, stageAfter: next.stage, events: results, rival, relegated, promoted, qualified: [...ctx.qualified], worldChampion, finished, pendingOffers: next.pendingOffers },
  }
}

/** 스카우트·이적 제안 하나를 고른다. index가 null이면 거절(이적 제안만 거절할 수 있다). */
export function acceptOffer(state: GameState, index: number | null): GameState {
  const pending = state.pendingOffers
  if (!pending) throw new Error('받은 제안이 없다')
  if (index === null) {
    if (pending.kind === 'scout') throw new Error('입단 제안은 하나를 골라야 한다')
    return { ...state, pendingOffers: null }
  }
  const offer = pending.offers[index]
  if (!offer) throw new Error('없는 제안이다')
  return {
    ...state,
    team: offer.team,
    money: state.money + (offer.perk === 'salary' ? OFFERS.salaryMoney : 0),
    fame: state.fame + (offer.perk === 'playtime' ? OFFERS.playtimeFame : 0),
    pendingOffers: null,
  }
}

/** 자진 은퇴: 시즌 결산을 마친 시점에 언제든 고를 수 있다. */
export function retire(state: GameState): GameState {
  if (state.finished) return state
  if (!isSettled(state)) throw new Error('시즌 결산 뒤에만 은퇴할 수 있다')
  return { ...state, pendingOffers: null, finished: evaluateEnding(state) }
}
