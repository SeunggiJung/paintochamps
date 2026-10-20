import lines from '../data/seasonLines.json'
import type { SeasonReport } from './season.ts'
import { stageName } from './season.ts'

/** 이번 시즌을 한 줄로 요약한다. 같은 시즌이면 항상 같은 문장이 나온다(시즌 번호로 문장을 고름). */
export function seasonLine(args: { name: string; season: number; report: SeasonReport; powerGain: number }): string {
  const { name, season, report, powerGain } = args
  const fill = (text: string, vars: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
  const pick = (list: string[]) => list[season % list.length]

  let best: SeasonReport['events'][number] | null = null
  for (const e of report.events) if (!best || e.placement / e.fieldSize <= best.placement / best.fieldSize) best = e

  const vars = { name, from: stageName(report.stageBefore), to: stageName(report.stageAfter), event: best?.name ?? '', place: best?.placement ?? 0 }
  let key: keyof typeof lines.lines
  if (report.worldChampion) key = 'world'
  else if (report.promoted) key = 'promoted'
  else if (report.relegated) key = 'relegated'
  else if (!best) key = 'none'
  else if (best.placement === 1) key = 'win'
  else if (best.placement <= 3 || best.placement / best.fieldSize <= 0.25) key = 'top'
  else if (best.placement / best.fieldSize <= 0.6) key = 'mid'
  else key = 'low'

  return fill(pick(lines.lines[key]), vars) + (powerGain >= lines.growthThreshold ? lines.growth : '')
}
