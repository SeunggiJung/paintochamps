import { describe, expect, it } from 'vitest'
import { TRAINING_POOL } from '../engine/training.ts'
import { createInitialState } from '../engine/state.ts'
import { rollAt } from './newGame.ts'
import { actionCost, actionTags, describeChange, previewDetail } from './preview.ts'

const make = (mode: 'tutorial' | 'standard') =>
  ({ ...createInitialState({ name: 't', genre: 'fps', mode, gacha: rollAt(1, 'fps', 0), seed: 1 }), trainingMenu: TRAINING_POOL, seasonTraining: 'basics' as const })

describe('행동 요약·변화 문구', () => {
  it('튜토리얼·표준은 숫자(exact)로 보여 준다', () => {
    expect(previewDetail('tutorial')).toBe('exact')
    expect(previewDetail('standard')).toBe('exact')
  })

  it('행동 요약과 비용', () => {
    const s = make('standard')
    expect(actionTags({ id: 'basics' }, s)).toContain('반응속도↑')
    expect(actionCost({ id: 'drink' }, s)).toBe(8)
    expect(actionCost({ id: 'part_time' }, s)).toBe(0)
    expect(actionCost({ id: 'private_lesson' }, s)).toBeGreaterThan(0)
  })

  it('변화 문구: 숫자 모드는 증감을, 힌트 모드는 방향만 보여 준다', () => {
    const before = make('standard')
    const after = { ...before, stats: { ...before.stats, reaction: before.stats.reaction + 10 }, fame: before.fame + 5 }
    expect(describeChange(before, after, 'exact')).toEqual(expect.arrayContaining(['반응속도 +10', '명성 +5']))
    expect(describeChange(before, after, 'hint').join(' ')).not.toMatch(/\d/)
  })
})
