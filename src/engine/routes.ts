import routes from '../data/routes.json'
import testData from '../data/tests.json'
import { academyName, pickTeams } from './field.ts'
import { genrePower } from './power.ts'
import { gaussian, type Rng } from './rng.ts'
import type { GameState, PathId, PendingOffers, StageId } from './state.ts'
import type { StatKey } from './types.ts'

/**
 * 초반 커리어(16~21세)의 갈림길. 승급을 숫자 조건으로 자동 처리하지 않고, 성적과 시험으로 루트가 갈린다.
 *   PC방 대회 상위 → 아카데미 입단 테스트 → 아카데미(정석) → 프로 트라이아웃 → 프로 2부
 *   PC방 대회 부진 → 재도전 → 지역 대회 → 스카우트 / 공개 테스트(우회) → 프로 2부 공개 테스트 → 프로 2부
 * 수치는 모두 data/routes.json, data/tests.json 에 있다.
 */

export type TestId = keyof typeof testData.tests

interface TestItem {
  label: string
  stat: 'power' | 'fame' | StatKey
  target: number
  weight: number
}
interface TestDef {
  name: string
  noise: number
  items: TestItem[]
}
export interface PrepDef {
  id: string
  label: string
  desc: string
  bonus: number
  chance: number
  condition?: number
  money?: number
}

const TESTS = testData.tests as Record<TestId, TestDef>
export const PREP = testData.prep as PrepDef[]
const R = routes

export interface TestResult {
  id: TestId
  name: string
  items: { label: string; ratio: number; weight: number }[]
  /** 항목 점수의 가중합 + 준비 보너스 + 운. 1.0 이상이면 합격 */
  score: number
  passed: boolean
  prep: string | null
}

export const pathOf = (s: Pick<GameState, 'path'>): PathId => s.path ?? 'rookie'

export function testName(id: TestId): string {
  return TESTS[id].name
}

function valueOf(state: GameState, item: TestItem): number {
  if (item.stat === 'power') return genrePower(state.stats, state.genre)
  if (item.stat === 'fame') return state.fame
  return state.stats[item.stat]
}

/** 항목별 달성도(1.0이 목표). 1.5에서 멈춘다. */
export function testItems(state: GameState, id: TestId): TestResult['items'] {
  return TESTS[id].items.map((it) => ({ label: it.label, ratio: Math.min(1.5, valueOf(state, it) / it.target), weight: it.weight }))
}

/** 운을 빼고 준비 보너스를 더한 예상 점수 */
export function expectedScore(state: GameState, id: TestId): number {
  const prep = PREP.find((p) => p.id === state.testPrep)
  return testItems(state, id).reduce((sum, it) => sum + it.ratio * it.weight, 0) + (prep ? prep.bonus * prep.chance : 0)
}

/** 이번 시즌 결산에서 볼 시험. certain이 false면 대회 성적에 따라 시험을 못 볼 수도 있다. */
export function upcomingTest(state: GameState): { id: TestId; certain: boolean } | null {
  switch (state.stage) {
    case 'basement':
      return state.academyInvite ? { id: 'academy_test', certain: true } : null
    case 'local_cup':
      return state.age <= R.local.maxAge ? { id: 'amateur_open_test', certain: false } : null
    case 'amateur_team':
      return { id: pathOf(state) === 'academy' ? 'pro_tryout' : 'pro2_open_test', certain: true }
    default:
      return null
  }
}

/** 시험 준비를 고른다. 컨디션·돈은 바로 반영하고, 점수 보너스는 결산 때 쓴다. */
export function choosePrep(state: GameState, prepId: string): GameState {
  const prep = PREP.find((p) => p.id === prepId)
  if (!prep) throw new Error('없는 준비다')
  if (!upcomingTest(state)) throw new Error('볼 시험이 없다')
  if (state.testPrep) throw new Error('이미 준비를 골랐다')
  if (prep.money && state.money + prep.money < 0) throw new Error('돈이 부족하다')
  return {
    ...state,
    testPrep: prepId,
    condition: Math.min(100, Math.max(0, state.condition + (prep.condition ?? 0))),
    money: state.money + (prep.money ?? 0),
  }
}

export function takeTest(state: GameState, id: TestId, rng: Rng): TestResult {
  const def = TESTS[id]
  const items = testItems(state, id)
  const prep = PREP.find((p) => p.id === state.testPrep) ?? null
  const bonus = prep && rng() < prep.chance ? prep.bonus : 0
  const score = items.reduce((sum, it) => sum + it.ratio * it.weight, 0) + bonus + def.noise * gaussian(rng)
  return { id, name: def.name, items, score, passed: score >= 1, prep: prep?.id ?? null }
}

export interface RouteStep {
  state: GameState
  promoted: boolean
  offers: PendingOffers | null
  tests: TestResult[]
  notes: string[]
}

interface RouteDeps {
  /** 대회 id → 이번 시즌 순위 (안 나갔으면 undefined) */
  placementOf: (eventId: string) => number | undefined
  scout: (kind: 'amateur' | 'pro', count: number) => PendingOffers
  rng: Rng
}

/**
 * 방구석 / 지역 대회 / 아마추어 팀 단계의 시즌 결산 때 루트를 정한다.
 * before: 시즌 시작 상태(능력치 기준), after: 대회 보상이 반영된 상태.
 */
export function routeStep(before: GameState, after: GameState, { placementOf, scout, rng }: RouteDeps): RouteStep {
  const power = genrePower(after.stats, after.genre)
  const tests: TestResult[] = []
  const notes: string[] = []
  let s: GameState = { ...after, testPrep: null }
  let promoted = false
  let offers: PendingOffers | null = null
  const move = (stage: StageId, path: PathId) => {
    s = { ...s, stage, path }
    promoted = true
  }

  if (before.stage === 'basement') {
    const cafe = placementOf('cafe_cup')
    const attempts = (before.cafeAttempts ?? 0) + (cafe !== undefined ? 1 : 0)
    s = { ...s, cafeAttempts: attempts }
    // PC방 대회 상위 성적(초대는 대회가 끝나는 시점에 이미 정해졌다)이거나 지난해 초대가 남아 있으면 입단 테스트를 본다
    if (before.academyInvite) {
      const t = takeTest(before, 'academy_test', rng)
      tests.push(t)
      if (t.passed) {
        const org = pickTeams(rng, 'pro', 1, new Set())[0]
        move('amateur_team', 'academy')
        s = { ...s, academyInvite: false, team: { id: org.id, name: academyName(org) } }
        notes.push(`아카데미 입단 테스트 합격! ${academyName(org)}의 연습생이 되었다.`)
      } else if ((before.academyRetries ?? 0) < R.academy.retryMax) {
        s = { ...s, academyRetries: (before.academyRetries ?? 0) + 1 }
        notes.push('아카데미 입단 테스트에서 떨어졌다. 내년에 한 번 더 도전할 수 있다.')
      } else {
        move('local_cup', 'open')
        s = { ...s, academyInvite: false }
        notes.push('아카데미 입단은 끝내 이루지 못했다. 이제 지역 대회에서 길을 찾는다.')
      }
    } else if ((attempts >= R.cafe.toLocalAfter && power >= R.cafe.toLocalMinPower) || attempts >= R.cafe.maxAttempts) {
      move('local_cup', 'open')
      notes.push('PC방 대회에서는 눈에 띄지 못했다. 이제 지역 아마추어 대회에 나간다.')
    } else {
      notes.push('PC방 대회에서 눈에 띄지 못했다. 실력을 더 쌓고 다시 도전하자.')
    }
  } else if (before.stage === 'local_cup') {
    const p = placementOf('local_cup')
    if (before.age > R.local.maxAge) {
      notes.push('지역 대회에서 길을 찾기엔 늦은 나이가 되었다.')
    } else if (p !== undefined && p <= R.local.scoutTop && power >= R.local.scoutMinPower) {
      move('amateur_team', 'open')
      offers = scout('amateur', R.offerCount.scout)
      notes.push('지역 대회 활약을 지켜본 팀들에서 스카우트 제안이 왔다!')
    } else if (p !== undefined && p <= R.local.openTestTop) {
      const t = takeTest(before, 'amateur_open_test', rng)
      tests.push(t)
      if (t.passed) {
        move('amateur_team', 'open')
        offers = scout('amateur', R.offerCount.openTest)
        notes.push('공개 입단 테스트에 합격했다.')
      } else notes.push('공개 입단 테스트에서 떨어졌다. 다음 대회를 노리자.')
    } else notes.push('지역 대회에서 눈에 띄는 성적을 내지 못했다.')
  } else if (before.stage === 'amateur_team') {
    const id: TestId = pathOf(before) === 'academy' ? 'pro_tryout' : 'pro2_open_test'
    const t = takeTest(before, id, rng)
    tests.push(t)
    if (t.passed) {
      s = { ...s, stage: 'pro2', everPro: true }
      promoted = true
      offers = scout('pro', R.offerCount.scout)
      notes.push(`${t.name} 합격! 프로 2부 팀들의 제안이 도착했다.`)
    } else notes.push(`${t.name}에서 떨어졌다. 한 시즌 더 준비하자.`)
  }
  return { state: s, promoted, offers, tests, notes }
}
