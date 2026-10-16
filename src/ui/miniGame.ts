import { applyWarmup, miniGameFor, MINIGAME, puzzleTier, shootingTier, type WarmupTier } from '../engine/minigame.ts'
import { createRng, mixSeed, shuffled, type Rng } from '../engine/rng.ts'
import type { GameState } from '../engine/state.ts'
import { h } from './dom.ts'
import { openSheet } from './sheet.ts'

const TIER_TEXT: Record<WarmupTier, string> = {
  miss: '아쉽지만 이번에는 보너스가 없어요. 손해도 없습니다.',
  good: '좋아요! 다음 턴 훈련 효율이 올라갑니다.',
  great: '최고예요! 다음 턴 훈련 효율이 크게 올라갑니다.',
}

const pct = (v: number) => `+${Math.round(v * 100)}%`

/**
 * 턴이 끝난 뒤 가볍게 즐기는 미니게임(턴마다 사격·퍼즐이 번갈아 나온다).
 * 결과에 따라 다음 턴 훈련 효율이 조금 오르고, 건너뛰거나 못 해도 손해는 없다. 보너스를 반영한 상태를 돌려준다.
 */
export async function offerMiniGame(state: GameState): Promise<GameState> {
  const kind = miniGameFor(state)
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
  const tier = kind === 'shooting' ? await playShooting(rng) : await playPuzzle(rng)
  const bonus = tier === 'miss' ? 0 : MINIGAME.bonus[tier]
  await openSheet<void>((close) =>
    h(
      'div',
      { class: 'stack-tight' },
      h('p', { class: 'eyebrow' }, info.name),
      h('p', { class: 'event-text' }, TIER_TEXT[tier]),
      bonus > 0 && h('p', { class: 'minigame-bonus' }, `다음 턴 훈련 효율 ${pct(bonus)}`),
      h('button', { class: 'btn primary', onclick: () => close() }, '확인'),
    ),
  )
  return applyWarmup(state, tier)
}

/** 사격: 제한 시간 동안 나타났다 사라지는 표적을 누른다. 맞힌 수로 등급이 정해진다. */
function playShooting(rng: Rng): Promise<WarmupTier> {
  const cfg = MINIGAME.shooting
  return openSheet<WarmupTier>((close) => {
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
      close(shootingTier(hits))
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
function playPuzzle(rng: Rng): Promise<WarmupTier> {
  const cfg = MINIGAME.puzzle
  return openSheet<WarmupTier>((close) => {
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
          if (done.size === deck.length) setTimeout(() => close(puzzleTier(moves, true)), 450)
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
      h('button', { class: 'btn ghost small', onclick: () => close('miss') }, '그만둔다'),
    )
  }, { autofocus: false })
}
