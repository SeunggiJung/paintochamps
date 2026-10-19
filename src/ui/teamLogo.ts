import teamData from '../data/teams.json'

/** src/assets/logos 아래의 구단 로고 파일 (파일 이름 = 슬러그). 없는 구단은 도트 아이콘을 쓴다. */
const FILES = import.meta.glob('../assets/logos/*.{png,svg,webp,jpg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

const LOGOS = new Map<string, string>(
  Object.entries(FILES).map(([path, url]) => [path.split('/').pop()!.replace(/\.[^.]+$/, ''), url]),
)

/** 팀 id(org_N, intl_N)에 대응하는 슬러그. 구단이 아니면 null. */
function slugOf(teamId: string): string | null {
  const org = /^org_(\d+)$/.exec(teamId)
  if (org) return teamData.orgSlugs[Number(org[1])] ?? null
  const intl = /^intl_(\d+)$/.exec(teamId)
  if (intl) return teamData.intlSlugs[Number(intl[1])] ?? null
  return null
}

/** 로고 이미지 주소. 로고 파일이 없으면 null. */
export function teamLogoUrl(teamId: string): string | null {
  const slug = slugOf(teamId)
  return slug ? (LOGOS.get(slug) ?? null) : null
}
