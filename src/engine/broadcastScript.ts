import lines from '../data/broadcast.json'
import type { FinalSeries } from './broadcast.ts'
import { createRng, mixSeed, type Rng } from './rng.ts'
import type { GenreId } from './types.ts'

/** 중계 장면 상태: 화면 가운데 큰 화면과 선수석이 어떻게 보일지 */
export type BroadcastMood = 'idle' | 'fight' | 'win' | 'lose'

export interface BroadcastStep {
  text: string
  /** 말하는 사람 (0: 캐스터, 1: 해설) */
  speaker: 0 | 1
  mood: BroadcastMood
  /** 이 멘트가 나올 때의 세트 스코어 [플레이어 팀, 상대] */
  score: [number, number]
  /** 몇 번째 세트인지 (시리즈 시작 전·후는 0) */
  set: number
}

/** 장르가 따르는 중계 멘트 묶음: AOS·RTS는 협곡 한타, FPS·격투는 라운드 교전 */
export const broadcastKind = (genre: GenreId): 'aos' | 'fps' => (genre === 'aos' || genre === 'rts' ? 'aos' : 'fps')

/** 같은 멘트가 한 시리즈에서 반복되지 않게 n개를 고른다 */
function pick(rng: Rng, list: readonly string[], n: number, used: Set<string>): string[] {
  const pool = list.filter((l) => !used.has(l))
  const out: string[] = []
  while (out.length < n && pool.length > 0) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  if (out.length < n) while (out.length < n) out.push(list[Math.floor(rng() * list.length)])
  out.forEach((l) => used.add(l))
  return out
}

/**
 * 결승 시리즈의 중계 대본. 같은 판(시드)에서는 늘 같은 멘트가 나온다.
 * 구성: 대회 소개 → (세트 시작 → 교전 멘트 2개 → 세트 결과 → 매치 포인트 안내)×세트 수 → 우승/준우승 멘트.
 */
export function broadcastScript(series: FinalSeries, genre: GenreId, seed: number, season: number): BroadcastStep[] {
  const rng = createRng(mixSeed(seed, season, 0xca57))
  const kind = lines.genres[broadcastKind(genre)]
  const finale = lines.finales[series.finale as keyof typeof lines.finales] ?? lines.finales.worlds
  const used = new Set<string>()
  const need = (series.bestOf + 1) / 2

  const steps: BroadcastStep[] = []
  let speaker: 0 | 1 = 0
  let score: [number, number] = [0, 0]
  const say = (text: string, mood: BroadcastMood, set: number) => {
    const fill = text
      .replaceAll('{me}', series.playerTeam)
      .replaceAll('{opp}', series.opponent)
      .replaceAll('{event}', series.eventName)
      .replaceAll('{set}', String(set))
      .replaceAll('{score}', `${score[0]} 대 ${score[1]}`)
    steps.push({ text: fill, speaker, mood, score: [...score], set })
    speaker = speaker === 0 ? 1 : 0
  }

  for (const t of pick(rng, finale.intro, finale.intro.length, used)) say(t, 'idle', 0)

  series.sets.forEach((won, i) => {
    const set = i + 1
    say(pick(rng, kind.setStart, 1, used)[0], 'idle', set)
    for (const t of pick(rng, kind.fight, 2, used)) say(t, 'fight', set)
    if (won) score = [score[0] + 1, score[1]]
    else score = [score[0], score[1] + 1]
    say(pick(rng, won ? kind.setWin : kind.setLose, 1, used)[0], won ? 'win' : 'lose', set)
    const last = i === series.sets.length - 1
    if (!last) {
      if (score[0] === need - 1 && score[1] === need - 1) say(pick(rng, kind.decider, 1, used)[0], 'idle', set)
      else if (score[0] === need - 1) say(pick(rng, kind.matchPointMe, 1, used)[0], 'idle', set)
      else if (score[1] === need - 1) say(pick(rng, kind.matchPointOpp, 1, used)[0], 'idle', set)
    }
  })

  const ending = series.playerWon ? finale.win : finale.lose
  for (const t of pick(rng, ending, ending.length, used)) say(t, series.playerWon ? 'win' : 'lose', 0)
  return steps
}
