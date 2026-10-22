import type { Ctx } from './app.ts'
import { segmented } from './components.ts'
import { h } from './dom.ts'
import type { FontId, MotionPref, ThemePref } from './prefs.ts'
import { listGuides, showGuide } from './guides.ts'
import { openSheet } from './sheet.ts'
import { onSoundChange, setSoundEnabled, soundEnabled } from './sound.ts'
import { openUpdateLog } from './updateLog.ts'

const THEME_ITEMS: { id: ThemePref; label: string }[] = [
  { id: 'auto', label: '자동' },
  { id: 'light', label: '밝은 카드' },
  { id: 'cozy', label: '크림+도트' },
  { id: 'dark', label: '다크' },
]
const FONT_ITEMS: { id: FontId; label: string }[] = [
  { id: 'pretendard', label: 'Pretendard' },
  { id: 'jua', label: '주아' },
  { id: 'galmuri', label: '갈무리' },
]
const MOTION_ITEMS: { id: MotionPref; label: string }[] = [
  { id: 'auto', label: '자동' },
  { id: 'calm', label: '차분' },
  { id: 'normal', label: '보통' },
  { id: 'lively', label: '화려' },
]

/** 오른쪽 위 ⚙로 여는 설정 시트. 고르는 즉시 적용되어 뒤 화면이 바뀐다. */
export function openSettings(ctx: Ctx, opts: { inGame: boolean }): Promise<void> {
  return openSheet<void>(
    (close) => {
      const root = h('div', { class: 'stack-tight settings' })
      const render = () => {
        if (!root.isConnected && root.childElementCount) return
        const row = (title: string, ...kids: Node[]) => h('div', { class: 'settings-row' }, h('h3', {}, title), ...kids)
        const link = (label: string, onclick: () => void, note?: string) =>
          h('button', { class: 'settings-link', type: 'button', onclick }, h('span', {}, label), h('span', { class: 'muted' }, note ?? '›'))
        const sound = h('button', { class: 'settings-link', type: 'button', role: 'switch', 'aria-checked': String(soundEnabled()), onclick: () => setSoundEnabled(!soundEnabled()) }, h('span', {}, '소리'), h('span', { class: 'muted' }, soundEnabled() ? '켜짐' : '꺼짐'))
        root.replaceChildren(
          h('p', { class: 'eyebrow' }, '설정'),
          row('테마', segmented(THEME_ITEMS, ctx.prefs.theme, (theme) => (ctx.updatePrefs({ theme }), render()))),
          row('글자', segmented(FONT_ITEMS, ctx.prefs.font, (font) => (ctx.updatePrefs({ font }), render()))),
          row('움직임', segmented(MOTION_ITEMS, ctx.prefs.motion, (motion) => (ctx.updatePrefs({ motion }), render()))),
          sound,
          link('업데이트 로그', () => void openUpdateLog()),
          link('가이드 모아 보기', () => void openGuideList(ctx), `${listGuides(ctx).filter((g) => g.seen).length}/${listGuides(ctx).length}`),
          ...(opts.inGame ? [link('타이틀로', () => (close(undefined), ctx.toTitle()))] : []),
        )
      }
      onSoundChange(render)
      render()
      return root
    },
    { variant: 'info' },
  )
}

/** 가이드 모아 보기: 본 것은 ✓, 누르면 다시 연다 (본 기록은 바뀌지 않는다) */
function openGuideList(ctx: Ctx): Promise<void> {
  return openSheet<void>(
    () =>
      h(
        'div',
        { class: 'stack-tight' },
        h('p', { class: 'eyebrow' }, '가이드 모아 보기'),
        ...listGuides(ctx).map((g) =>
          h(
            'button',
            { class: 'settings-link guide-row', type: 'button', onclick: () => void (g.id === 'start' ? ctx.showStartGuide() : showGuide(ctx, g.id)) },
            h('span', {}, `${g.seen ? '✓ ' : ''}${g.title}`),
            h('span', { class: 'muted small' }, g.where),
          ),
        ),
      ),
    { variant: 'info' },
  )
}
