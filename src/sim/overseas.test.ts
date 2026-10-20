import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { GenreId } from '../engine/types.ts'
import { domesticLeagueId } from '../engine/leagues.ts'
import { playCareer } from './bot.ts'

/**
 * 해외 이적 점검. 숙련 봇이 해외 제안을 받아들이는 판과 거절하는 판을 같은 시드로 돌려 비교한다.
 * 해외 이적이 늘 정답(또는 늘 손해)이 되지 않는지 본다. 결과를 파일로 받으려면:
 *   OVERSEAS_OUT=overseas.txt BALANCE_RUNS=150 npx vitest run src/sim/overseas
 */
const RUNS = Number(process.env.BALANCE_RUNS ?? 60)
const genres: GenreId[] = ['aos', 'fps']

interface Summary {
  titles: number
  withTitle: number
  moved: number
  runs: number
  avgTitlesMoved: number
  avgTitlesStay: number
  /** 같은 시드에서 해외 제안을 모두 거절한 판의 평균 월드 우승 횟수 */
  baseTitles: number
}

function measure(genre: GenreId): Summary {
  let titles = 0
  let withTitle = 0
  let moved = 0
  let titlesMoved = 0
  let titlesStay = 0
  let stay = 0
  let base = 0
  for (let seed = 1; seed <= RUNS; seed++) {
    base += playCareer(genre, 'standard', seed, { policy: 'skilled', acceptTransfers: false }).worldTitles
    const s = playCareer(genre, 'standard', seed, { policy: 'skilled', acceptTransfers: false, acceptOverseas: true })
    const wentAbroad = s.history.some((h) => (h.league ?? domesticLeagueId(genre)) !== domesticLeagueId(genre))
    titles += s.worldTitles
    if (s.worldTitles > 0) withTitle++
    if (wentAbroad) {
      moved++
      titlesMoved += s.worldTitles
    } else {
      stay++
      titlesStay += s.worldTitles
    }
  }
  return { titles, withTitle, moved, runs: RUNS, avgTitlesMoved: moved ? titlesMoved / moved : 0, avgTitlesStay: stay ? titlesStay / stay : 0, baseTitles: base / RUNS }
}

describe('해외 이적 봇 점검', () => {
  const results = genres.map((g) => ({ genre: g, base: undefined as number | undefined, ...measure(g) }))

  it('해외 제안을 받는 판이 실제로 생기고, 끝까지 오류 없이 돈다', () => {
    for (const r of results) {
      expect(r.moved).toBeGreaterThan(0)
    }
  })

  it('모든 해외 제안을 받는 숙련 플레이가 거절하는 같은 시드의 플레이보다 월드 우승을 크게 더 하지 않는다 (해외가 늘 정답이 아니다)', () => {
    for (const r of results) expect(r.titles / r.runs).toBeLessThan(r.baseTitles + 0.5)
  })

  it('리포트를 파일로 내보낸다 (OVERSEAS_OUT이 있을 때만)', () => {
    if (!process.env.OVERSEAS_OUT) return
    const text = results.map((r) => `${r.genre}: 판 ${r.runs}, 해외 경험 ${r.moved}판, 월드 우승 있는 판 ${r.withTitle}, 판당 평균 우승 ${(r.titles / r.runs).toFixed(2)} (거절 ${r.baseTitles.toFixed(2)}), 해외 판 ${r.avgTitlesMoved.toFixed(2)} / 국내 잔류 판 ${r.avgTitlesStay.toFixed(2)}`).join('\n')
    writeFileSync(process.env.OVERSEAS_OUT, text + '\n')
  })
})
