import gacha from '../data/gacha.json'
import genres from '../data/genres.json'
import { gradeBounds, gradeOdds } from '../engine/gacha.ts'
import { createInitialState } from '../engine/state.ts'
import { STAT_KEYS, type GachaResult, type Grade } from '../engine/types.ts'
import { perksFromMeta, saveGame, useSrTicket } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import type { NewGameDraft } from './create.ts'
import { h } from './dom.ts'
import { statName } from './statHelp.ts'
import { GRADE_COMMENT, GRADE_LABEL, MODE_INFO, STAT_LABEL } from './labels.ts'
import { celebrate } from './confetti.ts'
import { playGradeSfx } from './sound.ts'
import { rollAt, rollAtMin } from './newGame.ts'
import { segmented } from './components.ts'
import { openSheet } from './sheet.ts'

const STEP_MS = 130
/** 등급 공개 직전 뜸 들이는 시간 */
const SUSPENSE_MS = 350
/** 한 능력치가 가질 수 있는 최댓값 (나머지가 모두 최솟값일 때) */
const BAR_MAX = gacha.statTotal - gacha.statMin * (STAT_KEYS.length - 1)
/** 장르 가중치가 이 값 이상인 능력치를 핵심 능력치로 표시한다 */
const KEY_WEIGHT = 20
/** 목표 등급 자동 뽑기의 속도 배율 (평소 다시 뽑기의 2배) */
const AUTO_SPEED = 2
/** 낮은 등급부터 높은 등급 순 */
const GRADE_ORDER: Grade[] = ['N', 'R', 'SR', 'SSR', 'UR']

export function gachaScreen(ctx: Ctx, draft: NewGameDraft): HTMLElement {
  const genre = genres[draft.genre]
  let rollIndex = 0
  let timers: number[] = []

  const stage = h('div', { class: 'gacha-card', role: 'status', 'aria-live': 'polite' })
  const rerollBtn = h('button', { class: 'btn', type: 'button' }, '다시 뽑기')
  /** 카드 아래 안내 줄: 뽑는 중에는 건너뛰기 안내, 끝나면 다시 뽑은 횟수 */
  const note = h('p', { class: 'muted small gacha-note' })
  const startBtn = h('button', { class: 'btn primary', type: 'button' }, '이 캐릭터로 시작')
  let targetGrade: Grade = 'SSR'
  const autoBtn = h('button', { class: 'link-btn auto-link', type: 'button' }, '원하는 등급까지 뽑기 ›')
  /** 목표 등급 자동 뽑기가 돌아가는 중인지 */
  let autoRunning = false

  /** SR 보장권(업적 상점)을 쓰는 중인가. 켜면 뽑기 결과가 SR 이상으로만 나오고, 시작할 때 한 장 쓴다. */
  let ticketOn = false
  const tickets = () => ctx.meta.inventory.sr_ticket ?? 0
  const ticketBtn = h('button', { class: 'btn ghost small' })
  const current = () => (ticketOn ? rollAtMin(draft.seed, draft.genre, rollIndex) : rollAt(draft.seed, draft.genre, rollIndex))

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

  const show = (result: GachaResult, animate: boolean, speed = 1, onRevealed?: (hit: boolean) => void) => {
    const stepMs = STEP_MS / speed
    const suspenseMs = SUSPENSE_MS / speed
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
      // 자동 뽑기 중에는 목표 등급이 나왔을 때만 폭죽을 터뜨린다
      if (!autoRunning || isHit(result.grade)) {
        celebrate(result.grade)
        // 폭죽이 없는 낮은 등급도 공개 소리는 낸다 (SR 이상은 celebrate가 낸다)
        if (result.grade === 'N' || result.grade === 'R') playGradeSfx(result.grade)
      }
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
    rows.forEach((r, i) => timers.push(window.setTimeout(r.reveal, (i + 1) * stepMs)))
    timers.push(window.setTimeout(() => traitLine.classList.remove('hidden'), (rows.length + 1) * stepMs))
    timers.push(
      window.setTimeout(() => {
        revealGrade()
        setBusy(false)
        onRevealed?.(isHit(result.grade))
      }, (rows.length + 2) * stepMs + suspenseMs),
    )
    stage.onclick = autoRunning ? null : finish
  }

  const isHit = (g: Grade) => GRADE_ORDER.indexOf(g) >= GRADE_ORDER.indexOf(targetGrade)

  const setBusy = (busy: boolean) => {
    rerollBtn.disabled = busy || autoRunning
    startBtn.disabled = busy || autoRunning
    // 자동 뽑기 중에는 같은 버튼이 '멈추기'가 된다
    autoBtn.disabled = busy && !autoRunning
    autoBtn.textContent = autoRunning ? `멈추기 (누적 ${rollIndex}회 다시 뽑음)` : '원하는 등급까지 뽑기 ›'
    note.textContent = busy && !autoRunning ? '카드를 누르면 건너뛰어요' : rollIndex > 0 ? `${rollIndex}번 다시 뽑았어요` : ''
    stage.title = busy && !autoRunning ? '눌러서 건너뛰기' : ''
  }

  const roll = () => show(current(), true)

  rerollBtn.onclick = () => {
    rollIndex++
    roll()
  }
  // 목표 등급 이상이 나올 때까지 평소의 2배 속도로 계속 다시 뽑는다. 누적 횟수는 다시 뽑기 횟수에 그대로 센다. 버튼을 다시 누르면 멈춘다.
  const autoStep = () => {
    if (!autoRunning) {
      setBusy(false) // 다음 회차를 기다리는 사이에 멈추기를 눌렀다면 버튼을 되살린다
      return
    }
    rollIndex++
    show(current(), true, AUTO_SPEED, (hit) => {
      if (hit || !autoRunning) {
        autoRunning = false
        setBusy(false)
        return
      }
      timers.push(window.setTimeout(autoStep, 150 / AUTO_SPEED))
    })
    setBusy(true)
  }
  /** 목표 등급을 고르는 시트. '뽑기 시작'을 누르면 자동 뽑기가 돈다. */
  const chooseTarget = async () => {
    const picked = await openSheet<Grade | null>(
      (close) => {
        let pick: Grade = targetGrade
        const body = h('div', { class: 'stack-tight' })
        const draw = () =>
          body.replaceChildren(
            h('p', { class: 'eyebrow' }, '원하는 등급까지 뽑기'),
            h('p', { class: 'muted small' }, '고른 등급 이상이 나올 때까지 평소의 2배 속도로 계속 다시 뽑아요. 다시 뽑은 횟수는 그대로 세어요.'),
            segmented(
              GRADE_ORDER.slice(1).map((g) => ({ id: g, label: `${GRADE_LABEL[g]} 이상` })),
              pick,
              (g) => ((pick = g), draw()),
            ),
            h('button', { class: 'btn primary', type: 'button', onclick: () => close(pick) }, '뽑기 시작'),
            h('button', { class: 'btn ghost small', type: 'button', onclick: () => close(null) }, '취소'),
          )
        draw()
        return body
      },
      { variant: 'decision', autofocus: false },
    )
    if (!picked) return
    targetGrade = picked
    autoRunning = true
    autoStep()
  }
  autoBtn.onclick = () => {
    if (autoRunning) {
      autoRunning = false // 지금 연출까지만 보여 주고 멈춘다
      setBusy(true)
      return
    }
    void chooseTarget()
  }
  const renderTicket = () => {
    ticketBtn.textContent = ticketOn ? `SR 보장권 사용 중 (보유 ${tickets()}장) · 끄기` : `SR 보장권 쓰기 (보유 ${tickets()}장)`
    ticketBtn.classList.toggle('active', ticketOn)
  }
  ticketBtn.onclick = () => {
    if (autoRunning) return
    ticketOn = !ticketOn
    renderTicket()
    roll()
  }
  startBtn.onclick = () => {
    clearTimers()
    const perks = perksFromMeta(ctx.meta)
    const result = current()
    // 보장권을 쓴 판이면 한 장 사라진다
    if (ticketOn) ctx.meta = useSrTicket(ctx.storage) ?? ctx.meta
    const state = createInitialState({
      name: draft.name,
      genre: draft.genre,
      mode: draft.mode,
      gacha: result,
      seed: draft.seed,
      rerolls: rollIndex,
      perks,
    })
    saveGame(ctx.storage, state)
    ctx.toHome(state)
  }

  const screen = h(
    'main',
    { class: 'screen' },
    h('button', { class: 'btn ghost small back-btn', type: 'button', onclick: () => ctx.toCreate() }, '‹ 뒤로'),
    h('h2', {}, `${draft.name}의 재능`),
    h('p', { class: 'muted small' }, `${genre.name} · ${MODE_INFO[draft.mode].name} 모드 · 합계 ${gacha.statTotal}`),
    stage,
    note,
    autoBtn,
    tickets() > 0 && ticketBtn,
    h('div', { class: 'plan-cta btn-row gacha-actions' }, rerollBtn, startBtn),
  )
  renderTicket()
  roll()
  return screen
}
