import { h } from './dom.ts'

const DURATION_MS = 700

/**
 * 숫자가 from에서 to로 올라가는 연출을 하는 <b>. 값이 같거나 모션 줄이기를 켰다면 그냥 to를 보여 준다.
 * 화면에 붙은 다음 프레임부터 움직이고, 도중에 화면이 바뀌어 떨어져 나가면 멈춘다.
 */
export function countUp(from: number, to: number, format: (n: number) => string = (n) => String(Math.round(n))): HTMLElement {
  const el = h('b', {}, format(to))
  if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) return el
  el.textContent = format(from)
  let start = 0
  const step = (now: number) => {
    if (!el.isConnected && start > 0) return
    if (!start) start = now
    const t = Math.min(1, (now - start) / DURATION_MS)
    const eased = 1 - (1 - t) ** 3
    el.textContent = format(t >= 1 ? to : from + (to - from) * eased)
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
  return el
}
