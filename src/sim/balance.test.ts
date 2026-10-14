import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ModeId } from '../engine/state.ts'
import type { GenreId } from '../engine/types.ts'
import { formatReport, runBatch } from './report.ts'

/**
 * 난이도 점검. 규칙이나 `competitions.json`의 상대 실력치를 바꾼 뒤 아래처럼 돌리면
 * 전체 수치를 파일로 받아볼 수 있다. (판 수는 BALANCE_RUNS, 기본 80)
 *   BALANCE_OUT=report.txt BALANCE_RUNS=150 npx vitest run src/sim
 *
 * casual: 컨디션만 관리하며 훈련하는 단순한 플레이
 * skilled: 한 턴 앞을 보고 행동을 고르고 이벤트 선택지를 비교하는 플레이 (장비는 행동 칸을 써서 거의 사지 않는다)
 * 아래 기준은 초안이다. 플레이 테스트로 느낌이 달라지면 숫자를 바꾼다.
 */
const RUNS = Number(process.env.BALANCE_RUNS ?? 80)
const genres: GenreId[] = ['fps', 'aos']
const modes: ModeId[] = ['tutorial', 'standard', 'precise']

describe('난이도: 월드는 쉽게 갈 수 없고, 우승은 더 어렵다', () => {
  const reports = genres.flatMap((g) =>
    modes.map((m) => ({ casual: runBatch(g, m, RUNS, { policy: 'casual' }), skilled: runBatch(g, m, RUNS, { policy: 'skilled' }) })),
  )

  it('리포트를 파일로 내보낸다 (BALANCE_OUT이 있을 때만)', () => {
    if (!process.env.BALANCE_OUT) return
    const text = reports.map((r) => formatReport(r.casual, '[casual]') + '\n' + formatReport(r.skilled, '[skilled]')).join('\n')
    writeFileSync(process.env.BALANCE_OUT, text + '\n')
  })

  it('튜토리얼에서는 히든 엔딩이 절대 나오지 않는다', () => {
    for (const r of reports.filter((x) => x.skilled.mode === 'tutorial')) {
      expect(r.skilled.hidden).toBe(0)
      expect(r.casual.hidden).toBe(0)
    }
  })

  it('월드 우승은 숙련 플레이로도 어렵다 (한 판에 20% 이하), 단순 플레이로는 거의 불가능하다 (2% 이하)', () => {
    for (const r of reports) {
      expect(r.skilled.worldTitle).toBeLessThanOrEqual(0.2)
      expect(r.casual.worldTitle).toBeLessThanOrEqual(0.02)
    }
  })

  it('월드 진출은 시즌마다 되는 일이 아니다 (1부 시즌당 숙련 45% 이하, 단순 플레이 5% 이하)', () => {
    for (const r of reports) {
      expect(r.skilled.perSeason.world).toBeLessThanOrEqual(0.45)
      expect(r.casual.perSeason.world).toBeLessThanOrEqual(0.05)
    }
  })

  it('단순 플레이는 커리어 내내 거의 월드에 못 간다 (10% 이하)', () => {
    for (const r of reports) expect(r.casual.reachedWorld).toBeLessThanOrEqual(0.1)
  })

  it('그래도 숙련된 플레이어에게는 길이 열려 있다 (1부 도달 40% 이상, 월드 진출 30% 이상)', () => {
    for (const r of reports) {
      expect(r.skilled.reachedPro1).toBeGreaterThanOrEqual(0.4)
      expect(r.skilled.reachedWorld).toBeGreaterThanOrEqual(0.3)
    }
  })
})
