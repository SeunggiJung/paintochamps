// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { buildHero, sceneUrls } from './titleScene.ts'

afterEach(() => {
  delete document.documentElement.dataset.motion
})

const four = {
  '../assets/title/scene-1-room.webp': 'a.webp',
  '../assets/title/scene-2-train.webp': 'b.webp',
  '../assets/title/scene-3-match.webp': 'c.webp',
  '../assets/title/scene-4-win.webp': 'd.webp',
}

describe('타이틀 장면', () => {
  it('이미지가 없거나 4장이 안 되면 null → 기존 도트 장면', () => {
    expect(sceneUrls({})).toBeNull()
    expect(sceneUrls({ '../assets/title/scene-1-room.webp': 'a.webp' })).toBeNull()
    const hero = buildHero(null)
    expect(hero.querySelector('svg')).not.toBeNull()
    expect(hero.querySelector('.hi-scene')).toBeNull()
  })

  it('4장이 모두 있으면 순서대로 장면 4개와 자막 4개', () => {
    const urls = sceneUrls(four)!
    expect(urls).toEqual(['a.webp', 'b.webp', 'c.webp', 'd.webp'])
    const hero = buildHero(urls)
    expect(hero.querySelectorAll('.hi-scene').length).toBe(4)
    expect([...hero.querySelectorAll('.hi-captions span')].map((s) => s.textContent)).toEqual(['방구석에서 열심히 게임하던 겜돌이가', '코치·팀원과 연습해서 실력을 키워', '대회에서 다 같이 겨루고', '월드 챔피언을 향해!'])
  })

  it('차분 모드에서는 효과를 만들지 않는다', () => {
    document.documentElement.dataset.motion = 'calm'
    const hero = buildHero(sceneUrls(four)!)
    expect(hero.querySelector('.hi-fx')).toBeNull()
  })

  it('보통 모드에서는 효과가 있다', () => {
    document.documentElement.dataset.motion = 'normal'
    expect(buildHero(sceneUrls(four)!).querySelector('.hi-fx')).not.toBeNull()
  })
})
