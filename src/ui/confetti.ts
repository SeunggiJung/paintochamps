import { createRng } from '../engine/rng.ts'
import type { Grade } from '../engine/types.ts'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rot: number
  spin: number
  life: number
}

/** 등급별 폭죽 세기. 없는 등급은 효과가 없다. */
const BURSTS: Partial<Record<Grade, { count: number; waves: number; colors: string[] }>> = {
  SR: { count: 36, waves: 1, colors: ['#4fa3ff', '#8cc4ff', '#ffffff'] },
  SSR: { count: 70, waves: 2, colors: ['#b980ff', '#d9b3ff', '#ff8ad8', '#ffffff'] },
  UR: { count: 110, waves: 4, colors: ['#ffb740', '#ffd98a', '#ff6b7a', '#fff3c4', '#ffffff'] },
}

const WAVE_GAP_MS = 350
const GRAVITY = 0.18
const FRAME_LIMIT_MS = 4000

/** 화면 아래 양쪽에서 위로 쏘아 올리는 폭죽. 끝나면 스스로 캔버스를 지운다. */
export function celebrate(grade: Grade): void {
  const preset = BURSTS[grade]
  if (!preset || matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const canvas = document.createElement('canvas')
  canvas.className = 'confetti'
  canvas.width = innerWidth
  canvas.height = innerHeight
  canvas.setAttribute('aria-hidden', 'true')
  document.body.append(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas.remove()

  // 연출용 난수. 게임 결과와 무관하므로 시드는 시각으로 잡는다.
  const rand = createRng(Date.now())
  const particles: Particle[] = []
  const launch = () => {
    for (const side of [0, 1]) {
      for (let i = 0; i < preset.count / 2; i++) {
        const angle = (side === 0 ? -60 : -120) * (Math.PI / 180) + (rand() - 0.5) * 0.9
        const speed = 9 + rand() * 9
        particles.push({
          x: side === 0 ? canvas.width * 0.08 : canvas.width * 0.92,
          y: canvas.height * 0.85,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 5 + rand() * 6,
          color: preset.colors[Math.floor(rand() * preset.colors.length)],
          rot: rand() * Math.PI,
          spin: (rand() - 0.5) * 0.4,
          life: 1,
        })
      }
    }
  }
  for (let w = 0; w < preset.waves; w++) setTimeout(launch, w * WAVE_GAP_MS)

  const start = performance.now()
  const frame = (now: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const p of particles) {
      p.vy += GRAVITY
      p.vx *= 0.99
      p.x += p.vx
      p.y += p.vy
      p.rot += p.spin
      if (p.y > canvas.height * 0.6) p.life -= 0.012
      if (p.life <= 0) continue
      ctx.save()
      ctx.globalAlpha = Math.max(p.life, 0)
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      ctx.restore()
    }
    const waving = now - start < preset.waves * WAVE_GAP_MS
    const alive = particles.some((p) => p.life > 0)
    if ((waving || alive) && now - start < FRAME_LIMIT_MS) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
