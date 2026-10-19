import gacha from '../data/gacha.json'
import { genrePower } from './power.ts'
import { createRng, randInt, type Rng } from './rng.ts'
import { STAT_KEYS, type GachaResult, type GenreId, type Grade, type Stats, type Trait } from './types.ts'

const TRAITS = gacha.traits as Trait[]

const ODDS_SAMPLES = 200_000
const ODDS_SEED = 0x0dd5
const REFERENCE_GENRE: GenreId = 'fps'
const boundsCache = new Map<GenreId, { grade: Grade; minPower: number }[]>()

/** 뽑기와 같은 방식으로 고정 시드 표본을 뽑아 정렬한 장르 실력치 R (오름차순) */
function sampledPowers(genre: GenreId): number[] {
  const rng = createRng(ODDS_SEED)
  return Array.from({ length: ODDS_SAMPLES }, () => genrePower(rollStats(rng), genre)).sort((a, b) => a - b)
}

/**
 * 장르의 등급 경계. 기준 장르(FPS)는 gacha.json의 값을 그대로 쓴다.
 * 다른 장르는 능력치 비중이 달라 R의 퍼짐(특히 높은 쪽 끝)이 다르므로(비중이 고르면 높은 등급이 아예 안 나온다),
 * 기준 장르와 같은 등급 확률이 되도록 표본의 분위수로 경계를 옮긴다. 장르를 안 주면 gacha.json 그대로다.
 */
export function gradeBounds(genre?: GenreId): { grade: Grade; minPower: number }[] {
  const base = gacha.grades.map((g) => ({ grade: g.grade as Grade, minPower: g.minPower }))
  if (!genre || genre === REFERENCE_GENRE) return base
  const cached = boundsCache.get(genre)
  if (cached) return cached
  const ref = sampledPowers(REFERENCE_GENRE)
  const mine = sampledPowers(genre)
  const bounds = base.map((g) => {
    if (g.minPower <= 0) return g
    const share = ref.filter((p) => p >= g.minPower).length / ref.length // 이 경계 이상이 되는 비율
    return { grade: g.grade, minPower: mine[Math.min(mine.length - 1, Math.floor((1 - share) * mine.length))] }
  })
  boundsCache.set(genre, bounds)
  return bounds
}

/** 시작 실력치 R로 등급을 정한다. grades는 minPower 내림차순. */
export function gradeOf(power: number, genre?: GenreId): Grade {
  const bounds = gradeBounds(genre)
  return (bounds.find((g) => power >= g.minPower) ?? bounds[bounds.length - 1]).grade
}

/**
 * 능력치 6개를 뽑는다. 모두 최소값에서 시작하고, 남은 포인트를 막대기 나누기(stars and bars)로
 * 무작위 분배해 합계가 항상 statTotal이 되게 한다.
 */
export function rollStats(rng: Rng): Stats {
  const extra = gacha.statTotal - gacha.statMin * STAT_KEYS.length
  const cuts = Array.from({ length: STAT_KEYS.length - 1 }, () => randInt(rng, 0, extra)).sort((a, b) => a - b)
  const bounds = [0, ...cuts, extra]
  const stats = {} as Stats
  STAT_KEYS.forEach((key, i) => {
    stats[key] = gacha.statMin + bounds[i + 1] - bounds[i]
  })
  return stats
}

/** 뽑기 한 번: 능력치 6개 + 시작 특성 1개, 선택 장르 기준 등급 */
export function rollGacha(rng: Rng, genre: GenreId): GachaResult {
  const stats = rollStats(rng)
  const trait = TRAITS[randInt(rng, 0, TRAITS.length - 1)]
  const power = genrePower(stats, genre)
  return { stats, trait, grade: gradeOf(power, genre), power }
}

const oddsCache = new Map<GenreId, Record<Grade, number>>()

/**
 * 장르별 등급 확률(0~1). 뽑기와 같은 방식으로 고정 시드 표본을 뽑아 센다. 시드가 고정이라 항상 같은 값이고,
 * 등급 경계(gacha.json)나 가중치(genres.json)를 바꾸면 따라서 바뀐다. 오차는 ±0.1%p 안쪽이다.
 */
export function gradeOdds(genre: GenreId): Record<Grade, number> {
  const cached = oddsCache.get(genre)
  if (cached) return cached
  const rng = createRng(ODDS_SEED)
  const odds = Object.fromEntries(gacha.grades.map((g) => [g.grade, 0])) as Record<Grade, number>
  for (let i = 0; i < ODDS_SAMPLES; i++) odds[gradeOf(genrePower(rollStats(rng), genre), genre)] += 1 / ODDS_SAMPLES
  oddsCache.set(genre, odds)
  return odds
}
