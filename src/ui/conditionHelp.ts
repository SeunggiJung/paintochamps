import rules from '../data/rules.json'
import { CONDITION_TIERS, conditionTier } from '../engine/growth.ts'
import type { GameState } from '../engine/state.ts'
import { turnScale } from '../engine/turn.ts'
import { h } from './dom.ts'

let outsideCloseInstalled = false

/** 컨디션 숫자 옆에 붙는 현재 단계 표시: "72 좋음" */
export function conditionText(state: Pick<GameState, 'condition'>): string {
  return `${Math.round(state.condition)} ${conditionTier(state.condition).label}`
}

/**
 * 이름 옆에 붙이는 작은 도움말 아이콘. 마우스를 올리거나 눌러서(모바일) 말풍선을 보여 준다.
 * 컨디션·능력치 설명이 함께 쓴다.
 */
export function helpIcon(ariaLabel: string, ...content: (Node | string | null | false)[]): HTMLElement {
  const wrap = h('span', { class: 'help' })
  const button = h('button', { class: 'help-btn', type: 'button', 'aria-label': ariaLabel, 'aria-expanded': 'false' }, '?')
  button.addEventListener('click', (e) => {
    e.stopPropagation()
    const open = wrap.classList.toggle('open')
    button.setAttribute('aria-expanded', String(open))
  })
  wrap.append(button, h('div', { class: 'help-pop', role: 'tooltip' }, ...content))
  if (!outsideCloseInstalled) {
    outsideCloseInstalled = true
    document.addEventListener('click', () => document.querySelectorAll('.help.open').forEach((el) => el.classList.remove('open')))
  }
  return wrap
}

/** 컨디션 옆의 도움말: 컨디션이 훈련에 미치는 영향과 낮을 때의 위험, 현재 단계 강조 */
export function conditionHelp(state: Pick<GameState, 'condition' | 'mode'>): HTMLElement {
  const current = conditionTier(state.condition)
  const recover = Math.round(rules.conditionRecoveryPerBase * turnScale(state.mode))
  return helpIcon(
    '컨디션 설명',
    h('b', {}, '컨디션이 훈련에 미치는 영향'),
    h(
      'ul',
      { class: 'plain tiers' },
      ...[...CONDITION_TIERS].reverse().map((t) =>
        h(
          'li',
          { class: `tier${t.label === current.label ? ' current' : ''}` },
          h('span', { class: 'tier-range' }, `${t.min}~${t.max}`),
          h('span', { class: 'tier-label' }, t.label),
          h('span', { class: 'tier-desc' }, `${t.desc} (×${t.coef})`),
        ),
      ),
    ),
    h('p', { class: 'small' }, `턴마다 컨디션이 ${recover}씩 저절로 회복된다. 휴식·친목 모임으로는 더 빨리 회복한다.`),
    h('p', { class: 'small' }, '두 번째 행동은 첫 행동으로 줄어든 컨디션 기준으로 계산한다.'),
    h('p', { class: 'small risk' }, '29 이하면 슬럼프(성장이 절반), 34 이하면 부상 이벤트 위험이 있다. 부상 중에는 휴식·재활만 할 수 있다.'),
  )
}
