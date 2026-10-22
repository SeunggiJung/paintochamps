import './ui/theme.css'
import './ui/style.css'
import type { KeyValueStorage } from './save/storage.ts'
import { startApp } from './ui/app.ts'

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

startApp(document.querySelector<HTMLDivElement>('#app')!, pickStorage())
