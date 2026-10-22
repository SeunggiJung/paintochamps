# 타이틀 장면 이미지

`src/ui/titleScene.ts`가 이 폴더의 WebP 4장을 순서대로(방구석 → 훈련 → 대회 → 우승) 보여 준다.
4장이 **모두** 있어야 슬라이드가 켜지고, 하나라도 없으면 기존 도트 장면을 쓴다.

| 파일 이름 | 장면 | 원본(`docs/redesign-mockups/`) |
|---|---|---|
| `scene-1-room.webp` | 방구석 | `title-cellcog-1.png` |
| `scene-2-train.webp` | 훈련 | `title-cellcog-2-train.png` |
| `scene-3-match.webp` | 대회 | `title-cellcog-3-match-v2.png` |
| `scene-4-win.webp` | 우승 | `title-cellcog-4-win.png` |

## 변환 방법 (https://anypictoanypic.com/ko/)

4장을 같은 설정으로 일괄 변환한다.

- 출력 형식: **WebP**
- 크기: '직접 지정' 가로 **900** × 세로 **598** (원본 2048×1360과 같은 비율)
- 품질: **82**
- 변환한 파일 이름을 위 표대로 바꿔 이 폴더에 넣는다.
