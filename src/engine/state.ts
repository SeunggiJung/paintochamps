import rules from '../data/rules.json'
import { drawTrainingMenu } from './training.ts'
import type { GachaResult, GenreId, Stats, Trait } from './types.ts'

export type ModeId = 'tutorial' | 'standard' | 'precise'
export type ActionId =
  | 'rank_practice'
  | 'basics'
  | 'video_review'
  | 'team_scrim'
  | 'aim_lab'
  | 'reflex_drill'
  | 'strategy_study'
  | 'comms_practice'
  | 'concentration'
  | 'mental_training'
  | 'vs_pros'
  | 'sparring'
  | 'marathon_match'
  | 'speed_challenge'
  | 'combo_shooting'
  | 'team_camp'
  | 'precision_drill'
  | 'tactical_shooting'
  | 'replay_review'
  | 'tactics_lab'
  | 'mental_camp'
  | 'rest'
  | 'part_time'
  | 'broadcast'
  | 'hangout'
  | 'drink'
  | 'nightlife'
  | 'gamble'
  | 'donate'
  | 'private_lesson'
  | 'overtrain'
  | 'meditation'
  | 'impulse_shopping'
  | 'community_flame'
  | 'all_night_gaming'
  | 'rehab'
  | 'counseling'
export type EquipmentId = 'keyboard' | 'mouse' | 'monitor' | 'pc'
/** 초반 루트: rookie 아직 갈림길 전, academy 정석(아카데미 출신), open 우회(공개 테스트·스카우트) */
export type PathId = 'rookie' | 'academy' | 'open'
export type StageId = 'basement' | 'local_cup' | 'amateur_team' | 'pro2' | 'pro1'
export type EndingId =
  | 'hidden_loyal'
  | 'legend'
  | 'world_finalist'
  | 'pro1_regular'
  | 'pro2_veteran'
  | 'coach'
  | 'streamer'
  | 'hobbyist'

export interface TeamRef {
  id: string
  name: string
}

/** 스카우트·이적 제안 한 건. perk는 연봉(돈) 또는 출전 기회(명성) 중 무엇을 받느냐다. */
export interface Offer {
  team: TeamRef
  perk: 'salary' | 'playtime'
}

export interface PendingOffers {
  /** scout: 승급에 따른 입단 제안(반드시 하나 고른다), transfer: 1부 이적 제안(거절 가능) */
  kind: 'scout' | 'transfer'
  offers: Offer[]
}

export interface EventRecord {
  id: string
  name: string
  /** 1부터 시작하는 최종 순위 */
  placement: number
  fieldSize: number
}

export interface SeasonRecord {
  season: number
  age: number
  stage: StageId
  events: EventRecord[]
}

export interface GameState {
  saveVersion: 1
  /** 대회 상대·결과를 만드는 시드. 시즌마다 이 값과 시즌 번호로 난수를 새로 만든다. */
  seed: number
  name: string
  genre: GenreId
  mode: ModeId
  /** 나이 (16~30) */
  age: number
  /** 1부터 시작하는 시즌 번호 */
  season: number
  /** 이번 시즌에서 지금까지 진행한 턴 수 */
  turnInSeason: number
  /** 전체 진행 턴 수 */
  turnCount: number
  stats: Stats
  /** 이번 시즌을 시작할 때의 능력치. 시즌 결산 화면이 변동폭을 보여 주는 기준이다. (옛 저장에는 없을 수 있다) */
  seasonStartStats: Stats
  trait: Trait
  condition: number
  /** 만 원 */
  money: number
  fame: number
  /** 장비 단계 (0~3) */
  equipment: Record<EquipmentId, number>
  /** 마지막으로 장비를 산 턴(turnCount). 한 턴에 하나만 살 수 있다. */
  equipBoughtTurn: number
  /** 이번 턴에 나온 무작위 훈련 후보. 턴이 끝날 때마다 새로 뽑는다. (옛 세이브에는 없을 수 있다 — trainingMenuOf) */
  trainingMenu: ActionId[]
  /** 초반 루트. 옛 세이브에는 없을 수 있다 (routes.ts가 기본값을 채운다) */
  path: PathId
  /** PC방 대회에 나간 횟수 */
  cafeAttempts: number
  /** PC방 대회 상위 성적으로 아카데미 입단 테스트 초대를 받았는지 */
  academyInvite: boolean
  /** 아카데미 입단 테스트에서 떨어져 재도전한 횟수 */
  academyRetries: number
  /** 이번 시즌 결산에서 볼 시험의 준비 선택 (prep id) */
  testPrep: string | null
  /** 시즌 중간 제안을 마지막으로 받은 시즌. 시즌당 한 번만 온다. */
  midOfferSeason: number

  stage: StageId
  /** 소속 팀. 아마추어 팀 단계부터 생긴다. */
  team: TeamRef | null
  /** 프로 1부에 처음 올라갔을 때의 팀 (히든 엔딩 조건) */
  debutTeamId: string | null
  /** 프로 2부 이상에 오른 적이 있는지 */
  everPro: boolean
  seasonsInPro1: number
  worldAppearances: number
  worldTitles: number
  /** 슬럼프가 남은 개월 수. 0보다 크면 성장이 절반이 된다. */
  slumpMonths: number
  /** 부상으로 쉬어야 하는 개월 수. 0보다 크면 휴식·재활만 할 수 있다. */
  injuredMonths: number
  /** 방탕 게이지. 술·유흥·도박으로 오르고 쉬면 내려간다. 높을수록 부작용이 잦고, 일정 수준을 넘으면 중독 패널티가 붙는다. */
  vice: number
  pendingOffers: PendingOffers | null
  /** 플레이어가 직접 지은 PC방 대회 팀 이름 (처음 출전할 때 정한다) */
  cafeTeamName: string | null
  /** 능력치 뽑기를 다시 뽑은 횟수. 엔딩·게임 오버에서 보여 준다. */
  rerolls: number
  finished: EndingId | null
  history: SeasonRecord[]
}

export interface NewGameOptions {
  name: string
  genre: GenreId
  mode: ModeId
  gacha: GachaResult
  seed: number
  /** 다시 뽑은 횟수 (기본 0) */
  rerolls?: number
}

export function createInitialState({ name, genre, mode, gacha, seed, rerolls = 0 }: NewGameOptions): GameState {
  return {
    saveVersion: 1,
    seed,
    name,
    genre,
    mode,
    age: rules.startAge,
    season: 1,
    turnInSeason: 0,
    turnCount: 0,
    stats: { ...gacha.stats },
    seasonStartStats: { ...gacha.stats },
    trait: gacha.trait,
    condition: rules.start.condition,
    money: rules.start.money,
    fame: rules.start.fame,
    equipment: { keyboard: 0, mouse: 0, monitor: 0, pc: 0 },
    equipBoughtTurn: -1,
    trainingMenu: drawTrainingMenu(seed, 0, false),
    midOfferSeason: 0,
    path: 'rookie',
    cafeAttempts: 0,
    academyInvite: false,
    academyRetries: 0,
    testPrep: null,
    stage: 'basement',
    team: null,
    debutTeamId: null,
    everPro: false,
    seasonsInPro1: 0,
    worldAppearances: 0,
    worldTitles: 0,
    slumpMonths: 0,
    injuredMonths: 0,
    vice: 0,
    pendingOffers: null,
    cafeTeamName: null,
    rerolls,
    finished: null,
    history: [],
  }
}
