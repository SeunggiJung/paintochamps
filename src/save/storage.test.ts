import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialState, type GameState } from '../engine/state.ts'
import { clearGame, loadGame, loadMeta, markGuideDone, recordFinish, saveGame, SAVE_KEY, type KeyValueStorage } from './storage.ts'

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
}

const stats = { reaction: 100, accuracy: 100, focus: 100, judgment: 100, mental: 100, teamwork: 100 }
function make(o: Partial<GameState> = {}): GameState {
  return {
    ...createInitialState({
      name: '테스트',
      genre: 'fps',
      mode: 'tutorial',
      seed: 9,
      gacha: { stats, trait: { id: 'grit', name: '끈기', stat: 'focus' }, grade: 'R', power: 100 },
    }),
    ...o,
  }
}

let storage: MemoryStorage
beforeEach(() => {
  storage = new MemoryStorage()
})

describe('세이브', () => {
  it('저장한 상태를 그대로 불러온다', () => {
    const s = make({ age: 21, fame: 33, team: { id: 'org_2', name: '미스트워커' } })
    expect(saveGame(storage, s)).toBe(true)
    expect(loadGame(storage)).toEqual(s)
  })

  it('저장이 없으면 null', () => {
    expect(loadGame(storage)).toBeNull()
  })

  it('깨진 데이터, 모르는 버전, 필드가 빠진 데이터는 null', () => {
    storage.setItem(SAVE_KEY, '{not json')
    expect(loadGame(storage)).toBeNull()
    storage.setItem(SAVE_KEY, JSON.stringify({ ...make(), saveVersion: 99 }))
    expect(loadGame(storage)).toBeNull()
    storage.setItem(SAVE_KEY, JSON.stringify({ saveVersion: 1, age: 16 }))
    expect(loadGame(storage)).toBeNull()
  })

  it('저장소가 예외를 던져도 게임이 멈추지 않는다 (시크릿 모드 등)', () => {
    const broken: KeyValueStorage = {
      getItem() {
        throw new Error('denied')
      },
      setItem() {
        throw new Error('denied')
      },
      removeItem() {
        throw new Error('denied')
      },
    }
    expect(saveGame(broken, make())).toBe(false)
    expect(loadGame(broken)).toBeNull()
    expect(loadMeta(broken).finishedRuns).toBe(0)
    expect(() => clearGame(broken)).not.toThrow()
  })
})

describe('엔딩 도감·기록', () => {
  it('끝난 판을 기록하면 도감이 쌓이고, 튜토리얼 완료가 켜지고, 저장 데이터는 지워진다', () => {
    saveGame(storage, make())
    const meta = recordFinish(storage, make({ finished: 'hobbyist', stage: 'local_cup' }))
    expect(meta.tutorialDone).toBe(true)
    expect(meta.endings.hobbyist?.count).toBe(1)
    expect(meta.finishedRuns).toBe(1)
    expect(loadGame(storage)).toBeNull()
    const again = recordFinish(storage, make({ finished: 'hobbyist' }))
    expect(again.endings.hobbyist?.count).toBe(2)
    expect(loadMeta(storage).finishedRuns).toBe(2)
  })

  it('강등당해도 가장 높이 오른 단계를 기록한다', () => {
    const history = [{ season: 5, age: 20, stage: 'pro2' as const, events: [] }]
    const meta = recordFinish(storage, make({ finished: 'pro2_veteran', stage: 'amateur_team', history }))
    expect(meta.bestStage).toBe('pro2')
  })

  it('엔딩마다 가장 최근 판의 요약(이름·나이·최고 단계·뽑기 횟수)을 남긴다', () => {
    const history = [{ season: 4, age: 19, stage: 'pro1' as const, events: [] }]
    const meta = recordFinish(storage, make({ finished: 'legend', name: '민수', age: 23, season: 8, stage: 'pro2', history, worldTitles: 1, worldAppearances: 2, rerolls: 3 }))
    expect(meta.endings.legend?.last).toMatchObject({ name: '민수', age: 23, seasons: 8, bestStage: 'pro1', worldTitles: 1, worldAppearances: 2, rerolls: 3 })
    const next = recordFinish(storage, make({ finished: 'legend', name: '지수' }))
    expect(next.endings.legend?.count).toBe(2)
    expect(next.endings.legend?.last?.name).toBe('지수')
  })

  it('옛 도감(요약 없음)도 읽히고 이어서 기록된다', () => {
    storage.setItem('paintochamps:meta', JSON.stringify({ version: 1, tutorialDone: true, endings: { hobbyist: { count: 2 } }, bestStage: 'basement', finishedRuns: 2 }))
    expect(loadMeta(storage).endings.hobbyist?.last).toBeUndefined()
    const meta = recordFinish(storage, make({ finished: 'hobbyist', name: '새이름' }))
    expect(meta.endings.hobbyist?.count).toBe(3)
    expect(meta.endings.hobbyist?.last?.name).toBe('새이름')
  })

  it('끝나지 않은 판은 기록할 수 없다', () => {
    expect(() => recordFinish(storage, make())).toThrow()
  })
})

describe('첫 안내', () => {
  it('처음에는 안 본 상태이고, 기록하면 유지되며 다른 기록은 그대로다', () => {
    const storage = new MemoryStorage()
    expect(loadMeta(storage).guideDone).toBe(false)
    markGuideDone(storage)
    const meta = loadMeta(storage)
    expect(meta.guideDone).toBe(true)
    expect(meta.finishedRuns).toBe(0)
  })

  it('옛 도감 데이터(guideDone 없음)도 안 본 상태로 읽힌다', () => {
    const storage = new MemoryStorage()
    storage.setItem('paintochamps:meta', JSON.stringify({ version: 1, tutorialDone: true, endings: {}, bestStage: 'basement', finishedRuns: 3 }))
    const meta = loadMeta(storage)
    expect(meta.guideDone).toBe(false)
    expect(meta.finishedRuns).toBe(3)
  })
})
