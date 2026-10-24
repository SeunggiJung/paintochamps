import type { GameState } from '../engine/state.ts'
import { ENDINGS } from '../engine/endings.ts'
import { clearGame } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { h } from './dom.ts'
import { MODE_INFO } from './labels.ts'
import { supportButton } from './support.ts'
import { hasUnseenUpdate, maybeShowUpdateLog, openUpdateLog } from './updateLog.ts'
import { titleHero } from './titleScene.ts'
import { infoFooter } from './infoPages.ts'

export function titleScreen(ctx: Ctx, saved: GameState | null): HTMLElement {
  const resume = saved
    ? h('button', { class: 'btn primary', type: 'button', onclick: () => ctx.toHome(saved) }, `이어하기 · ${saved.name} (${saved.age}세, ${MODE_INFO[saved.mode].name})`)
    : null

  const newGame = h(
    'button',
    {
      class: saved ? 'btn' : 'btn primary',
      type: 'button',
      onclick: () => {
        // 저장이 있으면 덮어쓰기 전에 한 번 더 확인한다
        if (saved && !confirm('저장된 게임이 사라집니다. 새로 시작할까요?')) return
        if (saved) clearGame(ctx.storage)
        ctx.toCreate()
      },
    },
    '새로 시작',
  )

  const tile = (icon: string, label: string, onclick: () => void, badge = false) =>
    h('button', { class: 'title-tile', type: 'button', onclick }, h('span', { class: 'tile-icon' }, icon), h('span', {}, label), badge && h('span', { class: 'tile-badge', 'aria-label': '새 업데이트' }, 'N'))

  // 접속 직후 타이틀을 처음 볼 때 업데이트 로그를 띄운다 (오늘 하루 안 보기를 눌렀다면 건너뜀)
  setTimeout(maybeShowUpdateLog, 0)

  return h(
    'main',
    { class: 'screen title' },
    supportButton(),
    h('h1', {}, '방구석 겜돌이에서 프로게이머되기'),
    h('p', { class: 'title-sub' }, '16세, 방구석에서 월드 챔피언십 우승을 향한 15년'),
    titleHero(),
    h('div', { class: 'stack' }, resume, newGame),
    h(
      'div',
      { class: 'title-tiles' },
      tile('📖', `엔딩 도감 ${ENDINGS.filter((e) => ctx.meta.endings[e.id]).length}/${ENDINGS.length}`, () => ctx.toCodex()),
      tile('🪙', `업적 상점 ${ctx.meta.tokens}`, () => ctx.toShop()),
      tile('📝', '업데이트', () => void openUpdateLog(), hasUnseenUpdate()),
    ),
    ctx.meta.finishedRuns > 0 && h('p', { class: 'muted small' }, `완주 ${ctx.meta.finishedRuns}회`),
    infoFooter(ctx),
  )
}
