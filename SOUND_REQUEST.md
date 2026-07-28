# 효과음

## 지금 상태

**소리 21개가 이미 들어 있다.** `public/sfx/*.wav` — 녹음이 아니라 파형을 직접
합성해 구운 것이다 (`tools/gen-sfx.py`). 아무것도 받아 오지 않아도 게임은
제 소리를 낸다.

녹음 파일을 쓰지 않은 이유는 두 가지다.

- 이 앱은 그림도 전부 벡터로 그린다. 여기저기서 모은 녹음 21개를 섞으면
  게임마다 소리의 결이 달라진다. 파형을 만들면 21개가 한 악기에서 나온 것처럼
  들린다 (sfxr 계열 게임들이 쓰는 방법).
- 무료 음원 사이트에서 받아 오려면 라이선스를 하나씩 확인해야 하고,
  CC0가 아닌 것을 섞으면 나중에 앱 안에 크레딧 화면을 만들어야 한다.

소리를 고치고 싶으면 `tools/gen-sfx.py`의 값을 바꾸고 다시 돌린다.

```
python3 tools/gen-sfx.py
```

## 진짜 녹음으로 바꾸고 싶을 때

같은 이름의 **`.mp3`를 `public/sfx/`에 넣으면 그쪽이 이긴다.** wav는 지우지
않아도 된다 (코드가 mp3를 먼저 찾는다). 21개 전부를 바꿀 필요도 없고, 마음에
안 드는 것만 하나씩 갈아끼우면 된다.

바꿀 만한 순서는 이렇다. 위쪽일수록 효과가 크다.

1. `rhythm-hit` — 리듬 탭 손맛의 90%가 이 소리다
2. `tap` — 전 게임에서 가장 많이 들린다
3. `stone` — 오목은 돌 놓는 소리가 전부다
4. `clear` / `gameover` — 판이 끝나는 순간의 인상
5. 나머지

### 규격

| 항목 | 값 |
|---|---|
| 형식 | mp3 (128kbps 이상) · 모노 권장 |
| 길이 | 아래 표의 길이. **앞뒤 무음은 잘라낼 것** — 앞에 0.05초만 있어도 탭이 굼떠 보인다 |
| 음량 | 정규화만 되어 있으면 된다. 게임별 크기는 `src/shared/sound.ts`의 `gain`에서 맞춘다 |
| 라이선스 | **CC0(퍼블릭 도메인)만.** 출처 표기 의무가 있는 것을 쓰면 크레딧 화면이 필요해진다 |

### 받을 만한 곳

- https://kenney.nl/assets/tag:audio — 전부 CC0, 게임용으로 이미 다듬어져 있다. 여기부터 보면 된다
- https://pixabay.com/sound-effects/ — 무료·상업 이용 가능
- https://freesound.org — 양이 가장 많다. **License 필터를 CC0으로** 걸 것

---

## 소리 21개

지금 들어 있는 wav가 어떤 소리인지, 바꾼다면 무엇으로 바꿔야 하는지.
"측정값"은 구워진 파일을 분석한 것이다 (무게중심 주파수 = 밝기).

### 공통 12개 — 여러 게임이 나눠 쓴다

| 이름 | 어떤 소리 | 길이 | 측정값 | 바꾼다면 |
|---|---|---|---|---|
| `tap` | 손끝으로 톡. 짧고 둥글게 — 하루에 수천 번 들릴 소리라 날이 서면 안 된다 | 90ms | 573Hz | Kenney *Interface Sounds* → `click_001` |
| `merge` | 두 개가 합쳐지는 맑은 "팅". 마림바 배음 4개 | 340ms | 962Hz | Kenney *Digital Audio* → `powerUp` 계열 |
| `gameover` | 내려앉는 세 음 (G–D♯–G). 무섭기보다 아쉽게 | 1050ms | 1103Hz | Kenney *Music Jingles* 하강 계열 |
| `pop` | 물방울 터지듯 음이 위로 튄다 | 130ms | 1502Hz | freesound "bubble pop" |
| `clear` | 오르는 네 음 (C–E–G–C) | 950ms | 1896Hz | Kenney *Music Jingles* → `jingles_STEEL16` |
| `fail` | 낮은 부저. 크면 게임을 관두게 된다 | 260ms | 644Hz | Kenney *UI Audio* → `error` 계열 |
| `hurt` | 퍽 — 저음 덩어리에 짧은 파열음 | 300ms | 878Hz | Kenney *Impact Sounds* → `impactPunch` |
| `coin` | 두 음 아르페지오 (B→E). 아케이드 동전의 기본형 | 340ms | 7629Hz | Kenney *Casino Audio* → `chipsHandle` |
| `whoosh` | 스치는 바람. 필터가 열렸다 닫힌다 | 240ms | 3058Hz | freesound "whoosh short" |
| `impact` | 나무에 부딪히는 탁. 울림 없이 딱 끊긴다 | 150ms | 1020Hz | Kenney *Impact Sounds* → `impactWood` |
| `unlock` | 열리는 두 음 (D→A) | 460ms | 1205Hz | Kenney *UI Audio* → `confirmation` |
| `select` | 결정했다는 딸깍. `tap`보다 단단하다 | 70ms | 6772Hz | Kenney *Interface Sounds* → `switch` |

### 게임 고유 9개

| 이름 | 게임 | 어떤 소리 | 길이 | 측정값 | 바꾼다면 |
|---|---|---|---|---|---|
| `rhythm-hit` | 리듬 탭 | 클로즈드 하이햇. 1초에 여덟 번까지 울리므로 **울림이 있으면 안 된다** | 100ms | 11829Hz | freesound "hi hat closed" / "rimshot" |
| `rhythm-miss` | 리듬 탭 | 김빠지는 삑 | 200ms | 825Hz | freesound "buzzer short" |
| `shoot` | 궤도 슈팅 · 오토 배틀 | 짧은 레이저. 0.15초마다 연사되므로 꼬리가 길면 뭉친다 | 130ms | 3806Hz | Kenney *Sci-Fi Sounds* → `laserSmall` |
| `explode` | 궤도 슈팅 · 오토 배틀 | 펑 — 화면을 흔들 만큼은 아니게 | 460ms | 2700Hz | Kenney *Sci-Fi Sounds* → `explosionCrunch` |
| `sword` | 카드 배틀 · 오토 배틀 | 쉭 하고 지나간 뒤 금속이 운다 | 320ms | 4232Hz | freesound "sword swing" |
| `stone` | 오목 | 나무판 위 바둑돌. 마르고 단단하게 | 140ms | 1634Hz | freesound "go stone" / "wood block hit" |
| `ice-slide` | 펭귄 미끄럼 | 필터가 올라가며 스르륵 | 440ms | 4668Hz | freesound "ice slide" |
| `water` | 종이배 뱃길 | 첨벙보다 찰랑. 물방울에 잔물결이 두 번 | 380ms | 487Hz | freesound "water lap gentle" |
| `flip` | 한글 워들 | 종이 한 장 넘어가는 탁. 여섯 칸이 연달아 울린다 | 80ms | 5175Hz | freesound "card flip" |

---

## 코드 쪽에서 해 둔 것

- **연쇄는 음이 올라간다.** 파일 하나로 처리한다 — 별똥별은 이을수록, 워들은
  칸이 열릴수록, 대나무는 오를수록, 리듬 탭은 퍼펙트일수록(1.14배).
- **오목은 AI 수를 0.94배로 낮춰** 내 수와 소리로 구분된다.
- 같은 소리가 20ms 안에 겹치면 건너뛴다 (한 프레임에 여러 번 울리면 뭉쳐서 커진다).
- 게임을 열 때 그 게임이 쓸 소리를 미리 받아 둔다.
- mp3·wav 둘 다 없으면 예전 신스 소리로 돌아간다. 어느 쪽이든 앱은 깨지지 않는다.

## 나중에 볼 것

- **BGM**은 `action`·`puzzle`·`sim` 세 곡으로 30개 게임을 나눠 쓴다 (`public/bgm/`, 2.9MB).
  분위기가 안 맞는 게임이 생기면 그때 곡을 늘린다 (`src/shared/music.ts`의 `bgmFor`).
- 소리 크기는 실제로 들어 보고 `src/shared/sound.ts`의 `gain` 값으로 맞춘다.
  지금 값은 파형 분석으로 잡은 것이라 귀로 들으면 다를 수 있다.
