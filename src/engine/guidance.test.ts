import { describe, expect, it } from 'vitest'
import { nextGoal, focusStat } from './guidance.ts'
import { createInitialState, type GameState } from './state.ts'

const stats = { reaction: 100, accuracy: 100, focus: 100, judgment: 100, mental: 100, teamwork: 100 }
const make = (o: Partial<GameState> = {}): GameState => ({
  ...createInitialState({ name: '테스트', genre: 'fps', mode: 'standard', seed: 3, gacha: { stats, trait: { id: 'grit', name: '끈기', stat: 'focus' }, grade: 'R', power: 100 } }),
  ...o,
})

describe('nextGoal (결산의 다음 목표)', () => {
  it('끝난 판에는 목표가 없다', () => {
    expect(nextGoal(make({ finished: 'legend' }))).toBeNull()
  })
  it('단계마다 다음 목표 제목이 다르다', () => {
    const titles = (['basement', 'local_cup', 'amateur_team', 'pro2', 'pro1'] as const).map((stage) => nextGoal(make({ stage }))!.title)
    expect(new Set(titles).size).toBe(5)
  })
  it('프로 2부는 콜업 기준 실력치와 부족한 양을 알려 준다', () => {
    const low = nextGoal(make({ stage: 'pro2' }))!
    expect(low.lines[0]).toContain('250')
    expect(low.lines[0]).toContain('부족')
    const high = nextGoal(make({ stage: 'pro2', stats: { ...stats, reaction: 900, accuracy: 900, focus: 900, judgment: 900, mental: 900, teamwork: 900 } }))!
    expect(high.lines[0]).toContain('충족')
  })
  it('프로 1부는 국제전 상대와의 격차와 월드 진출 길을 알려 준다', () => {
    const fps = nextGoal(make({ stage: 'pro1' }))!
    expect(fps.lines.join(' ')).toMatch(/부족/)
    expect(fps.lines.join(' ')).toMatch(/포인트/)
    const aos = nextGoal(make({ stage: 'pro1', genre: 'aos' }))!
    expect(aos.lines.join(' ')).toMatch(/MSI/)
    expect(aos.lines.join(' ')).not.toMatch(/[{}]/)
  })
  it('25세부터는 경험 능력치로 보완하라는 안내가 붙는다', () => {
    expect(nextGoal(make({ stage: 'pro1', age: 24 }))!.lines.join(' ')).not.toContain('피지컬이 해마다')
    expect(nextGoal(make({ stage: 'pro1', age: 26 }))!.lines.join(' ')).toContain('피지컬이 해마다')
  })
  it('키울 능력치는 장르 비중이 크고 여유가 많은 것이다', () => {
    expect(focusStat(make({ genre: 'fps', stats: { ...stats, accuracy: 900 } }))).toBe('reaction')
  })
})
