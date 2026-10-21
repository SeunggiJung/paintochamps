import { describe, expect, it } from 'vitest'
import { amateurTeams, makeOpponents, proOrgs, TIERS } from './field.ts'
import { createRng } from './rng.ts'
import { createInitialState, type GameState } from './state.ts'
import { offerTerms, salaryOf, teamBoost, teamProfile } from './teams.ts'
import { applyTurn } from './turn.ts'
import type { Stats } from './types.ts'

const stats = (v: number): Stats => ({ reaction: v, accuracy: v, focus: v, judgment: v, mental: v, teamwork: v })

function make(o: Partial<GameState> = {}, power = 600): GameState {
  const base = createInitialState({
    name: '테스트',
    genre: 'fps',
    mode: 'standard',
    seed: 21,
    gacha: { stats: stats(power), trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power },
  })
  return { ...base, age: 22, stage: 'pro2', team: proOrgs('fps')[0], turnInSeason: 0, trainingMenu: ['basics', 'aim_lab', 'video_review'], ...o }
}

describe('팀 정보', () => {
  it('같은 판·같은 시즌이면 팀 정보가 늘 같고, 시즌이 바뀌면 전력이 조금 달라진다', () => {
    const team = proOrgs('fps')[3]
    expect(teamProfile(21, 5, team, 'pro1')).toEqual(teamProfile(21, 5, team, 'pro1'))
    expect(teamProfile(21, 6, team, 'pro1')!.power).not.toBe(teamProfile(21, 5, team, 'pro1')!.power)
    expect(teamProfile(21, 5, team, 'basement')).toBeNull()
  })

  it('제안 화면에서 보여 주는 전력이 실제 리그 상대의 전력과 같다', () => {
    const teams = makeOpponents(createRng(1), 'orgs', 'pro1', 9, new Set(), 'fps', { seed: 21, season: 5 })
    for (const t of teams) expect(t.power).toBeCloseTo(teamProfile(21, 5, { id: t.id, name: t.name }, 'pro1')!.power)
  })

  it('지난 시즌 순위는 리그 팀 수 안에 들고, 전력이 높은 팀일수록 순위가 높다', () => {
    const profiles = proOrgs('fps').map((t) => teamProfile(21, 5, t, 'pro1')!)
    for (const p of profiles) {
      expect(p.lastRank).toBeGreaterThanOrEqual(1)
      expect(p.lastRank).toBeLessThanOrEqual(p.leagueSize)
    }
    const strongest = [...profiles].sort((a, b) => b.power - a.power)[0]
    expect(strongest.team.id).toBeDefined()
  })

  it('강한 팀일수록 월급을 더 주고, 상위 리그일수록 월급이 높다', () => {
    // 같은 리그에서는 재정이 넉넉한 구단이 월급을 더 준다
    const pro1 = proOrgs('fps').map((t) => teamProfile(21, 5, t, 'pro1')!).sort((a, b) => a.market.finance - b.market.finance)
    const avg = (xs: { salary: number }[]) => xs.reduce((a, b) => a + b.salary, 0) / xs.length
    expect(avg(pro1.slice(-4))).toBeGreaterThan(avg(pro1.slice(0, 4)))
    const am = teamProfile(21, 5, amateurTeams()[0], 'amateur_team')!
    const p2 = teamProfile(21, 5, proOrgs('fps')[0], 'pro2')!
    const p1 = teamProfile(21, 5, proOrgs('fps')[0], 'pro1')!
    expect(am.salary).toBeLessThan(p2.salary)
    expect(p2.salary).toBeLessThan(p1.salary)
  })

  it('제안 조건: 내 실력과의 차이, 지금 월급과의 차이, 대회 전력 보정이 나온다', () => {
    const s = make({ stage: 'pro1' })
    const offer = { team: proOrgs('fps')[5], perk: 'salary' as const }
    const t = offerTerms(s, offer)!
    expect(t.gap).toBeCloseTo(t.profile.power - 600)
    expect(t.salaryDelta).toBe(t.profile.salary - salaryOf(s))
    expect(Math.sign(t.boost)).toBe(Math.sign(t.profile.power - TIERS.pro1.mean) || 0)
  })
})

describe('월급', () => {
  it('팀에 소속되면 턴마다 월급이 들어오고, 무소속이면 들어오지 않는다', () => {
    const withTeam = make({ money: 100 })
    const salary = salaryOf(withTeam)
    expect(salary).toBeGreaterThan(0)
    const r = applyTurn(withTeam, [{ id: 'rest' }, { id: 'rest' }])
    if (!r.ok) throw new Error(r.error)
    expect(r.delta.money).toBeCloseTo(salary)
    const free = applyTurn({ ...withTeam, team: null, stage: 'local_cup' }, [{ id: 'rest' }, { id: 'rest' }])
    if (!free.ok) throw new Error(free.error)
    expect(free.delta.money).toBeCloseTo(0)
  })

  it('6개월 턴은 월급도 2배, 아카데미 연습생은 훈련비 정도만 받는다', () => {
    const std = make({ money: 100 })
    const tut = { ...std, mode: 'tutorial' as const }
    // 대회 상금이 섞이지 않게 대회 진행은 건너뛴다
    const a = applyTurn(std, [{ id: 'rest' }, { id: 'rest' }], undefined, false)
    const b = applyTurn(tut, [{ id: 'rest' }, { id: 'rest' }], undefined, false)
    if (!a.ok || !b.ok) throw new Error('turn failed')
    expect(b.delta.money).toBeCloseTo(a.delta.money * 2)
    const trainee = make({ stage: 'amateur_team', path: 'academy', team: { id: 'org_1', name: '실버폭스 아카데미' } })
    expect(salaryOf(trainee)).toBeLessThan(salaryOf({ ...trainee, path: 'open' }))
  })
})

describe('팀 강도와 대회 전력', () => {
  it('보정은 리그 전체 평균으로는 0에 가깝고, 팀이 강하면 +, 약하면 −다 (연습생·무소속은 0)', () => {
    const boosts = proOrgs('fps').map((t) => teamBoost(make({ stage: 'pro1', team: t })))
    expect(Math.max(...boosts)).toBeGreaterThan(0)
    expect(Math.min(...boosts)).toBeLessThan(0)
    // 시드를 바꿔 가며 평균을 내면 0에 가깝다 (평균적인 팀 기준이라 전체 난이도는 그대로)
    let sum = 0
    for (let seed = 0; seed < 60; seed++) for (const t of proOrgs('fps')) sum += teamBoost(make({ stage: 'pro1', team: t, seed }))
    expect(Math.abs(sum / (60 * proOrgs('fps').length))).toBeLessThan(2)
    expect(teamBoost(make({ team: null }))).toBe(0)
    expect(teamBoost(make({ stage: 'amateur_team', path: 'academy', team: proOrgs('fps')[0] }))).toBe(0)
  })
})
