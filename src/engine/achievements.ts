import achievementData from '../data/achievements.json'
import { isUnofficial, isWorldEvent } from './competitions.ts'
import type { GameState } from './state.ts'

export type AchievementId = 'golden_road' | 'rookie_champion'

export interface AchievementDef {
  id: AchievementId
  name: string
  desc: string
}

export const ACHIEVEMENTS = achievementData.order as AchievementDef[]

/** 한 시즌에 참가한 공식 대회가 이 수 이상이어야 "모든 대회 우승"으로 친다 (대회가 한두 개뿐인 시즌 제외) */
const GOLDEN_MIN_EVENTS = 3

/**
 * 끝난 판에서 달성한 업적. 월드 우승 뒤에도 커리어가 이어지므로, 월드를 우승한 시즌 기록을 모두 훑어 판정한다.
 * 비공식 초청 대회는 "시즌 모든 대회"에서 뺀다.
 */
export function earnedAchievements(state: GameState): AchievementId[] {
  const out: AchievementId[] = []
  if (!state.finished || state.worldTitles < 1) return out

  const champSeasons = state.history.filter((r) => r.events.some((e) => isWorldEvent(e.id) && e.placement === 1))
  const golden = champSeasons.some((r) => {
    const official = r.events.filter((e) => !isUnofficial(e.id))
    return official.length >= GOLDEN_MIN_EVENTS && official.every((e) => e.placement === 1)
  })
  if (golden) out.push('golden_road')

  // 프로 1부에 데뷔한 첫 시즌에 우승했는가
  const firstPro1 = state.history.find((r) => r.stage === 'pro1')
  if (firstPro1 && champSeasons.includes(firstPro1)) out.push('rookie_champion')
  return out
}

export function achievementDef(id: AchievementId): AchievementDef {
  return ACHIEVEMENTS.find((a) => a.id === id)!
}
