import modes from '../data/modes.json'
import type { ModeId } from '../engine/state.ts'
import type { GenreId } from '../engine/types.ts'
import type { Ctx } from './app.ts'
import { h } from './dom.ts'
import { MODE_INFO } from './labels.ts'
import { cleanName, NAME_MAX, newSeed, playableGenres } from './newGame.ts'

/** 캐릭터 생성 입력. 뽑기를 거쳐 확정되면 GameState가 된다. */
export interface NewGameDraft {
  name: string
  genre: GenreId
  mode: ModeId
  seed: number
}

export function createScreen(ctx: Ctx): HTMLElement {
  const genres = playableGenres()
  const modeIds = Object.keys(modes) as ModeId[]
  // 1회차는 튜토리얼만 열려 있다
  const unlocked = (m: ModeId) => m === 'tutorial' || ctx.meta.tutorialDone

  let genre: GenreId = genres[0].id
  let mode: ModeId = ctx.meta.tutorialDone ? 'standard' : 'tutorial'

  const nameInput = h('input', {
    type: 'text',
    maxLength: NAME_MAX,
    placeholder: '이름 (최대 8자)',
    value: '겜돌이',
    autocomplete: 'off',
  })
  const error = h('p', { class: 'error', role: 'alert' })

  const genreBox = h('div', { class: 'choices' })
  const modeBox = h('div', { class: 'choices vertical' })

  const choice = (selected: boolean, onclick: () => void, title: string, desc?: string, locked = false) =>
    h(
      'button',
      { class: `choice${selected ? ' selected' : ''}`, disabled: locked, 'aria-pressed': String(selected), onclick },
      h('strong', {}, title),
      desc && h('span', { class: 'muted small' }, desc),
    )

  const render = () => {
    genreBox.replaceChildren(
      ...genres.map((g) =>
        choice(
          g.id === genre,
          () => {
            genre = g.id
            render()
          },
          g.name,
        ),
      ),
    )
    modeBox.replaceChildren(
      ...modeIds.map((m) =>
        choice(
          m === mode,
          () => {
            mode = m
            render()
          },
          MODE_INFO[m].name,
          unlocked(m) ? MODE_INFO[m].desc : '튜토리얼을 한 번 끝내면 열린다.',
          !unlocked(m),
        ),
      ),
    )
  }
  render()

  const next = () => {
    const name = cleanName(nameInput.value)
    if (!name) {
      error.textContent = '이름을 입력해 주세요.'
      nameInput.focus()
      return
    }
    ctx.toGacha({ name, genre, mode, seed: newSeed() })
  }

  return h(
    'main',
    { class: 'screen' },
    h('button', { class: 'btn ghost small back-btn', type: 'button', onclick: () => ctx.toTitle() }, '‹ 뒤로'),
    h('h2', {}, '캐릭터 만들기'),
    h('label', { class: 'field' }, h('span', {}, '이름'), nameInput),
    error,
    h('section', {}, h('h3', {}, '장르'), genreBox),
    h('section', {}, h('h3', {}, '모드'), modeBox),
    h('div', { class: 'plan-cta' }, h('button', { class: 'btn primary', type: 'button', onclick: next }, '능력치 뽑기')),
  )
}
