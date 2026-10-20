import { playSfx, vibrate } from './sound.ts'
import { h } from './dom.ts'
import { openSheet } from './sheet.ts'
import { upgradeArt, type UpgradeKind } from './upgradeArt.ts'

export interface UpgradeInput {
  kind: UpgradeKind
  name: string
  level: number
  max: number
  /** 이미 포맷된 문구 */
  costText: string
  moneyText: string
  effectText: string
  /** 구매를 실제로 처리한다. 실패하면 false */
  buy: () => boolean
}

/**
 * 장비·시설 업그레이드 팝업. 지금 그림 → 다음 단계 그림을 보여 주고, 구매하면
 * 그림이 새 단계로 바뀌며 반짝이는 연출이 나온다. 구매했으면 true.
 */
export function openUpgrade(input: UpgradeInput): Promise<boolean> {
  const { kind, name, level, max } = input
  return openSheet<boolean>((close) => {
    const root = h('div', { class: 'stack-tight upg-sheet' })
    let bought = false

    const askView = () => {
      root.replaceChildren(
        h('p', { class: 'eyebrow' }, name),
        h('div', { class: 'upg-compare' }, upgradeArt(kind, level, max, 'before'), h('span', { class: 'upg-arrow' }, '➜'), upgradeArt(kind, level + 1, max, 'after')),
        h('h3', {}, `Lv${level} → Lv${level + 1}`),
        h('p', { class: 'event-text' }, `${input.costText}을(를) 쓰고 업그레이드할까요? (보유 ${input.moneyText})`),
        h('p', { class: 'muted small' }, input.effectText),
        h(
          'button',
          {
            class: 'btn primary',
            onclick: () => {
              if (!input.buy()) return close(false)
              bought = true
              playSfx('upgrade')
              vibrate(30)
              doneView()
            },
          },
          '업그레이드',
        ),
        h('button', { class: 'btn ghost', onclick: () => close(false) }, '취소'),
      )
    }

    const doneView = () => {
      const sparks = Array.from({ length: 8 }, (_, i) => h('span', { class: 'upg-spark', style: `--a:${i * 45}deg` }))
      root.replaceChildren(
        h('p', { class: 'eyebrow' }, '업그레이드 완료!'),
        h('div', { class: 'upg-stage' }, upgradeArt(kind, level + 1, max, 'big pop'), ...sparks),
        h('h3', {}, `${name} Lv${level + 1} 달성`),
        h('p', { class: 'muted small' }, input.effectText),
        h('button', { class: 'btn primary', onclick: () => close(bought) }, '확인'),
      )
    }

    askView()
    return root
  }, { center: true, autofocus: false })
}
