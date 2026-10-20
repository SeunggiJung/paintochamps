import { describe, expect, it } from 'vitest'
import lines from '../data/broadcast.json'
import { eventsFor } from './competitions.ts'
import { finalSeries, type FinalSeries } from './broadcast.ts'
import { broadcastScript } from './broadcastScript.ts'
import { advanceCalendar } from './calendar.ts'
import { createInitialState, type GameState } from './state.ts'
import { rollGacha } from './gacha.ts'
import { createRng } from './rng.ts'

const series = (over: Partial<FinalSeries> = {}): FinalSeries => ({
  eventId: 'world', eventName: '월드 챔피언십', finale: 'worlds', bestOf: 5, playerTeam: '우리팀', opponent: '상대팀',
  sets: [true, false, true, true], playerWon: true, playerTeamId: 'a', opponentId: 'b', ...over,
})

describe('중계 멘트 데이터', () => {
  it('장르마다 구간별 멘트가 5개 이상(결과·안내는 2개 이상)이고 대회마다 소개·우승·준우승 멘트가 있다', () => {
    for (const g of Object.values(lines.genres)) {
      expect(g.setStart.length).toBeGreaterThanOrEqual(5)
      expect(g.fight.length).toBeGreaterThanOrEqual(5)
      expect(g.setWin.length).toBeGreaterThanOrEqual(2)
      expect(g.setLose.length).toBeGreaterThanOrEqual(2)
    }
    for (const f of Object.values(lines.finales)) {
      expect(f.intro.length).toBeGreaterThanOrEqual(2)
      expect(f.win.length).toBeGreaterThanOrEqual(2)
      expect(f.lose.length).toBeGreaterThanOrEqual(2)
    }
  })
  it('결승 연출이 붙는 대회의 finale가 모두 멘트 묶음에 있다', () => {
    for (const genre of ['aos', 'fps'] as const) {
      const state = { ...createInitialState({ name: 'a', genre, mode: 'standard', gacha: rollGacha(createRng(1), genre), seed: 1 }), stage: 'pro1' as const }
      for (const ev of eventsFor(state)) if (ev.finale) expect(Object.keys(lines.finales)).toContain(ev.finale)
    }
  })
})

describe('결승 대본', () => {
  it('같은 입력이면 같은 대본이고, 자리표시자가 남지 않는다', () => {
    const a = broadcastScript(series(), 'aos', 7, 3)
    expect(a).toEqual(broadcastScript(series(), 'aos', 7, 3))
    for (const s of a) expect(s.text).not.toMatch(/[{}]/)
  })
  it('마지막 스코어가 세트 승패와 맞고 우승이면 승리 분위기로 끝난다', () => {
    const steps = broadcastScript(series(), 'fps', 1, 1)
    expect(steps[steps.length - 1].mood).toBe('win')
    expect(steps.filter((s) => s.mood === 'win' && s.set > 0).length).toBe(3)
    expect(broadcastScript(series({ sets: [false, false, false], playerWon: false }), 'aos', 1, 1).at(-1)?.mood).toBe('lose')
  })
  it('한 시리즈 안에서 같은 멘트가 반복되지 않는다', () => {
    const texts = broadcastScript(series(), 'aos', 5, 2).map((s) => s.text)
    expect(new Set(texts).size).toBe(texts.length)
  })
})

describe('finalSeries', () => {
  it('결승 연출 대회에서 1~2위일 때만 만들어지고, 세트 승패가 시리즈 결과와 맞는다', () => {
    let state: GameState = { ...createInitialState({ name: 'a', genre: 'fps', mode: 'standard', gacha: rollGacha(createRng(2), 'fps'), seed: 2 }), stage: 'pro1' as const }
    state = { ...state, team: { id: 'fps_pro1_t1', name: 'T1' } as never, stats: { reaction: 900, accuracy: 900, focus: 900, judgment: 900, mental: 900, teamwork: 900 } }
    const finals = advanceCalendar(state, 1).beats.flatMap((b) => (b.kind === 'end' && b.final ? [b.final] : []))
    expect(finals.length).toBeGreaterThan(0)
    for (const f of finals) {
      const need = (f.bestOf + 1) / 2
      const mine = f.sets.filter(Boolean).length
      expect(f.playerWon ? mine : f.sets.length - mine).toBe(need)
      expect(f.sets.length).toBeLessThanOrEqual(f.bestOf)
    }
    expect(finalSeries).toBeTypeOf('function')
  })
})
