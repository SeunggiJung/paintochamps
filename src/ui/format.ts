/** 돈(만 원)을 읽기 쉽게: 12,500 → "1억 2,500만", 30000 → "3억", 320 → "320만" */
export function formatMoney(manwon: number): string {
  const v = Math.round(Math.abs(manwon))
  const sign = manwon < 0 ? '-' : ''
  if (v >= 10000) {
    const eok = Math.floor(v / 10000)
    const rest = v % 10000
    return `${sign}${eok.toLocaleString('ko-KR')}억${rest > 0 ? ` ${rest.toLocaleString('ko-KR')}만` : ''}`
  }
  return `${sign}${v.toLocaleString('ko-KR')}만`
}

/** 부호를 붙인 증감: +1,200만 / -30만 */
export function formatMoneyDelta(manwon: number): string {
  return `${manwon > 0 ? '+' : ''}${formatMoney(manwon)}`
}
