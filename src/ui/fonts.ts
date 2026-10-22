import type { FontId } from './prefs.ts'

const SYSTEM = "system-ui, -apple-system, 'Segoe UI', 'Malgun Gothic', sans-serif"

export const FONT_STACK: Record<FontId, string> = {
  pretendard: `'Pretendard Variable', ${SYSTEM}`,
  jua: `'Jua', ${SYSTEM}`,
  galmuri: `'Galmuri11', ${SYSTEM}`,
}

// 외부 요청 없이 번들에 포함된 글자만 쓴다 (개인정보처리방침: 서버로 전송하지 않는다)
const LOADERS: Record<FontId, () => Promise<unknown>> = {
  pretendard: () => import('pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'),
  jua: () => import('@fontsource/jua/index.css'),
  galmuri: () => import('galmuri/dist/galmuri.css'),
}

const loaded = new Map<FontId, Promise<void>>()

/** 글자 CSS를 한 번만 불러온다. 실패해도 시스템 글자로 남을 뿐 거절(reject)하지 않는다. */
export function loadFont(id: FontId): Promise<void> {
  let p = loaded.get(id)
  if (!p) {
    p = LOADERS[id]().then(
      () => undefined,
      () => undefined,
    )
    loaded.set(id, p)
  }
  return p
}
