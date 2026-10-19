import { describe, expect, it } from 'vitest'
import { INFO_PAGE_IDS, infoTitle, isInfoPageId, RIGHTS_NOTICE } from './infoPages.ts'

describe('정보 페이지', () => {
  it('서비스 소개·게임 가이드·개인정보처리방침·이용약관·문의 다섯 페이지가 있다', () => {
    expect(INFO_PAGE_IDS.map(infoTitle)).toEqual(['서비스 소개', '게임 가이드', '개인정보처리방침', '이용약관', '문의'])
  })

  it('주소 해시로 열 수 있는 페이지 id만 인정한다', () => {
    expect(isInfoPageId('terms')).toBe(true)
    expect(isInfoPageId('admin')).toBe(false)
    expect(isInfoPageId('')).toBe(false)
  })

  it('권리 고지는 구단·리그의 상표와 저작권, 비공식·무제휴를 밝힌다', () => {
    expect(RIGHTS_NOTICE).toContain('상표')
    expect(RIGHTS_NOTICE).toContain('저작권')
    expect(RIGHTS_NOTICE).toContain('비공식')
    expect(RIGHTS_NOTICE).toContain('제휴')
  })
})
