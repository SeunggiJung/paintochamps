import type { GameState } from '../engine/state.ts'
import type { SpriteLook } from './sprite.ts'

/** 기본 모습 (타이틀·계약 연출과 같은 셔츠 색) */
export const DEFAULT_LOOK: SpriteLook = { shirt: '#3b5bdb', hair: '#7a4426', pants: '#3a4a8a', headset: '#444a6a' }

/** 플레이어의 지금 모습. 장착한 의상이 있으면 그 색을 쓴다. */
export function playerLook(_state: Pick<GameState, 'genre'>, outfit?: Partial<SpriteLook> | null): SpriteLook {
  return { ...DEFAULT_LOOK, ...(outfit ?? {}) }
}
