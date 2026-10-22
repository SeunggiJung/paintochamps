import { h } from './dom.ts'

/** 말풍선 가이드의 한 단계. target은 화면 요소의 data-guide 값이고, 없으면 화면 중앙에 안내만 띄운다. */
interface GuideStep {
  target?: string
  title: string
  text: string
}

/** 육성 화면 첫 안내. 화면에 없는 요소(예: 부상 중이라 숨겨진 묶음)의 단계는 건너뛴다. */
const STEPS: GuideStep[] = [
  { title: '방구석 겜돌이에서 프로게이머되기', text: '16세 겜돌이를 키워 월드 챔피언십 우승에 도전하는 게임이에요. 시즌마다 계획을 세워 능력치를 키우고, 대회·이적 같은 큰 일을 결정해요. 1분이면 끝나는 안내를 먼저 볼게요.' },
  { target: 'status', title: '지금 상태', text: '컨디션·돈·명성이에요. 컨디션이 낮으면 훈련 효과가 크게 줄어요. 컨디션 옆 ? 를 누르면 단계별 효과를 볼 수 있어요.' },
  { target: 'go', title: '다음 턴 진행', text: '이 버튼을 누르면 시간이 흐르고, 능력치가 얼마나 달라졌는지 그래프로 보여 줘요. 훈련과 휴식은 시즌 계획대로 알아서 흘러가고, 대회·이적·이벤트 같은 큰 일이 생길 때만 직접 결정해요.' },
  { target: 'tabs', title: '아래 탭 4개', text: '홈은 지금 상태와 다음 턴, 시즌은 일정과 계획, 선수는 능력치·계약·내 경력, 기록은 도감과 업적 상점이에요.' },
  { target: 'gear', title: '설정', text: '테마·글자·움직임·소리를 바꾸고, 업데이트 로그와 가이드를 다시 볼 수 있어요. 화이팅!' },
]

/** 아주 높은 요소(목록 묶음)는 윗부분만 강조한다 */
const MAX_HIGHLIGHT = 150

/**
 * 첫 접속용 말풍선 가이드. 요소를 하나씩 밝게 비추며 설명하고, 끝나거나 건너뛰면 resolve된다.
 * 화면 전체를 덮어 가이드 중에는 아래 화면이 눌리지 않는다.
 */
export function runGuide(root: ParentNode = document): Promise<void> {
  const steps = STEPS.filter((s) => !s.target || root.querySelector(`[data-guide="${s.target}"]`))
  return new Promise((resolve) => {
    let index = 0
    const spot = h('div', { class: 'guide-spot' })
    const title = h('b', {})
    const text = h('p', { class: 'guide-text' })
    const count = h('span', { class: 'muted small' })
    const next = h('button', { class: 'btn primary' }, '다음')
    const skip = h('button', { class: 'btn ghost small' }, '건너뛰기')
    const card = h('div', { class: 'guide-card', role: 'dialog', 'aria-modal': 'true' }, count, title, text, h('div', { class: 'guide-actions' }, skip, next))
    const overlay = h('div', { class: 'guide' }, spot, card)

    const place = () => {
      const step = steps[index]
      const el = step.target ? root.querySelector<HTMLElement>(`[data-guide="${step.target}"]`) : null
      if (!el) {
        spot.style.display = 'none'
        card.className = 'guide-card mid'
        return
      }
      const r = el.getBoundingClientRect()
      const height = Math.min(r.height, MAX_HIGHLIGHT)
      spot.style.cssText = `display:block;top:${r.top - 6}px;left:${r.left - 6}px;width:${r.width + 12}px;height:${height + 12}px`
      // 요소가 화면 아래쪽에 있으면 설명을 위에, 위쪽에 있으면 아래에 둔다
      card.className = `guide-card ${r.top + height / 2 > innerHeight / 2 ? 'top' : 'bottom'}`
    }

    const show = () => {
      const step = steps[index]
      const el = step.target ? root.querySelector<HTMLElement>(`[data-guide="${step.target}"]`) : null
      // 화면에 고정된 요소(턴 진행 바)는 스크롤하지 않고, 나머지는 화면 위쪽 1/3 지점에 오게 한다
      if (el && getComputedStyle(el).position !== 'fixed') {
        const top = el.getBoundingClientRect().top + scrollY - innerHeight * 0.3
        scrollTo({ top: Math.max(0, top), behavior: 'auto' })
      }
      count.textContent = `${index + 1} / ${steps.length}`
      title.textContent = step.title
      text.textContent = step.text
      next.textContent = index === steps.length - 1 ? '시작하기' : '다음'
      place()
    }

    const finish = () => {
      removeEventListener('resize', place)
      removeEventListener('scroll', place)
      overlay.remove()
      scrollTo({ top: 0, behavior: 'auto' })
      resolve()
    }
    next.addEventListener('click', () => (index === steps.length - 1 ? finish() : (index++, show())))
    skip.addEventListener('click', finish)
    addEventListener('resize', place)
    addEventListener('scroll', place)

    document.body.append(overlay)
    show()
    next.focus()
  })
}
