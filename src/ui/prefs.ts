import type { KeyValueStorage } from '../save/storage.ts'

export const THEMES = ['light', 'cozy', 'dark'] as const
export const FONTS = ['pretendard', 'jua', 'galmuri'] as const
export const MOTIONS = ['calm', 'normal', 'lively'] as const
export const CODEX_VIEWS = ['tile', 'list'] as const

export type ThemeId = (typeof THEMES)[number]
export type ThemePref = ThemeId | 'auto'
export type FontId = (typeof FONTS)[number]
export type MotionId = (typeof MOTIONS)[number]
export type MotionPref = MotionId | 'auto'
export type CodexView = (typeof CODEX_VIEWS)[number]

export interface Prefs {
  theme: ThemePref
  font: FontId
  motion: MotionPref
  codexView: CodexView
}

export const PREFS_KEY = 'paintochamps:prefs'

export const defaultPrefs: Prefs = { theme: 'auto', font: 'pretendard', motion: 'auto', codexView: 'tile' }

function pick<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

export function loadPrefs(storage: KeyValueStorage): Prefs {
  let raw: unknown
  try {
    const text = storage.getItem(PREFS_KEY)
    raw = text ? JSON.parse(text) : null
  } catch {
    return { ...defaultPrefs }
  }
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    theme: pick<ThemePref>([...THEMES, 'auto'], r.theme, defaultPrefs.theme),
    font: pick(FONTS, r.font, defaultPrefs.font),
    motion: pick<MotionPref>([...MOTIONS, 'auto'], r.motion, defaultPrefs.motion),
    codexView: pick(CODEX_VIEWS, r.codexView, defaultPrefs.codexView),
  }
}

export function savePrefs(storage: KeyValueStorage, prefs: Prefs): boolean {
  try {
    storage.setItem(PREFS_KEY, JSON.stringify(prefs))
    return true
  } catch {
    return false
  }
}

export function resolveTheme(pref: ThemePref, prefersDark: boolean): ThemeId {
  if (pref !== 'auto') return pref
  return prefersDark ? 'dark' : 'light'
}

export function resolveMotion(pref: MotionPref, reducedMotion: boolean): MotionId {
  if (pref !== 'auto') return pref
  return reducedMotion ? 'calm' : 'normal'
}

export interface Env {
  prefersDark: boolean
  reducedMotion: boolean
}

export function readEnv(): Env {
  if (typeof matchMedia !== 'function') return { prefersDark: false, reducedMotion: false }
  return {
    prefersDark: matchMedia('(prefers-color-scheme: dark)').matches,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  }
}

export function applyPrefs(prefs: Prefs, env: Env, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = resolveTheme(prefs.theme, env.prefersDark)
  root.dataset.font = prefs.font
  root.dataset.motion = resolveMotion(prefs.motion, env.reducedMotion)
}

/** 지금 화면의 움직임이 '차분'인가 (자동 설정이면 기기의 동작 줄이기가 반영된 값) */
export const isCalm = (): boolean => document.documentElement.dataset.motion === 'calm'
