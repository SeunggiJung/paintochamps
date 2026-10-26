import { choosePrep, expectedScore, PREP, testItems, testName, upcomingTest } from '../engine/routes.ts'
import type { GameState } from '../engine/state.ts'
import { saveGame } from '../save/storage.ts'
import type { Ctx } from './app.ts'
import { confirmSheet } from './confirm.ts'
import { h } from './dom.ts'
import { showGuideOnce } from './guides.ts'
import { askCafeTeamName } from './teamNameSheet.ts'

/**
 * 시즌의 마지막 턴까지 마친 상태(탭 바 없는 전체 화면): 시험 준비를 고르고 결산으로 넘어간다.
 * 결산은 시드로 정해져서 중간에 나가도 같은 결과가 나온다.
 */
export function seasonEnd(ctx: Ctx, initial: GameState): HTMLElement {
  let state = initial
  const root = h('main', { class: 'screen season-end' })

  /** 이번 결산에서 볼 시험의 현재 달성도와 준비 선택 */
  const prepCard = (): HTMLElement | null => {
    const upcoming = upcomingTest(state)
    if (!upcoming) return null
    const items = testItems(state, upcoming.id)
    const score = Math.round(expectedScore(state, upcoming.id) * 100)
    const chosen = PREP.find((p) => p.id === state.testPrep)
    return h(
      'section',
      { class: 'card prep-card' },
      h('div', { class: 'row' }, h('h3', {}, testName(upcoming.id, state)), h('span', { class: 'power' }, '예상 ', h('b', {}, `${score}`), ' / 합격 100')),
      !upcoming.certain && h('p', { class: 'muted small' }, '지역 대회 성적이 좋으면 응시할 수 있다.'),
      ...items.map((it) =>
        h(
          'div',
          { class: 'stat-row compact' },
          h('span', { class: 'stat-name' }, it.label),
          h('div', { class: 'bar' }, h('div', { class: `bar-fill${it.ratio < 0.8 ? ' low' : ''}`, style: `width:${Math.min(100, (it.ratio / 1.5) * 100)}%` })),
          h('span', { class: 'stat-value' }, `${Math.round(it.ratio * 100)}%`),
          h('span', {}),
        ),
      ),
      chosen
        ? h('p', { class: 'muted' }, `준비: ${chosen.label}`)
        : h(
            'div',
            { class: 'choices vertical' },
            ...PREP.map((p) =>
              h(
                'button',
                {
                  class: 'choice',
                  type: 'button',
                  disabled: !!p.money && state.money + p.money < 0,
                  onclick: () => {
                    state = choosePrep(state, p.id)
                    saveGame(ctx.storage, state)
                    draw()
                  },
                },
                h('b', {}, p.label),
                h('span', { class: 'muted small' }, p.desc),
              ),
            ),
          ),
    )
  }

  const toSettle = async () => {
    const test = upcomingTest(state)
    if (test && !state.testPrep) {
      const ok = await confirmSheet({
        title: `${testName(test.id, state)} 준비를 안 했어요`,
        message: '시험 준비(집중·컨디션·조언)를 고르지 않고 결산으로 넘어갈까요? 준비하면 합격 확률이 올라갑니다.',
        ok: '준비 없이 넘어가기',
        cancel: '돌아가서 준비하기',
      })
      if (!ok) return
    }
    state = await askCafeTeamName(ctx.storage, state)
    ctx.toSeason(state)
  }

  function draw() {
    root.replaceChildren(
      h('p', { class: 'eyebrow' }, `${state.season}시즌 종료`),
      h('h2', {}, `${state.name} · ${state.age}세`),
      h('p', { class: 'muted' }, '이번 시즌의 모든 턴을 마쳤어요. 대회 결과를 확인하세요. (진행 상황은 저장되어 있어요.)'),
      prepCard() ?? '',
      h('div', { class: 'plan-cta' }, h('button', { class: 'btn primary', type: 'button', onclick: () => void toSettle() }, '시즌 결산 보기')),
    )
  }
  draw()
  if (upcomingTest(state)) void showGuideOnce(ctx, 'prep')
  return root
}
