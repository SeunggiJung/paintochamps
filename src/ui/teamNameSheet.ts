import { eventsFor } from '../engine/season.ts'
import type { GameState } from '../engine/state.ts'
import { saveGame, type KeyValueStorage } from '../save/storage.ts'
import { h } from './dom.ts'
import { cleanTeamName, TEAM_NAME_MAX } from './newGame.ts'
import { openSheet } from './sheet.ts'

/** PC방 대회에 처음 나가기 전에 팀 이름을 직접 짓게 한다. 필요 없으면 상태를 그대로 돌려준다. */
export async function askCafeTeamName(storage: KeyValueStorage, state: GameState): Promise<GameState> {
  if (state.cafeTeamName || state.academyInvite || !eventsFor(state).some((e) => e.field?.names === 'cafe')) return state
  const input = h('input', { type: 'text', maxLength: TEAM_NAME_MAX, value: `${state.name}팀`, autocomplete: 'off', 'aria-label': '팀 이름' })
  const name = await openSheet<string>((close) =>
    h(
      'form',
      {
        class: 'stack-tight',
        onsubmit: (e: Event) => {
          e.preventDefault()
          close(cleanTeamName(input.value) ?? `${state.name}팀`)
        },
      },
      h('p', { class: 'eyebrow' }, 'PC방 대회 출전'),
      h('p', { class: 'event-text' }, '친구들과 PC방 대회에 나가기로 했다. 팀 이름은 뭐로 할까?'),
      input,
      h('button', { class: 'btn primary', type: 'submit' }, '이 이름으로 출전'),
    ), { variant: 'decision' })
  const next = { ...state, cafeTeamName: name }
  saveGame(storage, next)
  return next
}
