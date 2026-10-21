import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { adIncome, adPerf, adSlots } from '../engine/ads.ts'
import { leagueDef, leagueIdOf } from '../engine/leagues.ts'
import type { GameState } from '../engine/state.ts'
import type { GenreId } from '../engine/types.ts'
import { playCareer } from './bot.ts'

/**
 * 광고 수입 시뮬레이션. 숙련 봇 커리어에서 시즌마다 명성·직전 성적·월드 성적으로 광고 수입을 계산해
 * 지금의 총수입(커리어 끝 보유금 + 장비 구매액)과 비교한다. 광고는 아직 게임 흐름에 연결하지 않았고 계산만 한다.
 *   ADS_OUT=ads.txt BALANCE_RUNS=100 npx vitest run src/sim/ads
 */
const RUNS = Number(process.env.BALANCE_RUNS ?? 40)

interface SeasonLog {
  age: number
  fame: number
  perf: ReturnType<typeof adPerf>
  worldPlace: number | null
  prestige: number
  stage: string
}

function simulate(genre: GenreId) {
  const seasons: SeasonLog[][] = []
  const finals: GameState[] = []
  for (let seed = 1; seed <= RUNS; seed++) {
    const log: SeasonLog[] = []
    let prev = { worldPlace: null as number | null, playoffs: false }
    let startFame = 0
    const s = playCareer(genre, 'standard', seed, {
      policy: 'skilled',
      onTurn: (st) => {
        if (st.turnInSeason === 1) startFame = st.fame
        if (st.turnInSeason === 4) {
          const runs = st.seasonRun?.runs ?? []
          const world = runs.find((r) => r.id === 'world')
          const playoffs = runs.some((r) => (r.id === 'playoffs' || r.id.endsWith('_playoffs')) && r.placement <= 4)
          log.push({ age: st.age, fame: startFame, perf: adPerf(prev), worldPlace: world?.placement ?? null, prestige: leagueDef(leagueIdOf(st)).prestige, stage: st.stage })
          prev = { worldPlace: world?.placement ?? null, playoffs }
        }
      },
    })
    seasons.push(log)
    finals.push(s)
  }
  return { seasons, finals }
}

describe('광고 수입 모델', () => {
  it('슬롯은 명성 60부터 생기고 최대 3개다', () => {
    expect(adSlots(59)).toBe(0)
    expect(adSlots(60)).toBe(1)
    expect(adSlots(120)).toBe(2)
    expect(adSlots(500)).toBe(3)
  })

  it('월드 특약은 월드 4강 이상일 때 보너스가 붙는다', () => {
    const good = adIncome({ fame: 200, perf: 'title', worldPlace: 1 })
    const bad = adIncome({ fame: 200, perf: 'title', worldPlace: 9 })
    expect(good.total).toBeGreaterThan(bad.total)
    expect(adIncome({ fame: 30, perf: 'title', worldPlace: 1 }).total).toBe(0)
  })

  const results = (['fps', 'aos'] as const).map((g) => ({ genre: g, ...simulate(g) }))

  it('시뮬레이션 결과를 파일로 내보낸다 (ADS_OUT이 있을 때만)', () => {
    if (!process.env.ADS_OUT) return
    const lines: string[] = []
    for (const r of results) {
      const totals: number[] = []
      const byAge: Record<number, number[]> = {}
      let unlockSeasons = 0
      let proSeasons = 0
      const slotSeasons = [0, 0, 0, 0]
      r.seasons.forEach((log) => {
        let sum = 0
        for (const s of log) {
          if (s.stage !== 'pro1') continue
          proSeasons++
          const inc = adIncome({ fame: s.fame, perf: s.perf, prestige: s.prestige, worldPlace: s.worldPlace })
          slotSeasons[inc.slots]++
          if (inc.slots > 0) unlockSeasons++
          sum += inc.total
          ;(byAge[s.age] ??= []).push(inc.total)
        }
        totals.push(sum)
      })
      const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
      const money = r.finals.map((f) => f.money)
      lines.push(`${r.genre}: ${RUNS}판`)
      lines.push(`  커리어 광고 수입 합계 평균 ${(avg(totals) / 10000).toFixed(1)}억 (최소 ${(Math.min(...totals) / 10000).toFixed(1)}억, 최대 ${(Math.max(...totals) / 10000).toFixed(1)}억)`)
      lines.push(`  지금 총수입 근사(30세 보유금 평균) ${(avg(money) / 10000).toFixed(1)}억`)
      lines.push(`  프로 1부 시즌 중 광고가 열린 비율 ${((unlockSeasons / Math.max(1, proSeasons)) * 100).toFixed(0)}% (슬롯 0/1/2/3 시즌 수 ${slotSeasons.join('/')})`)
      for (const age of Object.keys(byAge).map(Number).sort((a, b) => a - b)) lines.push(`    ${age}세 시즌 광고 수입 평균 ${(avg(byAge[age]) / 10000).toFixed(2)}억 (n=${byAge[age].length})`)
    }
    writeFileSync(process.env.ADS_OUT, lines.join('\n') + '\n')
  })
})

describe('광고 계약을 실제 흐름으로 치른 숙련 봇', () => {
  const REAL_RUNS = Math.min(RUNS, 60)
  const measure = (genre: GenreId) => {
    let titlesBase = 0
    let titlesAds = 0
    let moneyBase = 0
    let moneyAds = 0
    let earned = 0
    for (let seed = 1; seed <= REAL_RUNS; seed++) {
      const base = playCareer(genre, 'standard', seed, { policy: 'skilled' })
      const ads = playCareer(genre, 'standard', seed, { policy: 'skilled', signAds: true })
      titlesBase += base.worldTitles
      titlesAds += ads.worldTitles
      moneyBase += base.money
      moneyAds += ads.money
      earned += ads.adEarned
    }
    return { genre, titlesBase: titlesBase / REAL_RUNS, titlesAds: titlesAds / REAL_RUNS, moneyBase: moneyBase / REAL_RUNS, moneyAds: moneyAds / REAL_RUNS, earned: earned / REAL_RUNS }
  }
  const real = (['fps', 'aos'] as const).map(measure)

  it('광고로 돈은 더 벌지만 월드 우승 횟수는 거의 그대로다 (촬영 컨디션 비용만 든다)', () => {
    for (const r of real) {
      expect(r.earned).toBeGreaterThan(0)
      expect(r.moneyAds).toBeGreaterThan(r.moneyBase)
      expect(Math.abs(r.titlesAds - r.titlesBase)).toBeLessThanOrEqual(0.4 + 1e-9) // 5판 평균이라 0.2 단위로 움직인다
    }
  })

  it('실제 흐름 결과를 파일로 내보낸다 (ADS_OUT이 있을 때만)', () => {
    if (!process.env.ADS_OUT) return
    const text = real
      .map((r) => `${r.genre} 실제 흐름(${REAL_RUNS}판): 광고 수입 평균 ${(r.earned / 10000).toFixed(1)}억, 30세 보유금 ${(r.moneyBase / 10000).toFixed(1)}억 → ${(r.moneyAds / 10000).toFixed(1)}억, 판당 월드 우승 ${r.titlesBase.toFixed(2)} → ${r.titlesAds.toFixed(2)}`)
      .join('\n')
    writeFileSync(process.env.ADS_OUT + '.real', text + '\n')
  })
})
