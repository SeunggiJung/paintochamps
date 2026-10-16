import endingData from '../data/endings.json'
import type { EndingId, GameState } from './state.ts'

interface When {
  minWorldTitles?: number
  minWorldAppearances?: number
  minSeasonsInPro1?: number
  minTeamwork?: number
  minFame?: number
  stage?: string
  everPro?: boolean
  /** true면 지금 소속 팀이 1부에 처음 올라간 팀과 같아야 한다 */
  debutTeam?: boolean
  /** 이 모드에서는 달성할 수 없다 (튜토리얼에서 히든이 열리지 않게 한다) */
  notMode?: GameState['mode']
}

export interface EndingDef {
  id: EndingId
  name: string
  when: When
  /** 도감에 해금된 뒤 보여 주는 설명 */
  desc: string
  /** 아직 못 본 엔딩에 보여 주는 조건 힌트 */
  hint: string
  /** 엔딩 화면 문구. {name}은 선수 이름으로 바뀐다 */
  epilogue: string
}

export const ENDINGS = endingData.order as EndingDef[]

function matches(state: GameState, w: When): boolean {
  if (w.minWorldTitles !== undefined && state.worldTitles < w.minWorldTitles) return false
  if (w.minWorldAppearances !== undefined && state.worldAppearances < w.minWorldAppearances) return false
  if (w.minSeasonsInPro1 !== undefined && state.seasonsInPro1 < w.minSeasonsInPro1) return false
  if (w.minTeamwork !== undefined && state.stats.teamwork < w.minTeamwork) return false
  if (w.minFame !== undefined && state.fame < w.minFame) return false
  if (w.stage !== undefined && state.stage !== w.stage) return false
  if (w.notMode !== undefined && state.mode === w.notMode) return false
  if (w.everPro !== undefined && state.everPro !== w.everPro) return false
  if (w.debutTeam !== undefined && (state.team !== null && state.team.id === state.debutTeamId) !== w.debutTeam) return false
  return true
}

/** 지금 상태로 은퇴·종료했을 때의 엔딩. 표에서 위에 있는 조건이 우선한다. */
export function evaluateEnding(state: GameState): EndingId {
  const hit = ENDINGS.find((e) => matches(state, e.when))
  if (hit) return hit.id
  return state.everPro ? (endingData.fallbackIfPro as EndingId) : 'hobbyist'
}

export function endingName(id: EndingId): string {
  return ENDINGS.find((e) => e.id === id)!.name
}

export function endingDef(id: EndingId): EndingDef {
  return ENDINGS.find((e) => e.id === id)!
}
