import { earnedAchievements, type AchievementId } from '../engine/achievements.ts'
import { STAT_KEYS } from '../engine/types.ts'
import type { EndingId, GameState, StageId } from '../engine/state.ts'

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
    return data && looksLikeState(data) ? (data as unknown as GameState) : null
  }, null)
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

/** 판을 넘어 유지되는 기록: 엔딩 도감, 튜토리얼 완료 여부 */
export interface MetaSave {
  version: 1
  tutorialDone: boolean
  /** 육성 화면 첫 안내(말풍선 가이드)를 봤는지 */
  guideDone: boolean
  endings: Partial<Record<EndingId, { count: number; last?: FinishSummary }>>
  /** 달성한 업적. 횟수와 가장 최근 판 요약 (옛 도감에는 없을 수 있다) */
  achievements: Partial<Record<AchievementId, { count: number; last?: FinishSummary }>>
  bestStage: StageId
  finishedRuns: number
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
  return { version: 1, tutorialDone: false, guideDone: false, endings: {}, achievements: {}, bestStage: 'basement', finishedRuns: 0 }
}

export function loadMeta(storage: KeyValueStorage): MetaSave {
  return safe(() => {
    const text = storage.getItem(META_KEY)
    if (!text) return emptyMeta()
    const m = JSON.parse(text) as Partial<MetaSave>
    return m && m.version === 1 && typeof m.endings === 'object' ? { ...emptyMeta(), ...m } : emptyMeta()
  }, emptyMeta())
}

/** 첫 안내를 봤다고 기록한다. */
export function markGuideDone(storage: KeyValueStorage): MetaSave {
  const next: MetaSave = { ...loadMeta(storage), guideDone: true }
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
  const next: MetaSave = {
    ...meta,
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
