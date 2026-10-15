import genres from '../data/genres.json'
import type { GenreId, StatKey } from '../engine/types.ts'
import { ACTIONS } from '../engine/turn.ts'
import type { ActionId } from '../engine/state.ts'
import { helpIcon } from './conditionHelp.ts'
import { h } from './dom.ts'
import { STAT_LABEL } from './labels.ts'

interface StatInfo {
  /** 한 줄 설명 */
  desc: string
  /** 어디에 도움이 되는지 */
  effect: string
  /** 나이·시험 같은 덧붙임 */
  note?: string
}

const AGE_NOTE = '25세부터 시즌마다 조금씩 떨어진다.'

const STAT_INFO: Record<StatKey, StatInfo> = {
  reaction: { desc: '자극에 바로 반응하는 속도.', effect: '교전 시작이나 빠른 대응이 필요한 장면에서 도움이 된다. 반응형 장르(FPS·격투)에서 비중이 크다.', note: AGE_NOTE },
  accuracy: { desc: '조준·컨트롤·입력의 정밀함.', effect: '교전 승률과 마무리 능력에 바로 이어진다. FPS·격투에서 특히 중요하다.', note: AGE_NOTE },
  focus: { desc: '긴 경기에서 실수를 줄이는 힘.', effect: '경기 후반이나 긴 시리즈에서 안정감을 준다. 동시에 여러 가지를 다뤄야 하는 RTS에서 비중이 크다.' },
  judgment: { desc: '상황을 읽고 운영을 선택하는 능력.', effect: 'AOS·RTS처럼 판단이 승부를 가르는 장르에서 가장 중요하다.', note: '나이가 들어도 떨어지지 않는다.' },
  mental: {
    desc: '큰 경기와 슬럼프에 버티는 힘.',
    effect: '결승·플레이오프 같은 큰 경기의 전력 보정(멘탈 500 기준 위·아래), 슬럼프 기간, 이벤트의 능력치 판정에 쓰인다.',
    note: '입단 시험의 면접 평가에도 쓰인다.',
  },
  teamwork: { desc: '소통과 역할 수행.', effect: '팀 경기에서의 호흡에 쓰인다. AOS에서 비중이 크다.', note: '입단 시험의 팀플 평가에도 쓰인다. 나이가 들어도 떨어지지 않는다.' },
}

/** 이 능력치가 주로(70 이상) 오르는 훈련 이름들 */
function mainTrainings(key: StatKey): string[] {
  return (Object.entries(ACTIONS) as [ActionId, (typeof ACTIONS)[ActionId]][])
    .filter(([, a]) => a.pool && (a.stats?.[key] ?? 0) >= 70)
    .map(([, a]) => a.name)
}

/** 능력치 이름 옆의 도움말 아이콘: 무슨 능력치인지, 어디에 도움이 되는지, 현재 장르에서의 비중, 주로 오르는 훈련 */
export function statHelp(key: StatKey, genre: GenreId): HTMLElement {
  const info = STAT_INFO[key]
  const g = genres[genre]
  const weight = g.weights[key]
  const trainings = mainTrainings(key)
  return helpIcon(
    `${STAT_LABEL[key]} 설명`,
    h('b', {}, STAT_LABEL[key]),
    h('p', { class: 'small' }, info.desc),
    h('p', { class: 'small' }, info.effect),
    h('p', { class: 'small' }, `${g.name} 실력치 비중 ${weight}%${weight >= 20 ? ' (핵심 능력치 ★)' : ''}`),
    trainings.length > 0 && h('p', { class: 'small' }, `주로 오르는 훈련: ${trainings.slice(0, 6).join(', ')}${trainings.length > 6 ? ' 등' : ''}`),
    info.note ? h('p', { class: 'small muted' }, info.note) : null,
  )
}

/** 능력치 이름 + 도움말 아이콘 (+ 핵심 능력치 별) */
export function statName(key: StatKey, genre: GenreId, star = false): HTMLElement {
  return h('span', { class: 'stat-name' }, STAT_LABEL[key], statHelp(key, genre), star && h('b', { title: '이 장르의 핵심 능력치' }, '★'))
}
