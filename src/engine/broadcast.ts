import { eventsFor, type EventDef } from './competitions.ts'
import { winProbability } from './match.ts'
import { createRng, mixSeed, type Rng } from './rng.ts'
import type { GameState, RunRecord } from './state.ts'

/** 결승 중계에 필요한 정보: 상대, 세트별 승패 */
export interface FinalSeries {
  eventId: string
  eventName: string
  /** 중계 멘트 묶음 이름 (대회의 finale 값) */
  finale: string
  bestOf: number
  playerTeam: string
  opponent: string
  /** 세트 승패 (true = 플레이어 팀 승). 시리즈가 끝나는 세트까지만 있다 */
  sets: boolean[]
  playerWon: boolean
  /** 플레이어 팀 id (팀 색·로고용) */
  playerTeamId: string
  opponentId: string
}

/**
 * 시리즈 결과(누가 이겼는가)는 그대로 두고, 그 결과로 이어지는 세트별 승패를 만든다.
 * 한 세트 승률로 세트를 굴려 시리즈 결과가 같은 것만 받아들이는 방식이라 접전과 완승이 실력 차에 맞게 나온다.
 * 대회 결과를 정한 난수와는 따로 만든 시드를 쓰므로 대회 결과는 바뀌지 않는다.
 */
function setSequence(rng: Rng, p: number, bestOf: number, playerWon: boolean): boolean[] {
  const need = (bestOf + 1) / 2
  for (let tries = 0; tries < 400; tries++) {
    const sets: boolean[] = []
    let mine = 0
    let theirs = 0
    while (mine < need && theirs < need) {
      const win = rng() < p
      sets.push(win)
      if (win) mine++
      else theirs++
    }
    if ((mine === need) === playerWon) return sets
  }
  // 거의 일어나지 않는 경우(극단적인 실력 차): 이긴 쪽이 모두 이기는 시리즈
  return Array.from({ length: need }, () => playerWon)
}

/** 결승 연출이 붙는 대회에서 플레이어가 결승(1~2위)까지 올랐다면 결승 시리즈를, 아니면 null을 돌려준다. */
export function finalSeries(state: GameState, ev: EventDef, rec: RunRecord): FinalSeries | null {
  if (!ev.finale || rec.placement > 2) return null
  const me = rec.order.find((t) => t.isPlayer)
  const opp = rec.placement === 1 ? rec.order[1] : rec.order[0]
  if (!me || !opp) return null
  const index = eventsFor(state).findIndex((e) => e.id === ev.id)
  const rng = createRng(mixSeed(state.seed, state.season, 0xb0ad, index))
  const playerWon = rec.placement === 1
  const p = winProbability(me.power, opp.power)
  return {
    eventId: ev.id,
    eventName: ev.name,
    finale: ev.finale,
    bestOf: ev.bestOf,
    playerTeam: me.name,
    opponent: opp.name,
    sets: setSequence(rng, p, ev.bestOf, playerWon),
    playerWon,
    playerTeamId: me.id,
    opponentId: opp.id,
  }
}
