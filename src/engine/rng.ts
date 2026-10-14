/** 0 이상 1 미만 난수를 돌려주는 함수. 같은 시드면 같은 순서로 나온다. */
export type Rng = () => number

/** mulberry32 시드 난수 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 시드와 여러 정수를 섞어 새 시드를 만든다. (예: 게임 시드 + 시즌 번호) */
export function mixSeed(seed: number, ...parts: number[]): number {
  let h = seed >>> 0
  for (const p of parts) h = Math.imul(h ^ (p + 0x9e3779b9 + (h << 6) + (h >>> 2)), 0x85ebca6b) >>> 0
  return h
}

/** 평균 0, 표준편차 1인 정규분포 난수 (Box-Muller) */
export function gaussian(rng: Rng): number {
  const u = 1 - rng()
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** 배열을 무작위로 섞은 복사본 (Fisher-Yates) */
export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** min 이상 max 이하 정수 */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}
