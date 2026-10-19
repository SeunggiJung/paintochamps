import site from '../data/site.json'
import support from '../data/support.json'
import { h } from './dom.ts'
import type { Ctx } from './app.ts'

export type InfoPageId = 'about' | 'guide' | 'privacy' | 'terms' | 'contact'

interface Section {
  heading?: string
  paragraphs?: string[]
  list?: string[]
}
interface InfoPage {
  title: string
  sections: Section[]
}

/** 구단·리그·대회의 권리 고지. 소개·이용약관·문의 페이지와 타이틀 하단에 같은 문구를 쓴다. */
export const RIGHTS_NOTICE =
  '이 게임에 나오는 구단·리그·대회의 이름과 로고, 그리고 관련 상표와 저작권은 모두 각 구단과 리그, 권리자에게 있습니다. 이 게임은 팬이 만든 비공식 게임이며 해당 구단·리그·게임 제작사와 제휴, 후원, 승인 관계가 없습니다.'

const PAGES: Record<InfoPageId, InfoPage> = {
  about: {
    title: '서비스 소개',
    sections: [
      {
        paragraphs: [
          `「${site.name}」은 16세 겜돌이가 방구석 랭커에서 시작해 프로 계약, 월드 챔피언십 우승, 은퇴까지 걸어가는 웹 육성 시뮬레이션입니다. 설치와 로그인 없이 브라우저에서 한 판에 15~25분이면 끝나도록 만들었습니다.`,
          '능력치 뽑기로 시작하고, 시즌마다 훈련과 방침을 정한 뒤 이벤트와 이적, 계약 같은 굵직한 선택으로 커리어를 이끌어 갑니다. 같은 길은 한 번도 없고, 엔딩 11종과 업적을 모으는 재미가 있습니다.',
        ],
      },
      {
        heading: '이런 점이 특징이에요',
        list: [
          '장르(FPS·AOS)마다 능력치 비중이 달라 같은 훈련도 효율이 다릅니다.',
          '19~23세 성장기와 25세 이후의 에이징 커브로 "젊음 vs 경험"의 구도가 있습니다.',
          '2026년 기준 실제 리그 구조(AOS는 LCK, FPS는 VCT 퍼시픽)를 참고한 시즌 일정과 팀이 나옵니다.',
          '서버 없이 내 기기에만 저장되며, 로그인과 회원가입이 없습니다.',
        ],
      },
      {
        heading: '권리 안내',
        paragraphs: [RIGHTS_NOTICE, '권리자의 요청이 있으면 해당 이름과 이미지는 지체 없이 수정하거나 삭제합니다.'],
      },
      {
        heading: '운영',
        paragraphs: [`${site.operator}가 취미로 만들고 운영합니다. 광고를 달지 않으며, 마음이 닿는 분들만 타이틀 화면의 '개발자 밥사주기'로 응원할 수 있습니다.`],
      },
    ],
  },
  guide: {
    title: '게임 가이드',
    sections: [
      {
        heading: '게임의 흐름',
        paragraphs: [
          '1시즌은 1년이고 나이는 16세에서 시작해 30세 시즌이 끝나면 커리어가 끝납니다. 시즌이 시작될 때 계획(방침·이번 시즌 훈련·개인 레슨·장비와 시설 구매)을 세우면 시즌 중에는 "다음 턴 진행"만 눌러도 컨디션에 맞춰 훈련과 휴식이 자동으로 흘러갑니다.',
          '대회는 시즌 안의 정해진 시기에 열리고, 리그는 중간 순위와 최종 순위를 그때그때 알려 줍니다. 이벤트, 이적·콜업 제안, 연봉 협상 같은 큰 일에서는 직접 선택합니다.',
        ],
      },
      {
        heading: '능력치와 실력치',
        list: [
          '능력치 6개: 반응속도·정확도·집중력·판단력·멘탈·팀워크 (각 0~1000).',
          '장르 실력치는 능력치에 장르별 비중을 곱해 더한 값이고, 경기 승률을 정합니다. 이름 옆 ? 아이콘에서 자세한 설명을 볼 수 있어요.',
          '능력치 뽑기는 6개 합계가 600으로 같고 어디에 몰렸는지로 등급(N~UR)이 정해집니다. 등급은 초반의 발판일 뿐이에요. 다시 뽑기는 무제한이고, 목표 등급이 나올 때까지 자동으로 뽑는 버튼도 있습니다.',
        ],
      },
      {
        heading: '컨디션·돈·명성',
        list: [
          '컨디션은 훈련 성과를 가릅니다. 0~30 부진, 31~60 평범, 61~80 좋음, 81~100 완벽 순으로 효율이 높아집니다. 낮으면 슬럼프와 부상 위험이 있어요.',
          '돈은 장비·시설·레슨에 쓰고, 소속 단계가 높을수록 규모가 커집니다. 월급은 팀 소속일 때 매 턴 들어옵니다.',
          '명성은 스카우트와 이적 제안, 월급 협상에 영향을 줍니다.',
        ],
      },
      {
        heading: '나이와 성장',
        paragraphs: [
          '19~23세는 성장기라 훈련 효율이 높습니다. 25세부터는 훈련 효율이 줄고, 반응속도·정확도·집중력은 해마다 더 크게 떨어지는 대신 판단력·멘탈·팀워크는 경험으로 오릅니다. 후반에는 피지컬보다 경험으로 승부를 봐야 해요.',
        ],
      },
      {
        heading: '커리어 사다리',
        list: [
          '방구석 랭커(PC방 대회) → 아카데미 입단 테스트 또는 지역 대회 → 아마추어 팀 → 프로 2부(챌린저스) → 프로 1부 → 월드 챔피언십.',
          '실력과 성적이 충분하면 시즌 도중에도 위 단계 팀에서 제안이 와서 바로 승급할 수 있어요.',
          '프로 2부에서 실력이 충분하면 1부 팀의 콜업 제안이 오고, 순위가 하위권이면 강등될 수 있습니다.',
        ],
      },
      {
        heading: '팁',
        list: [
          '시즌 훈련을 고를 때 ★ 표시가 붙은 훈련이 지금 실력치를 가장 많이 올려 줍니다.',
          '코치가 훈련 교체를 제안하면 ★가 붙은 선택지가 지금 훈련보다 더 도움이 되는 거예요.',
          '컨디션 관리 방침은 가장 효율이 좋지만, 돈벌이 방침은 돈을 모으는 대신 성장이 느립니다.',
          '술자리·유흥·도박은 2회차부터 이벤트로 나오며 방탕 게이지가 쌓이면 부작용이 커집니다.',
        ],
      },
    ],
  },
  privacy: {
    title: '개인정보처리방침',
    sections: [
      {
        paragraphs: [`${site.name}(이하 "서비스")는 이용자의 개인정보를 수집하지 않습니다. 이 방침은 ${site.updated} 기준입니다.`],
      },
      {
        heading: '1. 수집하는 정보',
        list: [
          '회원가입과 로그인이 없으며 이름·연락처·위치 같은 개인정보를 서버로 수집하지 않습니다.',
          '게임 진행 정보(캐릭터 이름, 능력치, 기록, 도감, 설정)는 이용자 기기의 브라우저 저장소(localStorage)에만 저장되고 서버로 전송되지 않습니다. 브라우저 데이터를 지우면 함께 삭제됩니다.',
          '캐릭터 이름은 게임 안에서 보여 주기 위해 이용자가 직접 입력하는 값이며, 실명을 쓰지 않으셔도 됩니다.',
        ],
      },
      {
        heading: '2. 호스팅과 접속 기록',
        paragraphs: ['서비스는 정적 웹 호스팅(Cloudflare Pages)으로 제공됩니다. 호스팅 사업자는 서비스 제공과 보안을 위해 IP 주소, 접속 시각, 브라우저 정보 같은 일반적인 접속 기록을 자체 정책에 따라 처리할 수 있으며, 운영자는 이 기록으로 개인을 식별하지 않습니다.'],
      },
      {
        heading: '3. 쿠키와 광고',
        paragraphs: ['서비스는 광고 쿠키나 행태 분석 도구를 사용하지 않으며 광고를 게시하지 않습니다.'],
      },
      {
        heading: '4. 후원',
        paragraphs: ['타이틀 화면의 "개발자 밥사주기"는 계좌번호를 보여 주는 안내일 뿐이며, 서비스가 결제 정보나 입금자 정보를 수집하지 않습니다.'],
      },
      {
        heading: '5. 이용자의 권리',
        paragraphs: ['저장된 게임 데이터는 브라우저의 사이트 데이터 삭제로 언제든 지울 수 있습니다. 다른 기기와는 자동으로 동기화되지 않습니다.'],
      },
      {
        heading: '6. 아동의 이용',
        paragraphs: ['서비스는 개인정보를 받지 않으므로 연령 제한 없이 이용할 수 있습니다. 다만 게임 속 일부 소재(술자리·도박 이벤트 등)는 청소년에게 적합하지 않을 수 있습니다.'],
      },
      {
        heading: '7. 방침의 변경과 문의',
        paragraphs: ['방침이 바뀌면 이 페이지에 갱신 날짜와 함께 알립니다. 문의는 "문의" 페이지를 이용해 주세요.'],
      },
    ],
  },
  terms: {
    title: '이용약관',
    sections: [
      {
        paragraphs: [`이 약관은 ${site.name}(이하 "서비스")의 이용 조건을 정합니다. 서비스를 이용하면 약관에 동의한 것으로 봅니다. (${site.updated} 기준)`],
      },
      {
        heading: '제1조 서비스의 성격',
        paragraphs: ['서비스는 팬이 취미로 만든 비공식 게임이며 무료로 제공됩니다. 실제 구단·리그·선수·게임 제작사와 어떠한 제휴, 후원, 승인 관계도 없고 그들의 의견을 대변하지 않습니다. 게임 속 성적, 전력, 연봉, 사건은 모두 가상의 시뮬레이션이며 실제와 무관합니다.'],
      },
      {
        heading: '제2조 상표·저작권 및 권리 귀속',
        paragraphs: [
          RIGHTS_NOTICE,
          '서비스에 쓰인 구단·리그·대회의 명칭은 이야기의 배경을 설명하기 위한 것이며, 해당 권리자의 권리를 침해하려는 의도가 없습니다. 권리자가 수정이나 삭제를 요청하면 지체 없이 조치합니다.',
          '서비스의 프로그램과 직접 만든 도트 그림, 문구의 저작권은 운영자에게 있습니다.',
        ],
      },
      {
        heading: '제3조 이용자의 의무',
        list: ['서비스를 상업적으로 재판매하거나 무단으로 복제·배포하지 않습니다.', '서비스의 정상적인 운영을 방해하는 행위(비정상적 접근, 취약점 악용)를 하지 않습니다.', '문의나 신고를 할 때 타인의 개인정보를 포함하지 않습니다.'],
      },
      {
        heading: '제4조 저장 데이터',
        paragraphs: ['게임 데이터는 이용자 기기의 브라우저에만 저장됩니다. 브라우저 설정, 기기 변경, 업데이트(규칙·데이터 변경)로 저장 데이터가 사라지거나 이어할 수 없게 될 수 있으며, 운영자는 이에 대해 복구 책임을 지지 않습니다.'],
      },
      {
        heading: '제5조 서비스의 변경과 중단',
        paragraphs: ['운영자는 밸런스, 규칙, 콘텐츠를 예고 없이 바꾸거나 서비스를 중단할 수 있습니다. 변경 내용은 타이틀 화면의 업데이트 로그에서 알립니다.'],
      },
      {
        heading: '제6조 면책',
        paragraphs: ['서비스는 있는 그대로 제공되며, 오류·중단·데이터 손실로 인한 손해에 대해 법령이 허용하는 범위에서 책임을 지지 않습니다.'],
      },
      {
        heading: '제7조 후원',
        paragraphs: ['후원은 전적으로 자발적인 것이며 대가로 제공되는 기능이나 혜택이 없습니다. 후원금은 서비스 운영과 개발에 쓰입니다. 환불은 개별 문의를 받아 검토합니다.'],
      },
    ],
  },
  contact: {
    title: '문의',
    sections: [
      {
        paragraphs: ['오류 신고, 기능 제안, 이용 문의를 받습니다. 구단·리그·대회 이름이나 이미지에 대한 권리 관련 요청(수정·삭제)도 이곳으로 알려 주세요. 확인 즉시 조치합니다.'],
      },
      {
        heading: '문의 방법',
        list: [...(site.contactEmail ? [`이메일: ${site.contactEmail}`] : []), `GitHub 이슈: ${site.contactUrl}`],
      },
      {
        heading: '문의할 때 알려 주세요',
        list: ['브라우저와 기기 종류', '어떤 화면에서 무슨 일이 있었는지(가능하면 캐릭터 이름과 나이)', '권리 관련 문의라면 해당 권리자와 요청 내용'],
      },
      {
        heading: '후원',
        paragraphs: [support.account.trim() ? `서비스가 마음에 드셨다면 타이틀 화면 왼쪽 위의 '${support.title}'으로 응원해 주실 수 있어요.` : '후원 안내는 준비 중입니다.'],
      },
    ],
  },
}

export const INFO_PAGE_IDS: InfoPageId[] = ['about', 'guide', 'privacy', 'terms', 'contact']
export const infoTitle = (id: InfoPageId): string => PAGES[id].title

export function isInfoPageId(value: string): value is InfoPageId {
  return (INFO_PAGE_IDS as string[]).includes(value)
}

/** 정보 페이지 화면 (서비스 소개·게임 가이드·개인정보처리방침·이용약관·문의) */
export function infoScreen(ctx: Ctx, id: InfoPageId): HTMLElement {
  const page = PAGES[id]
  const nav = h(
    'nav',
    { class: 'info-nav', 'aria-label': '정보 페이지' },
    ...INFO_PAGE_IDS.map((p) => h('button', { class: `btn ghost small${p === id ? ' current' : ''}`, 'aria-current': p === id ? 'page' : null, onclick: () => ctx.toInfo(p) }, PAGES[p].title)),
  )
  return h(
    'main',
    { class: 'screen info' },
    h('button', { class: 'btn ghost small', onclick: () => ctx.toTitle() }, '← 타이틀로'),
    h('h2', {}, page.title),
    ...page.sections.map((s) =>
      h(
        'section',
        { class: 'info-section' },
        s.heading && h('h3', {}, s.heading),
        ...(s.paragraphs ?? []).map((t) => h('p', {}, t)),
        s.list && h('ul', { class: 'plain info-list' }, ...s.list.map((t) => h('li', {}, t))),
      ),
    ),
    h('p', { class: 'muted small rights' }, RIGHTS_NOTICE),
    nav,
  )
}

/** 타이틀 하단: 정보 페이지 링크와 권리 고지 */
export function infoFooter(ctx: Ctx): HTMLElement {
  return h(
    'footer',
    { class: 'info-footer' },
    h('div', { class: 'info-links' }, ...INFO_PAGE_IDS.map((p) => h('button', { class: 'link-btn', type: 'button', onclick: () => ctx.toInfo(p) }, PAGES[p].title))),
    h('p', { class: 'muted small rights' }, RIGHTS_NOTICE),
  )
}
