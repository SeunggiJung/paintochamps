import type { ModeId } from './state.ts'
import type { GenreId } from './types.ts'

/** 도전 코드: 같은 시드·장르·모드로 시작하면 같은 후보와 같은 세계가 나와 친구와 결과를 비교할 수 있다. */
export interface Challenge {
  seed: number
  genre: GenreId
  mode: ModeId
}

// 장르·모드를 한 글자씩으로 줄여 코드 앞에 붙인다 (예: FS-1Z141Z3)
const GENRE_CODE: Record<GenreId, string> = { fps: 'F', aos: 'A', rts: 'R', fighting: 'G' }
const MODE_CODE: Record<ModeId, string> = { tutorial: 'T', standard: 'S' }

export function encodeChallenge({ seed, genre, mode }: Challenge): string {
  return `${GENRE_CODE[genre]}${MODE_CODE[mode]}-${(seed >>> 0).toString(36).toUpperCase()}`
}

/** 코드 문자열을 읽는다. 대소문자·공백은 무시하고, 형식이 틀리면 null. */
export function decodeChallenge(raw: string): Challenge | null {
  const m = /^([A-Z])([A-Z])-([0-9A-Z]{1,7})$/.exec(raw.replace(/\s+/g, '').toUpperCase())
  if (!m) return null
  const genre = (Object.keys(GENRE_CODE) as GenreId[]).find((g) => GENRE_CODE[g] === m[1])
  const mode = (Object.keys(MODE_CODE) as ModeId[]).find((x) => MODE_CODE[x] === m[2])
  const seed = parseInt(m[3], 36)
  if (!genre || !mode || !Number.isSafeInteger(seed) || seed > 0xffffffff) return null
  return { seed, genre, mode }
}
