import gacha from '../data/gacha.json'
import genres from '../data/genres.json'
import { gradeBounds, gradeOdds } from '../engine/gacha.ts'
import { createInitialState } from '../engine/state.ts'
import { STAT_KEYS, type GachaResult, type Grade } from '../engine/types.ts'
import { saveGame } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import type { NewGameDraft } from './create.ts'
import { h } from './dom.ts'
import { statName } from './statHelp.ts'
import { GRADE_COMMENT, GRADE_LABEL, MODE_INFO, STAT_LABEL } from './labels.ts'
import { celebrate } from './confetti.ts'
import { rollAt } from './newGame.ts'

const STEP_MS = 130
/** 등급 공개 직전 뜸 들이는 시간 */
const SUSPENSE_MS = 350
/** 한 능력치가 가질 수 있는 최댓값 (나머지가 모두 최솟값일 때) */
const BAR_MAX = gacha.statTotal - gacha.statMin * (STAT_KEYS.length - 1)
/** 장르 가중치가 이 값 이상인 능력치를 핵심 능력치로 표시한다 */
const KEY_WEIGHT = 20

export function gachaScreen(ctx: Ctx, draft: NewGameDraft): HTMLElement {
  const genre = genres[draft.genre]
  let rollIndex = 0
  let timers: number[] = []

  const stage = h('div', { class: 'gacha-card', role: 'status', 'aria-live': 'polite' })
  const rerollBtn = h('button', { class: 'btn' })
  const startBtn = h('button', { class: 'btn primary' }, '이 캐릭터로 시작')

  const clearTimers = () => {
    timers.forEach(clearTimeout)
    timers = []
  }

  /** 등급별 설명과 확률. 누르면 펼쳐지고, 지금 뽑은 등급에 표시가 붙는다. */
  const oddsList = (current: Grade) => {
    const odds = gradeOdds(draft.genre)
    const bounds = gradeBounds(draft.genre)
    const rows = bounds.map((g, i) => {
      const above = bounds[i - 1]
      const fmt = (v: number) => String(Math.round(v))
      const range = above ? (g.minPower > 0 ? `${fmt(g.minPower)} 이상 ${fmt(above.minPower)} 미만` : `${fmt(above.minPower)} 미만`) : `${fmt(g.minPower)} 이상`
      const id = g.grade as Grade
      const p = odds[id] * 100
      return h(
        'li',
        { class: `odds-row grade-${id}${id === current ? ' current' : ''}` },
        h('span', { class: 'odds-letter' }, GRADE_LABEL[id]),
        h('span', { class: 'odds-desc' }, GRADE_COMMENT[id], h('span', { class: 'muted small' }, `실력치 ${range}`)),
        h('b', { class: 'odds-pct' }, p < 0.1 ? '<0.1%' : `${p.toFixed(1)}%`, id === current && h('span', { class: 'tag' }, '내 등급')),
      )
    })
    const details = h('details', { class: 'odds' }, h('summary', {}, '등급별 확률 보기'), h('p', { class: 'odds-note' }, '재능은 초반에 치고 나가기 위한 발판일 뿐, 후반의 고점을 정하지 않습니다. 이후의 성장은 훈련과 선택에 달려 있으니, 뽑기 결과에 너무 연연하지 마세요.'), h('ul', { class: 'plain' }, ...rows), h('p', { class: 'muted small' }, `${genre.name} 기준, 표본 추정치 (±0.1%p)`))
    details.addEventListener('click', (e) => e.stopPropagation()) // 건너뛰기 눌림으로 번지지 않게
    return details
  }

  const show = (result: GachaResult, animate: boolean) => {
    clearTimers()
    stage.classList.remove('glow', 'glow-N', 'glow-R', 'glow-SR', 'glow-SSR', 'glow-UR')
    const rows = STAT_KEYS.map((k) => {
      const fill = h('div', { class: 'bar-fill' })
      const value = h('span', { class: 'stat-value' }, animate ? '' : String(result.stats[k]))
      const isTrait = result.trait.stat === k
      const row = h(
        'div',
        { class: `stat-row${animate ? ' hidden' : ''}` },
        statName(k, draft.genre, genre.weights[k] >= KEY_WEIGHT),
        h('div', { class: 'bar' }, fill),
        value,
        isTrait && h('span', { class: 'tag' }, '특성'),
      )
      const reveal = () => {
        row.classList.remove('hidden')
        value.textContent = String(result.stats[k])
        fill.style.width = `${(result.stats[k] / BAR_MAX) * 100}%`
      }
      return { row, reveal, fill }
    })
    const traitLine = h('p', { class: `trait${animate ? ' hidden' : ''}` }, `시작 특성 · ${result.trait.name} (${STAT_LABEL[result.trait.stat]} 성장 ↑)`)
    const grade = h(
      'div',
      { class: `grade grade-${result.grade}${animate ? ' hidden' : ''}` },
      h('span', { class: 'grade-letter' }, GRADE_LABEL[result.grade]),
      h('span', { class: 'muted' }, `${genre.name} 실력치 ${Math.round(result.power)} · ${GRADE_COMMENT[result.grade]}`),
    )
    const odds = oddsList(result.grade)
    if (animate) odds.classList.add('hidden')
    stage.replaceChildren(...rows.map((r) => r.row), traitLine, grade, odds)

    // 등급 공개: 카드 테두리가 등급색으로 빛나고 폭죽이 터진다. 건너뛰기와 겹쳐도 한 번만.
    let gradeShown = false
    const revealGrade = () => {
      if (gradeShown) return
      gradeShown = true
      grade.classList.remove('hidden')
      odds.classList.remove('hidden')
      stage.classList.add('glow', `glow-${result.grade}`)
      celebrate(result.grade)
    }

    const finish = () => {
      clearTimers()
      rows.forEach((r) => r.reveal())
      traitLine.classList.remove('hidden')
      revealGrade()
      setBusy(false)
    }

    if (!animate) {
      rows.forEach((r) => r.reveal())
      setBusy(false)
      return
    }
    setBusy(true)
    // 능력치를 위에서부터 차례로 채운 뒤 특성, 등급 순으로 공개한다. 카드를 누르면 건너뛴다.
    rows.forEach((r, i) => timers.push(window.setTimeout(r.reveal, (i + 1) * STEP_MS)))
    timers.push(window.setTimeout(() => traitLine.classList.remove('hidden'), (rows.length + 1) * STEP_MS))
    timers.push(
      window.setTimeout(() => {
        revealGrade()
        setBusy(false)
      }, (rows.length + 2) * STEP_MS + SUSPENSE_MS),
    )
    stage.onclick = finish
  }

  const setBusy = (busy: boolean) => {
    rerollBtn.textContent = rollIndex > 0 ? `다시 뽑기 (${rollIndex}회 다시 뽑음)` : '다시 뽑기'
    rerollBtn.disabled = busy
    startBtn.disabled = busy
    stage.title = busy ? '눌러서 건너뛰기' : ''
  }

  const roll = () => show(rollAt(draft.seed, draft.genre, rollIndex), true)

  rerollBtn.onclick = () => {
    rollIndex++
    roll()
  }
  startBtn.onclick = () => {
    clearTimers()
    const state = createInitialState({
      name: draft.name,
      genre: draft.genre,
      mode: draft.mode,
      gacha: rollAt(draft.seed, draft.genre, rollIndex),
      seed: draft.seed,
      rerolls: rollIndex,
    })
    saveGame(ctx.storage, state)
    ctx.toHome(state)
  }

  const screen = h(
    'main',
    { class: 'screen' },
    h('h2', {}, `${draft.name}의 재능`),
    h('p', { class: 'muted small' }, `${genre.name} · ${MODE_INFO[draft.mode].name} 모드 · 합계 ${gacha.statTotal}`),
    stage,
    h('div', { class: 'stack' }, startBtn, rerollBtn, h('button', { class: 'btn ghost', onclick: () => ctx.toCreate() }, '처음부터')),
  )
  roll()
  return screen
}
