import { describe, expect, it } from 'vitest'
import rules from '../data/rules.json'
import { advanceCalendar, type CalendarBeat } from './calendar.ts'
import { createInitialState, type GameState } from './state.ts'
import { applyCoachSwap, canRerollTraining, chooseSeasonTraining, coachSwapOffer, rerollTrainingMenu, slumpGap, TRAINING_POOL } from './training.ts'
import { ACTIONS, applyTurn } from './turn.ts'
import type { Stats } from './types.ts'

const stats = (v: number): Stats => ({ reaction: v, accuracy: v, focus: v, judgment: v, mental: v, teamwork: v })
const TEAM = { id: 'org_0', name: '나이트호크' }

function make(o: Partial<GameState> = {}, power = 500): GameState {
  const base = createInitialState({
    name: '테스트',
    genre: 'aos',
    mode: 'standard',
    seed: 33,
    gacha: { stats: stats(power), trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power },
  })
  return { ...base, age: 22, stage: 'pro2', team: TEAM, fame: 40, everPro: true, trainingMenu: TRAINING_POOL, seasonTraining: 'basics', ...o }
}

const mid = (rank: number, expected: number | null, size = 10): CalendarBeat => ({ kind: 'mid', phase: 0.25, eventId: 'pro2_spring', name: '봄 리그', table: [], rank, size, expected })

describe('코치의 시즌 목표 (기대 순위)', () => {
  const leagueRecord = (s: GameState) => advanceCalendar(s, 0.3).state.seasonRun!.runs.find((r) => r.id === 'pro2_spring')!

  it('리그가 시작될 때 팀 전력과 선수 실력으로 기대 순위가 정해져 기록된다', () => {
    const rec = leagueRecord(make())
    expect(rec.expected).toBeGreaterThanOrEqual(1)
    expect(rec.expected).toBeLessThanOrEqual(rec.fieldSize)
  })

  it('선수가 강할수록 기대 순위가 높다(숫자가 작다)', () => {
    expect(leagueRecord(make({}, 900)).expected!).toBeLessThan(leagueRecord(make({}, 100)).expected!)
  })

  it('중간 순위 공개에 기대 순위가 함께 실린다', () => {
    const beat = advanceCalendar(make(), 0.3).beats.find((b) => b.kind === 'mid')
    expect(beat && beat.kind === 'mid' && beat.expected).toBeGreaterThanOrEqual(1)
  })
})

describe('코치의 훈련 교체 제안', () => {
  it('중간 순위가 기대보다 크게 낮으면 시즌당 한 번 무작위 후보와 함께 제안한다', () => {
    const s = make()
    const gap = slumpGap(10)
    const offer = coachSwapOffer(s, [mid(2 + gap, 2)])
    expect(offer).not.toBeNull()
    expect(offer!.options).toHaveLength(rules.coachSwap.options)
    expect(offer!.options).not.toContain('basics')
    expect(new Set(offer!.options).size).toBe(offer!.options.length)
    expect(offer).toMatchObject({ rank: 2 + gap, expected: 2, size: 10 })
    // 같은 상태면 같은 후보
    expect(coachSwapOffer(s, [mid(2 + gap, 2)])!.options).toEqual(offer!.options)
  })

  it('기대 순위와 차이가 작으면 제안하지 않는다', () => {
    expect(coachSwapOffer(make(), [mid(2 + slumpGap(10) - 1, 2)])).toBeNull()
    expect(coachSwapOffer(make(), [mid(1, 5)])).toBeNull()
    expect(coachSwapOffer(make(), [mid(9, null)])).toBeNull()
  })

  it('리그가 클수록 기준이 넓어지고, 최소 격차가 있다', () => {
    expect(slumpGap(6)).toBe(rules.coachSwap.minGap)
    expect(slumpGap(20)).toBeGreaterThan(slumpGap(10))
  })

  it('팀이 없으면(코치가 없으면) 제안하지 않는다', () => {
    expect(coachSwapOffer(make({ team: null }), [mid(9, 1)])).toBeNull()
  })

  it('시즌 훈련을 아직 안 정했으면 제안하지 않는다', () => {
    expect(coachSwapOffer(make({ seasonTraining: null }), [mid(9, 1)])).toBeNull()
  })

  it('이번 시즌에 이미 제안했으면 다시 제안하지 않는다 (거절해도 마찬가지)', () => {
    const s = make()
    const answered = applyCoachSwap(s, null)
    expect(answered.trainingSwapSeason).toBe(s.season)
    expect(answered.seasonTraining).toBe('basics')
    expect(coachSwapOffer(answered, [mid(9, 1)])).toBeNull()
    // 다음 시즌에는 다시 제안할 수 있다
    expect(coachSwapOffer({ ...answered, season: s.season + 1 }, [mid(9, 1)])).not.toBeNull()
  })

  it('받아들이면 시즌 훈련이 바뀌고, 이후 턴에는 새 훈련만 할 수 있다', () => {
    const s = make()
    const offer = coachSwapOffer(s, [mid(9, 1)])!
    const next = applyCoachSwap(s, offer.options[0])
    expect(next.seasonTraining).toBe(offer.options[0])
    expect(applyTurn(next, [{ id: offer.options[0] }, { id: 'rest' }]).ok).toBe(true)
    expect(applyTurn(next, [{ id: 'basics' }, { id: 'rest' }]).ok).toBe(false)
  })

  it('시즌 훈련을 고르는 것은 후보 안에서만 가능하다', () => {
    const s = make({ seasonTraining: null, trainingMenu: ['basics', 'aim_lab'] })
    expect(chooseSeasonTraining(s, 'aim_lab').seasonTraining).toBe('aim_lab')
    expect(() => chooseSeasonTraining(s, 'sparring')).toThrow()
  })
})

describe('훈련 후보 다시 뽑기', () => {
  it('시즌당 한 번만 되고, 지금 후보와 겹치지 않으며, 고른 훈련은 비워진다', () => {
    const base = make({ trainingMenu: TRAINING_POOL.slice(0, 4), seasonTraining: 'basics' })
    expect(canRerollTraining(base)).toBe(true)
    const r = rerollTrainingMenu(base)
    expect(r.trainingMenu).toHaveLength(4)
    expect(r.trainingMenu.some((id) => base.trainingMenu.includes(id))).toBe(false)
    expect(r.seasonTraining).toBeNull()
    expect(canRerollTraining(r)).toBe(false)
    expect(() => rerollTrainingMenu(r)).toThrow()
    expect(rerollTrainingMenu(base).trainingMenu).toEqual(r.trainingMenu)
  })
  it('다음 시즌에는 다시 뽑을 수 있다', () => {
    const r = rerollTrainingMenu(make({}))
    expect(canRerollTraining({ ...r, season: r.season + 1 })).toBe(true)
  })
  it('훈련 풀에는 능력치 3개 조합 20가지가 하나씩 다 있다', () => {
    const combos = new Set(
      TRAINING_POOL.map((id) => Object.keys(ACTIONS[id].stats ?? {}).sort().join(',')).filter((c) => c.split(',').length === 3),
    )
    expect(combos.size).toBe(20)
  })
})
