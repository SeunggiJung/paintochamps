import gacha from '../data/gacha.json'
import { genrePower } from './power.ts'
import { createRng, randInt, type Rng } from './rng.ts'
import { STAT_KEYS, type GachaResult, type GenreId, type Grade, type Stats, type Trait } from './types.ts'

const TRAITS = gacha.traits as Trait[]

/** 시작 실력치 R로 등급을 정한다. grades는 minPower 내림차순. */
export function gradeOf(power: number): Grade {
  return (gacha.grades.find((g) => power >= g.minPower) ?? gacha.grades[gacha.grades.length - 1]).grade as Grade
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
  return { stats, trait, grade: gradeOf(power), power }
}

const ODDS_SAMPLES = 200_000
const ODDS_SEED = 0x0dd5
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
  for (let i = 0; i < ODDS_SAMPLES; i++) odds[gradeOf(genrePower(rollStats(rng), genre))] += 1 / ODDS_SAMPLES
  oddsCache.set(genre, odds)
  return odds
}
