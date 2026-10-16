import { playSeries } from './match.ts'
import type { Rng } from './rng.ts'

export interface Team {
  id: string
  name: string
  /** 이 대회에서 쓰는 실력치 R (플레이어 팀은 멘탈 보정까지 반영해서 넘긴다) */
  power: number
  isPlayer?: boolean
}

export interface Standing {
  team: Team
  wins: number
  losses: number
}

/**
 * 리그전: 모든 팀이 서로 rounds번씩 시리즈를 치르고, 승수 순으로 정렬한다 (동률은 무작위).
 * 경기는 라운드 순서대로 치러지고, 전체 경기의 절반을 치른 시점의 순위(mid)도 함께 돌려준다.
 */
export function runLeagueDetailed(rng: Rng, teams: readonly Team[], rounds: number, bestOf: number): { final: Standing[]; mid: Standing[] } {
  const table = new Map<string, Standing>(teams.map((team) => [team.id, { team, wins: 0, losses: 0 }]))
  const tiebreak = new Map(teams.map((t) => [t.id, rng()]))
  const sorted = () =>
    [...table.values()].map((s) => ({ ...s })).sort((x, y) => y.wins - x.wins || tiebreak.get(y.team.id)! - tiebreak.get(x.team.id)!)

  const total = rounds * ((teams.length * (teams.length - 1)) / 2)
  const midAt = Math.floor(total / 2)
  let played = 0
  let mid: Standing[] = sorted()
  for (let r = 0; r < rounds; r++) {
    for (const [a, b] of roundRobinSchedule(teams.length)) {
      const aWins = playSeries(rng, teams[a].power, teams[b].power, bestOf)
      const [winner, loser] = aWins ? [teams[a], teams[b]] : [teams[b], teams[a]]
      table.get(winner.id)!.wins++
      table.get(loser.id)!.losses++
      played++
      if (played === midAt) mid = sorted()
    }
  }
  return { final: sorted(), mid }
}

/**
 * 라운드로빈 경기 순서 (circle method): 매 경기일마다 모든 팀이 한 경기씩 치른다.
 * 팀 번호 순으로 몰아 치르면 0번 팀(플레이어)만 중간 순위에 최종 성적이 나온다.
 */
function roundRobinSchedule(n: number): [number, number][] {
  const slots: (number | null)[] = Array.from({ length: n }, (_, i) => i)
  if (n % 2 === 1) slots.push(null)
  const m = slots.length
  const games: [number, number][] = []
  for (let day = 0; day < m - 1; day++) {
    for (let i = 0; i < m / 2; i++) {
      const a = slots[i]
      const b = slots[m - 1 - i]
      if (a !== null && b !== null) games.push([a, b])
    }
    slots.splice(1, 0, slots.pop()!)
  }
  return games
}

/** 리그전 최종 순위 */
export function runLeague(rng: Rng, teams: readonly Team[], rounds: number, bestOf: number): Standing[] {
  return runLeagueDetailed(rng, teams, rounds, bestOf).final
}

/**
 * k패 탈락 토너먼트 (k=1 단판, k=2 더블, k=3 트리플 엘리미네이션).
 * 매 라운드 같은 패수끼리 시드 순(1위 대 꼴찌)으로 붙이고, 남는 팀은 다른 그룹 남는 팀과 붙인다.
 * teams는 시드 순이고, 반환값은 최종 순위(0번이 우승)다.
 */
export function runElimination(rng: Rng, teams: readonly Team[], k: number, bestOf: number): Team[] {
  const seed = new Map(teams.map((t, i) => [t.id, i]))
  const losses = new Map(teams.map((t) => [t.id, 0]))
  let alive = [...teams]
  const eliminated: Team[][] = []

  while (alive.length > 1) {
    const byLosses = new Map<number, Team[]>()
    for (const t of alive) byLosses.set(losses.get(t.id)!, [...(byLosses.get(losses.get(t.id)!) ?? []), t])

    const pairs: [Team, Team][] = []
    const carry: Team[] = []
    for (const lossCount of [...byLosses.keys()].sort((a, b) => a - b)) {
      const group = byLosses.get(lossCount)!.sort((a, b) => seed.get(a.id)! - seed.get(b.id)!)
      if (group.length % 2 === 1) carry.push(group.shift()!)
      while (group.length > 0) pairs.push([group.shift()!, group.pop()!])
    }
    while (carry.length >= 2) pairs.push([carry.shift()!, carry.shift()!])

    const out: Team[] = []
    for (const [a, b] of pairs) {
      const aWins = playSeries(rng, a.power, b.power, bestOf)
      const loser = aWins ? b : a
      losses.set(loser.id, losses.get(loser.id)! + 1)
      if (losses.get(loser.id)! >= k) out.push(loser)
    }
    if (out.length > 0) {
      eliminated.push(out.sort((x, y) => seed.get(x.id)! - seed.get(y.id)!))
      const gone = new Set(out.map((t) => t.id))
      alive = alive.filter((t) => !gone.has(t.id))
    }
  }

  // 나중에 탈락한 팀이 더 높은 순위. 같은 라운드 탈락끼리는 시드가 높은 쪽이 위.
  return [...alive, ...eliminated.reverse().flat()]
}
