// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { hiddenToday, openUpdateLog, UPDATES } from './updateLog.ts'

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
})

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

describe('업데이트 로그 시트', () => {
  it('안쪽에 따로 스크롤되는 영역이 없다 (시트 하나만 스크롤)', () => {
    const css = readFileSync('src/ui/style.css', 'utf-8')
    const rule = css.split(/\r?\n/).find((l) => l.startsWith('.update-items'))!
    expect(rule).not.toMatch(/overflow/)
    expect(rule).not.toMatch(/max-height/)
  })

  it('하나를 열면 나머지는 접힌다', () => {
    void openUpdateLog()
    const entries = [...document.querySelectorAll<HTMLDetailsElement>('details.update-entry')]
    expect(entries.length).toBeGreaterThan(1)
    expect(entries[0].open).toBe(true)
    entries[1].open = true
    entries[1].dispatchEvent(new Event('toggle'))
    expect(entries[0].open).toBe(false)
  })

  it("'오늘 하루 안 보기'가 hiddenToday를 true로 만든다", async () => {
    const p = openUpdateLog()
    ;[...document.querySelectorAll<HTMLButtonElement>('.overlay button')].find((b) => b.textContent === '오늘 하루 안 보기')!.click()
    await p
    expect(hiddenToday()).toBe(true)
  })
})
