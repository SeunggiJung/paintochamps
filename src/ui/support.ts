import support from '../data/support.json'
import { h } from './dom.ts'
import { openSheet } from './sheet.ts'

/** 후원 계좌가 data/support.json에 채워져 있는지. 비어 있으면 버튼을 보여 주지 않는다. */
export const hasSupport = (): boolean => support.account.trim().length > 0

/** 송금 QR 이미지(src/assets/support/qr.jpg). 파일이 없으면 QR은 보여 주지 않는다. 원본이 큰 흰 여백 안에 QR이 있어 CSS로 잘라 보여 준다(.qr-crop). */
const QR_FILES = import.meta.glob('../assets/support/qr.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const QR_URL = Object.values(QR_FILES)[0] as string | undefined

/** 휴대폰이면 QR을 스캔할 수 없으니 송금 앱을 바로 여는 버튼을, 컴퓨터면 QR을 보여 준다. */
const isMobile = (): boolean => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

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

/** 계좌번호 팝업 (복사 버튼 포함). 타이틀 버튼과 엔딩 후원 카드가 함께 쓴다. */
export function openSupportSheet(): Promise<void> {
  return openSheet<void>((close) => {
    const status = h('p', { class: 'muted small', 'aria-live': 'polite' }, '')
    const accountText = `${support.bank} ${support.account}`.trim()
    return h(
      'div',
      { class: 'stack-tight support' },
      h('p', { class: 'eyebrow' }, `🍚 ${support.title}`),
      h('p', { class: 'muted' }, support.message),
      h('div', { class: 'account-box' }, h('span', { class: 'muted small' }, support.bank), h('b', { class: 'account' }, support.account), support.holder && h('span', { class: 'muted small' }, `예금주 ${support.holder}`)),
      isMobile() && support.transferLink
        ? h('a', { class: 'btn primary', href: support.transferLink }, '토스로 송금하기')
        : QR_URL && h('div', { class: 'qr-box' }, h('div', { class: 'qr-crop' }, h('img', { src: QR_URL, alt: '토스 송금 QR 코드' })), h('span', { class: 'muted small' }, '토스 앱으로 스캔하면 송금 화면이 열려요')),
      status,
      h(
        'button',
        {
          class: 'btn',
          onclick: async () => {
            status.textContent = (await copyText(accountText)) ? '계좌번호를 복사했어요. 고맙습니다!' : '복사하지 못했어요. 번호를 직접 길게 눌러 복사해 주세요.'
          },
        },
        '계좌번호 복사',
      ),
      h('button', { class: 'btn ghost small', onclick: () => close() }, '닫기'),
    )
  }, { variant: 'info' })
}

/** 타이틀 화면 왼쪽 위의 "개발자 밥사주기" 버튼. 누르면 계좌번호가 나온다. */
export function supportButton(): HTMLElement | null {
  if (!hasSupport()) return null
  return h('button', { class: 'support-btn', type: 'button', onclick: () => void openSupportSheet() }, '🍚 개발자 밥사주기')
}

const ENDING_HIDE_KEY = 'paintochamps:support:ending-hide'

/** 엔딩 화면 아래의 후원 카드. 부담을 주지 않는 한 줄과 버튼 하나, '다시 보지 않기'가 있다. 계좌가 없거나 이미 숨겼으면 null. */
export function endingSupportCard(): HTMLElement | null {
  if (!hasSupport()) return null
  try {
    if (localStorage.getItem(ENDING_HIDE_KEY) === '1') return null
  } catch {
    // 저장소를 못 쓰면 매번 보인다
  }
  const card = h(
    'section',
    { class: 'card support-card' },
    h('p', { class: 'muted small' }, support.endingMessage),
    h(
      'div',
      { class: 'btn-row' },
      h('button', { class: 'btn', type: 'button', onclick: () => void openSupportSheet() }, `🍚 ${support.title}`),
      h(
        'button',
        {
          class: 'btn ghost small',
          type: 'button',
          onclick: () => {
            try {
              localStorage.setItem(ENDING_HIDE_KEY, '1')
            } catch {
              // 저장하지 못해도 이번 화면에서는 닫는다
            }
            card.remove()
          },
        },
        '다시 보지 않기',
      ),
    ),
  )
  return card
}
