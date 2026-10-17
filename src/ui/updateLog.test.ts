import { describe, expect, it } from 'vitest'
import { hiddenToday, UPDATES } from './updateLog.ts'

describe('업데이트 로그', () => {
  it('최신 항목이 맨 위에 있고(날짜 내림차순) 모든 항목에 제목·내용이 있다', () => {
    expect(UPDATES.length).toBeGreaterThan(0)
    for (const u of UPDATES) {
      expect(u.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(u.title.length).toBeGreaterThan(0)
      expect(u.items.length).toBeGreaterThan(0)
    }
    const dates = UPDATES.map((u) => u.date)
    expect(dates).toEqual([...dates].sort().reverse())
    expect(new Set(dates).size).toBe(dates.length) // 날짜별로 항목 하나
  })

  it('최초 배포일(2026-10-15) 이후 변경만 담고, 저장소를 못 써도 오늘 안 보기 확인이 죽지 않는다', () => {
    expect(UPDATES.every((u) => u.date >= '2026-10-15')).toBe(true)
    expect(hiddenToday()).toBe(false) // 테스트 환경에는 localStorage가 없다
  })
})
