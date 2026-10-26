import competitions from '../data/competitions.json'
import contracts from '../data/contracts.json'
import events from '../data/events.json'
import genres from '../data/genres.json'
import routes from '../data/routes.json'
import rules from '../data/rules.json'
import stages from '../data/stages.json'
import { conditionTier } from './growth.ts'
import { domesticLeagueId, leagueDef } from './leagues.ts'
import { genrePower } from './power.ts'
import type { ActionId, GameState, RunRecord } from './state.ts'
import { trainingGains } from './training.ts'
import { STAT_KEYS, type StatKey } from './types.ts'

/** 시즌 결산 화면의 '다음 목표' 카드 내용 */
export interface Guidance {
  /** 카드 제목: 다음에 노릴 것 */
  title: string
  /** 조건·기준 설명 (한 줄씩) */
  lines: string[]
  /** 지금 키울 가치가 가장 큰 능력치 (장르 비중 × 남은 여유) */
  focus: StatKey
}

/** 장르 비중이 크고 아직 오를 자리가 많이 남은 능력치. 이걸 키우면 실력치 R이 가장 많이 오른다. */
export function focusStat(state: GameState): StatKey {
  const weights = genres[state.genre].weights
  return STAT_KEYS.reduce((best, key) => (weights[key] * (1000 - state.stats[key]) > weights[best] * (1000 - state.stats[best]) ? key : best), STAT_KEYS[0])
}

const pct = (ratio: number) => `${Math.round(ratio * 100)}%`

/** 월드 챔피언십에 나가는 길: 데이터의 진출권(상위 몇 팀, 포인트)에서 문장을 만든다. 장르 계열(AOS형·FPS형)에 따라 일정이 다르다. */
function worldRoute(genre: GameState['genre']): string {
  const family = genre === 'aos' || genre === 'rts' ? 'aos' : 'fps'
  const events = competitions.stages.pro1[family] as { id: string; name: string; qualifies?: { to: string; top: number }[]; pointsQualify?: { to: string; minPoints: number } }[]
  const parts: string[] = []
  // 대회 이름의 {league}는 국내 리그 이름으로, {city}(개최 도시)는 뺀다
  const league = leagueDef(domesticLeagueId(genre)).name
  const nameOf = (raw: string) => raw.replaceAll('{league}', league).replace(/\s*\{city\}/g, '')
  for (const e of events.map((x) => ({ ...x, name: nameOf(x.name) }))) {
    const q = e.qualifies?.find((x) => x.to === 'world')
    if (q) parts.push(q.top === 1 ? `${e.name} 우승` : `${e.name} 상위 ${q.top}팀`)
    if (e.pointsQualify?.to === 'world') parts.push(`챔피언십 포인트 ${e.pointsQualify.minPoints} 이상`)
  }
  return parts.length > 0 ? `월드 진출: ${parts.join(' 또는 ')}` : '월드 진출: 1부 시즌 상위권'
}

/**
 * 다음에 노릴 단계와 그 기준을 지금 실력과 견줘 알려 준다. 결산이 끝난 상태(새 단계 기준)로 부른다.
 * 기준 숫자는 모두 규칙 데이터(stages·routes·competitions)에서 읽는다. 끝난 판이면 null.
 */
export function nextGoal(state: GameState): Guidance | null {
  if (state.finished) return null
  const power = Math.round(genrePower(state.stats, state.genre))
  const focus = focusStat(state)
  const lines: string[] = []

  switch (state.stage) {
    case 'basement': {
      const { inviteTop, toLocalMinPower } = routes.cafe
      lines.push(`PC방 대회에서 ${inviteTop}강 이상이면 아카데미 입단 테스트에 초대돼요.`, `계속 부진하면 실력치 ${toLocalMinPower}을 넘기고 지역 대회로 넘어가요. (지금 ${power})`)
      return { title: '다음 목표: 아카데미 입단', lines, focus }
    }
    case 'local_cup': {
      const { scoutTop, scoutMinPower, openTestTop, maxAge } = routes.local
      lines.push(`지역 대회 ${scoutTop}강 이상에 실력치 ${scoutMinPower} 이상이면 스카우트 제안이 와요. (지금 ${power})`, `${openTestTop}강 이상이면 공개 입단 테스트를 볼 수 있어요.`, `지역 대회는 ${maxAge}세까지만 나갈 수 있어요.`)
      return { title: '다음 목표: 아마추어 팀 입단', lines, focus }
    }
    case 'amateur_team': {
      const m = stages.midPromotion.amateur_team
      lines.push(`아마추어 리그 상위 ${pct(m.topRatio)}에 실력치 ${m.minPower} 이상이면 시즌 도중에도 프로 2부 제안이 와요. (지금 ${power})`)
      return { title: '다음 목표: 프로 2부', lines, focus }
    }
    case 'pro2': {
      const m = stages.midPromotion.pro2
      const need = stages.stages.pro2.next.minPower
      lines.push(`시즌 결산 때 실력치 ${need} 이상이면 1부 콜업 제안이 와요. (지금 ${power}${power >= need ? ' · 충족' : ` · ${need - power} 부족`})`, `시즌 도중에는 리그 상위 ${pct(m.topRatio)}에 실력치 ${m.minPower}, 명성 ${m.minFame} 이상이 필요해요.`)
      return { title: '다음 목표: 프로 1부 콜업', lines, focus }
    }
    case 'pro1': {
      const top = competitions.tiers.pro1.grades[0].mean
      const world = competitions.tiers.intl.mean
      lines.push(`지금 실력치 ${power} · 1부 강호 평균 ${top} · 국제전 상대 평균 ${world}`, power >= world ? '국제전 상대와 비슷하거나 앞서요. 월드 우승을 노릴 만해요.' : `국제전 상대 평균까지 ${world - power} 부족해요. 월드 우승에는 이만큼을 더 채워야 해요.`, worldRoute(state.genre))
      if (state.age >= rules.ageDecline.fromAge) lines.push(`${rules.ageDecline.fromAge}세부터 피지컬이 해마다 떨어져요. 경험 능력치(판단력·멘탈·팀워크)로 보완하세요.`)
      return { title: '다음 목표: 월드 챔피언십', lines, focus }
    }
  }
  return null
}

/**
 * 리그 결과의 이유를 전력과 순위로 풀어 쓴다 (코치의 한 줄 분석). 전력 정보가 없는 옛 기록이나 리그가 아닌 대회는 null.
 * 순위는 승패의 운이 섞이므로, 기대 순위와 크게 다를 때만 '운·접전' 탓으로 돌린다.
 */
export function leagueReason(run: RunRecord): string[] | null {
  if (!run.table || !run.strength || run.expected === undefined) return null
  const { mine, avg, top } = run.strength
  const gap = run.placement - run.expected
  const lines = [`우리 팀 전력 ${mine} · 리그 평균 ${avg} · 최강 팀 ${top} → 전력 순위 ${run.expected}위`]
  if (gap >= 2) lines.push(`전력 순위보다 ${gap}계단 낮은 ${run.placement}위로 끝났어요. 전력 차이보다는 접전을 내주었거나 운이 따르지 않은 시즌이에요.`)
  else if (gap <= -2) lines.push(`전력 순위보다 ${-gap}계단 높은 ${run.placement}위예요. 접전을 잘 가져간 시즌이었어요.`)
  else lines.push('전력 순위와 비슷한 성적이에요. 전력이 곧 결과로 이어진 시즌이에요.')
  if (mine < avg) lines.push(`팀 전력이 리그 평균보다 ${avg - mine} 낮아 처음부터 불리했어요. 실력치를 올리거나 더 강한 팀으로 옮기면 전력이 올라가요.`)
  return lines
}

/** 이적·입단 제안 카드의 추천/주의 판정 */
export interface OfferVerdict {
  level: 'good' | 'caution' | 'neutral'
  /** 지금보다 월급이 낮아지는 양 (오르거나 같으면 0) */
  salaryDrop: number
  /** 이 팀에서 받는 대회 전력 보정 */
  boost: number
  /** 팀 전력이 리그 평균보다 많이 낮아 대회 전력이 깎이는가 */
  weak: boolean
}

/**
 * 제안의 손익을 한눈에 가른다: 월급이 내려가거나 대회 전력이 크게 깎이면 주의, 둘 다 문제없고 대회 전력이 오르면 추천.
 * 기준은 contracts.json의 offerVerdict. 팀이 없는 선수의 입단 제안은 월급 하락이 없다(salaryDelta가 늘 양수).
 */
export function offerVerdict(terms: { salaryDelta: number; boost: number }): OfferVerdict {
  const { cautionBoost, goodBoost } = contracts.offerVerdict
  const salaryDrop = terms.salaryDelta < 0 ? -terms.salaryDelta : 0
  const weak = terms.boost <= cautionBoost
  const level = salaryDrop > 0 || weak ? 'caution' : terms.boost >= goodBoost ? 'good' : 'neutral'
  return { level, salaryDrop, boost: terms.boost, weak }
}

/** 낮은 컨디션 경고에 쓰는 수치 */
export interface ConditionWarning {
  condition: number
  label: string
  /** 이 단계의 훈련 성과 배율 */
  coef: number
  /** 이 값 이하에서 슬럼프 이벤트가 날 수 있다 */
  slumpAt: number
  /** 이 값 이하에서 부상 이벤트가 날 수 있다 */
  injuryAt: number
}

const eventCondMax = (id: string): number => (events as { id: string; when?: { condition?: { max?: number } } }[]).find((e) => e.id === id)?.when?.condition?.max ?? 0

/**
 * 컨디션이 낮을 때 보여 줄 경고. 훈련 성과 배율과 슬럼프·부상 위험선을 알려 준다(결과를 미리 계산해 보여 주는 게 아니라 위험만 알린다).
 * 기준은 rules.conditionWarnAt. 이미 부상 중이면 쉬며 재활하므로 경고하지 않는다.
 */
export function conditionWarning(state: Pick<GameState, 'condition' | 'injuredMonths'>): ConditionWarning | null {
  if (state.injuredMonths > 0 || state.condition > rules.conditionWarnAt) return null
  const tier = conditionTier(state.condition)
  return { condition: Math.round(state.condition), label: tier.label, coef: tier.coef, slumpAt: eventCondMax('slump'), injuryAt: eventCondMax('injury') }
}

/** 고른 훈련이 가장 뒤처진 능력치를 올려 주지 않을 때의 경고 */
export interface TrainingBalance {
  /** 장르 비중에 비해 가장 뒤처진 능력치 */
  lagging: StatKey
  /** 가장 높은 능력치와의 차이 */
  gap: number
  /** 이번 후보 중 그 능력치를 올려 주는 다른 훈련 */
  fixers: ActionId[]
}

/**
 * 이 훈련을 고르면 가장 뒤처진 능력치가 계속 방치되는지 본다. 뒤처진 정도는 (가장 높은 능력치와의 차이 × 장르 비중)이 가장 큰 능력치로 정하고,
 * 차이가 rules.trainingBalance.minGap 이상인데 이 훈련이 그 능력치를 올리지 않을 때만 경고한다. 추천(★) 계산은 건드리지 않는다.
 */
export function trainingBalance(state: GameState, id: ActionId, menu: readonly ActionId[]): TrainingBalance | null {
  const weights = genres[state.genre].weights
  const best = Math.max(...STAT_KEYS.map((k) => state.stats[k]))
  const lagging = STAT_KEYS.reduce((a, k) => (weights[k] * (best - state.stats[k]) > weights[a] * (best - state.stats[a]) ? k : a), STAT_KEYS[0])
  const gap = best - state.stats[lagging]
  if (gap < rules.trainingBalance.minGap || (trainingGains(state, id)[lagging] ?? 0) > 0) return null
  return { lagging, gap, fixers: menu.filter((m) => m !== id && (trainingGains(state, m)[lagging] ?? 0) > 0) }
}
