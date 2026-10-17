import achievementData from '../data/achievements.json'
import { isUnofficial, isWorldEvent } from './competitions.ts'
import type { GameState, SeasonRecord } from './state.ts'

export type AchievementId = string

export interface AchievementDef {
  id: AchievementId
  name: string
  desc: string
}

export const ACHIEVEMENTS = achievementData.order as AchievementDef[]

/** 한 시즌에 참가한 공식 대회가 이 수 이상이어야 "모든 대회 우승"으로 친다 (대회가 한두 개뿐인 시즌 제외) */
const GOLDEN_MIN_EVENTS = 3

const worldPlace = (r: SeasonRecord): number | null => r.events.find((e) => isWorldEvent(e.id))?.placement ?? null
const wonWorld = (r: SeasonRecord): boolean => worldPlace(r) === 1

/** 같은 팀에서 이 시즌까지 이어서 뛴 시즌 수 (옛 기록처럼 팀 정보가 없으면 1) */
function seasonsWithSameTeam(history: readonly SeasonRecord[], i: number): number {
  const id = history[i].teamId
  if (!id) return 1
  let n = 1
  while (i - n >= 0 && history[i - n].teamId === id) n++
  return n
}

/** 월드 우승 시즌의 번호들에서 가장 길게 이어진 연속 우승 수 */
function longestStreak(history: readonly SeasonRecord[], pred: (r: SeasonRecord) => boolean): number {
  let best = 0
  let run = 0
  for (const r of history) {
    run = pred(r) ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

/**
 * 끝난 판에서 달성한 업적. 월드 우승 뒤에도 커리어가 이어지므로 시즌 기록 전체를 훑어 판정한다.
 * 비공식 초청 대회는 "시즌 모든 대회"에서 뺀다. (정의는 data/achievements.json)
 */
export function earnedAchievements(state: GameState): AchievementId[] {
  if (!state.finished) return []
  const h = state.history
  const out = new Set<AchievementId>()
  const champ = h.map((r, i) => ({ r, i })).filter(({ r }) => wonWorld(r))

  if (state.worldTitles >= 1 && champ.length > 0) {
    // 한 시즌의 공식 대회를 전부 우승
    if (champ.some(({ r }) => {
      const official = r.events.filter((e) => !isUnofficial(e.id))
      return official.length >= GOLDEN_MIN_EVENTS && official.every((e) => e.placement === 1)
    })) out.add('golden_road')
    // 프로 1부에 데뷔한 첫 시즌에 우승
    const firstPro1 = h.find((r) => r.stage === 'pro1')
    if (firstPro1 && wonWorld(firstPro1)) out.add('rookie_champion')
    // 첫 우승이 28세 이상
    if (champ[0].r.age >= 28) out.add('late_bloomer')
    if (champ.length >= 3) out.add('dynasty')
    if (longestStreak(h, wonWorld) >= 3) out.add('immortal')
    // 직전 시즌에 부상·슬럼프를 겪고도 우승
    if (champ.some(({ i }) => i > 0 && h[i - 1].setback)) out.add('phoenix')
    if (champ.some(({ r }) => r.underdog)) out.add('underdog')
    // 팀을 옮긴 첫 시즌에 우승
    if (champ.some(({ r, i }) => i > 0 && r.teamId && h[i - 1].teamId && r.teamId !== h[i - 1].teamId)) out.add('hired_gun')
    if (champ.some(({ i }) => seasonsWithSameTeam(h, i) >= 5)) out.add('one_club')
    // 마지막 시즌(30세)에 우승
    if (wonWorld(h[h.length - 1]) && h[h.length - 1].age >= 30) out.add('last_dance')
    if (champ.some(({ r }) => r.age <= 19)) out.add('prodigy')
  }

  if (state.seasonsInPro1 >= 10) out.add('pro1_pillar')
  if (longestStreak(h, (r) => worldPlace(r) !== null) >= 5) out.add('ironman')
  if (h.some((r) => r.age >= 30 && worldPlace(r) !== null)) out.add('old_guard')
  if (h.filter((r) => worldPlace(r) === 2).length >= 3) out.add('runner_up')

  return ACHIEVEMENTS.map((a) => a.id).filter((id) => out.has(id))
}

export function achievementDef(id: AchievementId): AchievementDef {
  return ACHIEVEMENTS.find((a) => a.id === id)!
}
