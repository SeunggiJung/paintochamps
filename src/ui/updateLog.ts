import updates from '../data/updates.json'
import { h } from './dom.ts'
import { openSheet } from './sheet.ts'

interface UpdateEntry {
  date: string
  title: string
  items: string[]
}

export const UPDATES = updates as UpdateEntry[]

const HIDE_KEY = 'paintochamps:updatelog:hide'

/** 오늘 날짜 (사용자 시간대, YYYY-MM-DD) */
function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** '오늘 하루 안 보기'를 눌렀는지. 저장소를 못 써도 동작은 해야 하므로 실패하면 보지 않은 것으로 본다. */
export function hiddenToday(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === today()
  } catch {
    return false
  }
}

function hideToday(): void {
  try {
    localStorage.setItem(HIDE_KEY, today())
  } catch {
    // 저장소를 쓸 수 없으면 이번 접속 동안만 안 뜬다 (shownThisLoad)
  }
}

let shownThisLoad = false

/** 업데이트 로그 팝업: 날짜별로 한 항목씩이고, 최신 날짜만 펼쳐져 있다. 하나를 열면 나머지는 접히고 내용은 스크롤로 본다. 닫기와 '오늘 하루 안 보기'가 있다. */
export async function openUpdateLog(): Promise<void> {
  const hide = await openSheet<boolean>((close) => {
    const entries = UPDATES.map((u, i) =>
      h(
        'details',
        { class: 'update-entry', open: i === 0 },
        h('summary', {}, h('b', {}, u.date), h('span', { class: 'muted small' }, ` ${u.title}`)),
        h('ul', { class: 'update-items' }, ...u.items.map((t) => h('li', {}, t))),
      ),
    )
    // 하나를 열면 나머지는 접는다 (브라우저의 name 속성 아코디언에 기대지 않고 직접 처리)
    for (const d of entries) d.addEventListener('toggle', () => d.open && entries.forEach((o) => o !== d && (o.open = false)))
    return h(
      'div',
      { class: 'stack-tight update-log' },
      h('p', { class: 'eyebrow' }, '업데이트 로그'),
      ...entries,
      h('button', { class: 'btn primary', onclick: () => close(false) }, '닫기'),
      h('button', { class: 'btn ghost small', onclick: () => close(true) }, '오늘 하루 안 보기'),
    )
  }, { autofocus: false })
  if (hide) hideToday()
}

/** 접속(페이지를 연) 뒤 타이틀을 처음 보여 줄 때 한 번만, 오늘 안 보기를 누르지 않았다면 업데이트 로그를 띄운다. */
export function maybeShowUpdateLog(): void {
  if (shownThisLoad || hiddenToday() || UPDATES.length === 0) return
  shownThisLoad = true
  void openUpdateLog()
}
