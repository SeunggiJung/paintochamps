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
  precise: { name: '정밀', desc: '1개월씩 진행. 선택지가 많고 함정도 많다.' },
}

/** 행동 목록 묶음. 여기 없는 행동은 목록에 나오지 않으니 행동을 추가하면 여기도 넣는다. */
export const ACTION_GROUPS: { title: string; ids: string[] }[] = [
  { title: '훈련', ids: ['rank_practice', 'basics', 'video_review', 'team_scrim', 'private_lesson', 'overtrain', 'all_night_gaming'] },
  { title: '회복', ids: ['rest', 'meditation', 'rehab', 'counseling', 'hangout'] },
  { title: '돈·명성', ids: ['part_time', 'broadcast', 'donate'] },
  { title: '유혹', ids: ['drink', 'nightlife', 'gamble', 'impulse_shopping', 'community_flame'] },
]
