import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ModeId } from '../engine/state.ts'
import type { GenreId } from '../engine/types.ts'
import { formatReport, runBatch } from './report.ts'

/**
 * 난이도 점검. 규칙이나 `competitions.json`의 상대 실력치를 바꾼 뒤 아래처럼 돌리면
 * 전체 수치를 파일로 받아볼 수 있다. (판 수는 BALANCE_RUNS, 기본 100)
 *   BALANCE_OUT=report.txt BALANCE_RUNS=150 npx vitest run src/sim
 *
 * 시즌 중 행동은 시즌 계획대로 자동으로 흘러가므로, 봇의 차이는 계획·장비·이벤트 선택에서 나온다.
 * random: 방침·훈련·레슨·장비를 무작위로 정하는 플레이 (잘 모르고 눌러 보는 사람)
 * casual: 앞의 훈련 후보와 기본 방침(균형)만 쓰고 장비는 사지 않는 단순한 플레이
 * skilled: 시즌을 미리 돌려 보고 가장 좋은 계획을 고르고, 장비를 사고, 이벤트 선택지도 비교하는 플레이
 * 아래 기준은 초안이다. 플레이 테스트로 느낌이 달라지면 숫자를 바꾼다.
 */
const RUNS = Number(process.env.BALANCE_RUNS ?? 100)
const genres: GenreId[] = ['fps', 'aos']
const modes: ModeId[] = ['tutorial', 'standard', 'precise']

describe('난이도: 월드는 쉽게 갈 수 없고, 우승은 더 어렵다', () => {
  const reports = genres.flatMap((g) =>
    modes.map((m) => ({
      random: runBatch(g, m, RUNS, { policy: 'random' }),
      casual: runBatch(g, m, RUNS, { policy: 'casual' }),
      skilled: runBatch(g, m, RUNS, { policy: 'skilled' }),
    })),
  )

  it('리포트를 파일로 내보낸다 (BALANCE_OUT이 있을 때만)', () => {
    if (!process.env.BALANCE_OUT) return
    const text = reports.map((r) => [formatReport(r.random, '[random]'), formatReport(r.casual, '[casual]'), formatReport(r.skilled, '[skilled]')].join('\n')).join('\n')
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

  // 2026-10-16 시즌 계획(자동 진행) 개편: 시즌 중 행동은 컨디션에 맞춰 자동으로 흘러가서, 아무렇게나 눌러도 컨디션이 무너지지 않는다.
  // 그래서 예전처럼 "무작위가 단순 플레이보다 한참 못하다"는 성립하지 않고, 격차는 방침·훈련·레슨·장비를 알고 고르는 데서 나온다.
  it('방침·훈련·장비를 알고 고르는 숙련 플레이는 기본 계획만 누르는 단순 플레이보다 뚜렷하게 앞선다 (최종 실력치 120 이상)', () => {
    for (const r of reports) expect(r.skilled.avgFinal.power - r.casual.avgFinal.power).toBeGreaterThanOrEqual(120)
  })

  it('계획을 아무렇게나 정하면 숙련보다 뒤처지고(최종 실력치 80 이상 낮다) 월드에는 거의 못 간다 (30% 이하)', () => {
    for (const r of reports) {
      expect(r.skilled.avgFinal.power - r.random.avgFinal.power).toBeGreaterThanOrEqual(80)
      expect(r.random.reachedWorld).toBeLessThanOrEqual(0.3)
      expect(r.random.worldTitle).toBeLessThanOrEqual(0.02)
    }
  })

  it('정밀 모드는 계획이 더 잘게 나뉘어 있어, 아는 사람과 기본 계획만 누르는 사람의 격차가 표준 모드보다 크다', () => {
    for (const genre of genres) {
      const gap = (mode: ModeId) => {
        const r = reports.find((x) => x.skilled.genre === genre && x.skilled.mode === mode)!
        return r.skilled.avgFinal.power - r.casual.avgFinal.power
      }
      expect(gap('precise')).toBeGreaterThan(gap('standard'))
    }
  })
})
