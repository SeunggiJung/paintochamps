import modes from '../data/modes.json'
import { decodeChallenge } from '../engine/challenge.ts'
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
  const codeInput = h('input', { type: 'text', maxLength: 12, placeholder: '예: FS-1Z141Z3', autocomplete: 'off', 'aria-label': '도전 코드' })
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
    // 도전 코드가 있으면 친구와 같은 시드·장르·모드로 시작한다
    const raw = codeInput.value.trim()
    if (raw) {
      const challenge = decodeChallenge(raw)
      if (!challenge) {
        error.textContent = '도전 코드를 읽을 수 없어요. 결과 카드에 적힌 코드를 그대로 입력해 주세요.'
        codeInput.focus()
        return
      }
      if (!playableGenres().some((g) => g.id === challenge.genre)) {
        error.textContent = '아직 열리지 않은 장르의 코드예요.'
        return
      }
      if (!unlocked(challenge.mode)) {
        error.textContent = '이 코드는 표준 모드예요. 튜토리얼을 한 번 끝내면 쓸 수 있어요.'
        return
      }
      ctx.toGacha({ name, ...challenge })
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
    h('label', { class: 'field' }, h('span', {}, '도전 코드 (선택)'), codeInput, h('span', { class: 'muted small' }, '친구의 결과 카드에 적힌 코드를 넣으면 같은 조건으로 시작해요. 장르와 모드는 코드를 따라가요.')),
    h('div', { class: 'plan-cta' }, h('button', { class: 'btn primary', type: 'button', onclick: next }, '능력치 뽑기')),
  )
}
