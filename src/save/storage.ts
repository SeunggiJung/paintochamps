import { earnedAchievements, type AchievementId } from '../engine/achievements.ts'
import { buildCareer, type Career } from '../engine/career.ts'
import { canBuy, nextCost, perksOf, SHOP_ITEMS, tokenReward, type Inventory } from '../engine/shop.ts'
import { pro2Teams, proOrgs } from '../engine/field.ts'
import { STAT_KEYS } from '../engine/types.ts'
import type { EndingId, GameState, StageId, TeamRef } from '../engine/state.ts'

/** localStorage와 같은 모양. 테스트에서는 메모리 구현을 넘긴다. */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const SAVE_KEY = 'paintochamps:save'
export const META_KEY = 'paintochamps:meta'
export const CURRENT_SAVE_VERSION = 1

/** 이전 버전 저장 데이터를 현재 버전으로 올리는 함수들. 버전이 올라갈 때 여기에 추가한다. */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {}

function migrate(raw: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof raw.saveVersion !== 'number' || raw.saveVersion > CURRENT_SAVE_VERSION) return null
  let version: number = raw.saveVersion
  let data = raw
  while (version < CURRENT_SAVE_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) return null
    data = step(data)
    version = data.saveVersion as number
  }
  return data
}

function looksLikeState(raw: Record<string, unknown>): boolean {
  const stats = raw.stats as Record<string, unknown> | undefined
  return (
    (raw.mode === 'tutorial' || raw.mode === 'standard') && // 폐지된 정밀 모드 세이브는 이어할 수 없다
    typeof raw.seed === 'number' &&
    typeof raw.age === 'number' &&
    typeof raw.stage === 'string' &&
    !!stats &&
    STAT_KEYS.every((k) => typeof stats[k] === 'number')
  )
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

/** 저장한다. 저장소를 쓸 수 없으면(시크릿 모드 등) false. */
export function saveGame(storage: KeyValueStorage, state: GameState): boolean {
  return safe(() => (storage.setItem(SAVE_KEY, JSON.stringify(state)), true), false)
}

/** 이어하기용으로 불러온다. 없거나 깨졌거나 모르는 버전이면 null. */
export function loadGame(storage: KeyValueStorage): GameState | null {
  return safe(() => {
    const text = storage.getItem(SAVE_KEY)
    if (!text) return null
    const parsed = JSON.parse(text) as Record<string, unknown>
    const data = parsed && typeof parsed === 'object' ? migrate(parsed) : null
    return data && looksLikeState(data) ? upgradeTeams(data as unknown as GameState) : null
  }, null)
}

/**
 * 실존 구단으로 바뀌기 전(org_N 가상 구단) 세이브의 팀을 같은 순서의 실존 팀으로 옮긴다.
 * 소속 단계에 맞는 풀(프로 2부면 챌린저스, 아니면 1부 구단)에서 고른다.
 */
function upgradeTeams(state: GameState): GameState {
  const legacy = (ref: TeamRef | null, pro2: boolean): TeamRef | null => {
    const m = ref && /^org_(\d+)$/.exec(ref.id)
    if (!ref || !m) return ref
    const pool = pro2 ? pro2Teams(state.genre) : proOrgs(state.genre)
    return pool[Number(m[1]) % pool.length]
  }
  const team = legacy(state.team, state.stage === 'pro2')
  const debut = state.debutTeamId && /^org_(\d+)$/.test(state.debutTeamId) ? legacy({ id: state.debutTeamId, name: '' }, false)!.id : state.debutTeamId
  return team === state.team && debut === state.debutTeamId ? state : { ...state, team, debutTeamId: debut }
}

export function clearGame(storage: KeyValueStorage): void {
  safe(() => storage.removeItem(SAVE_KEY), undefined)
}

/** 한 판을 마친 기록 요약. 도감과 엔딩 화면에 보여 준다. */
export interface FinishSummary {
  name: string
  genre: GameState['genre']
  mode: GameState['mode']
  /** 마지막 나이 */
  age: number
  seasons: number
  /** 이번 판에서 오른 가장 높은 단계 */
  bestStage: StageId
  worldAppearances: number
  worldTitles: number
  /** 능력치 뽑기를 다시 뽑은 횟수 */
  rerolls: number
}

/** 끝낸 커리어 하나의 경력 기록 (명예의 전당) */
export interface CareerSnapshot {
  name: string
  genre: GameState['genre']
  ending: EndingId
  age: number
  career: Career
}

/** 최근 몇 판의 경력까지 남기는가 */
const MAX_CAREERS = 20

/** 상황별 첫 등장 가이드의 종류 (`start`는 첫 접속 홈 가이드) */
export type GuideId = 'start' | 'plan' | 'spend' | 'contract' | 'offers' | 'event' | 'injury' | 'prep' | 'turnResult' | 'midOffer' | 'ads' | 'house' | 'shop' | 'tokenShop' | 'broadcast' | 'minigame'

/** 판을 넘어 유지되는 기록: 엔딩 도감, 튜토리얼 완료 여부 */
export interface MetaSave {
  version: 1
  tutorialDone: boolean
  /** 육성 화면 첫 안내(말풍선 가이드)를 봤는지 */
  guideDone: boolean
  /** 상황별 가이드를 본 기록 (옛 도감에는 없을 수 있다) */
  guidesSeen: Partial<Record<GuideId, true>>
  endings: Partial<Record<EndingId, { count: number; last?: FinishSummary }>>
  /** 달성한 업적. 횟수와 가장 최근 판 요약 (옛 도감에는 없을 수 있다) */
  achievements: Partial<Record<AchievementId, { count: number; last?: FinishSummary }>>
  bestStage: StageId
  finishedRuns: number
  /** 업적 토큰: 지금 가진 수와 지금까지 번 수 (옛 도감에는 없을 수 있다) */
  tokens: number
  tokensEarned: number
  /** 업적 상점에서 산 것: 소모품은 개수, 영구 강화는 단계 */
  inventory: Inventory
  /** 힌트로 조건을 열어 본 도감 항목. 키는 'ending:<id>'·'achievement:<id>' (옛 도감에는 없을 수 있다) */
  hints: Record<string, true>
  /** 끝낸 커리어의 경력 기록, 최근 것이 앞 */
  careers: CareerSnapshot[]
}

const STAGE_RANK: StageId[] = ['basement', 'local_cup', 'amateur_team', 'pro2', 'pro1']

/** 강등당해도 이번 판에서 오른 가장 높은 단계 */
export function bestStageOf(state: GameState, from: StageId = 'basement'): StageId {
  const reached = [state.stage, from, ...state.history.map((h) => h.stage)]
  return reached.reduce((a, b) => (STAGE_RANK.indexOf(b) > STAGE_RANK.indexOf(a) ? b : a))
}

export function finishSummary(state: GameState): FinishSummary {
  return {
    name: state.name,
    genre: state.genre,
    mode: state.mode,
    age: state.age,
    seasons: state.season,
    bestStage: bestStageOf(state),
    worldAppearances: state.worldAppearances,
    worldTitles: state.worldTitles,
    rerolls: state.rerolls,
  }
}

export function emptyMeta(): MetaSave {
  return { version: 1, tutorialDone: false, guideDone: false, guidesSeen: {}, endings: {}, achievements: {}, bestStage: 'basement', finishedRuns: 0, tokens: 0, tokensEarned: 0, inventory: {}, hints: {}, careers: [] }
}

export function loadMeta(storage: KeyValueStorage): MetaSave {
  return safe(() => {
    const text = storage.getItem(META_KEY)
    if (!text) return emptyMeta()
    const m = JSON.parse(text) as Partial<MetaSave>
    return m && m.version === 1 && typeof m.endings === 'object' ? { ...emptyMeta(), ...m, guidesSeen: { ...(m.guidesSeen ?? {}) }, hints: { ...(m.hints ?? {}) } } : emptyMeta()
  }, emptyMeta())
}

/** 첫 안내를 봤다고 기록한다. */
export function markGuideDone(storage: KeyValueStorage): MetaSave {
  const next: MetaSave = { ...loadMeta(storage), guideDone: true }
  safe(() => storage.setItem(META_KEY, JSON.stringify(next)), undefined)
  return next
}

export function hasSeenGuide(meta: MetaSave, id: GuideId): boolean {
  return Boolean(meta.guidesSeen[id]) || (id === 'start' && meta.guideDone)
}

/** 상황별 가이드를 봤다고 기록한다. 이미 본 것은 그대로다. */
export function markGuideSeen(storage: KeyValueStorage, id: GuideId): MetaSave {
  const meta = loadMeta(storage)
  const next: MetaSave = { ...meta, guideDone: meta.guideDone || id === 'start', guidesSeen: { ...meta.guidesSeen, [id]: true } }
  safe(() => storage.setItem(META_KEY, JSON.stringify(next)), undefined)
  return next
}

/** 판이 끝났을 때 호출한다. 엔딩 도감·튜토리얼 완료·최고 단계를 갱신해 저장하고 새 기록을 돌려준다. */
export function recordFinish(storage: KeyValueStorage, state: GameState): MetaSave {
  if (!state.finished) throw new Error('끝나지 않은 판이다')
  const meta = loadMeta(storage)
  const prev = meta.endings[state.finished]?.count ?? 0
  // 강등당해도 지금까지 오른 가장 높은 단계를 기록한다
  const bestStage = bestStageOf(state, meta.bestStage)
  // 업적을 달성하면 토큰을 받는다 (처음 달성한 업적은 더 많이)
  const earned = earnedAchievements(state)
  const gained = earned.reduce((sum, id) => sum + tokenReward(!meta.achievements[id]), 0)
  const next: MetaSave = {
    ...meta,
    tokens: meta.tokens + gained,
    tokensEarned: meta.tokensEarned + gained,
    careers: [{ name: state.name, genre: state.genre, ending: state.finished, age: state.age, career: buildCareer(state) }, ...meta.careers].slice(0, MAX_CAREERS),
    tutorialDone: meta.tutorialDone || state.mode === 'tutorial',
    endings: { ...meta.endings, [state.finished]: { count: prev + 1, last: finishSummary(state) } },
    achievements: { ...meta.achievements, ...Object.fromEntries(earnedAchievements(state).map((id) => [id, { count: (meta.achievements[id]?.count ?? 0) + 1, last: finishSummary(state) }])) },
    bestStage,
    finishedRuns: meta.finishedRuns + 1,
  }
  safe(() => storage.setItem(META_KEY, JSON.stringify(next)), undefined)
  clearGame(storage)
  return next
}

/** 이번 판에서 업적으로 받을 토큰 (recordFinish 전의 도감 기준) */
export function tokensFor(meta: MetaSave, state: GameState): number {
  return earnedAchievements(state).reduce((sum, id) => sum + tokenReward(!meta.achievements[id]), 0)
}

/** 업적 상점에서 물건을 산다. 토큰이 모자라거나 더 살 수 없으면 null. */
export function buyItem(storage: KeyValueStorage, id: string): MetaSave | null {
  const meta = loadMeta(storage)
  const item = SHOP_ITEMS.find((i) => i.id === id)
  if (!item || !canBuy(item, meta.inventory, meta.tokens)) return null
  const cost = nextCost(item, meta.inventory)!
  const next: MetaSave = { ...meta, tokens: meta.tokens - cost, inventory: { ...meta.inventory, [id]: (meta.inventory[id] ?? 0) + 1 } }
  safe(() => storage.setItem(META_KEY, JSON.stringify(next)), undefined)
  return next
}

/** SR 보장권을 한 장 쓴다. 없으면 null. */
export function useSrTicket(storage: KeyValueStorage): MetaSave | null {
  const meta = loadMeta(storage)
  const owned = meta.inventory.sr_ticket ?? 0
  if (owned <= 0) return null
  const next: MetaSave = { ...meta, inventory: { ...meta.inventory, sr_ticket: owned - 1 } }
  safe(() => storage.setItem(META_KEY, JSON.stringify(next)), undefined)
  return next
}

/** 도감 힌트의 종류와 쓰는 물건 */
export type HintKind = 'ending' | 'achievement'
const HINT_ITEM: Record<HintKind, string> = { ending: 'hint_ending', achievement: 'hint_achievement' }

export const hintKey = (kind: HintKind, id: string): string => `${kind}:${id}`

/** 이미 조건을 열어 본 항목인지 */
export const hasHint = (meta: MetaSave, kind: HintKind, id: string): boolean => Boolean(meta.hints[hintKey(kind, id)])

/** 힌트를 한 장 써서 도감 항목의 조건을 연다. 이미 열었거나 가진 힌트가 없으면 null. */
export function useHint(storage: KeyValueStorage, kind: HintKind, id: string): MetaSave | null {
  const meta = loadMeta(storage)
  const item = HINT_ITEM[kind]
  const owned = meta.inventory[item] ?? 0
  if (owned <= 0 || hasHint(meta, kind, id)) return null
  const next: MetaSave = { ...meta, inventory: { ...meta.inventory, [item]: owned - 1 }, hints: { ...meta.hints, [hintKey(kind, id)]: true } }
  safe(() => storage.setItem(META_KEY, JSON.stringify(next)), undefined)
  return next
}

/** 새 판에 줄 영구 효과 */
export function perksFromMeta(meta: MetaSave) {
  return perksOf(meta.inventory)
}
