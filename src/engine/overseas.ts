import { pickTeams } from './field.ts'
import { domesticLeagueId, isOverseas, leagueDef, leagueIdOf, leaguesOf, OVERSEAS_RULES, type LeagueId } from './leagues.ts'
import { genrePower } from './power.ts'
import { shuffled, type Rng } from './rng.ts'
import type { GameState, Offer, PendingOffers } from './state.ts'

/**
 * 해외 이적. 국내 1부 선수가 해외 리그의 제안을 받거나, 해외 선수가 다른 해외 리그·국내로 돌아오는 제안을 받는다.
 * 리그를 옮기면 적응도가 낮게 시작해서 시즌마다 오른다(leagues.ts). 시즌당 한 번만 옮길 수 있다.
 */

/** 해외(또는 복귀) 이적 제안을 받을 수 없는 이유. 받을 수 있으면 null. */
export function overseasBlocker(state: GameState): string | null {
  if (state.finished) return '이미 끝난 커리어다'
  if (state.stage !== 'pro1' || !state.team) return '프로 1부 선수만 다른 리그의 제안을 받는다'
  if (state.fame < OVERSEAS_RULES.minFame) return `명성이 ${OVERSEAS_RULES.minFame} 이상이어야 다른 리그가 관심을 보인다`
  if (!isOverseas(state) && state.age > OVERSEAS_RULES.maxAge) return `${OVERSEAS_RULES.maxAge}세가 넘으면 해외 구단이 영입을 꺼린다`
  if ((state.leagueMoveSeason ?? 0) === state.season) return '이번 시즌에 이미 리그를 옮겼다'
  return null
}

/** 지금 소속 리그가 아닌 후보 리그 중 내 실력이 기준을 넘는 곳. 국내 복귀는 실력 기준이 없다. */
export function interestedLeagues(state: GameState) {
  const mine = leagueIdOf(state)
  const power = genrePower(state.stats, state.genre)
  return leaguesOf(state.genre).filter((l) => l.id !== mine && (l.domestic ? isOverseas(state) : l.transferable) && power >= l.minPower)
}

/**
 * 해외(복귀) 제안: 서로 다른 리그의 팀 한 곳씩, 최대 3곳. 관심을 보인 리그가 없으면 null.
 * 제안 카드는 국내 이적과 따로 보여 준다(kind: 'overseas').
 */
export function makeOverseasOffers(state: GameState, rng: Rng): PendingOffers | null {
  if (overseasBlocker(state)) return null
  const leagues: LeagueId[] = shuffled(rng, interestedLeagues(state).map((l) => l.id)).slice(0, 3)
  const offers: Offer[] = leagues.flatMap((league) => {
    const team = pickTeams(rng, 'pro1', 1, new Set(state.team ? [state.team.id] : []), state.genre, league)[0]
    return team ? [{ team, perk: rng() < 0.5 ? ('salary' as const) : ('playtime' as const), league }] : []
  })
  return offers.length > 0 ? { kind: 'overseas', offers } : null
}

/** 리그를 옮기는 제안인가 (같은 리그의 다른 팀으로 가는 이적이 아니라) */
export function movesLeague(state: GameState, offer: Offer): boolean {
  return !!offer.league && offer.league !== leagueIdOf(state)
}

/** 옮겨 가는 리그에서 시작할 적응도 (국내 복귀는 100) */
export function adaptationAfterMove(genre: GameState['genre'], league: LeagueId): number {
  return league === domesticLeagueId(genre) ? 100 : leagueDef(league).adaptStart
}
