import type { EndingId, GameState, ModeId, StageId } from '../engine/state.ts'
import type { GenreId } from '../engine/types.ts'
import { playCareer, type BotOptions } from './bot.ts'

export interface BatchReport {
  genre: GenreId
  mode: ModeId
  runs: number
  endings: Partial<Record<EndingId, number>>
  /** 비율(0~1) */
  reachedPro1: number
  reachedWorld: number
  worldTitle: number
  hidden: number
  /** 단계별 처음 도달한 평균 나이 */
  firstAge: Partial<Record<StageId, number>>
  /** 1부에서 보낸 평균 시즌 수 */
  avgPro1Seasons: number
  /** 1부 시즌 하나당: 플레이오프에 든 비율, 월드에 나간 비율, 월드를 우승한 비율 */
  perSeason: { playoffs: number; world: number; title: number }
}

const STAGES: StageId[] = ['local_cup', 'amateur_team', 'pro2', 'pro1']

function summarize(genre: GenreId, mode: ModeId, finals: GameState[]): BatchReport {
  const n = finals.length
  const endings: BatchReport['endings'] = {}
  const ages: Record<string, number[]> = {}
  let pro1 = 0
  for (const s of finals) {
    endings[s.finished!] = (endings[s.finished!] ?? 0) + 1
    const reached = new Set<StageId>()
    // 결산 직후 단계가 아니라 그 시즌을 뛴 단계 기준. 마지막 시즌 뒤 단계(승급)도 포함한다.
    for (const h of s.history) if (!reached.has(h.stage)) (reached.add(h.stage), (ages[h.stage] ??= []).push(h.age))
    if (reached.has('pro1')) pro1++
  }
  const avg = (a: number[] | undefined) => (a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : undefined)
  let pro1Seasons = 0
  let playoffSeasons = 0
  let worldSeasons = 0
  let titleSeasons = 0
  for (const s of finals) {
    for (const h of s.history) {
      if (h.stage !== 'pro1') continue
      pro1Seasons++
      if (h.events.some((e) => e.id === 'playoffs' || e.id === 'stage2_playoffs')) playoffSeasons++
      const world = h.events.find((e) => e.id === 'world')
      if (world) worldSeasons++
      if (world?.placement === 1) titleSeasons++
    }
  }
  const per = (v: number) => (pro1Seasons ? v / pro1Seasons : 0)
  return {
    perSeason: { playoffs: per(playoffSeasons), world: per(worldSeasons), title: per(titleSeasons) },
    genre,
    mode,
    runs: n,
    endings,
    reachedPro1: pro1 / n,
    reachedWorld: finals.filter((s) => s.worldAppearances > 0).length / n,
    worldTitle: finals.filter((s) => s.worldTitles > 0).length / n,
    hidden: finals.filter((s) => s.finished === 'hidden_loyal').length / n,
    firstAge: Object.fromEntries(STAGES.map((st) => [st, avg(ages[st])]).filter(([, v]) => v !== undefined)),
    avgPro1Seasons: finals.reduce((sum, s) => sum + s.seasonsInPro1, 0) / n,
  }
}

export function runBatch(genre: GenreId, mode: ModeId, runs: number, opts: BotOptions): BatchReport {
  const finals: GameState[] = []
  for (let seed = 1; seed <= runs; seed++) finals.push(playCareer(genre, mode, seed, opts))
  return summarize(genre, mode, finals)
}

const pct = (v: number) => `${(v * 100).toFixed(0)}%`

export function formatReport(r: BatchReport, label: string): string {
  const endings = Object.entries(r.endings)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${pct(v / r.runs)}`)
    .join(', ')
  const ages = Object.entries(r.firstAge)
    .map(([k, v]) => `${k} ${v!.toFixed(1)}`)
    .join(', ')
  return `${label} ${r.genre}/${r.mode} (${r.runs}판): 1부 도달 ${pct(r.reachedPro1)} | 월드 진출 ${pct(r.reachedWorld)} | 월드 우승 ${pct(r.worldTitle)} | 히든 ${pct(r.hidden)} | 1부 ${r.avgPro1Seasons.toFixed(1)}시즌 | 시즌당 플레이오프 ${pct(r.perSeason.playoffs)} 월드 ${pct(r.perSeason.world)} 우승 ${pct(r.perSeason.title)} | 첫 도달 나이 ${ages}\n   엔딩: ${endings}`
}
