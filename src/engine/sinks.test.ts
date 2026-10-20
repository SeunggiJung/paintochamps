import { describe, expect, it } from 'vitest'
import { analystBonus, buyFacility, checkFacility, facilityCost, facilityEffectLines, facilityEffectText, FACILITY_IDS, mentalGuard, studioBoost, trainerGuard, trainerRecovery } from './facilities.ts'
import { createInitialState, type GameState } from './state.ts'
import { applyTurn } from './turn.ts'
import { acquireTeam, assetGrade, buyHome, homeBlocker, homeSlumpFactor, netWorth, ownerBlocker, HOMES } from './life.ts'
import { applyEffects } from './effects.ts'
import { earnedAchievements } from './achievements.ts'
import { isEligible, EVENTS } from './events.ts'
import { endingDef, evaluateEnding } from './endings.ts'
import { adOffersFor, adSlots, adsOf, dueShoots, finishAdOffers, performShoot, settleAds, shootTurn, signAd } from './ads.ts'
import { buyCosmetic, CATALOG, equipCosmetic, equippedOf, grantCosmetic, limitedStock, ownedCount, ownedIds, shopBlocker } from './cosmetics.ts'
import type { GenreId, Stats } from './types.ts'

const stats = (power: number): Stats => ({ reaction: power, accuracy: power, focus: power, judgment: power, mental: power, teamwork: power })

/** 프로 1부 국내 소속 상태 */
export function proState(genre: GenreId = 'fps', over: Partial<GameState> = {}): GameState {
  const base = createInitialState({ name: '테스트', genre, mode: 'standard', seed: 21, gacha: { stats: stats(700), trait: { id: 'quick_hands', name: '손이 빠름', stat: 'reaction' }, grade: 'R', power: 700 } })
  return { ...base, age: 22, stage: 'pro1', team: { id: 'fps_pro1_t1', name: 'T1' }, fame: 120, money: 10_000_000, season: 4, seasonTraining: 'basics', ...over }
}

describe('스태프 시설', () => {
  it('새 시설 4종이 있고 해외 전용이 아니며 가격은 소속 단계 배율을 따른다', () => {
    for (const id of ['analyst', 'mental', 'trainer', 'studio'] as const) {
      expect(FACILITY_IDS).toContain(id)
      expect(checkFacility(proState(), id)).toBeNull()
      expect(facilityCost(proState(), id)).toBeGreaterThan(facilityCost({ ...proState(), stage: 'pro2' }, id))
    }
  })

  it('레벨마다 효과가 커진다', () => {
    const s = (level: number, id: 'analyst' | 'mental' | 'trainer' | 'studio') => ({ ...proState(), facilities: { [id]: level } })
    expect(analystBonus(s(3, 'analyst'))).toBe(12)
    expect(mentalGuard(s(2, 'mental'))).toBeCloseTo(0.3)
    expect(trainerGuard(s(5, 'trainer'))).toBeCloseTo(0.6)
    expect(trainerRecovery(s(4, 'trainer'))).toBe(2)
    expect(studioBoost(s(5, 'studio'))).toBeCloseTo(2)
    expect(analystBonus(proState())).toBe(0)
  })

  it('시설 효과 문구와 한 줄 요약이 나온다', () => {
    expect(facilityEffectText('analyst', 2)).toContain('+8')
    expect(facilityEffectText('studio', 0)).toBe('효과 없음')
    expect(facilityEffectLines(proState())).toEqual([])
    const lines = facilityEffectLines({ ...proState(), facilities: { coach: 2, mental: 1 } })
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('개인 코치 Lv2')
  })

  it('스튜디오가 있으면 방송 수입이 늘고, 구매하면 단계가 오른다', () => {
    const base = proState()
    const gain = (s: GameState) => {
      const r = applyTurn(s, [{ id: 'broadcast' }, { id: 'rest' }])
      if (!r.ok) throw new Error(r.error)
      return r.delta.money
    }
    const plain = gain(base)
    const boosted = gain({ ...base, facilities: { studio: 5 } })
    expect(boosted).toBeGreaterThan(plain)
    const bought = buyFacility(base, 'studio')
    expect(bought.ok && bought.state.facilities.studio).toBe(1)
  })
})

describe('집과 자산', () => {
  it('프로 2부 이상에서 돈이 되면 3단계까지 집을 살 수 있다', () => {
    expect(homeBlocker(proState('fps', { stage: 'amateur_team' }))).not.toBeNull()
    expect(homeBlocker(proState('fps', { money: 100 }))).not.toBeNull()
    let s = proState('fps', { money: 10_000_000 })
    for (let i = 0; i < 3; i++) {
      const r = buyHome(s)
      expect(r.ok).toBe(true)
      if (r.ok) s = r.state
    }
    expect(s.home).toBe(3)
    expect(s.money).toBe(10_000_000 - HOMES.reduce((a, h) => a + h.price, 0))
    expect(homeBlocker(s)).not.toBeNull()
  })

  it('집이 있으면 슬럼프가 짧아진다', () => {
    const slump = (home: number) => applyEffects(proState('fps', { home }), { slumpMonths: 6 }).slumpMonths
    expect(slump(3)).toBeCloseTo(slump(0) * 0.7)
    expect(homeSlumpFactor(proState())).toBe(1)
  })

  it('순자산 등급은 돈과 집 가치로 정한다', () => {
    expect(assetGrade(proState('fps', { money: 100 }))).toBe('평범한 살림')
    expect(assetGrade(proState('fps', { money: 60_000 }))).toBe('부자')
    expect(assetGrade(proState('fps', { money: 210_000 }))).toBe('갑부')
    expect(assetGrade(proState('fps', { money: 600_000 }))).toBe('재벌')
    expect(netWorth(proState('fps', { money: 1000, home: 2 }))).toBe(1000 + (10_000 + 40_000) * 0.5)
  })

  it('집 3단계는 업적 효도, 가족 이벤트는 집이 있을 때만 나온다', () => {
    const done = { ...proState(), finished: 'legend' as const, home: 3, history: [] }
    expect(earnedAchievements(done)).toContain('filial')
    expect(earnedAchievements({ ...done, home: 2 })).not.toContain('filial')
    const family = EVENTS.filter((e) => e.when.home !== undefined && e.id !== 'family_slump_home')
    expect(family.length).toBeGreaterThanOrEqual(4)
    const base = proState('fps', { condition: 80, fame: 50 })
    for (const e of family) expect(isEligible({ ...base, home: 0 }, e)).toBe(false)
    expect(isEligible({ ...base, home: 3, team: { id: 'fps_pro1_t1', name: 'T1' } }, EVENTS.find((e) => e.id === 'family_housewarming')!)).toBe(true)
  })

  it('재산이 충분하면 끝난 커리어에서 구단을 인수해 구단주 엔딩을 본다', () => {
    const over = proState('fps', { money: 600_000, finished: 'legend', everPro: true })
    expect(ownerBlocker(over)).toBeNull()
    const owned = acquireTeam(over)
    expect(owned.finished).toBe('owner')
    expect(owned.owner).toBe(true)
    expect(owned.money).toBe(400_000)
    expect(endingDef('owner').name).toBe('구단주')
    expect(ownerBlocker(proState('fps', { money: 600_000, finished: null }))).not.toBeNull()
    expect(ownerBlocker({ ...over, money: 250_000 })).not.toBeNull()
    expect(evaluateEnding(proState('fps', { money: 600_000 }))).not.toBe('owner')
  })
})

describe('광고 계약', () => {
  const star = (over: Partial<GameState> = {}) => proState('fps', { fame: 130, ...over })

  it('프로 1부 소속에 명성이 해금 기준을 넘으면 슬롯 수만큼 제안이 오고, 스튜디오가 해금 명성을 낮춘다', () => {
    expect(adOffersFor(proState('fps', { fame: 40 }))).toEqual([])
    expect(adOffersFor(star({ fame: 130 })).map((o) => o.type)).toEqual(['season', 'single'])
    expect(adOffersFor(star({ fame: 250 })).map((o) => o.type)).toEqual(['season', 'single', 'world'])
    expect(adOffersFor(proState('fps', { stage: 'pro2', fame: 130 }))).toEqual([])
    expect(adSlots(55)).toBe(0)
    expect(adSlots(55, 5)).toBe(1)
    expect(adOffersFor(proState('fps', { fame: 55, facilities: { studio: 1 } }))).toHaveLength(1)
    // 같은 판·같은 시즌이면 같은 제안이고, 정한 시즌에는 다시 오지 않는다
    expect(adOffersFor(star())).toEqual(adOffersFor(star()))
    expect(adOffersFor(finishAdOffers(star()))).toEqual([])
  })

  it('가상 브랜드가 붙고 수입이 시즌 모델 > 단발 순이다', () => {
    const [season, single] = adOffersFor(star())
    expect(season.brand.length).toBeGreaterThan(0)
    expect(season.category.length).toBeGreaterThan(0)
    expect(season.base).toBeGreaterThan(single.base)
  })

  it('계약하면 일정에 맞춰 촬영하고 돈·명성을 받고 컨디션이 준다', () => {
    let s = star({ turnInSeason: 0 })
    const [season, single] = adOffersFor(s)
    s = signAd(signAd(s, season), single)
    expect(adsOf(s)).toHaveLength(2)
    expect(dueShoots(s)).toHaveLength(0)
    // 표준 모드 4턴: 시즌 모델은 1·3턴째, 단발은 2턴째
    expect(shootTurn('season', 0, 'standard')).toBe(1)
    expect(shootTurn('season', 1, 'standard')).toBe(3)
    expect(shootTurn('single', 0, 'standard')).toBe(2)
    s = { ...s, turnInSeason: 1, condition: 80 }
    const due = dueShoots(s)
    expect(due.map((d) => d.contract.type)).toEqual(['season'])
    const r = performShoot(s, due[0].contract.id)
    expect(r.paid).toBe(Math.round(season.base * 0.375))
    expect(r.state.money).toBe(s.money + r.paid)
    expect(r.state.condition).toBe(75)
    expect(r.state.fame).toBe(s.fame + 1)
    expect(dueShoots(r.state)).toHaveLength(0)
    expect(performShoot({ ...r.state, turnInSeason: 3 }, due[0].contract.id).paid).toBe(r.paid)
  })

  it('결산 때 시즌 모델은 성적이 괜찮고 촬영을 다 마쳤을 때만 잔금, 월드 특약은 4강 이상일 때 보너스를 받는다', () => {
    let s = star({ fame: 250, turnInSeason: 0 })
    for (const o of adOffersFor(s)) s = signAd(s, o)
    const shootAll = (st: GameState) => {
      let cur = { ...st, turnInSeason: 4 }
      for (let i = 0; i < 3; i++) for (const d of dueShoots(cur)) cur = performShoot(cur, d.contract.id).state
      return cur
    }
    const done = shootAll(s)
    const good = settleAds(done, { worldPlace: 1, placeRatio: 0.3 })
    const bad = settleAds(done, { worldPlace: 9, placeRatio: 0.9 })
    expect(good.paid).toBeGreaterThan(bad.paid)
    expect(bad.paid).toBe(0)
    expect(good.state.ads).toEqual([])
    expect(good.state.adEarned).toBeGreaterThan(good.paid)
    expect(good.notes.some((n) => n.includes('성과 보너스'))).toBe(true)
    expect(settleAds(s, { worldPlace: 1, placeRatio: 0.3 }).paid).toBe(0)
  })
})

describe('꾸미기와 상점', () => {
  it('기본 상품은 늘 가지고 있고, 상품은 칸마다 있으며 가격은 0.05~3억이다', () => {
    const s = proState()
    expect(ownedIds(s)).toEqual(expect.arrayContaining(['room_basic', 'desk_none', 'outfit_basic', 'badge_none']))
    expect(equippedOf(s).room).toBe('room_basic')
    for (const slot of ['room', 'desk', 'outfit', 'badge'] as const) expect(CATALOG.filter((c) => c.slot === slot).length).toBeGreaterThanOrEqual(5)
    const priced = CATALOG.filter((c) => c.price > 0)
    expect(Math.min(...priced.map((c) => c.price))).toBeGreaterThanOrEqual(300)
    expect(Math.max(...priced.map((c) => c.price))).toBeLessThanOrEqual(30_000)
    expect(new Set(CATALOG.map((c) => c.id)).size).toBe(CATALOG.length)
  })

  it('상점에서 사면 돈이 줄고 장착할 수 있다. 돈 부족·보유·콜라보 상품은 살 수 없다', () => {
    const s = proState('fps', { money: 10_000 })
    expect(shopBlocker(s, 'desk_plant')).toBeNull()
    const r = buyCosmetic(s, 'desk_plant')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.money).toBe(10_000 - 500)
    expect(shopBlocker(r.state, 'desk_plant')).toBe('이미 가지고 있다')
    expect(equippedOf(equipCosmetic(r.state, 'desk_plant')).desk).toBe('desk_plant')
    expect(equippedOf(equipCosmetic(s, 'desk_plant')).desk).toBe('desk_none') // 없는 것은 장착되지 않는다
    expect(shopBlocker(proState('fps', { money: 100 }), 'desk_lamp')).toBe('돈이 부족하다')
    expect(shopBlocker(s, 'badge_fan')).toContain('콜라보')
  })

  it('한정 상품은 시즌마다 정해진 4개 안에서만 살 수 있고 시즌이 바뀌면 입고가 바뀐다', () => {
    const s = proState('fps', { money: 10_000_000, season: 3 })
    const stock = limitedStock(s)
    expect(stock).toHaveLength(4)
    expect(limitedStock(s).map((c) => c.id)).toEqual(stock.map((c) => c.id))
    const all = CATALOG.filter((c) => c.limited)
    const out = all.find((c) => !stock.some((x) => x.id === c.id))
    expect(out).toBeDefined()
    expect(shopBlocker(s, out!.id)).toContain('입고')
    expect(shopBlocker(s, stock[0].id)).toBeNull()
    const seasons = Array.from({ length: 6 }, (_, i) => limitedStock({ ...s, season: i + 1 }).map((c) => c.id).join())
    expect(new Set(seasons).size).toBeGreaterThan(1)
  })

  it('콜라보 이벤트가 상품을 지급하고 중복 지급은 없다', () => {
    const base = proState()
    const fx = applyEffects(base, { money: 100, grant: 'badge_fan' })
    expect(ownedIds(fx)).toContain('badge_fan')
    expect(ownedIds(applyEffects(fx, { grant: 'badge_fan' })).filter((id) => id === 'badge_fan')).toHaveLength(1)
    expect(grantCosmetic(base, 'nope')).toBe(base)
    const collabEvents = EVENTS.filter((e) => e.id.startsWith('collab_'))
    expect(collabEvents.length).toBeGreaterThanOrEqual(6)
    const granted = collabEvents.flatMap((e) => e.choices.map((c) => c.effects?.grant)).filter(Boolean)
    expect(granted.length).toBeGreaterThanOrEqual(4)
    for (const id of granted) expect(CATALOG.find((c) => c.id === id)?.collab).toBe(true)
  })

  it('상품을 모으면 업적이 쌓인다', () => {
    const limited = CATALOG.filter((c) => c.limited).slice(0, 3).map((c) => c.id)
    const many = CATALOG.filter((c) => c.price > 0 && !c.limited && !c.collab).slice(0, 12).map((c) => c.id)
    const done = { ...proState(), finished: 'legend' as const, history: [] }
    expect(earnedAchievements(done)).not.toContain('collector')
    const full = { ...done, owned: [...many, ...limited] }
    expect(ownedCount(full)).toBeGreaterThanOrEqual(12)
    expect(earnedAchievements(full)).toEqual(expect.arrayContaining(['collector', 'limited_hunter']))
  })
})
