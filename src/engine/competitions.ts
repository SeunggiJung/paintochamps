import competitions from '../data/competitions.json'
import type { NamePool } from './field.ts'
import { mentalAdjusted } from './match.ts'
import { genrePower } from './power.ts'
import type { GameState, ModeId } from './state.ts'
import type { GenreId } from './types.ts'

interface Reward {
  upTo: number
  fame: number
  money: number
}

export interface EventDef {
  id: string
  name: string
  /** 시즌 안에서 이 대회가 열리는 기간 [시작, 끝] (0~1, 시즌의 몇 %가 지난 시점). 끝나는 때 결과가 나온다. */
  span: [number, number]
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

/** 1부 일정의 모양: AOS형(리그 → 선발전 → 국제전 → 플레이오프 → 월드), FPS형(킥오프 → 스테이지 1·2 → 마스터즈 → 챔피언스) */
const CALENDAR_OF: Record<GenreId, 'aos' | 'fps'> = { aos: 'aos', rts: 'aos', fps: 'fps', fighting: 'fps' }

/** 이번 시즌에 치르는 대회 목록 (시간 순서) */
export function eventsFor(state: Pick<GameState, 'stage' | 'genre' | 'mode'>): EventDef[] {
  const all = (state.stage === 'pro1' ? competitions.stages.pro1[CALENDAR_OF[state.genre]] : competitions.stages[state.stage]) as EventDef[]
  return all.filter((e) => !e.modes || e.modes.includes(state.mode))
}

/** 플레이어의 지금 장르 실력치. 큰 경기면 멘탈 보정을 더한다. */
export function playerPower(state: GameState, big: boolean): number {
  const r = genrePower(state.stats, state.genre)
  return big ? mentalAdjusted(r, state.stats.mental) : r
}

/** 리그의 중간 순위를 보여 주는 시점 (리그 기간의 절반) */
export function midPhase(ev: EventDef): number | null {
  return ev.format === 'league' ? (ev.span[0] + ev.span[1]) / 2 : null
}
