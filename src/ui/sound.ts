import type { Grade } from '../engine/types.ts'

/**
 * 효과음. 음원 파일 없이 Web Audio로 짧은 소리를 합성한다 (라이선스 걱정 없음).
 * 브라우저 정책상 첫 터치 뒤에야 소리가 나므로 AudioContext는 처음 필요할 때 만든다.
 * 켜짐/꺼짐은 localStorage에 기억하고, 저장소에 접근할 수 없으면 켜진 채로 둔다.
 */
export type Sfx = 'click' | 'turn' | 'statUp' | 'stamp' | 'win' | 'lose' | 'upgrade' | 'hurt' | 'grade-N' | 'grade-R' | 'grade-SR' | 'grade-SSR' | 'grade-UR'

interface Note {
  /** 시작 시각(초) */
  at: number
  freq: number
  /** 길이(초) */
  len: number
  type?: OscillatorType
  gain?: number
  /** 끝날 때의 주파수(미끄러지는 소리) */
  to?: number
}

const KEY = 'paintochamps.sound'
const MASTER = 0.18

/** 도 레 미 … 음계 도우미 (C5 = 523Hz 기준 반음 수) */
const semi = (n: number) => 523.25 * 2 ** (n / 12)
const arpeggio = (steps: number[], gap: number, len: number, type: OscillatorType = 'triangle', gain = 0.8): Note[] => steps.map((s, i) => ({ at: i * gap, freq: semi(s), len, type, gain }))

const SOUNDS: Record<Sfx, Note[]> = {
  click: [{ at: 0, freq: 660, to: 520, len: 0.05, type: 'square', gain: 0.35 }],
  turn: [
    { at: 0, freq: 300, to: 600, len: 0.12, type: 'sine', gain: 0.6 },
    { at: 0.1, freq: 600, to: 450, len: 0.1, type: 'sine', gain: 0.4 },
  ],
  statUp: arpeggio([0, 4, 7], 0.06, 0.12, 'square', 0.35),
  stamp: [
    { at: 0, freq: 140, to: 50, len: 0.18, type: 'sine', gain: 1 },
    { at: 0, freq: 90, to: 40, len: 0.12, type: 'square', gain: 0.35 },
  ],
  win: [...arpeggio([0, 4, 7, 12, 16, 19], 0.11, 0.3, 'triangle', 0.9), { at: 0.7, freq: semi(24), len: 0.9, type: 'triangle', gain: 0.8 }],
  lose: arpeggio([0, -3, -7], 0.22, 0.4, 'sine', 0.7),
  upgrade: arpeggio([0, 5, 9, 12], 0.07, 0.16, 'square', 0.35),
  hurt: [{ at: 0, freq: 220, to: 90, len: 0.25, type: 'sawtooth', gain: 0.5 }],
  'grade-N': [{ at: 0, freq: 330, len: 0.1, type: 'triangle', gain: 0.6 }],
  'grade-R': arpeggio([0, 4], 0.09, 0.14, 'triangle', 0.7),
  'grade-SR': arpeggio([0, 4, 7, 12], 0.09, 0.18, 'triangle', 0.8),
  'grade-SSR': [...arpeggio([0, 4, 7, 12, 16], 0.09, 0.24, 'triangle', 0.85), { at: 0.5, freq: semi(19), len: 0.6, type: 'sine', gain: 0.7 }],
  'grade-UR': [...arpeggio([0, 4, 7, 12, 16, 19, 24], 0.08, 0.28, 'triangle', 0.9), { at: 0.65, freq: semi(28), len: 1.1, type: 'sine', gain: 0.8 }, { at: 0.65, freq: semi(16), len: 1.1, type: 'triangle', gain: 0.6 }],
}

let ctx: AudioContext | null = null
let enabled = readEnabled()
const listeners = new Set<() => void>()

function readEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export const soundEnabled = (): boolean => enabled

export function setSoundEnabled(on: boolean): void {
  enabled = on
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // 저장하지 못해도 이번 접속 동안은 그대로 동작한다
  }
  listeners.forEach((fn) => fn())
}

/** 소리 설정이 바뀔 때 알림을 받는다 (토글 버튼의 모양 갱신용) */
export const onSoundChange = (fn: () => void): void => void listeners.add(fn)

function context(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  return ctx
}

/** 효과음 하나를 재생한다. 꺼져 있거나 재생할 수 없는 환경이면 조용히 넘어간다. */
export function playSfx(name: Sfx): void {
  if (!enabled) return
  const ac = context()
  if (!ac) return
  if (ac.state === 'suspended') void ac.resume().catch(() => undefined)
  const start = ac.currentTime + 0.01
  for (const note of SOUNDS[name]) {
    const osc = ac.createOscillator()
    const amp = ac.createGain()
    const t0 = start + note.at
    osc.type = note.type ?? 'sine'
    osc.frequency.setValueAtTime(note.freq, t0)
    if (note.to) osc.frequency.exponentialRampToValueAtTime(note.to, t0 + note.len)
    const peak = MASTER * (note.gain ?? 1)
    amp.gain.setValueAtTime(0.0001, t0)
    amp.gain.exponentialRampToValueAtTime(peak, t0 + 0.01)
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + note.len)
    osc.connect(amp).connect(ac.destination)
    osc.start(t0)
    osc.stop(t0 + note.len + 0.02)
  }
}

export const playGradeSfx = (grade: Grade): void => playSfx(`grade-${grade}`)

/** 모바일 진동. 지원하지 않거나 모션 줄이기를 켠 사람에게는 아무것도 하지 않는다. */
export function vibrate(pattern: number | number[]): void {
  if (!enabled || typeof navigator.vibrate !== 'function') return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  navigator.vibrate(pattern)
}

/** 모든 버튼을 누를 때 클릭음을 낸다. 앱 시작 때 한 번만 부른다. */
export function installClickSound(): void {
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as Element | null
      if (target?.closest('button:not(:disabled):not([data-silent])')) playSfx('click')
    },
    true,
  )
}

/** 화면 오른쪽 위에 떠 있는 소리 켜기/끄기 버튼 */
export function soundToggle(): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'sound-toggle'
  btn.dataset.silent = ''
  const paint = () => {
    btn.textContent = enabled ? '🔊' : '🔇'
    btn.setAttribute('aria-label', enabled ? '소리 끄기' : '소리 켜기')
    btn.setAttribute('aria-pressed', String(enabled))
  }
  paint()
  btn.addEventListener('click', () => {
    setSoundEnabled(!enabled)
    if (enabled) playSfx('click')
  })
  onSoundChange(paint)
  return btn
}
