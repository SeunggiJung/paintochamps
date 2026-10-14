import { describe, expect, it } from 'vitest'
import { ENDINGS } from './endings.ts'
import { applyEventChoice, rollEvent, turnRng } from './events.ts'
import { rollGacha } from './gacha.ts'
import { createRng } from './rng.ts'
import { acceptOffer, settleSeason } from './season.ts'
import { createInitialState, type GameState, type ModeId } from './state.ts'
import { applyTurn, startNextSeason, turnsPerSeason, type Slot } from './turn.ts'
import { STAT_KEYS, type GenreId } from './types.ts'

const MAX_TURNS: Record<ModeId, number> = { tutorial: 30, standard: 60, precise: 180 }

/** 컨디션을 관리하며 훈련하는 단순한 자동 플레이. 규칙이 끝까지 맞물리는지 확인하는 용도다. */
function playCareer(genre: GenreId, mode: ModeId, seed: number): GameState {
  const rng = createRng(seed)
  let s = createInitialState({ name: '봇', genre, mode, seed, gacha: rollGacha(rng, genre) })
  const train: Slot[] = genre === 'fps' || genre === 'fighting' ? [{ id: 'basics' }, { id: 'rank_practice' }] : [{ id: 'video_review' }, { id: 'rank_practice' }]
  let turn = 0
  while (!s.finished) {
    const scrim: Slot = s.team ? { id: 'team_scrim' } : train[1]
    const work: Slot = turn % 2 ? train[0] : scrim
    let choice: [Slot, Slot] = [work, train[(turn + 1) % 2]]
    if (s.condition < 45) choice = [{ id: 'rest' }, { id: 'rest' }]
    else if (s.condition < 65) choice = [work, { id: 'rest' }]
    if (s.injuredMonths > 0) choice = [{ id: 'rest' }, { id: 'rest' }]

    const r = applyTurn(s, choice)
    if (!r.ok) throw new Error(`${genre}/${mode}/${seed} turn ${turn}: ${r.error}`)
    s = r.state
    turn++

    const event = rollEvent(s, turnRng(s))
    if (event) s = applyEventChoice(s, event, 0)

    if (r.seasonEnded) {
      s = settleSeason(s).state
      if (s.finished) break
      if (s.pendingOffers) s = acceptOffer(s, s.pendingOffers.kind === 'transfer' ? null : 0)
      s = startNextSeason(s)
    }
  }
  return s
}

describe('처음부터 엔딩까지 완주', () => {
  const genres: GenreId[] = ['fps', 'aos', 'rts', 'fighting']
  const modes: ModeId[] = ['tutorial', 'standard', 'precise']

  for (const genre of genres) {
    for (const mode of modes) {
      it(`${genre} / ${mode}: 20판 모두 오류 없이 끝나고 상태가 유효하다`, () => {
        for (let seed = 1; seed <= 20; seed++) {
          const s = playCareer(genre, mode, seed)
          expect(ENDINGS.map((e) => e.id)).toContain(s.finished)
          expect(s.turnCount).toBeLessThanOrEqual(MAX_TURNS[mode])
          expect(s.turnCount).toBe(s.history.length * turnsPerSeason(mode))
          expect(s.age).toBeLessThanOrEqual(30)
          expect(s.condition).toBeGreaterThanOrEqual(0)
          expect(s.condition).toBeLessThanOrEqual(100)
          expect(s.money).toBeGreaterThanOrEqual(0)
          for (const key of STAT_KEYS) {
            expect(s.stats[key]).toBeGreaterThanOrEqual(0)
            expect(s.stats[key]).toBeLessThanOrEqual(1000)
          }
        }
      })
    }
  }

  it('같은 시드로 두 번 플레이하면 완전히 같은 결과가 나온다', () => {
    expect(playCareer('aos', 'standard', 42)).toEqual(playCareer('aos', 'standard', 42))
    expect(playCareer('aos', 'standard', 42)).not.toEqual(playCareer('aos', 'standard', 43))
  })

  it('월드 우승으로 끝난 판은 우승 기록과 레전드 계열 엔딩을 가진다', () => {
    let found = 0
    for (let seed = 1; seed <= 60 && found < 3; seed++) {
      const s = playCareer('fps', 'tutorial', seed)
      if (s.worldTitles > 0) {
        found++
        expect(['hidden_loyal', 'legend']).toContain(s.finished)
        expect(s.worldAppearances).toBeGreaterThanOrEqual(1)
      }
    }
    expect(found).toBeGreaterThan(0)
  })
})
