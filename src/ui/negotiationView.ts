import { ASKS, canNegotiate, negotiateSalary, negotiationChance } from '../engine/negotiation.ts'
import type { GameState } from '../engine/state.ts'
import { salaryOf } from '../engine/teams.ts'
import { h } from './dom.ts'
import { formatMoney } from './format.ts'
import { openSheet } from './sheet.ts'

/**
 * 월급 협상 팝업: 지금 월급을 보여 주고, 올려 달라고 요구할지 고른다. 협상은 시즌당 한 번이다.
 * 요구하면 확률로 성공해 월급이 오르고, 크게 요구했다가 실패하면 멘탈이 흔들린다. 협상을 마친 상태를 돌려준다.
 */
export async function openNegotiation(state: GameState): Promise<GameState> {
  if (!canNegotiate(state)) return state
  const salary = salaryOf(state)
  const askId = await openSheet<string | null>((close) =>
    h(
      'div',
      { class: 'stack-tight' },
      h('p', { class: 'eyebrow' }, `${state.team!.name} · 연봉 협상`),
      h('p', { class: 'event-text' }, `지금 월급은 3개월마다 ${formatMoney(salary)}. 더 올려 달라고 요구해 볼까? 명성이 높을수록 잘 먹힌다. (시즌당 한 번)`),
      h(
        'div',
        { class: 'choices vertical' },
        ...ASKS.map((a) =>
          h(
            'button',
            { class: 'choice', onclick: () => close(a.id) },
            h('strong', {}, `${a.name} (+${Math.round(a.raise * 100)}%)`),
            h('span', { class: 'muted small' }, `월급 ${formatMoney(Math.round(salary * (1 + a.raise)))} · 성공 확률 약 ${Math.round(negotiationChance(state, a) * 100)}%${a.failMental ? ' · 실패하면 멘탈이 흔들린다' : ''}`),
          ),
        ),
      ),
      h('button', { class: 'btn ghost small', onclick: () => close(null) }, '지금 조건대로 간다'),
    ),
  )
  if (askId === null) return state
  const r = negotiateSalary(state, askId)
  await openSheet<void>((close) =>
    h(
      'div',
      { class: 'stack-tight' },
      h('p', { class: 'eyebrow' }, '협상 결과'),
      h('p', { class: 'event-text' }, r.success ? `협상 성공! 월급이 3개월마다 ${formatMoney(r.salary)}으로 올랐다.` : `협상이 틀어졌다. 월급은 그대로 ${formatMoney(r.salary)}이다.${r.state.stats.mental < state.stats.mental ? ' 괜히 말을 꺼냈나 싶어 마음이 무겁다.' : ''}`),
      h('button', { class: 'btn primary', onclick: () => close() }, '확인'),
    ),
  )
  return r.state
}
