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
  /** 앞선 이벤트 순위표의 상위 top팀(side가 bottom이면 하위 top팀)으로 치른다 (플레이어가 거기 못 들면 열리지 않는다).
   * 시즌 도중 승급해 앞선 이벤트를 치르지 않았다면 field가 있을 때 field로 대신 치른다. */
  from?: { event: string; top: number; side?: 'bottom' }
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
  /** 결승 중계 연출이 붙는 대회. 값은 중계 멘트 묶음(broadcast.json `finales`)의 이름 */
  finale?: string
  rewards: Reward[]
  /** 순위가 min~top이면 진출권을 얻는다 (min이 없으면 1위부터) */
  qualifies?: { to: string; top: number; min?: number }[]
  /** 리그 순위를 시즌 성적(활약·카드)에는 쓰지만 강등 판정에서는 뺀다 */
  noRelegate?: boolean
  points?: number[]
  pointsQualify?: { to: string; minPoints: number }
  /** 공식 일정이 아닌 초청 대회. 골든로드 같은 "시즌 모든 대회" 기록에서 빠진다. */
  unofficial?: boolean
  /** N시즌에 한 번만 열린다 (season % N === 0) */
  everyNSeasons?: number
  /** 초청 조건: 명성이 minFame 이상이고, 직전 시즌 성적이 anyOf 중 하나를 만족해야 한다. (실제 초청제 대회가 직전 성적 순위로 팀을 초청하는 방식을 참고) */
  invite?: { minFame: number; anyOf: ({ event: string; top: number } | { played: string })[] }
}

/** 1부 일정의 모양: AOS형(리그 → 선발전 → 국제전 → 플레이오프 → 월드), FPS형(킥오프 → 스테이지 1·2 → 마스터즈 → 챔피언스) */
const CALENDAR_OF: Record<GenreId, 'aos' | 'fps'> = { aos: 'aos', rts: 'aos', fps: 'fps', fighting: 'fps' }

/** 이번 시즌에 치르는 대회 목록 (시간 순서) */
export function eventsFor(state: Pick<GameState, 'stage' | 'genre' | 'mode'> & { season?: number }): EventDef[] {
  const all = (state.stage === 'pro1' ? competitions.stages.pro1[CALENDAR_OF[state.genre]] : competitions.stages[state.stage]) as EventDef[]
  return all.filter((e) => (!e.modes || e.modes.includes(state.mode)) && (!e.everyNSeasons || (state.season !== undefined && state.season % e.everyNSeasons === 0)))
}

/** 공식 일정이 아닌 대회인지 (대회 id로 조회) */
export function isUnofficial(eventId: string): boolean {
  const stages = competitions.stages as unknown as Record<string, EventDef[] | Record<string, EventDef[]>>
  const all = Object.values(stages).flatMap((v) => (Array.isArray(v) ? v : Object.values(v).flat()))
  return all.some((e) => e.id === eventId && e.unofficial)
}

/** 월드 챔피언십(시즌 마지막 최고 대회)인지 (대회 id로 조회) */
export function isWorldEvent(eventId: string): boolean {
  const stages = competitions.stages as unknown as Record<string, EventDef[] | Record<string, EventDef[]>>
  const all = Object.values(stages).flatMap((v) => (Array.isArray(v) ? v : Object.values(v).flat()))
  return all.some((e) => e.id === eventId && e.world)
}

/** 초청 대회에 초청받았는지. 팀에 소속되어 있고, 명성과 직전 시즌 성적이 조건을 채워야 한다. */
export function isInvited(state: Pick<GameState, 'season' | 'fame' | 'team' | 'history'>, ev: EventDef): boolean {
  if (!ev.invite) return true
  if (!state.team || state.fame < ev.invite.minFame) return false
  const prev = state.history.find((h) => h.season === state.season - 1)
  if (!prev) return false
  return ev.invite.anyOf.some((c) => ('played' in c ? prev.events.some((e) => e.id === c.played) : (prev.events.find((e) => e.id === c.event)?.placement ?? Infinity) <= c.top))
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
