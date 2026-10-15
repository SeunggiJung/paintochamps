import support from '../data/support.json'
import { h } from './dom.ts'
import { openSheet } from './sheet.ts'

/** 후원 계좌가 data/support.json에 채워져 있는지. 비어 있으면 버튼을 보여 주지 않는다. */
export const hasSupport = (): boolean => support.account.trim().length > 0

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // 클립보드 권한이 없는 환경: 임시 입력칸으로 복사를 시도한다
    const input = h('textarea', { value: text, style: 'position:fixed;opacity:0' })
    document.body.append(input)
    input.select()
    const ok = document.execCommand('copy')
    input.remove()
    return ok
  }
}

/** 타이틀 화면 왼쪽 위의 "개발자 밥사주기" 버튼. 누르면 계좌번호가 나온다. */
export function supportButton(): HTMLElement | null {
  if (!hasSupport()) return null
  return h(
    'button',
    {
      class: 'support-btn',
      type: 'button',
      onclick: () =>
        openSheet<void>((close) => {
          const status = h('p', { class: 'muted small', 'aria-live': 'polite' }, '')
          const accountText = `${support.bank} ${support.account}`.trim()
          return h(
            'div',
            { class: 'stack-tight support' },
            h('p', { class: 'eyebrow' }, `🍚 ${support.title}`),
            h('p', { class: 'muted' }, support.message),
            h('div', { class: 'account-box' }, h('span', { class: 'muted small' }, support.bank), h('b', { class: 'account' }, support.account), support.holder && h('span', { class: 'muted small' }, `예금주 ${support.holder}`)),
            status,
            h(
              'button',
              {
                class: 'btn primary',
                onclick: async () => {
                  status.textContent = (await copyText(accountText)) ? '계좌번호를 복사했어요. 고맙습니다!' : '복사하지 못했어요. 번호를 직접 길게 눌러 복사해 주세요.'
                },
              },
              '계좌번호 복사',
            ),
            h('button', { class: 'btn ghost small', onclick: () => close() }, '닫기'),
          )
        }),
    },
    '🍚 개발자 밥사주기',
  )
}
