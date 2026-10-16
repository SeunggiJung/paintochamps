import highlightData from '../data/highlights.json'
import type { EventDef } from './competitions.ts'
import { TIERS } from './field.ts'
import { genrePower } from './power.ts'
import { createRng, gaussian, mixSeed } from './rng.ts'
import type { GameState, SeasonRun, StageId, StandingRow } from './state.ts'

export interface Award {
  id: string
  name: string
  desc: string
}

export interface BoardLine {
  /** 선수 이름(플레이어는 본인, 나머지는 '○○ 팀 에이스') */
  name: string
  team: string
  rating: number
  isPlayer: boolean
  rank: number
}

export type Level = 'top' | 'high' | 'mid' | 'low'

export interface Highlights {
  /** 이번 시즌 리그 성적 (리그가 없는 단계는 null) */
  league: { name: string; wins: number; losses: number; placement: number; size: number; expected: number | null } | null
  /** 시즌 평점 (0~10, 소수 첫째 자리) */
  rating: number
  /** 리그 선수들 중 내 평점 순위와 비교 대상 수 */
  ratingRank: number
  players: number
  level: Level
  /** 평점 순위표 상위권과 내 줄 */
  board: BoardLine[]
  awards: Award[]
}

const H = highlightData
const TIER_OF_STAGE: Partial<Record<StageId, string>> = { basement: 'cafe', local_cup: 'local', amateur_team: 'amateur', pro2: 'pro2', pro1: 'pro1' }

export const LEVEL_TEXT: Record<Level, string> = { top: '리그 최상위권', high: '리그 상위권', mid: '리그 중위권', low: '리그 하위권' }

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const round1 = (v: number) => Math.round(v * 10) / 10
const winRate = (r: StandingRow) => (r.wins + r.losses === 0 ? 0.5 : r.wins / (r.wins + r.losses))

/** 평점 순위 비율로 본 리그 내 수준 */
export function levelOf(rank: number, players: number): Level {
  const pct = players <= 1 ? 0 : (rank - 1) / (players - 1)
  return pct <= H.level.top ? 'top' : pct <= H.level.high ? 'high' : pct <= H.level.mid ? 'mid' : 'low'
}

/**
 * 시즌 활약 정리: 리그 성적, 시즌 평점과 리그 내 순위·수준, 수상 기록.
 * 리그에 나선 모든 팀의 에이스에게 팀 승률과 약간의 운으로 평점을 매기고(시드 고정), 내 평점은 팀 승률에 더해
 * 내 실력이 리그 평균보다 얼마나 높은지를 반영한다. 그래서 약팀에서도 혼자 잘하면 평점이 높고 좋은 팀에서 못하면 낮다.
 * state는 결산 직전 상태(소속 단계·능력치 기준), events는 그 단계의 대회 목록이다.
 */
export function seasonHighlights(state: GameState, run: SeasonRun, events: EventDef[]): Highlights {
  const rng = createRng(mixSeed(state.seed, state.season, 0x4a11))
  const awards: Award[] = []

  // 순위를 가르는 리그(마지막 공식 리그 하나)의 최종 순위표
  const leagueEvent = [...events].reverse().find((e) => e.rank && run.runs.some((r) => r.id === e.id && r.table))
  const leagueRun = leagueEvent ? run.runs.find((r) => r.id === leagueEvent.id)! : null
  const table = leagueRun?.table ?? null

  let result: Pick<Highlights, 'league' | 'rating' | 'ratingRank' | 'players' | 'level' | 'board'> = {
    league: null,
    rating: 0,
    ratingRank: 1,
    players: 1,
    level: 'mid',
    board: [],
  }

  if (leagueRun && table) {
    const tier = TIERS[TIER_OF_STAGE[state.stage] ?? 'amateur']
    const z = clamp((genrePower(state.stats, state.genre) - tier.mean) / tier.sd, -H.rating.zLimit, H.rating.zLimit)
    const lines = table.map((row, i) => {
      const noise = gaussian(rng)
      const base = H.rating.base + (winRate(row) - 0.5) * H.rating.winRateWeight
      const rating = row.isPlayer ? base + z * H.rating.powerWeight + noise * H.rating.playerNoise : base + noise * H.rating.noise
      return { row, i, rating: round1(clamp(rating, H.rating.min, H.rating.max)) }
    })
    const sorted = [...lines].sort((a, b) => b.rating - a.rating || a.i - b.i)
    const players = sorted.length
    const me = sorted.findIndex((l) => l.row.isPlayer)
    const rank = me + 1
    const line = (l: (typeof sorted)[number], k: number): BoardLine => ({
      name: l.row.isPlayer ? state.name : `${l.row.name} 에이스`,
      team: l.row.name,
      rating: l.rating,
      isPlayer: l.row.isPlayer,
      rank: k + 1,
    })
    const board = sorted.slice(0, H.boardSize).map(line)
    if (me >= H.boardSize) board.push(line(sorted[me], me))
    const mine = table[sorted[me].i]
    result = {
      league: { name: leagueRun.name, wins: mine.wins, losses: mine.losses, placement: leagueRun.placement, size: leagueRun.fieldSize, expected: leagueRun.expected ?? null },
      rating: sorted[me].rating,
      ratingRank: rank,
      players,
      level: levelOf(rank, players),
      board,
    }

    // 리그 수상 (평점 순위와 팀 성적으로 정한다)
    const teamOk = leagueRun.placement <= Math.ceil(leagueRun.fieldSize / 2)
    if (rank === 1 && teamOk) awards.push({ id: 'mvp', name: '리그 MVP', desc: `${leagueRun.name} 평점 1위 (${sorted[me].rating.toFixed(1)})` })
    else if (rank <= H.bestCount) awards.push({ id: 'best', name: '시즌 베스트 멤버', desc: `${leagueRun.name} 평점 ${rank}위` })
    const firstSeasonHere = state.history.every((h) => h.stage !== state.stage)
    if (firstSeasonHere && state.age <= H.rookieMaxAge && rank <= Math.ceil(players * H.rookieTop)) awards.push({ id: 'rookie', name: '올해의 신인', desc: `이 리그 첫 시즌에 평점 ${rank}위` })
    if (leagueRun.placement === 1) awards.push({ id: 'champion_team', name: '리그 우승 팀', desc: `${leagueRun.name}에서 팀을 정상으로 이끌었다` })
    const bestWr = Math.max(...table.map(winRate))
    if (winRate(mine) === bestWr && mine.wins + mine.losses > 0) awards.push({ id: 'win_rate', name: '승률왕', desc: `${leagueRun.name} 승률 ${Math.round(bestWr * 100)}%` })
  }

  // 대회 우승(월드는 결승 MVP까지)
  for (const ev of events) {
    if (ev.rank || ev.unofficial) continue
    const rec = run.runs.find((r) => r.id === ev.id)
    if (rec?.placement === 1) {
      awards.push({ id: `win_${ev.id}`, name: ev.world ? `${ev.name} 우승 · 결승 MVP` : `${ev.name} 우승`, desc: `${rec.fieldSize}팀 중 1위` })
    }
  }
  for (const ev of events) {
    if (!ev.unofficial) continue
    const rec = run.runs.find((r) => r.id === ev.id)
    if (rec?.placement === 1) awards.push({ id: `win_${ev.id}`, name: `${ev.name} 우승`, desc: `${rec.fieldSize}팀 중 1위` })
  }

  return { ...result, awards }
}
