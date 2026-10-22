// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { celebrate } from './confetti.ts'
import { setSoundEnabled, vibrate } from './sound.ts'

afterEach(() => {
  delete document.documentElement.dataset.motion
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('움직임 단계', () => {
  it('차분 모드에서는 폭죽 캔버스를 만들지 않고 보통에서는 만든다', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(), fillRect: vi.fn(), fillStyle: '', globalAlpha: 1 } as never)
    document.documentElement.dataset.motion = 'calm'
    celebrate('UR')
    expect(document.querySelector('canvas')).toBeNull()
    document.documentElement.dataset.motion = 'normal'
    celebrate('UR')
    expect(document.querySelector('canvas')).not.toBeNull()
  })

  it('차분 모드에서는 진동을 쓰지 않는다', () => {
    const spy = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: spy, configurable: true })
    setSoundEnabled(true)
    document.documentElement.dataset.motion = 'calm'
    vibrate(50)
    expect(spy).not.toHaveBeenCalled()
    document.documentElement.dataset.motion = 'normal'
    vibrate(50)
    expect(spy).toHaveBeenCalledWith(50)
  })

  it('style.css에 prefers-reduced-motion 규칙이 남아 있지 않다', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('src/ui/style.css', 'utf-8')).not.toContain('prefers-reduced-motion')
  })
})
