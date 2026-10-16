import { describe, expect, it } from 'vitest'
import { applyWarmup, MINIGAME, MINIGAME_IDS, numbersTier, patternTier, puzzleTier, reactionTier, rollMiniGame, shootingTier, warmupBonus } from './minigame.ts'
import { chooseSeasonTraining } from './training.ts'
import { createInitialState, type GameState } from './state.ts'
import { applyTurn } from './turn.ts'
import type { Stats } from './types.ts'

const stats = (v: number): Stats => ({ reaction: v, accuracy: v, focus: v, judgment: v, mental: v, teamwork: v })

function make(o: Partial<GameState> = {}): GameState {
  const base = createInitialState({
    name: '테스트',
    genre: 'fps',
    mode: 'standard',
    seed: 5,
    gacha: { stats: stats(300), trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power: 300 },
  })
  return chooseSeasonTraining({ ...base, condition: 70, trainingMenu: ['basics', 'aim_lab', 'video_review'], ...o }, 'basics')
}

const train = (s: GameState) => {
  const r = applyTurn(s, [{ id: 'basics' }, { id: 'basics' }], undefined, false)
  if (!r.ok) throw new Error(r.error)
  return r.state
}
const total = (s: GameState) => Object.values(s.stats).reduce((a, b) => a + b, 0)

describe('턴 끝 미니게임 (훈련 효율 보너스)', () => {
  it('점수가 기준을 넘을수록 등급이 오르고, 못 해도 손해는 없다', () => {
    expect(shootingTier(0)).toBe('miss')
    expect(shootingTier(MINIGAME.shooting.good)).toBe('good')
    expect(shootingTier(MINIGAME.shooting.great)).toBe('great')
    expect(puzzleTier(MINIGAME.puzzle.greatMoves, true)).toBe('great')
    expect(puzzleTier(MINIGAME.puzzle.goodMoves, true)).toBe('good')
    expect(puzzleTier(99, true)).toBe('miss')
    expect(puzzleTier(1, false)).toBe('miss')
    expect(warmupBonus(applyWarmup(make(), 'miss'))).toBe(0)
  })

  it('보너스는 약간이다 (최대 10% 이하)', () => {
    expect(MINIGAME.bonus.great).toBeLessThanOrEqual(0.1)
    expect(MINIGAME.bonus.good).toBeLessThan(MINIGAME.bonus.great)
  })

  it('다음 턴 훈련 성과가 오르고, 그 턴이 지나면 사라진다', () => {
    const base = make()
    const plain = total(train(base)) - total(base)
    const boosted = applyWarmup(base, 'great')
    const gain = total(train(boosted)) - total(boosted)
    expect(gain).toBeGreaterThan(plain)
    expect(gain / plain).toBeCloseTo(1 + MINIGAME.bonus.great, 1)
    expect(warmupBonus(train(boosted))).toBe(0)
  })

  it('옛 세이브(warmup 없음)도 보너스 0으로 본다', () => {
    expect(warmupBonus({ ...make(), warmup: undefined } as unknown as GameState)).toBe(0)
  })

  it('새 게임 3종도 점수가 좋을수록 등급이 오른다', () => {
    expect(reactionTier(250)).toBe('great')
    expect(reactionTier(350)).toBe('good')
    expect(reactionTier(500)).toBe('miss')
    expect(numbersTier(6, true)).toBe('great')
    expect(numbersTier(10, true)).toBe('good')
    expect(numbersTier(20, true)).toBe('miss')
    expect(numbersTier(3, false)).toBe('miss')
    expect(patternTier(MINIGAME.pattern.great)).toBe('great')
    expect(patternTier(MINIGAME.pattern.good)).toBe('good')
    expect(patternTier(2)).toBe('miss')
  })

  it('턴마다 약 30%만 뜨고, 종류는 5종이 모두 나오며, 같은 턴은 같은 결과다 (튜토리얼처럼 턴 번호가 홀수만 나와도 편중되지 않는다)', () => {
    const seen = new Set<string>()
    let shown = 0
    const N = 4000
    for (let i = 0; i < N; i++) {
      const s = make({ seed: 100 + i, turnCount: 2 * (i % 7) + 1 })
      const g = rollMiniGame(s)
      expect(rollMiniGame(s)).toBe(g)
      if (g) {
        shown++
        seen.add(g)
      }
    }
    expect(shown / N).toBeGreaterThan(0.26)
    expect(shown / N).toBeLessThan(0.34)
    expect([...seen].sort()).toEqual([...MINIGAME_IDS].sort())
  })
})
