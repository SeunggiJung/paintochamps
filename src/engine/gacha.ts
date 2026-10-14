import gacha from '../data/gacha.json'
import { genrePower } from './power.ts'
import { randInt, type Rng } from './rng.ts'
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
