import lines from '../data/broadcast.json'
import type { FinalSeries } from '../engine/broadcast.ts'
import { broadcastKind, broadcastScript } from '../engine/broadcastScript.ts'
import type { GenreId } from '../engine/types.ts'
import { broadcastSceneSvg } from './broadcastScene.ts'
import { h } from './dom.ts'
import { openSheet } from './sheet.ts'

/**
 * 결승 중계 연출: 중계 장면 위에 스코어보드와 해설 멘트가 흘러간다.
 * 화면을 누르면 다음 멘트로, '스킵하기'를 누르면 바로 끝낸다. 끝나면 대회 결과 카드가 이어서 뜬다.
 */
export function playBroadcast(series: FinalSeries, genre: GenreId, seed: number, season: number): Promise<void> {
  const steps = broadcastScript(series, genre, seed, season)
  return openSheet<void>(
    (close) => {
      const scene = h('div', { class: 'bs', 'data-mood': 'idle', role: 'img', 'aria-label': `${series.eventName} 결승 중계 화면` })
      scene.innerHTML = broadcastSceneSvg(broadcastKind(genre))
      const mine = h('b', { class: 'bc-num' }, '0')
      const theirs = h('b', { class: 'bc-num' }, '0')
      const who = h('p', { class: 'who' }, '')
      const say = h('p', { class: 'say', 'aria-live': 'polite' }, '')
      const root = h(
        'div',
        { class: 'stack-tight broadcast' },
        h('div', { class: 'row' }, h('p', { class: 'eyebrow' }, `${series.eventName} 결승`), h('span', { class: 'bc-live' }, 'LIVE')),
        scene,
        h('div', { class: 'bc-score' }, h('span', { class: 'bc-team me' }, series.playerTeam), mine, h('span', { class: 'muted' }, ':'), theirs, h('span', { class: 'bc-team opp' }, series.opponent)),
        h('div', { class: 'bc-caption' }, who, say),
        h('button', { class: 'btn ghost small skip-btn', onclick: () => {
              skipped = true
              release?.()
            },
          }, '스킵하기 ', h('span', { 'aria-hidden': 'true' }, '⏩')),
        h('p', { class: 'muted small' }, '화면을 누르면 다음 멘트로 넘어가요.'),
      )
      let skipped = false
      let release: (() => void) | null = null
      // 멘트마다 읽을 시간을 주고, 누르면 바로 다음으로 넘어간다
      const wait = (ms: number) =>
        new Promise<void>((resolve) => {
          const timer = setTimeout(done, ms)
          function done() {
            clearTimeout(timer)
            release = null
            resolve()
          }
          release = done
        })
      root.addEventListener('click', (e) => {
        if (!(e.target as Element).closest('button')) release?.()
      })

      void (async () => {
        await wait(400)
        for (const step of steps) {
          if (skipped) break
          scene.dataset.mood = step.mood
          mine.textContent = String(step.score[0])
          theirs.textContent = String(step.score[1])
          who.textContent = lines.casters[step.speaker]
          say.textContent = step.text
          const isResult = step.mood === 'win' || step.mood === 'lose'
          await wait(Math.min(5200, lines.pace.lineMs + step.text.length * 28 + (isResult ? lines.pace.setEndMs - 1500 : 0)))
        }
        close()
      })()
      return root
    },
    { variant: 'cinema', autofocus: false })
}
