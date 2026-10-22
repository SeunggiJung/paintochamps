import './ui/theme.css'
import './ui/style.css'
import type { KeyValueStorage } from './save/storage.ts'
import { startApp } from './ui/app.ts'
import { loadFont } from './ui/fonts.ts'
import { applyPrefs, loadPrefs, readEnv } from './ui/prefs.ts'

/** 저장소 접근 자체가 막힌 환경(시크릿 모드 등)에서는 이번 접속 동안만 기억하는 임시 저장소를 쓴다. */
function pickStorage(): KeyValueStorage {
  try {
    const probe = '__paintochamps_probe'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    const mem = new Map<string, string>()
    return {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
      removeItem: (k) => void mem.delete(k),
    }
  }
}

// 화면을 그리기 전에 설정을 적용한다. 자동 설정(테마·움직임)은 기기 설정이 바뀌면 다시 따른다.
const storage = pickStorage()
const prefs = loadPrefs(storage)
applyPrefs(prefs, readEnv())
void loadFont(prefs.font)
for (const q of ['(prefers-color-scheme: dark)', '(prefers-reduced-motion: reduce)']) {
  matchMedia(q).addEventListener('change', () => applyPrefs(loadPrefs(storage), readEnv()))
}

startApp(document.querySelector<HTMLDivElement>('#app')!, storage)
