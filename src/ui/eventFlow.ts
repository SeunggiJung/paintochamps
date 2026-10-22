import { applyEventChoice, availableChoices, choiceOutcomes, type GameEvent } from '../engine/events.ts'
import type { GameState } from '../engine/state.ts'
import { h } from './dom.ts'
import { STAT_LABEL } from './labels.ts'
import { describeChange, previewDetail } from './preview.ts'
import { openSheet } from './sheet.ts'
import { hasChange, turnChangeGraph } from './turnResult.ts'

/** 선택지 아래에 붙일 결과 미리보기 문구. 정밀 모드는 판정이 있다는 사실만 알려 준다. */
function choiceHint(state: GameState, event: GameEvent, index: number): string {
  const choice = event.choices[index]
  const detail = previewDetail(state.mode)
  const outcomes = choiceOutcomes(state, event, index)
  const text = (s: GameState) => describeChange(state, s, detail).join(', ') || '변화 없음'
  if (outcomes.length === 1) return detail === 'exact' ? text(outcomes[0].state) : ''
  const stat = choice.check?.stat
  const by = stat ? `${STAT_LABEL[stat]} 판정` : '운 판정'
  if (detail === 'hint') return by
  return `${by} · 성공 ${Math.round(outcomes[0].chance * 100)}%: ${text(outcomes[0].state)} / 실패: ${text(outcomes[1].state)}`
}

/** 이벤트 팝업을 띄우고 선택을 반영한 상태를 돌려준다. 고른 뒤 결과도 한 번 보여 준다. */
export async function runEvent(state: GameState, event: GameEvent): Promise<GameState> {
  const open = new Set(availableChoices(state, event))
  const picked = await openSheet<number>((close) =>
    h(
      'div',
      { class: 'stack-tight' },
      h('p', { class: 'eyebrow' }, '이벤트'),
      h('p', { class: 'event-text' }, event.text),
      ...event.choices.map((c, i) =>
        h(
          'button',
          { class: 'choice', disabled: !open.has(i), onclick: () => close(i) },
          h('strong', {}, c.label),
          open.has(i) ? h('span', { class: 'muted small' }, choiceHint(state, event, i)) : h('span', { class: 'muted small' }, '조건이 맞지 않아 고를 수 없다'),
        ),
      ),
    ), { variant: 'decision' })

  const after = applyEventChoice(state, event, picked)
  const outcomes = choiceOutcomes(state, event, picked)
  const success = outcomes.length === 2 ? JSON.stringify(after) === JSON.stringify(outcomes[0].state) : null
  await openSheet<void>((close) =>
    h(
      'div',
      { class: 'stack-tight' },
      h('p', { class: 'eyebrow' }, success === null ? event.choices[picked].label : success ? '성공!' : '실패...'),
      hasChange(state, after) ? turnChangeGraph(state, after, { onlyChanged: true }) : h('p', { class: 'muted' }, '눈에 띄는 변화는 없었다.'),
      h('button', { class: 'btn primary', onclick: () => close() }, '확인'),
    ), { variant: 'result' })
  return after
}
