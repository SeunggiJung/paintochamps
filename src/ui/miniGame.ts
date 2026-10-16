import { applyWarmup, MINIGAME, numbersTier, patternTier, puzzleTier, reactionTier, shootingTier, type MiniGameId, type WarmupTier } from '../engine/minigame.ts'
import { createRng, mixSeed, shuffled, type Rng } from '../engine/rng.ts'
import type { GameState } from '../engine/state.ts'
import { h } from './dom.ts'
import { openSheet } from './sheet.ts'

/** 미니게임 결과: 보너스 등급과 끝났을 때 보여 줄 기록(명중 수·평균 반응속도 등) */
interface MiniResult {
  tier: WarmupTier
  summary: string
}

const quit = (): MiniResult => ({ tier: 'miss', summary: '중간에 그만뒀어요' })

const TIER_TEXT: Record<WarmupTier, string> = {
  miss: '아쉽지만 이번에는 보너스가 없어요. 손해도 없습니다.',
  good: '좋아요! 다음 턴 훈련 효율이 올라갑니다.',
  great: '최고예요! 다음 턴 훈련 효율이 크게 올라갑니다.',
}

const pct = (v: number) => `+${Math.round(v * 100)}%`

/**
 * 턴이 끝난 뒤 가끔(`rollMiniGame`) 뜨는 가벼운 미니게임. 어떤 게임인지는 kind로 받는다.
 * 결과에 따라 다음 턴 훈련 효율이 조금 오르고, 건너뛰거나 못 해도 손해는 없다. 보너스를 반영한 상태를 돌려준다.
 */
export async function offerMiniGame(state: GameState, kind: MiniGameId): Promise<GameState> {
  const info = MINIGAME[kind]
  const play = await openSheet<boolean>((close) =>
    h(
      'div',
      { class: 'stack-tight' },
      h('p', { class: 'eyebrow' }, '쉬는 시간 미니게임'),
      h('h3', {}, info.name),
      h('p', { class: 'event-text' }, info.desc),
      h('p', { class: 'muted small' }, `잘하면 다음 턴 훈련 효율이 최대 ${pct(MINIGAME.bonus.great)} 오릅니다. 건너뛰어도 손해는 없어요.`),
      h('button', { class: 'btn primary', onclick: () => close(true) }, '해 본다'),
      h('button', { class: 'btn ghost small', onclick: () => close(false) }, '건너뛴다'),
    ),
  )
  if (!play) return state
  const rng = createRng(mixSeed(state.seed, state.turnCount, 0x3149))
  const { tier, summary } = await PLAYERS[kind](rng)
  const bonus = tier === 'miss' ? 0 : MINIGAME.bonus[tier]
  await openSheet<void>((close) =>
    h(
      'div',
      { class: 'stack-tight' },
      h('p', { class: 'eyebrow' }, info.name),
      h('p', { class: 'minigame-score' }, summary),
      h('p', { class: 'event-text' }, TIER_TEXT[tier]),
      bonus > 0 && h('p', { class: 'minigame-bonus' }, `다음 턴 훈련 효율 ${pct(bonus)}`),
      h('button', { class: 'btn primary', onclick: () => close() }, '확인'),
    ),
  )
  return applyWarmup(state, tier)
}

/** 사격: 제한 시간 동안 나타났다 사라지는 표적을 누른다. 맞힌 수로 등급이 정해진다. */
function playShooting(rng: Rng): Promise<MiniResult> {
  const cfg = MINIGAME.shooting
  return openSheet<MiniResult>((close) => {
    let hits = 0
    let left = cfg.seconds
    let over = false
    const timeEl = h('b', {}, `${left}`)
    const hitEl = h('b', {}, '0')
    const arena = h('div', { class: 'mg-arena' })

    const spawn = () => {
      if (over) return
      const target = h('button', { class: 'mg-target', 'aria-label': '표적' })
      target.style.left = `${6 + rng() * 78}%`
      target.style.top = `${6 + rng() * 78}%`
      target.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        if (over || !target.isConnected) return
        hits++
        hitEl.textContent = String(hits)
        target.remove()
      })
      arena.append(target)
      setTimeout(() => target.remove(), cfg.lifeMs)
      timers.push(setTimeout(spawn, cfg.spawnMs))
    }
    const timers: ReturnType<typeof setTimeout>[] = []
    const tick = setInterval(() => {
      left--
      timeEl.textContent = String(Math.max(0, left))
      if (left <= 0) finish()
    }, 1000)
    const finish = () => {
      if (over) return
      over = true
      clearInterval(tick)
      timers.forEach(clearTimeout)
      close({ tier: shootingTier(hits), summary: `표적 ${hits}개 명중!` })
    }
    timers.push(setTimeout(spawn, 400))

    return h(
      'div',
      { class: 'stack-tight' },
      h('p', { class: 'eyebrow' }, cfg.name),
      h('p', { class: 'row' }, h('span', {}, '남은 시간 ', timeEl, '초'), h('span', {}, '명중 ', hitEl)),
      arena,
      h('button', { class: 'btn ghost small', onclick: () => finish() }, '그만둔다'),
    )
  }, { autofocus: false })
}

const GLYPHS = [
  { g: '◆', c: '#5b8cff' },
  { g: '▲', c: '#4cc38a' },
  { g: '●', c: '#ff6b7a' },
  { g: '■', c: '#ffb740' },
  { g: '★', c: '#b980ff' },
  { g: '♥', c: '#ff8fc8' },
]

/** 퍼즐: 뒤집힌 카드에서 같은 그림 짝을 모두 찾는다. 짝을 시도한 횟수가 적을수록 좋은 등급이다. */
function playPuzzle(rng: Rng): Promise<MiniResult> {
  const cfg = MINIGAME.puzzle
  return openSheet<MiniResult>((close) => {
    const deck = shuffled(rng, GLYPHS.slice(0, cfg.pairs).flatMap((_, i) => [i, i]))
    const open: number[] = []
    const done = new Set<number>()
    let moves = 0
    let lock = false
    const movesEl = h('b', {}, '0')
    const cards = deck.map((kind, i) => {
      const btn = h('button', { class: 'mg-card', 'aria-label': '카드' })
      btn.addEventListener('click', () => {
        if (lock || done.has(i) || open.includes(i)) return
        reveal(btn, kind, true)
        open.push(i)
        if (open.length < 2) return
        moves++
        movesEl.textContent = String(moves)
        const [a, b] = open
        if (deck[a] === deck[b]) {
          done.add(a).add(b)
          open.length = 0
          if (done.size === deck.length) setTimeout(() => close({ tier: puzzleTier(moves, true), summary: `${moves}번 만에 모든 짝을 찾았어요!` }), 450)
          return
        }
        lock = true
        setTimeout(() => {
          for (const j of [a, b]) reveal(cards[j], 0, false)
          open.length = 0
          lock = false
        }, 650)
      })
      return btn
    })
    function reveal(btn: HTMLElement, kind: number, show: boolean) {
      btn.textContent = show ? GLYPHS[kind].g : ''
      btn.style.color = show ? GLYPHS[kind].c : ''
      btn.classList.toggle('open', show)
    }

    return h(
      'div',
      { class: 'stack-tight' },
      h('p', { class: 'eyebrow' }, cfg.name),
      h('p', { class: 'row' }, h('span', {}, '시도 ', movesEl, '번'), h('span', { class: 'muted small' }, `${cfg.greatMoves}번 이하면 최고`)),
      h('div', { class: 'mg-grid' }, ...cards),
      h('button', { class: 'btn ghost small', onclick: () => close(quit()) }, '그만둔다'),
    )
  }, { autofocus: false })
}

/** 반응속도: 화면이 초록으로 바뀌는 순간 누른다. 평균 반응 시간으로 평가하고, 너무 일찍 누르면 그 판을 다시 한다. */
function playReaction(rng: Rng): Promise<MiniResult> {
  const cfg = MINIGAME.reaction
  return openSheet<MiniResult>((close) => {
    const times: number[] = []
    let phase: 'idle' | 'wait' | 'go' = 'idle'
    let timer: ReturnType<typeof setTimeout> | undefined
    let goAt = 0
    const pad = h('button', { class: 'mg-react' })
    const roundEl = h('b', {}, '1')
    const show = (cls: string, text: string) => {
      pad.className = `mg-react ${cls}`
      pad.textContent = text
    }
    const next = () => {
      phase = 'wait'
      show('wait', '초록색이 되면 누르세요')
      timer = setTimeout(() => {
        phase = 'go'
        goAt = performance.now()
        show('go', '지금!')
      }, cfg.minWaitMs + rng() * (cfg.maxWaitMs - cfg.minWaitMs))
    }
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      if (phase === 'idle') return next()
      if (phase === 'wait') {
        clearTimeout(timer)
        phase = 'idle'
        return show('early', '너무 빨라요! 눌러서 다시')
      }
      times.push(performance.now() - goAt)
      if (times.length >= cfg.rounds) {
        phase = 'idle'
        const avg = times.reduce((a, b) => a + b, 0) / times.length
        return close({ tier: reactionTier(avg), summary: `평균 반응속도 ${Math.round(avg)}ms (가장 빠른 ${Math.round(Math.min(...times))}ms)` })
      }
      roundEl.textContent = String(times.length + 1)
      phase = 'idle'
      show('idle', `${Math.round(times[times.length - 1])}ms — 눌러서 다음`)
    })
    show('idle', '눌러서 시작')

    return h(
      'div',
      { class: 'stack-tight' },
      h('p', { class: 'eyebrow' }, cfg.name),
      h('p', { class: 'row' }, h('span', {}, '라운드 ', roundEl, `/${cfg.rounds}`), h('span', { class: 'muted small' }, `평균 ${cfg.greatMs}ms 이하면 최고`)),
      pad,
      h('button', { class: 'btn ghost small', onclick: () => (clearTimeout(timer), close(quit())) }, '그만둔다'),
    )
  }, { autofocus: false })
}

/** 숫자 순서 터치: 흩어진 숫자를 1부터 순서대로 누른다. 끝까지 걸린 시간으로 평가한다. */
function playNumbers(rng: Rng): Promise<MiniResult> {
  const cfg = MINIGAME.numbers
  return openSheet<MiniResult>((close) => {
    const order = shuffled(rng, Array.from({ length: cfg.count }, (_, i) => i + 1))
    let want = 1
    let startedAt = 0
    const nextEl = h('b', {}, '1')
    const cells = order.map((n) => {
      const btn = h('button', { class: 'mg-card', 'aria-label': `숫자 ${n}` }, String(n))
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        if (n !== want) {
          btn.classList.add('wrong')
          setTimeout(() => btn.classList.remove('wrong'), 200)
          return
        }
        if (want === 1) startedAt = performance.now()
        btn.classList.add('open')
        btn.disabled = true
        want++
        nextEl.textContent = want > cfg.count ? '-' : String(want)
        if (want > cfg.count) {
          const sec = (performance.now() - startedAt) / 1000
          close({ tier: numbersTier(sec, true), summary: `1~${cfg.count}를 ${sec.toFixed(2)}초 만에 눌렀어요!` })
        }
      })
      return btn
    })
    return h(
      'div',
      { class: 'stack-tight' },
      h('p', { class: 'eyebrow' }, cfg.name),
      h('p', { class: 'row' }, h('span', {}, '다음 숫자 ', nextEl), h('span', { class: 'muted small' }, `${cfg.greatSec}초 이하면 최고 (1을 누르면 시작)`)),
      h('div', { class: 'mg-grid three' }, ...cells),
      h('button', { class: 'btn ghost small', onclick: () => close(quit()) }, '그만둔다'),
    )
  }, { autofocus: false })
}

const PADS = [
  { c: '#5b8cff', label: '파랑' },
  { c: '#4cc38a', label: '초록' },
  { c: '#ff6b7a', label: '빨강' },
  { c: '#ffb740', label: '노랑' },
]

/** 패턴 기억: 깜빡이는 순서를 보고 똑같이 누른다. 라운드마다 한 칸씩 길어지고, 한 번 틀리면 끝난다. */
function playPattern(rng: Rng): Promise<MiniResult> {
  const cfg = MINIGAME.pattern
  return openSheet<MiniResult>((close) => {
    const seq = Array.from({ length: cfg.maxLength }, () => Math.floor(rng() * PADS.length))
    let length = cfg.startLength
    let cleared = 0
    let input = 0
    let accepting = false
    let over = false
    const statusEl = h('span', {}, '잘 보세요')
    const result = (): MiniResult => ({ tier: patternTier(cleared), summary: cleared > 0 ? `${cleared}칸짜리 순서까지 성공했어요${cleared >= cfg.maxLength ? ' (끝까지 완주!)' : ''}` : '첫 순서에서 틀렸어요' })
    const flash = (btn: HTMLElement, ms: number) => {
      btn.classList.add('lit')
      setTimeout(() => btn.classList.remove('lit'), ms)
    }
    const pads: HTMLElement[] = PADS.map((p, i) => {
      const btn = h('button', { class: 'mg-pad', 'aria-label': p.label })
      btn.style.setProperty('--pad', p.c)
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        if (!accepting || over) return
        flash(btn, 160)
        if (seq[input] !== i) {
          over = true
          accepting = false
          statusEl.textContent = '틀렸어요!'
          setTimeout(() => close(result()), 600)
          return
        }
        input++
        if (input < length) return
        cleared = length
        accepting = false
        if (length >= cfg.maxLength) {
          over = true
          setTimeout(() => close(result()), 400)
          return
        }
        length++
        statusEl.textContent = '좋아요! 다음은 더 길어요'
        setTimeout(show, 800)
      })
      return btn
    })
    function show() {
      if (over) return
      accepting = false
      input = 0
      statusEl.textContent = '잘 보세요'
      seq.slice(0, length).forEach((p, k) =>
        setTimeout(() => {
          if (!over) flash(pads[p], 420)
          if (k === length - 1) {
            setTimeout(() => {
              accepting = !over
              statusEl.textContent = '따라 누르세요'
            }, 500)
          }
        }, 600 + k * 700),
      )
    }
    setTimeout(show, 300)

    return h(
      'div',
      { class: 'stack-tight' },
      h('p', { class: 'eyebrow' }, cfg.name),
      h('p', { class: 'row' }, statusEl, h('span', { class: 'muted small' }, `${cfg.great}칸 이상이면 최고`)),
      h('div', { class: 'mg-grid two' }, ...pads),
      h('button', { class: 'btn ghost small', onclick: () => ((over = true), close(result())) }, '그만둔다'),
    )
  }, { autofocus: false })
}

const PLAYERS: Record<MiniGameId, (rng: Rng) => Promise<MiniResult>> = {
  shooting: playShooting,
  puzzle: playPuzzle,
  reaction: playReaction,
  numbers: playNumbers,
  pattern: playPattern,
}
