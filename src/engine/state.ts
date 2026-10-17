import rules from '../data/rules.json'
import type { SeasonPlan } from './plan.ts'
import { drawTrainingMenu } from './training.ts'
import type { Team } from './tournament.ts'
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
export type FacilityId = 'housing' | 'coach' | 'medic' | 'pr'
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
  /** scout: 승급에 따른 입단 제안(반드시 하나 고른다), transfer: 1부 이적 제안(거절 가능), callup: 프로 2부 → 1부 콜업 제안(거절하면 2부에 남는다) */
  kind: 'scout' | 'transfer' | 'callup'
  /** 제안한 팀이 뛰는 단계. 없으면 지금 단계(콜업은 프로 1부) */
  stage?: StageId
  offers: Offer[]
}

/** 순위표 한 줄 (리그의 중간·최종 순위 표시용) */
export interface StandingRow {
  name: string
  wins: number
  losses: number
  isPlayer: boolean
}

/** 이번 시즌에 시작해서 결과가 정해진 대회 한 건 */
export interface RunRecord {
  id: string
  name: string
  placement: number
  fieldSize: number
  /** 결과가 공개될 때 반영되는 보상 */
  fame: number
  money: number
  /** 최종 순서(0번이 1위). 상위 팀을 이어받는 뒤 대회가 쓴다 */
  order: Team[]
  /** 리그: 대회가 시작될 때 팀 전력과 플레이어 실력으로 본 기대 순위 (코치의 시즌 목표). 옛 세이브에는 없을 수 있다 */
  expected?: number
  /** 리그: 절반 시점의 순위표와 최종 순위표 */
  mid: StandingRow[] | null
  table: StandingRow[] | null
  /** 이 성적으로 얻은 진출권 문구 (예: '월드 챔피언십 진출') */
  advanced: string[]
  /** 어디까지 플레이어에게 알려 주었는지 */
  revealed: 'none' | 'mid' | 'end'
}

/** 이번 시즌의 대회 진행 상황. 대회는 기간이 시작될 때 결과가 정해지고, 절반·끝 시점에 공개된다. */
export interface SeasonRun {
  season: number
  /** 어느 시점(0~1)까지 진행했는지 */
  phase: number
  runs: RunRecord[]
  /** 진출하지 못해 열리지 않은 대회 id */
  skipped: string[]
  qualified: string[]
  points: number
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
  /** 시즌 활약 요약: 평점·리그 내 순위·수상 이름 (옛 세이브에는 없을 수 있다) */
  highlights?: { rating: number; rank: number; players: number; awards: string[] }
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
  /** 시설 투자 단계(숙소·개인 코치·재활 트레이너·홍보 에이전시). 돈 소비처. (옛 세이브에는 없을 수 있다 — facilityLevel) */
  facilities: Partial<Record<FacilityId, number>>
  /** 턴 끝 미니게임으로 얻은 다음 턴 훈련 효율 보너스 비율(0.05 = +5%). 턴이 지나면 0으로 돌아간다. (옛 세이브에는 없을 수 있다 — warmupBonus) */
  warmup: number
  /** 월급 협상으로 정해진 배율(1이면 팀의 제시액 그대로). 팀을 옮기면 1로 돌아간다. (옛 세이브에는 없을 수 있다) */
  salaryMult: number
  /** 월급 협상을 마지막으로 한 시즌 (시즌당 한 번). 계약을 새로 맺으면 0으로 돌아가 다시 협상할 수 있다. */
  negotiatedSeason: number
  /** 이번 시즌에 고를 수 있는 무작위 훈련 후보. 시즌이 시작될 때 뽑는다. (옛 세이브에는 없을 수 있다 — trainingMenuOf) */
  trainingMenu: ActionId[]
  /** 이번 시즌에 정한 훈련. 시즌 동안 이 훈련만 할 수 있고, 시즌이 시작되면 null로 돌아가 후보 중에서 다시 고른다. 코치가 교체를 제안하면 바뀐다. (옛 세이브에는 없을 수 있다) */
  seasonTraining: ActionId | null
  /** 코치가 훈련 교체를 제안한 마지막 시즌 (시즌당 한 번만 제안한다) */
  trainingSwapSeason: number
  /** 훈련 후보를 다시 뽑은 마지막 시즌 (시즌당 한 번만 다시 뽑을 수 있다). (옛 세이브에는 없을 수 있다) */
  trainingRerollSeason: number
  /** 시즌 계획(방침·개인 레슨). 시즌마다 다시 정하고, 정하기 전에는 지난 계획(또는 기본 계획)이 쓰인다. (옛 세이브에는 없을 수 있다 — planOf) */
  plan: SeasonPlan | null
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
  /** 이번 시즌 대회 진행 상황. 시즌이 바뀌면 새로 만든다 (옛 세이브에는 없을 수 있다). */
  seasonRun: SeasonRun | null
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
    facilities: {},
    warmup: 0,
    salaryMult: 1,
    negotiatedSeason: 0,
    trainingMenu: drawTrainingMenu(seed, 0, false),
    seasonTraining: null,
    trainingSwapSeason: 0,
    trainingRerollSeason: 0,
    plan: null,
    midOfferSeason: 0,
    seasonRun: null,
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
