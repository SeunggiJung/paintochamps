import genres from '../data/genres.json'
import { rollGacha } from '../engine/gacha.ts'
import { createRng, mixSeed } from '../engine/rng.ts'
import type { GachaResult, GenreId, Grade } from '../engine/types.ts'

/** 새 판 시드. 판을 시작할 때 한 번만 만들고, 이후 모든 난수는 이 시드에서 나온다. */
export function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

/** n번째 뽑기(0부터). 같은 시드·같은 횟수면 항상 같은 결과다. */
export function rollAt(seed: number, genre: GenreId, rollIndex: number): GachaResult {
  return rollGacha(createRng(mixSeed(seed, rollIndex)), genre)
}

/** SR 보장권을 쓴 n번째 뽑기: 같은 순서의 결과들 중 SR 이상이 처음 나오는 것. 같은 시드·같은 횟수면 항상 같다. */
export function rollAtMin(seed: number, genre: GenreId, rollIndex: number, min: Grade = 'SR'): GachaResult {
  const need = GRADE_RANK.indexOf(min)
  let last = rollGacha(createRng(mixSeed(seed, rollIndex, 0x71c4)), genre)
  for (let k = 1; k < 2000 && GRADE_RANK.indexOf(last.grade) < need; k++) last = rollGacha(createRng(mixSeed(seed, rollIndex, 0x71c4, k)), genre)
  return last
}

const GRADE_RANK: Grade[] = ['N', 'R', 'SR', 'SSR', 'UR']

/** 지금 고를 수 있는 장르 (확장 단계 장르는 아직 막는다) */
export function playableGenres(): { id: GenreId; name: string }[] {
  return (Object.entries(genres) as [GenreId, (typeof genres)[GenreId]][])
    .filter(([, g]) => g.stage === 'mvp')
    .map(([id, g]) => ({ id, name: g.name }))
}

export const NAME_MAX = 8
export const TEAM_NAME_MAX = 10

/** 이름 앞뒤 공백을 지우고 길이를 제한한다. 비면 null. */
export function cleanName(raw: string): string | null {
  const name = raw.trim().slice(0, NAME_MAX)
  return name.length > 0 ? name : null
}

/** 팀 이름 앞뒤 공백을 지우고 길이를 제한한다. 비면 null. */
export function cleanTeamName(raw: string): string | null {
  const name = raw.trim().slice(0, TEAM_NAME_MAX)
  return name.length > 0 ? name : null
}
