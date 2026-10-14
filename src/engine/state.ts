import rules from '../data/rules.json'
import type { GachaResult, GenreId, Stats, Trait } from './types.ts'

export type ModeId = 'tutorial' | 'standard' | 'precise'
export type ActionId = 'rank_practice' | 'basics' | 'video_review' | 'team_scrim' | 'rest' | 'part_time' | 'broadcast'
export type EquipmentId = 'keyboard' | 'mouse' | 'monitor' | 'pc'

export interface GameState {
  saveVersion: 1
  name: string
  genre: GenreId
  mode: ModeId
  /** 나이 (16~30) */
  age: number
  /** 1부터 시작하는 시즌 번호 */
  season: number
  /** 이번 시즌에서 지금까지 진행한 턴 수 */
  turnInSeason: number
  /** 전체 진행 턴 수 */
  turnCount: number
  stats: Stats
  trait: Trait
  condition: number
  /** 만 원 */
  money: number
  fame: number
  /** 장비 단계 (0~3) */
  equipment: Record<EquipmentId, number>
  inTeam: boolean
}

export interface NewGameOptions {
  name: string
  genre: GenreId
  mode: ModeId
  gacha: GachaResult
}

export function createInitialState({ name, genre, mode, gacha }: NewGameOptions): GameState {
  return {
    saveVersion: 1,
    name,
    genre,
    mode,
    age: rules.startAge,
    season: 1,
    turnInSeason: 0,
    turnCount: 0,
    stats: { ...gacha.stats },
    trait: gacha.trait,
    condition: rules.start.condition,
    money: rules.start.money,
    fame: rules.start.fame,
    equipment: { keyboard: 0, mouse: 0, monitor: 0, pc: 0 },
    inTeam: false,
  }
}
