// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { chip, sectionHeader, segmented, stepDots } from './components.ts'

describe('components', () => {
  it('segmented: 항목 수만큼 버튼, 클릭하면 id로 onChange, 활성만 aria-selected', () => {
    const got: string[] = []
    const el = segmented([{ id: 'a', label: 'A' }, { id: 'b', label: 'B', dot: true }, { id: 'c', label: 'C' }], 'a', (id) => got.push(id))
    const btns = el.querySelectorAll('button')
    expect(btns.length).toBe(3)
    expect(el.getAttribute('role')).toBe('tablist')
    expect(el.querySelectorAll('[aria-selected="true"]').length).toBe(1)
    expect(btns[0].getAttribute('aria-selected')).toBe('true')
    expect(btns[1].querySelector('.dot')).not.toBeNull()
    expect(btns[0].querySelector('.dot')).toBeNull()
    btns[2].click()
    expect(got).toEqual(['c'])
  })

  it('stepDots(4, 2)는 켜진 점 2개', () => {
    const el = stepDots(4, 2)
    expect(el.querySelectorAll('i').length).toBe(4)
    expect(el.querySelectorAll('.on').length).toBe(2)
  })

  it('chip과 sectionHeader', () => {
    expect(chip('경고', 'alert').className).toContain('alert')
    const header = sectionHeader('제목', '곁글')
    expect(header.textContent).toContain('제목')
    expect(header.textContent).toContain('곁글')
  })
})
