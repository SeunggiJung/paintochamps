import { exportBackup, importBackup } from '../save/backup.ts'
import type { Ctx } from './app.ts'
import { confirmSheet } from './confirm.ts'
import { h } from './dom.ts'
import { openSheet } from './sheet.ts'
import { copyText } from './support.ts'

/** 저장 코드 내보내기·불러오기. 브라우저 데이터를 지우거나 기기를 바꿔도 진행 상황을 옮길 수 있다. */
export function openBackup(ctx: Ctx): Promise<void> {
  return openSheet<void>(
    (close) => {
      const code = exportBackup(ctx.storage)
      const status = h('p', { class: 'muted small', 'aria-live': 'polite' }, '')
      const out = h('textarea', { class: 'backup-code', readonly: true, rows: 4, 'aria-label': '내 저장 코드' }, code) as HTMLTextAreaElement
      const input = h('textarea', { class: 'backup-code', rows: 4, placeholder: 'PTC1. 로 시작하는 저장 코드를 붙여 넣으세요', 'aria-label': '불러올 저장 코드' }) as HTMLTextAreaElement

      const saveFile = () => {
        const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }))
        const a = h('a', { href: url, download: 'paintochamps-save.txt' })
        document.body.append(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        status.textContent = '파일로 저장했어요.'
      }

      const restore = async () => {
        if (!input.value.trim()) return void (status.textContent = '불러올 코드를 붙여 넣어 주세요.')
        const ok = await confirmSheet({ title: '저장 코드를 불러올까요?', message: '지금 이 기기에 저장된 진행 중인 판과 도감·업적 기록이 코드의 내용으로 바뀌어요. 되돌릴 수 없어요.', ok: '불러온다', cancel: '취소' })
        if (!ok) return
        const result = importBackup(ctx.storage, input.value)
        if (!result.ok) {
          status.textContent = result.error
          return
        }
        status.textContent = '불러왔어요. 화면을 새로 열게요…'
        setTimeout(() => location.reload(), 600)
      }

      return h(
        'div',
        { class: 'stack-tight' },
        h('p', { class: 'eyebrow' }, '저장 코드'),
        h('p', { class: 'muted small' }, '진행 중인 판과 도감·업적 기록을 코드 한 줄로 옮겨요. 브라우저 데이터를 지우기 전이나 다른 기기에서 이어 할 때 써요.'),
        h('h3', {}, '내보내기'),
        out,
        h(
          'div',
          { class: 'btn-row' },
          h('button', { class: 'btn', type: 'button', disabled: !code, onclick: async () => (status.textContent = (await copyText(code)) ? '코드를 복사했어요.' : '복사하지 못했어요. 코드를 길게 눌러 직접 복사해 주세요.') }, '코드 복사'),
          h('button', { class: 'btn', type: 'button', disabled: !code, onclick: saveFile }, '파일로 저장'),
        ),
        h('h3', {}, '불러오기'),
        input,
        h('button', { class: 'btn primary', type: 'button', onclick: () => void restore() }, '코드 불러오기'),
        status,
        h('button', { class: 'btn ghost small', type: 'button', onclick: () => close() }, '닫기'),
      )
    },
    { variant: 'info' },
  )
}
