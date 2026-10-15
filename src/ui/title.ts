import type { GameState } from '../engine/state.ts'
import { clearGame } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { h } from './dom.ts'
import { MODE_INFO } from './labels.ts'
import { supportButton } from './support.ts'
import { titleHero } from './titleScene.ts'

export function titleScreen(ctx: Ctx, saved: GameState | null): HTMLElement {
  const resume = saved
    ? h(
        'button',
        { class: 'btn primary', onclick: () => ctx.toHome(saved) },
        `이어하기 · ${saved.name} (${saved.age}세, ${MODE_INFO[saved.mode].name})`,
      )
    : null

  const newGame = h(
    'button',
    {
      class: saved ? 'btn' : 'btn primary',
      onclick: () => {
        // 저장이 있으면 덮어쓰기 전에 한 번 더 확인한다
        if (saved && !confirm('저장된 게임이 사라집니다. 새로 시작할까요?')) return
        if (saved) clearGame(ctx.storage)
        ctx.toCreate()
      },
    },
    '새로 시작',
  )

  return h(
    'main',
    { class: 'screen title' },
    supportButton(),
    h('p', { class: 'eyebrow' }, '16세, 방구석에서'),
    h('h1', {}, '방구석 겜돌이에서 프로게이머되기'),
    h('p', { class: 'muted' }, '월드 챔피언십 우승을 향한 15년.'),
    titleHero(),
    h('div', { class: 'stack' }, resume, newGame),
    ctx.meta.finishedRuns > 0 && h('p', { class: 'muted small' }, `완주 ${ctx.meta.finishedRuns}회`),
  )
}
