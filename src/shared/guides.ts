import { locale } from './i18n'

// 게임 설명 가이드 — 플레이 화면의 ? 버튼으로 여는 팝업 내용.
// 게임마다 세 줄만 쓴다: 목표 / 조작 / 점수. 길면 읽지 않는다.
// i18n.ts가 이미 크기 때문에 여기서 따로 관리하고, ko/en 외 언어는 en으로 폴백한다.

export interface Guide {
  goal: string
  how: string
  score: string
}

const ko: Record<string, Guide> = {
  suika: {
    goal: '같은 과일끼리 부딪히면 더 큰 과일이 됩니다. 통 밖으로 넘치면 끝이에요.',
    how: '좌우로 움직여 위치를 정하고 탭해서 떨어뜨리세요.',
    score: '과일이 커질수록 점수가 크게 오릅니다.',
  },
  blockblast: {
    goal: '블록을 놓아 가로나 세로 한 줄을 채우면 사라집니다. 남은 블록을 놓을 자리가 없으면 끝이에요.',
    how: '아래 블록 세 개 중 하나를 끌어다 격자에 놓으세요.',
    score: '한 번에 여러 줄을 지울수록 더 많이 받습니다.',
  },
  brick: {
    goal: '공을 튕겨 벽돌을 부수세요. 벽돌이 바닥까지 내려오면 끝입니다.',
    how: '아래에서 당겨 각도를 정하고 놓으면 공이 날아갑니다. 부순 벽돌로 얻은 골드는 아래 두 버튼에서 공격력·공 개수로 바꿉니다.',
    score: '웨이브를 오래 버틸수록 점수가 쌓입니다. 강화는 판마다 처음부터 다시 쌓습니다.',
  },
  fruit2048: {
    goal: '같은 숫자 과일을 밀어 붙여 합치세요. 더 이상 움직일 수 없으면 끝입니다.',
    how: '화면을 상하좌우로 쓸어 넘기세요.',
    score: '합쳐진 숫자가 그대로 점수가 됩니다.',
  },
  runner: {
    goal: '장애물을 피해 최대한 멀리 달리세요. 부딪히면 끝입니다.',
    how: '탭하면 점프, 공중에서 한 번 더 탭하면 2단 점프예요.',
    score: '달린 거리 + 주운 코인.',
  },
  dodge: {
    goal: '위에서 떨어지는 물체를 피해 오래 버티세요.',
    how: '좌우로 끌어서 움직입니다.',
    score: '버틴 시간이 곧 점수입니다.',
  },
  survivor: {
    goal: '몰려드는 적 사이에서 살아남으세요. 체력이 다하면 끝입니다.',
    how: '끌어서 이동만 하면 공격은 자동입니다. 레벨업 때 강화를 하나 고르세요.',
    score: '처치 수와 생존 시간을 더해 계산합니다.',
  },
  merge: {
    goal: '같은 식물끼리 합쳐 황금 화분을 만드세요. 제한 시간 안에 목표 개수를 채우면 다음 단계로 갑니다.',
    how: '생성 버튼으로 씨앗을 놓고, 같은 그림끼리 끌어다 겹치세요.',
    score: '화분 하나에 100점, 단계를 깰 때 남은 1초당 5점.',
  },
  match3: {
    goal: '보석 세 개 이상을 한 줄로 만들어 목표치를 채우세요. 이동 횟수를 다 쓰면 끝입니다.',
    how: '이웃한 보석 두 개를 바꿔치기하세요.',
    score: '한 번에 많이 터뜨릴수록 유리합니다.',
  },
  tripeaks: {
    goal: '바닥에 놓인 카드보다 숫자가 하나 크거나 작은 카드를 걷어내 산을 치우세요.',
    how: '조건에 맞는 카드를 탭합니다. 낼 카드가 없으면 더미에서 한 장 뒤집으세요.',
    score: '연속으로 걷어낼수록 배수가 붙습니다.',
  },
  nonogram: {
    goal: '가장자리 숫자를 힌트 삼아 칸을 칠해 그림을 완성하세요. 세 번 틀리면 끝입니다.',
    how: '칠하기·X 표시를 바꿔가며 칸을 탭하거나 쓸어 넘기세요.',
    score: '퍼즐이 클수록, 생명이 많이 남을수록 높습니다.',
  },
  sudoku: {
    goal: '가로·세로·3×3 칸에 1~9를 겹치지 않게 채우세요. 세 번 틀리면 끝입니다.',
    how: '칸을 고르고 아래 숫자판에서 숫자를 누르세요.',
    score: '빨리 풀수록 높고, 데일리를 연속으로 풀면 보너스가 붙습니다.',
  },
  pipes: {
    goal: '파이프를 돌려 펌프에서 모든 끝까지 물이 흐르게 하세요. 시간이 다하면 끝입니다.',
    how: '타일을 탭할 때마다 90도씩 돌아갑니다.',
    score: '판이 클수록, 시간을 많이 남길수록 높습니다.',
  },
  defense: {
    goal: '몰려오는 적을 막으세요. 생명이 다하면 끝입니다.',
    how: '골드로 타워를 소환하고, 같은 타워를 겹쳐 끌면 한 단계 강해집니다.',
    score: '웨이브를 오래 버틸수록 점수가 쌓입니다.',
  },
  jump: {
    goal: '3분 동안 발판을 밟고 최대한 높이 올라가세요.',
    how: '누르고 있으면 힘이 모이고, 떼면 뜁니다. 캐릭터에서 좌우로 멀리 누를수록 옆으로 많이 날아가요.',
    score: '도달한 최고 높이(m)가 점수입니다.',
  },
  rhythm: {
    goal: '내려오는 노트를 판정선에 맞춰 두드리세요. 많이 놓치면 끝입니다.',
    how: '노트가 선에 닿는 순간 그 줄의 버튼을 탭하세요.',
    score: '정확할수록, 연속으로 맞힐수록 많이 받습니다.',
  },
  orbit: {
    goal: '사방에서 다가오는 적을 막으세요. 중앙까지 뚫리면 생명이 줄어듭니다.',
    how: '포신이 저절로 돌아갑니다. 적과 일직선이 되는 순간 탭해서 쏘세요.',
    score: '연속으로 맞힐수록 보너스가 커집니다.',
  },
  store: {
    goal: '손님이 원하는 상품을 제때 진열하세요. 헛걸음이 쌓여 평판이 바닥나면 폐업입니다.',
    how: '진열대를 탭해 창고 재고를 채우고, 재고가 떨어지면 발주하세요.',
    score: '누적 매출이 점수입니다.',
  },
  wordle: {
    goal: '숨은 두 글자 단어를 여섯 번 안에 맞히세요.',
    how: '자음·모음을 눌러 여섯 칸을 채우고 입력하세요. 초록은 자리까지 정답, 노랑은 자리만 틀린 것입니다.',
    score: '적은 횟수로 맞힐수록 높고, 데일리를 연속으로 풀면 보너스가 붙습니다.',
  },
  omok: {
    goal: 'AI보다 먼저 돌 다섯 개를 나란히 놓으세요. 이길수록 상대가 강해집니다.',
    how: '바둑판 교차점을 탭해 검은 돌을 둡니다.',
    score: '연승할수록 점수가 커집니다 — 한 번 지면 끝이에요.',
  },
  deck: {
    goal: '카드로 적을 쓰러뜨리며 나아가세요. 체력이 다하면 끝입니다.',
    how: '손에 든 카드를 탭해 냅니다. 적 머리 위 숫자가 이번 턴에 들어올 피해예요.',
    score: '쓰러뜨린 적이 많을수록 높습니다.',
  },
  autochess: {
    goal: '유닛을 사서 배치하고 자동 전투에서 이기세요. 지면 체력이 깎이고, 다 닳으면 끝입니다.',
    how: '상점에서 유닛을 사고, 같은 유닛을 겹쳐 끌면 한 단계 강해집니다.',
    score: '라운드를 오래 버틸수록 점수가 쌓입니다.',
  },
}

const en: Record<string, Guide> = {
  suika: {
    goal: 'Matching fruits merge into a bigger one. Overflow the jar and the run ends.',
    how: 'Slide left and right to aim, then tap to drop.',
    score: 'Bigger fruits are worth far more.',
  },
  blockblast: {
    goal: 'Fill a full row or column to clear it. When no block fits, the run ends.',
    how: 'Drag one of the three blocks onto the grid.',
    score: 'Clearing several lines at once pays more.',
  },
  brick: {
    goal: 'Bounce the ball to break bricks. If bricks reach the bottom, the run ends.',
    how: 'Pull back from the bottom to aim, release to launch. Spend the gold you earn on attack or extra balls.',
    score: 'Survive more waves to score higher. Upgrades start over every run.',
  },
  fruit2048: {
    goal: 'Slide matching fruits together to merge them. No moves left means game over.',
    how: 'Swipe up, down, left or right.',
    score: 'The merged number is your score.',
  },
  runner: {
    goal: 'Run as far as you can while dodging obstacles. One hit ends the run.',
    how: 'Tap to jump, tap again in mid-air for a double jump.',
    score: 'Distance run plus coins collected.',
  },
  dodge: {
    goal: 'Survive as long as you can under the falling objects.',
    how: 'Drag left and right to move.',
    score: 'Time survived is your score.',
  },
  survivor: {
    goal: 'Stay alive in the swarm. When your health runs out, the run ends.',
    how: 'Just drag to move — attacks are automatic. Pick an upgrade on level up.',
    score: 'Kills plus time survived.',
  },
  merge: {
    goal: 'Merge plants into golden pots. Reach the target count in time to advance a stage.',
    how: 'Tap Spawn to drop seeds, then drag matching plants onto each other.',
    score: '100 per pot, plus 5 for every second left when you clear a stage.',
  },
  match3: {
    goal: 'Line up three or more jewels to hit the target. Run out of moves and it ends.',
    how: 'Swap two neighbouring jewels.',
    score: 'Bigger clears pay more.',
  },
  tripeaks: {
    goal: 'Clear the peaks by taking cards one rank above or below the base card.',
    how: 'Tap any card that fits. Out of moves? Flip a card from the stock.',
    score: 'Longer streaks build a multiplier.',
  },
  nonogram: {
    goal: 'Use the edge numbers to fill the picture. Three mistakes end the run.',
    how: 'Switch between fill and mark, then tap or drag across cells.',
    score: 'Bigger puzzles and leftover lives score higher.',
  },
  sudoku: {
    goal: 'Fill 1–9 without repeats in every row, column and 3×3 box. Three mistakes end the run.',
    how: 'Pick a cell, then press a number on the pad below.',
    score: 'Faster solves score higher, and daily streaks add a bonus.',
  },
  pipes: {
    goal: 'Rotate pipes so water reaches every end. Running out of time ends the run.',
    how: 'Each tap turns a tile 90 degrees.',
    score: 'Bigger boards and leftover time score higher.',
  },
  defense: {
    goal: 'Hold back the waves. When your lives run out, the run ends.',
    how: 'Spend gold to summon towers, and drag matching towers together to upgrade.',
    score: 'Score builds the longer you hold.',
  },
  jump: {
    goal: 'Climb as high as you can in three minutes.',
    how: 'Hold to charge, release to jump. Press further to the side to leap sideways.',
    score: 'Your highest point in metres.',
  },
  rhythm: {
    goal: 'Hit the falling notes on the line. Miss too many and the run ends.',
    how: 'Tap the lane button the moment its note touches the line.',
    score: 'Accuracy and combo both raise your score.',
  },
  orbit: {
    goal: 'Stop enemies closing in from every side. Each breach costs a life.',
    how: 'The turret spins on its own — tap to fire when it lines up.',
    score: 'Consecutive hits build a bonus.',
  },
  store: {
    goal: 'Restock what customers want in time. Enough angry customers and you close down.',
    how: 'Tap a shelf to restock from storage, and order more when storage runs low.',
    score: 'Total revenue.',
  },
  wordle: {
    goal: 'Guess the hidden two-syllable word within six tries.',
    how: 'Tap letters to fill six slots and submit. Green is the right spot, yellow is the wrong spot.',
    score: 'Fewer guesses score higher, and daily streaks add a bonus.',
  },
  omok: {
    goal: 'Line up five stones before the AI does. Each win makes it tougher.',
    how: 'Tap an intersection to place your black stone.',
    score: 'Win streaks score higher — one loss ends the run.',
  },
  deck: {
    goal: 'Fight through enemies with your cards. When your health runs out, the run ends.',
    how: 'Tap a card in hand to play it. The number above the enemy is its incoming damage.',
    score: 'More enemies defeated, higher score.',
  },
  autochess: {
    goal: 'Buy units, place them, and win the auto battles. Losing costs health.',
    how: 'Buy from the shop and drag matching units together to upgrade them.',
    score: 'Score builds the longer you survive.',
  },
}

export function guideFor(slug: string): Guide | null {
  const table = locale.value === 'ko' ? ko : en
  return table[slug] ?? en[slug] ?? null
}

// 게임 추가 시 가이드 누락을 잡기 위한 검사용
export const GUIDE_SLUGS = Object.keys(ko)
export const GUIDE_TABLES = { ko, en }
