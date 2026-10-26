import { loadGame, loadMeta, META_KEY, SAVE_KEY, type KeyValueStorage } from './storage.ts'

/** 저장 코드 앞머리. 형식이 바뀌면 숫자를 올린다. */
const PREFIX = 'PTC1.'

interface Backup {
  /** 진행 중인 판 (없으면 null) */
  save: string | null
  /** 도감·업적·토큰 같은 판을 넘어 이어지는 기록 */
  meta: string | null
}

/** 문자열(한글 포함)을 base64로 */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin)
}

function fromBase64(code: string): string {
  const bin = atob(code)
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

/** 지금 저장된 진행 상황(판 + 기록)을 한 줄 저장 코드로 만든다. 저장소를 못 읽으면 빈 코드. */
export function exportBackup(storage: KeyValueStorage): string {
  try {
    const backup: Backup = { save: storage.getItem(SAVE_KEY), meta: storage.getItem(META_KEY) }
    return PREFIX + toBase64(JSON.stringify(backup))
  } catch {
    return ''
  }
}

export type ImportResult = { ok: true; hasSave: boolean; finishedRuns: number } | { ok: false; error: string }

/** 메모리에만 쓰는 임시 저장소: 코드를 검증할 때 진짜 저장소를 건드리지 않으려고 쓴다 */
function scratch(entries: [string, string][]): KeyValueStorage {
  const map = new Map(entries)
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) }
}

/**
 * 저장 코드를 불러와 저장소를 덮어쓴다. 형식과 내용을 먼저 임시 저장소로 검증하고, 문제가 없을 때만 실제로 쓴다.
 * 판 저장이 있으면 지금 판 규칙으로 읽을 수 있어야 하고(`loadGame`), 기록은 형식이 맞아야 한다.
 */
export function importBackup(storage: KeyValueStorage, raw: string): ImportResult {
  const code = raw.replace(/\s+/g, '')
  if (!code.startsWith(PREFIX)) return { ok: false, error: '저장 코드가 아니에요. "PTC1."로 시작하는 코드를 붙여 넣어 주세요.' }
  let backup: Backup
  try {
    backup = JSON.parse(fromBase64(code.slice(PREFIX.length))) as Backup
  } catch {
    return { ok: false, error: '코드가 깨졌어요. 복사할 때 일부가 빠지지 않았는지 확인해 주세요.' }
  }
  if (!backup || typeof backup !== 'object' || (backup.save !== null && typeof backup.save !== 'string') || (backup.meta !== null && typeof backup.meta !== 'string')) {
    return { ok: false, error: '저장 코드의 내용이 올바르지 않아요.' }
  }
  if (backup.save === null && backup.meta === null) return { ok: false, error: '이 코드에는 저장된 내용이 없어요.' }

  const entries: [string, string][] = []
  if (backup.save !== null) entries.push([SAVE_KEY, backup.save])
  if (backup.meta !== null) entries.push([META_KEY, backup.meta])
  const check = scratch(entries)
  if (backup.save !== null && !loadGame(check)) return { ok: false, error: '진행 중인 판을 읽을 수 없어요. 이 버전과 맞지 않는 코드일 수 있어요.' }
  const meta = loadMeta(check)
  if (backup.meta !== null) {
    try {
      const parsed = JSON.parse(backup.meta) as { version?: number }
      if (parsed.version !== 1) return { ok: false, error: '기록을 읽을 수 없어요. 이 버전과 맞지 않는 코드일 수 있어요.' }
    } catch {
      return { ok: false, error: '기록을 읽을 수 없어요.' }
    }
  }

  try {
    if (backup.save !== null) storage.setItem(SAVE_KEY, backup.save)
    else storage.removeItem(SAVE_KEY)
    if (backup.meta !== null) storage.setItem(META_KEY, backup.meta)
  } catch {
    return { ok: false, error: '저장소에 쓰지 못했어요. 브라우저의 저장 공간 설정을 확인해 주세요.' }
  }
  return { ok: true, hasSave: backup.save !== null, finishedRuns: meta.finishedRuns }
}
