# 인수인계: 2026-10-25 외부 리뷰 정리 + P0 구현 (새 세션용)

새 세션이 가장 먼저 읽는 문서는 `CLAUDE.md`(§0)이고, 그다음 이 문서다. 리뷰 원문의 분류·우선순위는 `docs/exp-review-2026-10-25.md`에 있다. 앞선 흐름은 `docs/handover-2026-10-22-wrapup.md`(UI 리디자인·타이틀 이미지).

## 0. 지금 상태 (한 줄)

외부 플레이 리뷰(`claude-exp.pdf`)를 분류하고 **P0 5개 + 도감 힌트 + 미리보기 이미지**를 구현해 `master`에 푸시했다. 남은 것은 사용자 자료가 필요한 **송금 링크·QR**, 사용자 결정이 필요한 **구단명·로고 방침**, 그리고 **P1 6개**다.

**2026-10-26 갱신**: P1 7개와 아카데미 초대 구단 표시, 후원 QR을 `e23d0d8`까지 푸시·배포(번들 `index-BAER_u9R.js` 일치)하고 노션 작업일지·메인·기획서를 갱신했다. 사용자가 새 UI를 보고 "좋다"고 확인했다. 다음은 P2(`docs/exp-review-2026-10-25.md` §5).

**P2 진행(2026-10-26)**: 사용자가 P2 중 1(컨디션 경고)·2(훈련 균형 경고)·4(한 줄 평 확대)를 먼저 하자고 해서 구현했다(CLAUDE.md §6 "외부 리뷰 P2 반영"). 남은 P2: 3 업적 진행률·근접 알림(못 본 항목 조건 숨김 방침과 충돌 — 진행률을 힌트 쓴 업적·달성 중인 업적에만 보일지 사용자 결정 필요), 5 상점 편의 확대(품목마다 밸런스 리포트), 6 초반 안전망(직접 플레이로 가혹한지 먼저 확인), 7 경로 주소·정적 페이지(도메인 연결 때).

## 1. 오늘 한 일

- **리뷰 분석**: PDF 13쪽을 읽고 코드와 대조해 좋을 것/신중할 것/미룰 것으로 나누고 우선순위를 정했다(`docs/exp-review-2026-10-25.md`).
- **P0 구현**: 메타 태그·`robots.txt`·`sitemap.xml`·`og.png`, 첫 방문 업데이트 로그 숨김과 `N` 배지, 엔딩 후원 카드, 확인 팝업 중복 방지와 엔딩 진입 시 팝업 정리, 서비스 소개 엔딩 수 자동 표기.
- **업적 상점 힌트**(사용자 추가 요청): `엔딩 힌트`·`업적 힌트`(`shop.json`, 토큰 3, 최대 5장). 도감에서 못 본 항목을 눌러 한 장 쓰면 조건(`desc`)이 열리고 `MetaSave.hints`에 `ending:<id>`·`achievement:<id>`로 저장(`storage.ts` `useHint`·`hasHint`, `codex.ts`). 테스트 1개 추가(548개).
- **링크 미리보기 이미지**: 우승 장면(`title-cellcog-4-win.png`)을 사용자가 1200×630 PNG로 변환해 `public/og.png`로 넣었다(1.5MB).
- `graphify`(코드·문서 지식 그래프)를 설치해 `graphify-out/`을 만들었다(§5).

## 2. 새로 생긴 것의 위치

- `src/ui/updateLog.ts`: `SEEN_KEY`(`paintochamps:updatelog:seen`), `hasUnseenUpdate`, `maybeShowUpdateLog`(첫 방문이면 조용히 본 것으로 기록).
- `src/ui/support.ts`: `openSupportSheet`(타이틀 버튼·엔딩 카드 공용), `endingSupportCard`. 문구는 `src/data/support.json`(`endingMessage`).
- `src/ui/confirm.ts`: `confirmSheet`가 이미 떠 있으면 끝나지 않는 Promise를 돌려준다, `dismissAllSheets`(엔딩 화면 진입 때 호출).
- `src/ui/codex.ts`: 잠긴 항목이 버튼이고 힌트 시트를 연다. `src/save/storage.ts`: `HintKind`·`useHint`.
- `index.html`: description·og·twitter·canonical. 주소는 모두 `https://paintochamps.tmdrl8336.workers.dev/`.

## 3. 남은 일 (이어서 할 때 바로)

**사용자 자료·결정이 필요한 것 (먼저 물어본다)**
1. ✅ **송금 링크·QR(2026-10-26 완료)**: 사용자가 `docs/images/qr.jpg`를 줬고(토스 송금 딥링크 `supertoss://send?...`, 계좌는 `support.json`과 같다) `src/assets/support/qr.jpg`로 옮겨 후원 팝업에 넣었다. 컴퓨터는 QR(CSS로 여백을 잘라 표시, `.qr-crop`), 휴대폰은 '토스로 송금하기' 버튼(`support.json` `transferLink`). 이 항목의 나머지(개인 계좌·GitHub 주소 노출 분리)는 아직 사용자 결정 대기. (원래 설명:) 토스 송금 링크나 QR 이미지를 받으면 `support.json`에 `link`(및 QR은 `src/assets`나 `public`)을 추가하고 `openSupportSheet`에 '송금하기' 버튼·QR을 붙인다. 계좌 정보 공개 범위(개인 계좌·GitHub 주소 노출)도 이때 후원 전용 계좌·링크로 분리할지 묻는다.
2. **구단명·로고 방침**(원본의 최대 리스크): 1 현행 유지 / 2 로고만 제거 / 3 가상 구단. 후원·홍보를 넓히기 전에 사용자가 정한다. 정해지면 `CLAUDE.md` §3-4와 정보 페이지 권리 고지를 함께 고친다.
3. **도메인**: 사용자가 `paintochamps.kro.kr`을 설정 중인 듯하다(`public/도메인.png`는 캡처, 추적하지 않음). 연결되면 `index.html`의 `canonical`·`og:url`·`og:image`·`twitter:image`, `robots.txt`·`sitemap.xml`의 주소를 새 도메인으로 바꾸고 Cloudflare 설정과 맞는지 확인한다.
4. **og 이미지 용량**: `og.png`가 1.5MB다. 미리보기가 느리면 JPG 품질 85(`og.jpg`)로 바꾸고 `index.html` 주소 2곳을 고친다(선택).

**P1 — 2026-10-26에 7개 모두 구현 완료** (아래 번호 순서. 직접 플레이 확인과 푸시만 남음)
1. ✅(2026-10-26 완료, `engine/guidance.ts` `nextGoal`·`seasonScreen.ts` `goalCard`) 결산의 상위권 길잡이: 다음 단계 조건·상위 팀 전력 대비 내 실력 격차·월드 진출 조건 한 줄(`seasonScreen.ts` 결산 화면, `season.ts`·`teams.ts`).
2. ✅(2026-10-26 완료, `RunRecord.strength`·`leagueReason`·`reasonCard`) 리그 결과 이유: 팀 전력 대비 내 팀 전력, 코치 한 줄(`standingsView.ts`·결산).
3. ✅ 이적 카드 추천/주의 태그와 국내 이적 확인창 손익 요약(`offerView.ts`, `session.ts` 이적 확인).
4. ✅ 장비·레슨 효과 수치 표시(`planFlow.ts` 지출 카드·`playerTab.ts`).
5. ✅ 콜업 연속 거절 불이익(`season.ts` `makeCallupOffers`, `stages.json`, **봇 결과·밸런스 리포트 재확인**).
6. ✅ 저장 코드 백업(내보내기/불러오기, `storage.ts`·설정 시트)과 도전 코드(결과 카드에 시드 표기, 새 판 입력).
7. ✅ 가이드 팝업 정리(첫 시즌 핵심 3줄만 — `data/guides.json`).

**검증 못 한 것**: 이번 화면 변경(엔딩 후원 카드·도감 힌트 시트·N 배지)을 브라우저에서 직접 열어 보지 못했다. 다음 세션에서 Playwright로 한 번 훑는다(`docs/handover-2026-10-22-wrapup.md` §4 방법). 배포 후 카카오톡 등에서 링크 미리보기가 뜨는지 확인(카카오는 캐시가 있어 디버거에서 갱신해야 할 수 있다).

## 4. 확정된 것·주의

- 도감 힌트는 **선택적 열기**이고 도감의 "못 본 항목 조건 숨김"(사용자 결정)은 유지한다. 힌트 문장은 `desc`를 그대로 쓴다(별도 힌트 문구는 없다. 더 모호하게 만들려면 항목마다 문구를 새로 써야 한다).
- 확인 팝업의 겹친 호출을 **취소(false)로 돌려주면 안 된다**(구단 인수 확인이 취소 쪽 흐름으로 넘어간다). 끝나지 않는 Promise가 의도다.
- 후원 문구는 약관 7조("후원에 대가가 없다")를 깨지 않아야 한다. 혜택을 주는 안(닉네임 명단 등)은 약관 수정이 먼저다.
- 업적 상점은 능력치·판정을 올리는 방향으로 넓히지 않는다(편의 위주).
- 난이도 방침(숙련은 20대 중반 월드 제패)은 그대로. 길잡이를 넣어도 수치는 건드리지 않는다.

## 4-1. 2026-10-26 P1 구현 요약 (직접 플레이 확인 필요)

- 다음 목표 카드·리그 결과 분석(`engine/guidance.ts`, `RunRecord.strength`), 아카데미 초대 구단 표시(`GameState.academyOrg`, `testName(id, state)`, 이벤트 문구 `{academy}`), 이적 제안 추천/주의 태그와 손해 확인(`offerVerdict`, `contracts.json offerVerdict`, `offerView.ts confirmOffer`), 장비 효율 수치(`planFlow.ts`·`playerTab.ts`), 콜업 연속 거절 명성 감소(`stages.json offers.callupRefusal`, `GameState.callupRefusals`, `callupRefusalCost`), 저장 코드(`save/backup.ts`·`ui/backupSheet.ts`, 설정 시트), 도전 코드(`engine/challenge.ts`, 결과 카드·캐릭터 만들기), 첫 가이드 짧게(`guides.json` `brief`).
- 화면(결산 카드·이적 카드·설정의 저장 코드·도전 코드 입력)은 렌더 테스트만 했고 브라우저로 보지 않았다.
- 남은 선택 과제(P2 이후): `docs/exp-review-2026-10-25.md` §5.

## 5. graphify 메모

- 설치: Python 3.10(`C:\Users\tmdrl\AppData\Local\Programs\Python\Python310\python.exe`)에 `pip install graphifyy`, 그 `Scripts\graphify.exe`. 기본 `python`은 MSYS Python 3.12라 pip가 없다.
- 산출물: `graphify-out/`(`graph.html`·`GRAPH_REPORT.md`·`graph.json`·`cache/`). 코드는 AST(무료), 문서 23개만 서브에이전트로 의미 추출(약 41만 토큰). 이미지 111장·HTML 시안은 제외. `--update` 매니페스트는 저장하지 못했다. `graphify-out/`은 `.gitignore`에 넣었다.
- 쓰임: 구조 질문(`GameState`·`settleSeason`을 누가 부르는지 등)에 `graphify query`. 파일을 고치는 일에는 효과가 작다.

## 5-1. 2026-10-26 확정된 것

- 링크 미리보기(`og.png`)는 사용자가 배포본에서 확인했다. 후원 QR·송금 버튼도 확인 완료.
- **구단명·로고 방침: 현행 유지**, 지적이 오면 그때 고친다. 도메인은 나중에(연결하면 `index.html`·`robots.txt`·`sitemap.xml` 주소 교체).
- **업데이트 로그에는 후원·송금·QR 같은 돈 관련 변경을 쓰지 않는다**(돈에 목매는 것처럼 보인다). 이미 쓴 후원 항목 2개는 삭제했다. 플레이에 영향이 없는 변경도 쓰지 않는다.
- 다음 작업은 P1을 §3 순서대로. 남은 사용자 결정: 개인 계좌·GitHub 주소 노출 분리.

## 6. 대기 중인 질문 (위 확정으로 대부분 해소)

- 송금 링크·QR을 줄 수 있는가(어떤 서비스·형태)?
- 구단명·로고 방침을 지금 정할 것인가, 홍보 확대 전으로 미룰 것인가?
- 도메인(`paintochamps.kro.kr`)을 연결했는가?
- P1을 위 순서대로 진행해도 되는가?
