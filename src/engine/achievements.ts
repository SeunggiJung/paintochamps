import achievementData from '../data/achievements.json'
import { isUnofficial } from './competitions.ts'
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
 * 끝난 판에서 달성한 업적. 월드 우승으로 끝난 판에서만 나오므로 마지막 시즌 기록(history 맨 끝)으로 판정한다.
 * 비공식 초청 대회는 "시즌 모든 대회"에서 뺀다.
 */
export function earnedAchievements(state: GameState): AchievementId[] {
  const out: AchievementId[] = []
  if (!state.finished || state.worldTitles < 1) return out
  const last = state.history[state.history.length - 1]
  if (!last) return out

  const official = last.events.filter((e) => !isUnofficial(e.id))
  if (official.length >= GOLDEN_MIN_EVENTS && official.every((e) => e.placement === 1)) out.push('golden_road')
  // 프로 1부에서 보낸 시즌이 이번 한 시즌뿐이면 데뷔 시즌이다
  if (last.stage === 'pro1' && state.history.filter((h) => h.stage === 'pro1').length === 1) out.push('rookie_champion')
  return out
}

export function achievementDef(id: AchievementId): AchievementDef {
  return ACHIEVEMENTS.find((a) => a.id === id)!
}
