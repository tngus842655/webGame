# 효과음 파일 요청서

> 넣을 곳: **`public/sfx/<이름>.mp3`** (BGM은 `public/bgm/`에 이미 있다)
> 파일이 없으면 지금까지 쓰던 신스 소리가 대신 난다 — 있는 것부터 하나씩 넣으면 된다.
> 이름을 정확히 맞춰야 코드가 찾는다. 21개 전부가 코드에서 실제로 불린다.

## 파일 규격

| 항목 | 값 |
|---|---|
| 형식 | mp3 (128kbps 이상) |
| 채널 | 모노 권장 (파일이 절반이 된다) |
| 길이 | 표에 적은 길이. **앞뒤 무음은 잘라낼 것** — 앞에 0.05초만 있어도 탭이 굼떠 보인다 |
| 크기 | 하나당 50KB 아래 |
| 음량 | 정규화만 되어 있으면 된다. 게임별 크기는 `src/shared/sound.ts`의 `gain`에서 맞춘다 |

**라이선스는 CC0(퍼블릭 도메인)만 받는다.** 출처 표기 의무가 있는 것을 쓰면
나중에 앱 안에 크레딧 화면을 만들어야 한다.

## 받을 만한 곳

| 사이트 | 특징 |
|---|---|
| https://kenney.nl/assets/tag:audio | **여기부터 보면 된다.** 전부 CC0, 게임용으로 이미 다듬어져 있음. 아래 표의 "추천"은 대부분 여기 것 |
| https://pixabay.com/sound-effects/ | 무료·상업 이용 가능, 검색어로 찾기 좋다 |
| https://freesound.org | 양이 가장 많다. 검색 후 **License 필터를 CC0으로** 걸 것 |

Kenney 팩은 zip 하나에 수십 개가 들어 있다. 받아서 마음에 드는 것을 골라
**이름만 바꿔서** `public/sfx/`에 넣으면 된다.

---

## 1. 공통 소리 12개 — 여러 게임이 나눠 쓴다

가장 많이 들리는 소리들이라 이 12개만 넣어도 30개 게임 전체가 달라진다.

| 파일명 | 어떤 느낌 | 길이 | 쓰는 곳 | 추천 |
|---|---|---|---|---|
| `tap.mp3` | 손끝으로 톡 건드리는 소리. **아주 짧고 부드럽게.** 하루에 수천 번 들릴 소리라 조금만 날카로워도 금방 피곤해진다 | 0.05–0.1초 | 전 게임의 탭·놓기 | Kenney *Interface Sounds* → `click_001` / *UI Audio* 계열 |
| `merge.mp3` | 두 개가 합쳐지며 나는 맑은 "팅". 기분 좋은 종·마림바 계열 | 0.15–0.3초 | 수박·2048·머지 가든·오토 배틀 합성 | Kenney *Digital Audio* → `powerUp` 계열 / freesound "marimba note" |
| `gameover.mp3` | 힘이 빠지며 내려가는 3음. 무섭기보다 아쉬운 느낌 | 0.8–1.5초 | 전 게임 종료 | Kenney *Music Jingles* → `jingles_NES/PIZZA` 중 하강 계열 |
| `pop.mp3` | 물방울이 톡 터지는 소리. `tap`보다 둥글고 울림이 조금 있다 | 0.08–0.15초 | 매치3·별똥별·분류 반장·블록 제거 | freesound "bubble pop" (CC0) / Kenney *Digital Audio* |
| `clear.mp3` | 짧은 팡파레. **1.2초를 넘기지 말 것** — 다음 판이 바로 시작된다 | 0.8–1.2초 | 판 클리어·스테이지 성공·전투 승리 | Kenney *Music Jingles* → `jingles_STEEL16` 같은 상승 계열 |
| `fail.mp3` | 낮고 짧은 "붕". 오답 부저. 너무 크면 게임을 관두게 된다 | 0.15–0.3초 | 오답·놓침 | Kenney *UI Audio* → `error` 계열 |
| `hurt.mp3` | 둔탁하게 맞는 "퍽". 살짝 낮은 타격 | 0.2–0.3초 | 피격·생명 감소 | Kenney *Impact Sounds* → `impactPunch` 계열 |
| `coin.mp3` | 동전 "챠링". 밝고 짧게 | 0.2–0.4초 | 코인·별 획득 | Kenney *Casino Audio* → `chipsHandle` / freesound "coin pickup" |
| `whoosh.mp3` | 바람이 스치는 "휙". **날카롭지 않게** — 빠르게 반복된다 | 0.15–0.25초 | 점프·스와이프·획 긋기·대나무 오르기 | freesound "whoosh short" (CC0) |
| `impact.mp3` | 나무나 돌에 부딪히는 "탁". 울림 없이 딱 끊기게 | 0.1–0.2초 | 착지·충돌·부딪혀 멈춤 | Kenney *Impact Sounds* → `impactWood` 계열 |
| `unlock.mp3` | 새로 열리는 상승 2음 "띠링" | 0.3–0.5초 | 새 부두 개방·레벨업 | Kenney *UI Audio* → `confirmation` 계열 |
| `select.mp3` | 또렷한 "딸깍". `tap`보다 단단하고 확실한 느낌 (결정했다는 소리) | 0.06–0.12초 | 카드·유닛·업그레이드 선택 | Kenney *Interface Sounds* → `switch` / `click_002` |

## 2. 게임 고유 소리 9개 — 그 게임의 정체가 되는 것

| 파일명 | 게임 | 어떤 느낌 | 길이 | 추천 |
|---|---|---|---|---|
| `rhythm-hit.mp3` | 리듬 탭 | **가장 중요한 파일.** 노트를 정확히 친 순간의 짧고 맑은 타격음. 리듬게임 손맛의 90%가 이 소리다. 1초에 8번까지 울리므로 **울림(리버브)이 길면 안 된다.** 클로즈드 하이햇이나 림샷 계열 | 0.05–0.12초 | freesound "hi hat closed" / "rimshot" (CC0), 또는 드럼 샘플팩의 클랩 |
| `rhythm-miss.mp3` | 리듬 탭 | 놓쳤을 때의 짧은 "삑". 김빠지는 느낌 | 0.15–0.25초 | freesound "buzzer short" |
| `shoot.mp3` | 궤도 슈팅 · 오토 배틀(궁수·마법사) | 짧은 레이저 발사음. 0.15초에 한 번씩 연사되므로 **꼬리가 길면 뭉친다** | 0.08–0.15초 | Kenney *Sci-Fi Sounds* → `laserSmall` 계열 |
| `explode.mp3` | 궤도 슈팅 · 오토 배틀 | 작은 폭발. 화면을 흔들 만큼은 아니고 "펑" 정도 | 0.3–0.5초 | Kenney *Sci-Fi Sounds* → `explosionCrunch` 계열 |
| `sword.mp3` | 카드 배틀 · 오토 배틀 | 칼이 베고 지나가는 "쉭–착". 금속성 | 0.2–0.35초 | freesound "sword swing" (CC0) |
| `stone.mp3` | 오목 | 바둑돌을 판에 놓는 "딱". **나무판 위 돌 소리** — 이게 오목의 전부다 | 0.08–0.15초 | freesound "go stone" / "wood block hit" (CC0) |
| `ice-slide.mp3` | 펭귄 미끄럼 | 얼음 위를 스르륵 미끄러지는 소리. 끝이 자연스럽게 잦아들게 | 0.3–0.5초 | freesound "ice slide" / "sliding whoosh" |
| `water.mp3` | 종이배 뱃길 | 배가 부두에 닿을 때 나는 잔잔한 물소리. 첨벙보다 **찰랑** | 0.2–0.4초 | freesound "water lap gentle" (CC0) |
| `flip.mp3` | 한글 워들 | 타일이 뒤집히는 "탁". 종이나 나무 느낌, 아주 짧게 (6칸이 0.13초 간격으로 연달아 울린다) | 0.05–0.1초 | freesound "card flip" (CC0) |

---

## 넣은 뒤 확인

1. `public/sfx/`에 파일을 넣는다
2. 새로고침하고 게임을 연다 — 그 게임이 쓰는 소리를 미리 받아 둔다
3. 소리가 안 바뀌면 파일명 오타이거나 mp3로 디코딩이 안 되는 경우다.
   둘 중 어느 쪽이든 예전 신스 소리로 돌아가므로 앱이 깨지지는 않는다

## 나중에 손볼 것

- **BGM**은 지금 `action`·`puzzle`·`sim` 세 곡으로 30개 게임을 나눠 쓴다.
  분위기가 안 맞는 게임이 생기면 그때 곡을 늘린다 (`src/shared/music.ts`의 `bgmFor`).
- 소리 크기는 파일을 넣어 보고 `src/shared/sound.ts`의 `gain` 값으로 맞춘다.
