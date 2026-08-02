# 스토어 등록정보 초안 (en-US)

Play Console → 스토어 등록정보 설정에 그대로 붙여넣을 수 있게 준비한 문구.
기본 언어가 영어(en-US)라 영어로 쓴다. 한국어판은 나중에 번역 관리에서 추가한다.
이미지 파일과 나머지 콘솔 설정은 `PLAY_CONSOLE.md`에 있다.

> **붙여넣기 전에 게임 설명 한 줄씩 실제 동작과 맞는지 확인할 것.**
> 게임 이름(`src/shared/i18n.ts`)을 기준으로 쓴 것이라, 실제 규칙과 어긋나는
> 문장이 있을 수 있다. 스토어 문구는 사실과 달라도 심사에서 걸린다.

---

## 간단한 설명 (80자 제한)

```
Thirty small games in one app. Pick one, play a round, put it down.
```

67자. 대안:

```
Thirty quick games in one app. Puzzles, arcade runs, and board classics.
```

72자.

---

## 자세한 설명 (4000자 제한)

```
Thirty games. One app. Nothing to install between them.

MiniGame30 is a collection of small games you can finish in a couple of
minutes — puzzles, arcade runs, board classics, and a few odd ones. Open
the app, pick something, play a round, put it down.

No energy timers. No waiting to play.

WHAT'S INSIDE

Puzzle
• Nonogram — fill the grid from the number clues
• Sudoku Daily — one puzzle a day for everyone, with notes and a streak
• Pipe Connect — rotate the pipes until it all lines up
• Jewel Match — match three, chain the cascades
• TriPeaks Solitaire — clear the peaks one card at a time
• Hangul Wordle — guess the word, letter by letter
• Spot the Match — find the pair before the timer runs out

Arcade
• Endless Runner — jump, slide, keep going
• Falling Dodge — dodge what drops
• Brick Breaker — the classic, with better physics
• Orbit Shooter — circle the center and shoot outward
• Jump Challenge — one tap, one arc, one landing
• Rhythm Tap — hit the notes on the beat
• Comet Chain — link falling stars into one long chain
• Penguin Slide — steer down the ice
• Bamboo Climb — climb without slipping

Merge and stack
• Melon Merge — drop fruit, merge it, don't overflow
• Fruit 2048 — the number game, with fruit
• Merge Garden — combine plants into better plants
• Block Blast — clear lines with dropped blocks
• Tower Stack — stack it straight or lose the width
• Marble Jars — sort the marbles into matching jars

Strategy
• Tower Defense — place turrets, hold the line
• Auto Battler — build the board, watch it fight
• Card Battler — draft a deck, spend your mana
• Survivor — stay alive, pick your upgrades
• Gomoku — five in a row

Quick thinking
• Number Line-up — order the numbers before time runs out
• Flash Numbers — memorize the sequence, tap it back
• Sorting Duty — sort what comes down the belt
• Paper Boat Lanes — draw the route, send the boats

ALSO

• Personal records and rankings for every game
• Available in 13 languages
• Sign in with Google or Kakao to carry your records between devices
• Or just play — an account is optional
```

---

## 스크린샷 (최소 2장, 4~6장 권장)

앱 설치 없이 웹에서 찍을 수 있다.

1. 크롬에서 `https://web-game-ecru.vercel.app` 열기
2. F12 → Ctrl+Shift+M (기기 툴바)
3. Pixel 7 등 9:16 기기 선택
4. 홈 화면 + 대표 게임 3~5개 캡처

규격: 16:9 또는 9:16, 최소 320px, 최대 3840px.

담을 화면 추천 — 첫 장이 목록에서 제일 크게 보이므로 게임이 많다는 게
한눈에 보이는 홈 화면부터 넣는다.

1. 홈 (게임 목록)
2. Melon Merge
3. Tower Defense
4. Nonogram 또는 Sudoku
5. 랭킹 화면
