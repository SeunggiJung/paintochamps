# 플레이 감성 마무리 계획 (2026-10-20)

밸런싱은 어느 정도 됐으니, 이제 "해 보면 기분 좋은 게임"으로 만드는 일을 정리한다. 코드는 `src/`, 그림은 현재 전부 코드로 그린 SVG 도트다.

## 1. 해야 할 일 (우선순위 제안)

### A. 연출과 그림 (사용자 요청 — 아래 2·3장에 AI 도구용 요청서)
1. **타이틀 애니메이션 교체** — 지금은 `titleScene.ts`가 SVG+CSS로 16초 4장면을 그린다.
2. **계약 연출 교체** — `contractScene.ts`(서명 → 도장 → 악수).
3. **우승 연출 교체** — 월드 우승 결과 카드(`calendarUi.ts`는 이모지 🏆 + 폭죽)와 엔딩 일러스트(`endingScenes.ts` 11장 중 우승 계열 5장: `legend`·`two_time`·`emperor`·`goat`·`hidden_loyal`).
4. 나머지 엔딩 6장, 장비·시설 업그레이드 그림(`upgradeArt.ts`)은 위가 끝난 뒤에 같은 화풍으로.

### B. 소리 — **효과음 구현(2026-10-20)**: `ui/sound.ts`가 Web Audio로 합성(음원 파일·라이선스 없음), 오른쪽 위 🔊 토글(localStorage). BGM과 실제 음원 교체는 아직
- 효과음: 버튼, 턴 진행, 능력치 상승, 뽑기 등급 공개(등급별), 계약 도장, 대회 결과(우승·탈락), 업그레이드.
- BGM: 타이틀 / 육성 메인 / 대회 진행 / 우승 / 엔딩. 음소거 토글을 타이틀과 홈에 둔다(기본은 꺼짐 또는 첫 터치 뒤 재생).
- 구현은 Web Audio / `<audio>` + `localStorage` 설정. 파일은 `public/audio/`.
- 음원은 라이선스를 확인한다(AI 생성 음원·무료 음원 모두 상업 이용 조건 확인).

### C. 경기 중계 연출 (기획은 `docs/season-calendar-plan.md` §4, 미구현)
- 결승·월드 등 `big` 대회의 내 경기만: 세트별 스코어보드와 멘트가 흘러가고 결과가 나온다.
- 엔진이 내 경기 기록(상대·세트별 승패)을 남겨야 한다. 같은 시드는 같은 중계.

### D. 결과 카드(공유 이미지) — **구현(2026-10-20)**: `ui/resultCard.ts`, 엔딩 화면 '결과 카드 만들기'(저장·Web Share). 엔딩 그림이 이미지로 바뀌면 자동으로 따라간다
- 엔딩 화면에서 이미지 저장/공유. 엔딩 일러스트 + 이름·엔딩·핵심 기록(캔버스로 그림). 퍼지기에 가장 좋은 장치.

### E. 손맛(마이크로 인터랙션) — **숫자 카운트업·버튼 눌림·화면 페이드·진동 구현(2026-10-20)**, 모션 줄이기 전수 점검·지연 로딩은 남음
- 숫자 카운트업(돈·명성·능력치), 버튼 눌림/호버 피드백, 화면 전환 페이드.
- 모바일 진동(`navigator.vibrate`): 우승·뽑기 SSR 이상·부상.
- `prefers-reduced-motion` 존중(폭죽·글로우 이미 일부 적용, 전수 점검).
- 로딩/첫 화면: 이미지가 늘어나면 지연 로딩과 스켈레톤.

### F. 글과 이야기 — **시즌 한 줄 요약·라이벌/동료 이벤트 7종 구현(2026-10-20)**, 이벤트 말투 통일·업적 이름 확정은 남음
- 시즌 결산을 한 줄 요약 문장으로("이번 시즌 …"), 이벤트 63종의 말투 통일과 추가(프로 시절·라이벌·동료).
- 라이벌과 팀 동료에 이름이 생기면 정이 붙는다(가상 이름, 실존 선수 이름은 쓰지 않음).
- 엔딩 문구·업적 이름(밈 업적 13종 이름 확정).

### G. 아직 남아 있는 기획 항목
- 판단력·멘탈·팀워크 증가량(`perSeason` 6) 상향 여부(체감 소감: 안 쌓이는 느낌).
- 계약 기간·재계약·팀의 역제안, 대회 참가 여부 선택.
- 외형 꾸미기·상점(3단계, 기획서에는 있으나 구현 안 됨).
- 도박·유흥이 매력적인지, 정밀 모드는 삭제됨.
- 구단·대회 이름이 2026년 기준으로 맞는지 사용자 확인(`teams.json`, `competitions.json`), 문의 이메일 입력(`site.json`).

### H. 출시 점검
- 모바일 실기기(360px 세로) 전 화면 확인, 이어하기·세이브 호환, 접근성(대비·포커스·`aria`), 성능(로고 57개 약 436KB 이하 유지).
- 푸시와 배포 확인(Cloudflare Pages), 업데이트 로그/노션 갱신.

## 2. AI 이미지 도구에 줄 공통 요구사항

### 화풍
- **치비 2.5등신 도트 아트**(머리가 크고 몸이 작은 비율), **진한 갈색 윤곽선**(순검정 금지, `#3b2418` 근처), **점 눈 + 굵은 눈썹**, 밝고 알록달록하지만 채도가 과하지 않은 팔레트, 위·왼쪽은 밝게 아래·오른쪽은 어둡게 음영. 현재 게임 화면의 스프라이트(타이틀·계약 연출)와 같은 분위기를 유지한다.
- **격자**: 가로 160×세로 100 도트 기준(8:5). AI는 정확한 도트를 못 맞추므로 **큰 이미지(1280×800)로 받고, 최근접 이웃(nearest-neighbor)으로 160×100으로 줄였다가 8배 확대**하면 도트 느낌이 정리된다. 색은 32색 이내로 줄인다(Aseprite·GIMP 인덱스 색상).
- **캐릭터는 원본 캐릭터**로 만든다. 기존 게임·애니메이션·만화의 유명 캐릭터를 닮게 그리지 않는다.

### 넣지 말 것 (네거티브 프롬프트)
- 실존 구단·리그·게임 로고와 상표, 실존 선수·유명인 얼굴, 실제 유니폼 디자인.
- 글자(한글·영문 모두; AI가 깨진 글자를 만든다). 글자는 코드로 얹는다. 워터마크, 서명, 프레임.
- 로고 자리는 **비워 둔 무지 방패/배지 형태**로 그려 달라고 한다. 실제 팀 로고는 코드가 얹는다.

### 일관성 팁
- 첫 번째 결과로 **캐릭터 시트(앞·옆·환호 포즈)** 를 먼저 만들고 이후 모든 장면에 레퍼런스 이미지로 넣는다(스타일 레퍼런스/캐릭터 레퍼런스 기능이 있는 도구 사용).
- 현재 게임 화면 스크린샷 3장(타이틀 4장면, 계약 연출, 엔딩 일러스트)을 스타일 레퍼런스로 첨부한다.
- 같은 시드·같은 모델·같은 스타일 프롬프트를 고정한다.
- 상업 이용 가능 여부(이용약관)와, AI 생성물에 대한 저작권 보호가 제한될 수 있다는 점을 확인한다.

### 납품 형식
- 배경과 인물/소품을 **레이어로 분리**해서 받는 것이 이상적(투명 PNG): 배경 1장 + 인물 포즈별 PNG + 소품. 안 되면 통짜 일러스트로 받고, 아래 규칙으로 자른다.
- 파일 위치 `public/art/`, 포맷 webp 또는 png, 장당 150KB 이하, 이름은 아래 표 그대로. 도입 시 코드 쪽에서 파일이 있으면 이미지를, 없으면 지금의 SVG를 보여 주는 방식으로 연결한다(기존 `data-art` 규칙).

## 3. 이미지별 요청서

> 아래 영어 프롬프트를 도구에 붙여 넣고, 괄호 안의 한국어 설명을 참고해 조정한다. 공통으로 `--no text, logo, watermark, real people` 같은 네거티브를 추가한다.

### 3-1. 타이틀 애니메이션 (16초 루프, 4장면)
**연출**: ① 방구석에서 혼자 게임하는 소년 → ② 여럿이 모인 PC방 대회 현장 → ③ 코치·팀원과 연습하는 팀 숙소 → ④ 트로피를 든 우승 무대. 장면 사이는 페이드/슬라이드로 이어진다.

| 파일 | 크기 | 내용 |
|---|---|---|
| `title_s1_room.webp` | 1280×800 | 방 배경(인물 없음): 낡은 책상, 모니터 1대, 어질러진 컵라면·콜라, 창밖 노을, 벽에 포스터. 모니터 화면은 비워 두고(단색) 코드로 깜빡임을 얹는다 |
| `title_s2_arena.webp` | 1280×800 | 동네 PC방 대회: 조잡한 현수막(글자 없이 줄무늬), 모니터가 줄지은 책상, 구경하는 관중 실루엣 |
| `title_s3_team.webp` | 1280×800 | 팀 연습실: 큰 화면, 헤드셋 낀 팀원 3명과 서 있는 코치(태블릿), 팀 컬러 포인트 |
| `title_s4_stage.webp` | 1280×800 | 우승 무대: 트로피, 쏟아지는 금빛 종이 조각, 조명, 대형 화면 |
| `title_player_sheet.png` | 투명, 각 포즈 256×352 | 주인공: 앉아서 게임(타이핑 2프레임), 서서 대기(깜빡임 2프레임), 환호(만세 2프레임) |
| `title_extras.png` | 투명 | 소품 모음: 트로피, 컵라면, 모니터 빛, 말풍선(빈 것) |

프롬프트 틀:
```
Chibi pixel art illustration, 2.5-head-ratio characters, dark brown outlines,
dot eyes with thick eyebrows, bright warm cheerful palette, soft cel shading,
[SCENE DESCRIPTION], 8:5 aspect ratio, game title screen background, no characters
in the foreground unless stated, crisp pixel edges, limited 32-color palette.
Negative: text, letters, logo, trademark, watermark, real person, photo, 3D render,
blurry, gradient banding.
```

### 3-2. 계약 연출 (서명 → 도장 → 악수)
**연출**: 책상 양쪽에서 선수와 팀 담당자가 서명 → 팀 도장이 쾅 찍힘 → 두 사람이 가운데로 다가와 악수. 팀마다 색과 도장 문양이 다르다(코드가 팀 로고·색을 얹는다).

| 파일 | 크기 | 내용 |
|---|---|---|
| `contract_bg.webp` | 1280×800 | 사무실: 책상과 서류, 창문, 팀 깃발 자리는 **빈 방패 모양**, 인물 없음 |
| `contract_player.png` | 투명, 포즈별 | 선수(원본 캐릭터): 앉아서 서명, 서서 대기, 악수(앞으로 손 내밀기) |
| `contract_manager.png` | 투명, 포즈별 | 팀 담당자: 앉아서 서명, 서서 대기, 악수. 양복은 **무채색**(팀 색은 코드가 입힘) |
| `contract_props.png` | 투명 | 계약서(글자 없이 줄만), 펜, 도장(무늬 없는 둥근 도장), 도장 찍힌 뒤 번쩍임 이펙트 |

프롬프트 틀:
```
Chibi pixel art, two characters in a bright sports club office, dark brown outlines,
dot eyes, thick eyebrows, [POSE], desk with a contract paper (blank lines only, no text),
a round blank stamp, an empty shield-shaped banner on the wall (no logo),
neutral gray suit for the manager, warm lighting, 8:5, 32-color palette, crisp pixels.
Negative: text, letters, real logo, watermark, real person.
```

### 3-3. 우승 연출 (월드 우승 결과 카드 + 엔딩 일러스트)
**연출**: 월드 결승 무대에서 트로피를 번쩍 드는 장면. 우승 횟수가 늘수록(2회 → 3회 → 4회 이상) 트로피와 장식이 화려해진다. 폭죽은 코드가 위에 얹는다.

| 파일 | 크기 | 내용 |
|---|---|---|
| `win_world_aos.webp` | 1280×800 | AOS 월드 결승 무대: 트로피를 든 선수와 환호하는 팀원 4명, 5대5 팀 게임 분위기의 대형 스크린(**화면 속은 추상적인 빛**, 게임 장면 금지), 금빛 조명 |
| `win_world_fps.webp` | 1280×800 | FPS 월드 결승 무대: 같은 구도, 대형 스크린은 조준선 모양의 추상 그래픽 |
| `ending_legend.webp` | 1280×720 | 레전드: 트로피를 든 선수와 팀원 |
| `ending_two_time.webp` | 1280×720 | 두 번 오른 정상: 트로피 2개를 든 선수, 은빛과 금빛 |
| `ending_emperor.webp` | 1280×720 | 왕조의 주인: 트로피 3개와 왕관 모양 장식, 붉은 카펫 |
| `ending_goat.webp` | 1280×720 | 역대 최고: 트로피가 빼곡한 전시관 한가운데, 별과 후광 |
| `ending_hidden_loyal.webp` | 1280×720 | 원클럽 레전드: 데뷔 때 유니폼 그대로 홈 경기장에서 트로피, 오래된 깃발과 영구결번 유니폼(번호만, 글자 없음) |
| `trophy.png` | 투명 256×256 | 트로피 단독(코드가 결과 카드와 업적에 재사용) |

프롬프트 틀:
```
Chibi pixel art illustration of a victorious esports player lifting a golden trophy
on a world championship stage, 2.5-head-ratio, dark brown outlines, dot eyes, thick eyebrows,
teammates cheering, confetti and golden spotlights, large stage screen showing
abstract glowing shapes (no text, no game footage), neutral team colors, 16:9,
warm gold palette, crisp pixel edges, 32-color palette.
Negative: text, letters, logo, trademark, real person, watermark, photo, 3D render.
```

### 3-4. 같은 화풍으로 나중에 (우선순위 낮음)
- 나머지 엔딩 6장(`world_finalist`, `pro1_regular`, `pro2_veteran`, `coach`, `streamer`, `hobbyist`): 장면 설명은 `docs/ending-images.md`.
- 장비 4종·시설 4종의 단계별 그림(`upgradeArt.ts`): 단계 5색 등급은 코드가 입혀도 된다.

## 4. 이미지가 준비되면 코드에서 할 일 (제가 이어서 한다)
1. `public/art/` 파일이 있으면 이미지를, 없으면 기존 SVG를 보여 주는 로더 추가(`data-art` 규칙 확장).
2. 타이틀: 4장면 크로스페이드 + 코드 애니메이션(모니터 깜빡임, 캐릭터 프레임, 눈 깜빡임).
3. 계약: 배경 + 선수/담당자 PNG를 3박자 타이밍으로 움직이고 팀 색·로고를 얹기.
4. 우승: 결과 카드와 엔딩에 일러스트 + 폭죽 + 트로피 반짝임.
5. 용량 확인(장당 150KB 이하, 지연 로딩), 모바일 360px에서 인물이 잘리지 않는지 점검.
