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
const modes: ModeId[] = ['tutorial', 'standard']

describe('난이도: 숙련 플레이는 20대 중반에 월드를 제패할 수 있고, 단순 플레이는 훨씬 어렵다', () => {
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

  // 2026-10-19 사용자 결정: 핵심 능력치를 끝까지 키운 선수가 국제전에서 꼴찌를 하는 건 현실과 안 맞는다.
  // 숙련 플레이는 20대 중반에 첫 월드 우승을 하는 게 흔해야 하므로 1부 강호(915→760)와 국제전 상대(990→770)를 낮췄다.
  // 2026-10-19 에이징 커브 강화: 피지컬(반응속도·정확도·집중)은 25세부터 해마다 더 크게 내려가고 경험 능력치는 오른다.
  // 후반 우승이 너무 쉬워지지 않도록 29세 이후 시즌당 우승률은 FPS 약 27%, AOS 약 50%(경험 장르)가 목표다.
  // 대신 단순·무작위 플레이도 예전보다 월드 우승 가능성이 열린다(자동 진행 때문에 둘의 실력 격차가 크지 않다).
  // 2026-10-20 사용자 결정: 프로게이머의 피지컬은 20대 초반에 완성되고 이후엔 경험으로 보완한다. 성장기(19~23세) 훈련 효율 +30%,
  // 시즌 도중 승급, 가파른 피지컬 하락으로 첫 우승 평균 25세 안팎·26세 이하 첫 우승 과반이 목표다(후반 우승률은 FPS 약 20%, AOS 약 45%).
  it('숙련 플레이는 커리어 안에 월드 우승을 하고, 첫 우승이 20대 중반에 온다 (평균 26.5세 이하, 26세 이하 첫 우승 40% 이상)', () => {
    for (const r of reports) {
      expect(r.skilled.worldTitle).toBeGreaterThanOrEqual(0.55)
      expect(r.skilled.firstTitle.avgAge!).toBeLessThanOrEqual(26.5)
      expect(r.skilled.firstTitle.by26).toBeGreaterThanOrEqual(0.4)
    }
  })

  it('단순 플레이는 숙련보다 월드 우승이 훨씬 드물다 (25% 이하, 숙련과 40%p 이상 차이)', () => {
    for (const r of reports) {
      expect(r.casual.worldTitle).toBeLessThanOrEqual(0.25)
      expect(r.skilled.worldTitle - r.casual.worldTitle).toBeGreaterThanOrEqual(0.4)
    }
  })

  it('월드 진출은 시즌마다 되는 일이 아니다 (1부 시즌당 숙련 60% 이하, 단순 플레이 20% 이하)', () => {
    for (const r of reports) {
      expect(r.skilled.perSeason.world).toBeLessThanOrEqual(0.6)
      expect(r.casual.perSeason.world).toBeLessThanOrEqual(0.2)
    }
  })

  it('단순 플레이가 커리어 내내 월드에 못 가는 경우도 많다 (진출 65% 이하)', () => {
    for (const r of reports) expect(r.casual.reachedWorld).toBeLessThanOrEqual(0.65)
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

  it('계획을 아무렇게나 정하면 숙련보다 뒤처지고(최종 실력치 80 이상 낮다) 월드 우승도 숙련보다 훨씬 드물다 (진출 85% 이하, 우승 45% 이하)', () => {
    for (const r of reports) {
      expect(r.skilled.avgFinal.power - r.random.avgFinal.power).toBeGreaterThanOrEqual(80)
      expect(r.random.reachedWorld).toBeLessThanOrEqual(0.85)
      expect(r.random.worldTitle).toBeLessThanOrEqual(0.45)
    }
  })
})
