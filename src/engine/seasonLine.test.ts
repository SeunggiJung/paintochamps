import { describe, expect, it } from 'vitest'
import type { SeasonReport } from './season.ts'
import { seasonLine } from './seasonLine.ts'

const base = { stageBefore: 'pro1', stageAfter: 'pro1', events: [], rival: null, relegated: false, promoted: false, qualified: [], worldChampion: false, finished: null, pendingOffers: null, tests: [], routeNotes: [], highlights: {} } as unknown as SeasonReport
const event = (placement: number, fieldSize = 12) => ({ id: 'x', name: '테스트컵', placement, fieldSize }) as SeasonReport['events'][number]
const line = (report: Partial<SeasonReport>, powerGain = 0, season = 1) => seasonLine({ name: '철수', season, report: { ...base, ...report }, powerGain })

describe('seasonLine', () => {
  it('월드 우승이 최우선이다', () => {
    expect(line({ worldChampion: true, promoted: true })).toMatch(/철수|월드/)
  })
  it('우승·상위·하위를 성적으로 가른다', () => {
    expect(line({ events: [event(1)] })).toContain('테스트컵')
    expect(line({ events: [event(2)] })).toContain('2위')
    expect(line({ events: [event(11)] }, 0, 0)).toContain('11위')
    expect(line({ events: [event(11)] }, 0, 1)).toContain('쓴맛')
  })
  it('대회가 없으면 실력을 쌓은 시즌이다', () => {
    expect(line({})).toMatch(/실력|연습/)
  })
  it('같은 입력은 항상 같은 문장이고 자리표시자가 남지 않는다', () => {
    const a = line({ events: [event(5)] }, 0, 3)
    expect(a).toBe(line({ events: [event(5)] }, 0, 3))
    expect(a).not.toMatch(/[{}]/)
  })
  it('실력이 크게 늘면 문장이 붙는다', () => {
    expect(line({}, 40)).toContain('늘었다')
    expect(line({}, 5)).not.toContain('늘었다')
  })
})
