import type { Grade, StatKey } from '../engine/types.ts'
import type { ModeId } from '../engine/state.ts'

export const STAT_LABEL: Record<StatKey, string> = {
  reaction: '반응속도',
  accuracy: '정확도',
  focus: '집중력',
  judgment: '판단력',
  mental: '멘탈',
  teamwork: '팀워크',
}

export const GRADE_LABEL: Record<Grade, string> = { UR: 'UR', SSR: 'SSR', SR: 'SR', R: 'R', N: 'N' }

export const GRADE_COMMENT: Record<Grade, string> = {
  UR: '전설이 될 재능이다!',
  SSR: '엄청난 원석이다.',
  SR: '눈에 띄는 재능이다.',
  R: '괜찮은 출발이다.',
  N: '평범한 시작. 노력으로 뒤집자.',
}

export const MODE_INFO: Record<ModeId, { name: string; desc: string }> = {
  tutorial: { name: '튜토리얼', desc: '6개월씩 진행. 처음 하는 사람용. 위험한 행동은 막혀 있다.' },
  standard: { name: '표준', desc: '3개월씩 진행. 본 게임.' },
}
