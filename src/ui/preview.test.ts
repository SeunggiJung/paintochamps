import { describe, expect, it } from 'vitest'
import { createInitialState } from '../engine/state.ts'
import { applyTurn } from '../engine/turn.ts'
import { rollAt } from './newGame.ts'
import { actionCost, actionRisks, actionTags, describeChange, previewDetail, previewTurn } from './preview.ts'

const make = (mode: 'tutorial' | 'standard' | 'precise') =>
  createInitialState({ name: 't', genre: 'fps', mode, gacha: rollAt(1, 'fps', 0), seed: 1 })

describe('턴 미리보기', () => {
  it('정밀 모드만 방향 표시(hint)를 쓴다', () => {
    expect(previewDetail('tutorial')).toBe('exact')
    expect(previewDetail('standard')).toBe('exact')
    expect(previewDetail('precise')).toBe('hint')
  })

  it('상태를 바꾸지 않고, 확정 효과만 보여 준다', () => {
    const s = make('standard')
    const before = JSON.stringify(s)
    const p = previewTurn(s, [{ id: 'rest' }, { id: 'rest' }])
    expect(JSON.stringify(s)).toBe(before)
    expect(p.ok).toBe(true)
    if (p.ok) expect(p.lines.some((l) => l.startsWith('컨디션 +'))).toBe(true)
  })

  it('도박의 확률 결과는 미리보기에 섞이지 않는다 (돈 -만 보인다)', () => {
    const s = make('standard')
    const p = previewTurn(s, [{ id: 'gamble' }, { id: 'rest' }])
    expect(p.ok && p.lines.join(' ')).toContain('돈 -')
    expect(p.ok && p.lines.join(' ')).not.toContain('돈 +')
  })

  it('정밀 모드는 숫자 대신 화살표만 보여 주고 위험은 "위험 있음"으로 가린다', () => {
    const s = make('precise')
    const p = previewTurn(s, [{ id: 'basics' }, { id: 'overtrain' }])
    expect(p.ok && p.lines.join(' ')).not.toMatch(/\d/)
    expect(actionRisks({ id: 'overtrain' }, s)).toEqual(['위험 있음'])
  })

  it('표준 모드는 위험 확률을 숫자로 알려 준다', () => {
    expect(actionRisks({ id: 'drink' }, make('standard'))[0]).toMatch(/^25%/)
  })

  it('못 하는 조합은 이유를 돌려준다', () => {
    const p = previewTurn(make('tutorial'), [{ id: 'gamble' }, { id: 'rest' }])
    expect(p).toEqual({ ok: false, error: expect.stringContaining('2회차부터') })
  })

  it('미리보기의 확정 효과가 실제 턴 결과와 일치한다 (확률 행동이 없을 때)', () => {
    const s = make('standard')
    const choice = [{ id: 'basics' }, { id: 'video_review' }] as const
    const r = applyTurn(s, choice)
    expect(r.ok).toBe(true)
    if (r.ok) expect(previewTurn(s, choice)).toEqual({ ok: true, lines: describeChange(s, r.state) })
  })

  it('행동 요약과 비용', () => {
    const s = make('standard')
    expect(actionTags({ id: 'basics' }, s)).toContain('반응속도↑')
    expect(actionCost({ id: 'drink' }, s)).toBe(8)
    expect(actionCost({ id: 'part_time' }, s)).toBe(0)
  })
})
