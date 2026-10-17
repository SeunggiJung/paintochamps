import rules from '../data/rules.json'
import stageData from '../data/stages.json'
import { evaluateEnding } from './endings.ts'
import { advanceCalendar } from './calendar.ts'
import { moneyScale } from './economy.ts'
import { eventsFor, playerPower, type EventDef } from './competitions.ts'
import { pickTeams } from './field.ts'
import { playSeries } from './match.ts'
import { seasonHighlights, type Highlights } from './highlights.ts'
import { genrePower } from './power.ts'
import { createRng, gaussian, mixSeed, type Rng } from './rng.ts'
import type { EndingId, EventRecord, GameState, Offer, PendingOffers, SeasonRecord, StageId } from './state.ts'
import { pathOf, routeStep, type TestResult } from './routes.ts'
import { isCareerOver, isSettled, turnScale, turnsPerSeason } from './turn.ts'

interface StageDef {
  name: string
  next?: { minPower: number; minFame?: number; scout?: 'amateur' | 'pro' }
}

const STAGE_ORDER = stageData.order as StageId[]
const STAGES = stageData.stages as Record<StageId, StageDef>
const OFFERS = stageData.offers

export { eventsFor, playerPower, type EventDef }

export function stageName(stage: StageId): string {
  return STAGES[stage].name
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
  /** 이번 시즌 본 시험 */
  tests: TestResult[]
  /** 루트가 어떻게 갈렸는지 알려 주는 문구 */
  routeNotes: string[]
  /** 시즌 활약: 리그 성적·평점·리그 내 수준·수상 기록 */
  highlights: Highlights
}

function makeScoutOffers(rng: Rng, kind: 'amateur' | 'pro', exclude: Set<string>, count: number = OFFERS.count): PendingOffers {
  const offers: Offer[] = pickTeams(rng, kind, count, exclude).map((team) => ({
    team,
    perk: rng() < 0.5 ? 'salary' : 'playtime',
  }))
  return { kind: 'scout', offers }
}

/** 프로 2부 → 1부 콜업 제안: 지금 소속 팀의 1군 콜업이 첫 번째, 나머지는 다른 구단에서 온다. 모두 1부 팀이다. */
function makeCallupOffers(rng: Rng, own: GameState['team']): PendingOffers {
  const others = pickTeams(rng, 'pro', own ? OFFERS.callupCount - 1 : OFFERS.callupCount, new Set(own ? [own.id] : []))
  const teams = own ? [own, ...others] : others
  return { kind: 'callup', stage: 'pro1', offers: teams.map((team) => ({ team, perk: rng() < 0.5 ? 'salary' : 'playtime' })) }
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
  if (state.stage === 'amateur_team' && pathOf(state) === 'academy') return state // 연습생은 이적 제안을 받지 않는다
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

  const rng = createRng(mixSeed(state.seed, state.season, 0x5ea5, 0xfe))
  const stageBefore = state.stage

  // 시즌 중에 이미 치른 대회는 그대로 두고, 아직 열리지 않은 대회가 있으면(옛 세이브·바로 결산하는 경우) 지금 치른다
  const advanced = advanceCalendar(state, 1).state
  const run = advanced.seasonRun!
  let next: GameState = { ...advanced, seasonsInPro1: advanced.seasonsInPro1 + (state.stage === 'pro1' ? 1 : 0) }
  const results: EventResult[] = []
  let rank: { placement: number; size: number } | null = null
  let worldChampion = false

  for (const ev of eventsFor(state)) {
    const rec = run.runs.find((r) => r.id === ev.id)
    if (!rec) continue
    results.push({ id: ev.id, name: ev.name, placement: rec.placement, fieldSize: rec.fieldSize, fame: rec.fame, money: rec.money })
    if (ev.rank) rank = { placement: rec.placement, size: rec.fieldSize }
    if (ev.world) {
      next = { ...next, worldAppearances: next.worldAppearances + 1 }
      if (rec.placement === 1) {
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

  // 승급·강등. 방구석·지역 대회·아마추어 팀 단계는 시험과 성적으로 루트가 갈리고(routes.ts), 프로 2부부터는 실력치 조건이다.
  let relegated = false
  let promoted = false
  let pendingOffers: PendingOffers | null = null
  let tests: TestResult[] = []
  let routeNotes: string[] = []
  const idx = STAGE_ORDER.indexOf(state.stage)
  // 정석 루트의 연습생은 아마추어 리그 성적이 나빠도 방출되지 않는다 (배우는 단계)
  const trainee = state.stage === 'amateur_team' && pathOf(state) === 'academy'
  if (!worldChampion && !trainee && rank && idx >= 2 && isRelegated(rank.placement, rank.size)) {
    relegated = true
    const lower = STAGE_ORDER[idx - 1]
    let team = next.team
    if (state.stage === 'amateur_team') team = null
    if (state.stage === 'pro2') team = pickTeams(rng, 'amateur', 1, new Set())[0]
    next = { ...next, stage: lower, team, path: 'open', salaryMult: 1, negotiatedSeason: 0 }
  } else if (!worldChampion && state.stage === 'pro2') {
    // 프로 2부 → 1부는 자동 승급이 아니라 1부 팀의 콜업 제안이다. 지금 팀(1군 콜업)과 다른 구단에서 온다. 거절하면 2부에 남는다.
    const cond = STAGES[state.stage].next!
    const power = genrePower(state.stats, state.genre)
    if (power >= cond.minPower && next.fame >= (cond.minFame ?? 0)) pendingOffers = makeCallupOffers(rng, next.team)
  } else if (!worldChampion && (state.stage === 'basement' || state.stage === 'local_cup' || state.stage === 'amateur_team')) {
    const step = routeStep(advanced, next, {
      placementOf: (id) => results.find((r) => r.id === id)?.placement,
      scout: (kind, count) => makeScoutOffers(rng, kind, new Set(next.team ? [next.team.id] : []), count),
      rng,
    })
    next = step.state
    promoted = step.promoted
    pendingOffers = step.offers
    tests = step.tests
    routeNotes = step.notes
  }
  next = { ...next, testPrep: null }
  if (!pendingOffers && !worldChampion && next.stage === 'pro1' && next.team && next.fame >= OFFERS.transferMinFame && rng() < OFFERS.transferChance) {
    pendingOffers = { kind: 'transfer', offers: makeScoutOffers(rng, 'pro', new Set([next.team.id])).offers.slice(0, 2) }
  }
  next = { ...next, pendingOffers }

  const highlights = seasonHighlights(state, run, eventsFor(state))
  const record: SeasonRecord = {
    season: state.season,
    age: state.age,
    stage: stageBefore,
    events: results.map(({ id, name, placement, fieldSize }) => ({ id, name, placement, fieldSize })),
    highlights: { rating: highlights.rating, rank: highlights.ratingRank, players: highlights.players, awards: highlights.awards.map((a) => a.name) },
  }
  next = { ...next, history: [...state.history, record] }

  let finished: EndingId | null = null
  if (isCareerOver(next)) {
    finished = evaluateEnding(next)
    next = { ...next, finished, pendingOffers: null }
  }

  return {
    state: next,
    report: { stageBefore, stageAfter: next.stage, events: results, rival, relegated, promoted, qualified: run.qualified, worldChampion, finished, pendingOffers: next.pendingOffers, tests, routeNotes, highlights },
  }
}

/** 스카우트·이적 제안 하나를 고른다. index가 null이면 거절(이적 제안만 거절할 수 있다). */
export function acceptOffer(state: GameState, index: number | null): GameState {
  const pending = state.pendingOffers
  if (!pending) throw new Error('받은 제안이 없다')
  if (index === null) {
    if (pending.kind === 'scout') throw new Error('입단 제안은 하나를 골라야 한다')
    return { ...state, pendingOffers: null } // 이적·콜업 제안은 거절할 수 있다 (콜업을 거절하면 2부에 남는다)
  }
  const offer = pending.offers[index]
  if (!offer) throw new Error('없는 제안이다')
  // 콜업이면 1부로 올라가고, 처음 올라가는 팀이 데뷔 팀이 된다. 팀을 옮기면 월급 협상은 새로 시작한다.
  const stage = pending.kind === 'callup' ? 'pro1' : state.stage
  return {
    ...state,
    stage,
    debutTeamId: stage === 'pro1' && state.debutTeamId === null ? offer.team.id : state.debutTeamId,
    team: offer.team,
    money: state.money + (offer.perk === 'salary' ? OFFERS.salaryMoney * moneyScale(stage) : 0),
    fame: state.fame + (offer.perk === 'playtime' ? OFFERS.playtimeFame : 0),
    salaryMult: 1,
    negotiatedSeason: 0,
    pendingOffers: null,
  }
}

/** 자진 은퇴: 시즌 결산을 마친 시점에 언제든 고를 수 있다. */
export function retire(state: GameState): GameState {
  if (state.finished) return state
  if (!isSettled(state)) throw new Error('시즌 결산 뒤에만 은퇴할 수 있다')
  return { ...state, pendingOffers: null, finished: evaluateEnding(state) }
}
