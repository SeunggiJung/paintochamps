export const STAT_KEYS = ['reaction', 'accuracy', 'focus', 'judgment', 'mental', 'teamwork'] as const
export type StatKey = (typeof STAT_KEYS)[number]
export type Stats = Record<StatKey, number>

export type GenreId = 'fps' | 'aos' | 'rts' | 'fighting'
export type Grade = 'UR' | 'SSR' | 'SR' | 'R' | 'N'

export interface Trait {
  id: string
  name: string
  stat: StatKey
}

export interface GachaResult {
  stats: Stats
  trait: Trait
  grade: Grade
  /** 선택 장르 기준 시작 실력치 R */
  power: number
}
