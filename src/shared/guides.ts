import { locale, type Locale } from './i18n'

// 게임 설명 가이드 — 플레이 화면의 ? 버튼으로 여는 팝업 내용.
// 게임마다 세 줄만 쓴다: 목표 / 조작 / 점수. 길면 읽지 않는다.
// i18n.ts가 이미 크기 때문에 여기서 따로 관리한다. 13개 언어를 모두 채운다.

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
  wordle: {
    goal: '숨은 두 글자 단어를 여섯 번 안에 맞히세요.',
    how: '자음·모음을 눌러 여섯 칸을 채우고 입력하세요. 초록은 자리까지 정답, 노랑은 자리만 틀린 것입니다.',
    score: '적은 횟수로 맞힐수록 높고, 데일리를 연속으로 풀면 보너스가 붙습니다.',
  },
  omok: {
    goal: '1단부터 10단까지 AI를 차례로 꺾으세요. 10단을 이기면 완전 정복입니다.',
    how: '바둑판 교차점을 탭해 검은 돌을 둡니다. 6단부터는 내 차례에만 시계가 갑니다.',
    score: '단이 오를수록 통과 점수가 커지고, 6단부터는 남긴 시간만큼 더 받습니다.',
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
  wordle: {
    goal: 'Guess the hidden two-syllable word within six tries.',
    how: 'Tap letters to fill six slots and submit. Green is the right spot, yellow is the wrong spot.',
    score: 'Fewer guesses score higher, and daily streaks add a bonus.',
  },
  omok: {
    goal: 'Beat the AI from stage 1 through 10. Clear stage 10 to finish the run.',
    how: 'Tap an intersection to place your black stone. From stage 6 your clock runs on your turn.',
    score: 'Higher stages pay more, and from stage 6 leftover time adds a bonus.',
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

const ja: Record<string, Guide> = {
  suika: {
    goal: '同じ果物どうしがぶつかると大きな果物になります。通からあふれると終了です。',
    how: '左右に動かして位置を決め、タップして落とします。',
    score: '果物が大きいほど点数が大きく上がります。',
  },
  blockblast: {
    goal: 'ブロックを置いて縦か横の1列を埋めると消えます。置く場所がなくなると終了です。',
    how: '下の3つのブロックから1つをドラッグして盤面に置きます。',
    score: '一度に複数の列を消すほど高得点です。',
  },
  brick: {
    goal: 'ボールを弾ませてブロックを壊します。ブロックが下まで来ると終了です。',
    how: '下から引いて角度を決め、離すと発射します。稼いだゴールドは攻撃力かボール数に使えます。',
    score: 'ウェーブを長く耐えるほど高得点。強化は毎回リセットされます。',
  },
  fruit2048: {
    goal: '同じ数字の果物を寄せて合体させます。動かせなくなると終了です。',
    how: '画面を上下左右にスワイプします。',
    score: '合体した数字がそのまま点数になります。',
  },
  runner: {
    goal: '障害物を避けてできるだけ遠くまで走ります。ぶつかると終了です。',
    how: 'タップでジャンプ、空中でもう一度タップで二段ジャンプ。',
    score: '走った距離＋拾ったコイン。',
  },
  dodge: {
    goal: '上から落ちてくる物を避けて長く生き残ります。',
    how: '左右にドラッグして動きます。',
    score: '耐えた時間がそのまま点数です。',
  },
  survivor: {
    goal: '群がる敵の中で生き延びます。体力が尽きると終了です。',
    how: 'ドラッグで移動するだけ、攻撃は自動です。レベルアップ時に強化を1つ選びます。',
    score: '撃破数と生存時間の合計。',
  },
  merge: {
    goal: '同じ植物を合体させて黄金の鉢を作ります。制限時間内に目標数を満たすと次のステージへ。',
    how: '生成ボタンで種を置き、同じ絵柄どうしをドラッグして重ねます。',
    score: '鉢1つで100点、ステージ突破時は残り1秒ごとに5点。',
  },
  match3: {
    goal: '宝石を3つ以上並べて目標を達成します。移動回数を使い切ると終了です。',
    how: '隣り合う宝石を2つ入れ替えます。',
    score: '一度に多く消すほど有利です。',
  },
  tripeaks: {
    goal: '場札より1つ大きいか小さいカードを取って山を崩します。',
    how: '条件に合うカードをタップ。出せるカードがなければ山札を1枚めくります。',
    score: '連続で取るほど倍率が上がります。',
  },
  nonogram: {
    goal: '端の数字を手がかりにマスを塗って絵を完成させます。3回間違えると終了です。',
    how: '塗る・×印を切り替えてマスをタップまたはスワイプします。',
    score: 'パズルが大きいほど、ライフが多く残るほど高得点。',
  },
  sudoku: {
    goal: '縦・横・3×3のマスに1〜9を重複なく埋めます。3回間違えると終了です。',
    how: 'マスを選び、下の数字パッドから数字を押します。',
    score: '速く解くほど高得点。デイリーを連続で解くとボーナス。',
  },
  pipes: {
    goal: 'パイプを回してポンプからすべての端まで水を流します。時間切れで終了です。',
    how: 'タイルをタップするたびに90度回ります。',
    score: '盤面が大きいほど、時間を多く残すほど高得点。',
  },
  defense: {
    goal: '押し寄せる敵を食い止めます。ライフが尽きると終了です。',
    how: 'ゴールドでタワーを召喚し、同じタワーどうしをドラッグして強化します。',
    score: '長く耐えるほど点数が伸びます。',
  },
  jump: {
    goal: '3分間でできるだけ高く登ります。',
    how: '押して力をため、離してジャンプ。横に寄せて押すほど横に跳びます。',
    score: '到達した最高地点（メートル）。',
  },
  rhythm: {
    goal: '落ちてくるノーツをラインで叩きます。ミスが多いと終了です。',
    how: 'ノーツがラインに触れた瞬間、そのレーンのボタンをタップ。',
    score: '精度とコンボの両方が点数を上げます。',
  },
  orbit: {
    goal: '四方から迫る敵を食い止めます。突破されるたびにライフが減ります。',
    how: '砲台は自動で回ります。狙いが合った瞬間にタップして撃ちます。',
    score: '連続で当てるほどボーナスが付きます。',
  },
  wordle: {
    goal: '隠された2文字の単語を6回以内に当てます。',
    how: '文字をタップして6マスを埋め、送信します。緑は位置も正解、黄色は位置違い。',
    score: '少ない回数ほど高得点。デイリー連続でボーナス。',
  },
  omok: {
    goal: '1段から10段までAIに勝ちます。10段を突破すると完全クリアです。',
    how: '交点をタップして黒石を置きます。6段からは自分の番に時間が減ります。',
    score: '段が上がるほど高得点。6段からは残り時間もボーナスになります。',
  },
  deck: {
    goal: 'カードで敵と戦います。体力が尽きると終了です。',
    how: '手札のカードをタップして使います。敵の上の数字は次に来るダメージです。',
    score: '倒した敵が多いほど高得点。',
  },
  autochess: {
    goal: 'ユニットを買って配置し、自動戦闘に勝ちます。負けると体力が減ります。',
    how: 'ショップで購入し、同じユニットどうしをドラッグして強化します。',
    score: '長く生き残るほど点数が伸びます。',
  },
}

const zhCN: Record<string, Guide> = {
  suika: {
    goal: '相同的水果碰在一起会合成更大的水果。溢出罐子就结束。',
    how: '左右移动确定位置，点击放下。',
    score: '水果越大，分数越高。',
  },
  blockblast: {
    goal: '放置方块填满一整行或一整列即可消除。没有地方放就结束。',
    how: '把下方三个方块中的一个拖到格子上。',
    score: '一次消除多行得分更多。',
  },
  brick: {
    goal: '弹球打砖块。砖块落到底部就结束。',
    how: '从下方拖动瞄准，松手发射。用赚到的金币提升攻击力或球数。',
    score: '撑过越多波次分数越高。强化每局重新开始。',
  },
  fruit2048: {
    goal: '把相同数字的水果推到一起合并。无法移动时结束。',
    how: '向上下左右滑动屏幕。',
    score: '合并出的数字就是分数。',
  },
  runner: {
    goal: '躲避障碍尽量跑远。撞到就结束。',
    how: '点击跳跃，空中再点一次可二段跳。',
    score: '跑的距离加上收集的金币。',
  },
  dodge: {
    goal: '躲开落下的物体，坚持得越久越好。',
    how: '左右拖动移动。',
    score: '坚持的时间就是分数。',
  },
  survivor: {
    goal: '在敌群中活下来。生命耗尽就结束。',
    how: '拖动移动即可，攻击是自动的。升级时选择一项强化。',
    score: '击杀数加生存时间。',
  },
  merge: {
    goal: '合成植物做出金花盆。在限时内达到目标数量就进入下一阶段。',
    how: '点生成放下种子，再把相同图案拖到一起。',
    score: '每个花盆100分，通关时每剩1秒加5分。',
  },
  match3: {
    goal: '把三个以上宝石连成一线达成目标。步数用完就结束。',
    how: '交换相邻的两个宝石。',
    score: '一次消除越多越有利。',
  },
  tripeaks: {
    goal: '取走比底牌大一点或小一点的牌来清空牌山。',
    how: '点击符合条件的牌。没牌可出就从牌堆翻一张。',
    score: '连续取牌会累积倍率。',
  },
  nonogram: {
    goal: '根据边上的数字涂格子完成图案。错三次就结束。',
    how: '切换涂色与标记，然后点击或滑过格子。',
    score: '谜题越大、剩余生命越多，分数越高。',
  },
  sudoku: {
    goal: '在每行、每列和每个3×3宫内填入不重复的1–9。错三次就结束。',
    how: '选中格子，再按下方数字键。',
    score: '解得越快分数越高，每日连续还有奖励。',
  },
  pipes: {
    goal: '旋转管道让水从泵流到每个末端。时间用完就结束。',
    how: '每点一次方块就旋转90度。',
    score: '棋盘越大、剩余时间越多，分数越高。',
  },
  defense: {
    goal: '挡住一波波敌人。生命耗尽就结束。',
    how: '用金币召唤防御塔，把相同的塔拖到一起升级。',
    score: '撑得越久分数越高。',
  },
  jump: {
    goal: '在三分钟内爬得越高越好。',
    how: '按住蓄力，松开跳跃。往侧边按得越远，跳得越偏。',
    score: '到达的最高点（米）。',
  },
  rhythm: {
    goal: '在判定线上击中落下的音符。失误太多就结束。',
    how: '音符碰到判定线的瞬间点击对应轨道的按钮。',
    score: '准确度和连击都会提高分数。',
  },
  orbit: {
    goal: '挡住从四面逼近的敌人。每被突破一次损失一条命。',
    how: '炮台自动旋转，对准时点击开火。',
    score: '连续命中会累积奖励。',
  },
  wordle: {
    goal: '六次以内猜出隐藏的两字词。',
    how: '点击字母填满六格后提交。绿色表示位置正确，黄色表示位置错误。',
    score: '猜的次数越少分数越高，每日连续还有奖励。',
  },
  omok: {
    goal: '从第1段打到第10段战胜AI。通过第10段即完全通关。',
    how: '点击交叉点落黑子。第6段起轮到你时开始计时。',
    score: '段位越高分数越高，第6段起剩余时间还有奖励。',
  },
  deck: {
    goal: '用卡牌与敌人战斗。生命耗尽就结束。',
    how: '点击手牌使用。敌人上方的数字是它即将造成的伤害。',
    score: '击败的敌人越多分数越高。',
  },
  autochess: {
    goal: '购买单位并布阵，赢下自动战斗。战败会扣生命。',
    how: '在商店购买，把相同单位拖到一起升级。',
    score: '活得越久分数越高。',
  },
}

const es: Record<string, Guide> = {
  suika: {
    goal: 'Las frutas iguales se fusionan en una mayor. Si el tarro se desborda, se acaba.',
    how: 'Desliza a izquierda y derecha para apuntar y toca para soltar.',
    score: 'Las frutas grandes valen mucho más.',
  },
  blockblast: {
    goal: 'Completa una fila o columna para borrarla. Si no cabe ningún bloque, se acaba.',
    how: 'Arrastra uno de los tres bloques a la cuadrícula.',
    score: 'Borrar varias líneas a la vez da más puntos.',
  },
  brick: {
    goal: 'Rebota la bola para romper ladrillos. Si los ladrillos llegan abajo, se acaba.',
    how: 'Tira hacia atrás desde abajo para apuntar y suelta para lanzar. Gasta el oro en ataque o en más bolas.',
    score: 'Aguanta más oleadas para puntuar más. Las mejoras se reinician cada partida.',
  },
  fruit2048: {
    goal: 'Junta frutas iguales para fusionarlas. Sin movimientos, se acaba.',
    how: 'Desliza arriba, abajo, izquierda o derecha.',
    score: 'El número fusionado es tu puntuación.',
  },
  runner: {
    goal: 'Corre lo más lejos posible esquivando obstáculos. Un golpe y se acaba.',
    how: 'Toca para saltar y toca otra vez en el aire para el doble salto.',
    score: 'Distancia recorrida más monedas.',
  },
  dodge: {
    goal: 'Sobrevive lo máximo posible bajo los objetos que caen.',
    how: 'Arrastra a izquierda y derecha para moverte.',
    score: 'El tiempo aguantado es tu puntuación.',
  },
  survivor: {
    goal: 'Sobrevive entre la horda. Si te quedas sin vida, se acaba.',
    how: 'Solo arrastra para moverte: el ataque es automático. Elige una mejora al subir de nivel.',
    score: 'Bajas más tiempo sobrevivido.',
  },
  merge: {
    goal: 'Fusiona plantas hasta lograr macetas doradas. Alcanza el objetivo a tiempo para pasar de fase.',
    how: 'Toca Generar para soltar semillas y arrastra plantas iguales una sobre otra.',
    score: '100 por maceta y 5 por cada segundo restante al superar una fase.',
  },
  match3: {
    goal: 'Alinea tres o más joyas para llegar al objetivo. Sin movimientos, se acaba.',
    how: 'Intercambia dos joyas vecinas.',
    score: 'Cuantas más elimines de golpe, mejor.',
  },
  tripeaks: {
    goal: 'Retira cartas una por encima o por debajo de la carta base para limpiar los picos.',
    how: 'Toca cualquier carta que encaje. ¿Sin jugadas? Voltea una del mazo.',
    score: 'Las rachas largas suben el multiplicador.',
  },
  nonogram: {
    goal: 'Usa los números del borde para completar el dibujo. Tres fallos y se acaba.',
    how: 'Cambia entre pintar y marcar, y toca o arrastra sobre las casillas.',
    score: 'Puzles más grandes y vidas restantes puntúan más.',
  },
  sudoku: {
    goal: 'Rellena del 1 al 9 sin repetir en cada fila, columna y caja de 3×3. Tres fallos y se acaba.',
    how: 'Elige una casilla y pulsa un número en el teclado de abajo.',
    score: 'Resolver rápido puntúa más y las rachas diarias dan bonus.',
  },
  pipes: {
    goal: 'Gira las tuberías para que el agua llegue a todos los extremos. Si se acaba el tiempo, se acaba.',
    how: 'Cada toque gira una pieza 90 grados.',
    score: 'Tableros grandes y tiempo restante puntúan más.',
  },
  defense: {
    goal: 'Frena las oleadas. Si te quedas sin vidas, se acaba.',
    how: 'Gasta oro para invocar torres y arrastra torres iguales para mejorarlas.',
    score: 'Cuanto más aguantes, más puntos.',
  },
  jump: {
    goal: 'Sube lo más alto que puedas en tres minutos.',
    how: 'Mantén para cargar y suelta para saltar. Presiona más hacia un lado para saltar en esa dirección.',
    score: 'Tu punto más alto en metros.',
  },
  rhythm: {
    goal: 'Golpea las notas en la línea. Demasiados fallos y se acaba.',
    how: 'Toca el botón del carril justo cuando su nota llega a la línea.',
    score: 'La precisión y el combo suben la puntuación.',
  },
  orbit: {
    goal: 'Detén a los enemigos que se acercan por todos lados. Cada brecha cuesta una vida.',
    how: 'La torreta gira sola: toca para disparar cuando esté alineada.',
    score: 'Los aciertos seguidos dan bonus.',
  },
  wordle: {
    goal: 'Adivina la palabra oculta de dos sílabas en seis intentos.',
    how: 'Toca las letras para llenar seis huecos y envía. Verde es posición correcta, amarillo es posición equivocada.',
    score: 'Menos intentos puntúan más y las rachas diarias dan bonus.',
  },
  omok: {
    goal: 'Gana a la IA desde el nivel 1 hasta el 10. Supera el nivel 10 para completar la partida.',
    how: 'Toca una intersección para colocar tu piedra negra. Desde el nivel 6 tu reloj corre en tu turno.',
    score: 'Los niveles altos dan más y desde el 6 el tiempo restante suma bonus.',
  },
  deck: {
    goal: 'Combate a los enemigos con tus cartas. Si te quedas sin vida, se acaba.',
    how: 'Toca una carta de la mano para jugarla. El número sobre el enemigo es el daño que hará.',
    score: 'Cuantos más enemigos derrotes, más puntos.',
  },
  autochess: {
    goal: 'Compra unidades, colócalas y gana las batallas automáticas. Perder cuesta salud.',
    how: 'Compra en la tienda y arrastra unidades iguales para mejorarlas.',
    score: 'Cuanto más sobrevivas, más puntos.',
  },
}

const ptBR: Record<string, Guide> = {
  suika: {
    goal: 'Frutas iguais se juntam em uma maior. Se transbordar do pote, acaba.',
    how: 'Deslize para os lados para mirar e toque para soltar.',
    score: 'Frutas maiores valem muito mais.',
  },
  blockblast: {
    goal: 'Complete uma linha ou coluna para limpá-la. Se nenhum bloco couber, acaba.',
    how: 'Arraste um dos três blocos para a grade.',
    score: 'Limpar várias linhas de uma vez rende mais.',
  },
  brick: {
    goal: 'Rebata a bola para quebrar os tijolos. Se os tijolos chegarem ao fundo, acaba.',
    how: 'Puxe de baixo para mirar e solte para lançar. Gaste o ouro em ataque ou em mais bolas.',
    score: 'Aguente mais ondas para pontuar mais. As melhorias reiniciam a cada partida.',
  },
  fruit2048: {
    goal: 'Junte frutas iguais para fundi-las. Sem jogadas, acaba.',
    how: 'Deslize para cima, baixo, esquerda ou direita.',
    score: 'O número fundido é a sua pontuação.',
  },
  runner: {
    goal: 'Corra o mais longe possível desviando dos obstáculos. Uma batida e acaba.',
    how: 'Toque para pular e toque de novo no ar para o pulo duplo.',
    score: 'Distância percorrida mais moedas.',
  },
  dodge: {
    goal: 'Sobreviva o máximo que puder sob os objetos que caem.',
    how: 'Arraste para os lados para se mover.',
    score: 'O tempo sobrevivido é a sua pontuação.',
  },
  survivor: {
    goal: 'Sobreviva no meio da horda. Se a vida acabar, acaba.',
    how: 'Basta arrastar para andar — o ataque é automático. Escolha uma melhoria ao subir de nível.',
    score: 'Abates mais tempo sobrevivido.',
  },
  merge: {
    goal: 'Junte plantas até formar vasos dourados. Alcance a meta a tempo para avançar de fase.',
    how: 'Toque em Gerar para soltar sementes e arraste plantas iguais umas sobre as outras.',
    score: '100 por vaso e 5 por segundo restante ao concluir uma fase.',
  },
  match3: {
    goal: 'Alinhe três ou mais joias para bater a meta. Sem jogadas, acaba.',
    how: 'Troque duas joias vizinhas.',
    score: 'Quanto mais limpar de uma vez, melhor.',
  },
  tripeaks: {
    goal: 'Retire cartas um valor acima ou abaixo da carta base para limpar os picos.',
    how: 'Toque em qualquer carta que sirva. Sem jogadas? Vire uma do monte.',
    score: 'Sequências longas aumentam o multiplicador.',
  },
  nonogram: {
    goal: 'Use os números das bordas para completar o desenho. Três erros e acaba.',
    how: 'Alterne entre pintar e marcar, depois toque ou arraste pelas casas.',
    score: 'Puzzles maiores e vidas restantes pontuam mais.',
  },
  sudoku: {
    goal: 'Preencha de 1 a 9 sem repetir em cada linha, coluna e quadro 3×3. Três erros e acaba.',
    how: 'Escolha uma casa e toque num número no teclado abaixo.',
    score: 'Resolver rápido pontua mais e sequências diárias dão bônus.',
  },
  pipes: {
    goal: 'Gire os canos para a água chegar a todas as pontas. Se o tempo acabar, acaba.',
    how: 'Cada toque gira uma peça 90 graus.',
    score: 'Tabuleiros maiores e tempo restante pontuam mais.',
  },
  defense: {
    goal: 'Segure as ondas. Se as vidas acabarem, acaba.',
    how: 'Gaste ouro para invocar torres e arraste torres iguais para melhorá-las.',
    score: 'Quanto mais segurar, mais pontos.',
  },
  jump: {
    goal: 'Suba o mais alto que conseguir em três minutos.',
    how: 'Segure para carregar e solte para pular. Pressione mais para o lado para pular de lado.',
    score: 'Seu ponto mais alto em metros.',
  },
  rhythm: {
    goal: 'Acerte as notas na linha. Errar demais encerra a partida.',
    how: 'Toque no botão da pista no instante em que a nota encosta na linha.',
    score: 'Precisão e combo aumentam a pontuação.',
  },
  orbit: {
    goal: 'Impeça os inimigos que se aproximam de todos os lados. Cada brecha custa uma vida.',
    how: 'A torre gira sozinha — toque para atirar quando estiver alinhada.',
    score: 'Acertos seguidos rendem bônus.',
  },
  wordle: {
    goal: 'Adivinhe a palavra escondida de duas sílabas em seis tentativas.',
    how: 'Toque nas letras para preencher seis espaços e envie. Verde é a posição certa, amarelo é a posição errada.',
    score: 'Menos tentativas pontuam mais e sequências diárias dão bônus.',
  },
  omok: {
    goal: 'Vença a IA do nível 1 ao 10. Passe do nível 10 para concluir a partida.',
    how: 'Toque numa interseção para colocar sua pedra preta. Do nível 6 em diante seu relógio corre na sua vez.',
    score: 'Níveis altos rendem mais e a partir do 6 o tempo restante vira bônus.',
  },
  deck: {
    goal: 'Enfrente os inimigos com suas cartas. Se a vida acabar, acaba.',
    how: 'Toque numa carta da mão para jogá-la. O número acima do inimigo é o dano que ele vai causar.',
    score: 'Quanto mais inimigos derrotar, mais pontos.',
  },
  autochess: {
    goal: 'Compre unidades, posicione-as e vença as batalhas automáticas. Perder custa vida.',
    how: 'Compre na loja e arraste unidades iguais para melhorá-las.',
    score: 'Quanto mais sobreviver, mais pontos.',
  },
}

const fr: Record<string, Guide> = {
  suika: {
    goal: 'Deux fruits identiques fusionnent en un plus gros. Si le bocal déborde, la partie est finie.',
    how: 'Glisse à gauche et à droite pour viser, puis touche pour lâcher.',
    score: 'Les gros fruits rapportent bien plus.',
  },
  blockblast: {
    goal: 'Remplis une ligne ou une colonne pour l\'effacer. Si aucun bloc ne rentre, la partie est finie.',
    how: 'Fais glisser un des trois blocs sur la grille.',
    score: 'Effacer plusieurs lignes d\'un coup rapporte plus.',
  },
  brick: {
    goal: 'Fais rebondir la balle pour casser les briques. Si elles atteignent le bas, la partie est finie.',
    how: 'Tire vers le bas pour viser, relâche pour lancer. Dépense l\'or en attaque ou en balles.',
    score: 'Tiens plus de vagues pour marquer plus. Les améliorations repartent de zéro à chaque partie.',
  },
  fruit2048: {
    goal: 'Rapproche les fruits identiques pour les fusionner. Plus de coup possible et c\'est fini.',
    how: 'Balaie vers le haut, le bas, la gauche ou la droite.',
    score: 'Le nombre fusionné devient ton score.',
  },
  runner: {
    goal: 'Cours le plus loin possible en évitant les obstacles. Un choc et c\'est fini.',
    how: 'Touche pour sauter, touche encore en l\'air pour un double saut.',
    score: 'Distance parcourue plus les pièces ramassées.',
  },
  dodge: {
    goal: 'Survis le plus longtemps possible sous les objets qui tombent.',
    how: 'Glisse à gauche et à droite pour te déplacer.',
    score: 'Le temps tenu est ton score.',
  },
  survivor: {
    goal: 'Reste en vie dans la horde. Quand ta santé tombe à zéro, c\'est fini.',
    how: 'Glisse simplement pour bouger, les tirs sont automatiques. Choisis une amélioration à chaque niveau.',
    score: 'Éliminations plus temps de survie.',
  },
  merge: {
    goal: 'Fusionne les plantes pour obtenir des pots dorés. Atteins l\'objectif à temps pour passer au palier suivant.',
    how: 'Touche Générer pour poser des graines, puis fais glisser les plantes identiques l\'une sur l\'autre.',
    score: '100 par pot, plus 5 par seconde restante à la fin d\'un palier.',
  },
  match3: {
    goal: 'Aligne trois joyaux ou plus pour atteindre l\'objectif. Plus de coups et c\'est fini.',
    how: 'Échange deux joyaux voisins.',
    score: 'Plus tu en fais sauter d\'un coup, mieux c\'est.',
  },
  tripeaks: {
    goal: 'Retire les cartes d\'un rang au-dessus ou en dessous de la carte de base pour vider les pics.',
    how: 'Touche une carte compatible. Plus de coup ? Retourne une carte de la pioche.',
    score: 'Les séries longues font monter le multiplicateur.',
  },
  nonogram: {
    goal: 'Utilise les chiffres des bords pour reconstituer l\'image. Trois erreurs et c\'est fini.',
    how: 'Bascule entre remplir et marquer, puis touche ou glisse sur les cases.',
    score: 'Les grandes grilles et les vies restantes rapportent plus.',
  },
  sudoku: {
    goal: 'Remplis de 1 à 9 sans répétition dans chaque ligne, colonne et bloc de 3×3. Trois erreurs et c\'est fini.',
    how: 'Choisis une case, puis appuie sur un chiffre du pavé.',
    score: 'Résoudre vite rapporte plus, et les séries quotidiennes donnent un bonus.',
  },
  pipes: {
    goal: 'Tourne les tuyaux pour que l\'eau atteigne chaque extrémité. Le temps écoulé met fin à la partie.',
    how: 'Chaque appui fait pivoter une tuile de 90 degrés.',
    score: 'Les grands plateaux et le temps restant rapportent plus.',
  },
  defense: {
    goal: 'Contiens les vagues. Quand tes vies sont épuisées, c\'est fini.',
    how: 'Dépense de l\'or pour invoquer des tours et fais glisser deux tours identiques pour les améliorer.',
    score: 'Plus tu tiens, plus tu marques.',
  },
  jump: {
    goal: 'Grimpe le plus haut possible en trois minutes.',
    how: 'Maintiens pour charger, relâche pour sauter. Appuie plus sur le côté pour sauter de côté.',
    score: 'Ton point le plus haut, en mètres.',
  },
  rhythm: {
    goal: 'Frappe les notes qui descendent sur la ligne. Trop de ratés et c\'est fini.',
    how: 'Touche le bouton de la voie au moment où sa note atteint la ligne.',
    score: 'La précision et le combo font monter le score.',
  },
  orbit: {
    goal: 'Arrête les ennemis qui arrivent de tous les côtés. Chaque passage coûte une vie.',
    how: 'La tourelle tourne toute seule : touche pour tirer quand elle est alignée.',
    score: 'Les tirs réussis d\'affilée donnent un bonus.',
  },
  wordle: {
    goal: 'Devine le mot caché de deux syllabes en six essais.',
    how: 'Touche les lettres pour remplir six cases puis valide. Vert : bonne place, jaune : mauvaise place.',
    score: 'Moins d\'essais rapporte plus, et les séries quotidiennes donnent un bonus.',
  },
  omok: {
    goal: 'Bats l\'IA du niveau 1 au niveau 10. Réussis le niveau 10 pour terminer la partie.',
    how: 'Touche une intersection pour poser ta pierre noire. À partir du niveau 6, ton temps tourne pendant ton tour.',
    score: 'Les niveaux élevés rapportent plus, et dès le 6 le temps restant donne un bonus.',
  },
  deck: {
    goal: 'Affronte les ennemis avec tes cartes. Quand ta santé tombe à zéro, c\'est fini.',
    how: 'Touche une carte en main pour la jouer. Le nombre au-dessus de l\'ennemi est les dégâts à venir.',
    score: 'Plus tu bats d\'ennemis, plus tu marques.',
  },
  autochess: {
    goal: 'Achète des unités, place-les et gagne les combats automatiques. Une défaite coûte de la santé.',
    how: 'Achète en boutique et fais glisser deux unités identiques pour les améliorer.',
    score: 'Plus tu survis, plus tu marques.',
  },
}

const de: Record<string, Guide> = {
  suika: {
    goal: 'Gleiche Früchte verschmelzen zu einer größeren. Läuft das Glas über, ist Schluss.',
    how: 'Nach links und rechts schieben zum Zielen, dann tippen zum Fallenlassen.',
    score: 'Größere Früchte bringen deutlich mehr.',
  },
  blockblast: {
    goal: 'Füll eine ganze Reihe oder Spalte, um sie zu löschen. Passt kein Block mehr, ist Schluss.',
    how: 'Zieh einen der drei Blöcke auf das Gitter.',
    score: 'Mehrere Reihen auf einmal bringen mehr.',
  },
  brick: {
    goal: 'Lass den Ball abprallen und zerschlag die Steine. Erreichen die Steine den Boden, ist Schluss.',
    how: 'Von unten zurückziehen zum Zielen, loslassen zum Abschuss. Gib das Gold für Angriff oder mehr Bälle aus.',
    score: 'Je mehr Wellen du hältst, desto mehr Punkte. Verbesserungen beginnen jede Runde neu.',
  },
  fruit2048: {
    goal: 'Schieb gleiche Früchte zusammen, um sie zu verschmelzen. Kein Zug mehr möglich, ist Schluss.',
    how: 'Wisch nach oben, unten, links oder rechts.',
    score: 'Die verschmolzene Zahl ist deine Punktzahl.',
  },
  runner: {
    goal: 'Lauf so weit du kannst und weich Hindernissen aus. Ein Treffer beendet die Runde.',
    how: 'Tippen zum Springen, in der Luft nochmal tippen für den Doppelsprung.',
    score: 'Gelaufene Strecke plus gesammelte Münzen.',
  },
  dodge: {
    goal: 'Überleb so lange wie möglich unter den fallenden Objekten.',
    how: 'Nach links und rechts ziehen zum Bewegen.',
    score: 'Die überstandene Zeit ist deine Punktzahl.',
  },
  survivor: {
    goal: 'Bleib im Schwarm am Leben. Geht die Gesundheit aus, ist Schluss.',
    how: 'Einfach ziehen zum Bewegen — angegriffen wird automatisch. Bei jedem Stufenaufstieg eine Verbesserung wählen.',
    score: 'Abschüsse plus überlebte Zeit.',
  },
  merge: {
    goal: 'Verbinde Pflanzen zu goldenen Töpfen. Erreich die Zielzahl rechtzeitig für die nächste Stufe.',
    how: 'Auf Erzeugen tippen, um Samen zu setzen, dann gleiche Pflanzen aufeinanderziehen.',
    score: '100 pro Topf, dazu 5 für jede Restsekunde beim Stufenabschluss.',
  },
  match3: {
    goal: 'Bring drei oder mehr Juwelen in eine Reihe, um das Ziel zu erreichen. Ohne Züge ist Schluss.',
    how: 'Tausch zwei benachbarte Juwelen.',
    score: 'Je mehr auf einmal verschwindet, desto besser.',
  },
  tripeaks: {
    goal: 'Räum die Gipfel ab, indem du Karten eine Stufe über oder unter der Basiskarte nimmst.',
    how: 'Tipp auf jede passende Karte. Kein Zug mehr? Dreh eine Karte vom Stapel.',
    score: 'Längere Serien bauen einen Multiplikator auf.',
  },
  nonogram: {
    goal: 'Nutz die Randzahlen, um das Bild zu füllen. Drei Fehler beenden die Runde.',
    how: 'Zwischen Füllen und Markieren wechseln, dann auf Felder tippen oder darüberziehen.',
    score: 'Größere Rätsel und übrige Leben bringen mehr.',
  },
  sudoku: {
    goal: 'Füll 1–9 ohne Wiederholung in jede Zeile, Spalte und jedes 3×3-Feld. Drei Fehler beenden die Runde.',
    how: 'Feld wählen, dann eine Zahl auf dem Feld darunter drücken.',
    score: 'Schnelleres Lösen bringt mehr, tägliche Serien geben einen Bonus.',
  },
  pipes: {
    goal: 'Dreh die Rohre, bis das Wasser jedes Ende erreicht. Läuft die Zeit ab, ist Schluss.',
    how: 'Jedes Tippen dreht eine Kachel um 90 Grad.',
    score: 'Größere Felder und übrige Zeit bringen mehr.',
  },
  defense: {
    goal: 'Halt die Wellen auf. Gehen die Leben aus, ist Schluss.',
    how: 'Gold ausgeben, um Türme zu beschwören, und gleiche Türme aufeinanderziehen zum Aufwerten.',
    score: 'Je länger du hältst, desto mehr Punkte.',
  },
  jump: {
    goal: 'Klettere in drei Minuten so hoch wie möglich.',
    how: 'Halten zum Aufladen, loslassen zum Springen. Weiter zur Seite drücken springt zur Seite.',
    score: 'Dein höchster Punkt in Metern.',
  },
  rhythm: {
    goal: 'Triff die fallenden Noten auf der Linie. Zu viele Fehler beenden die Runde.',
    how: 'Tipp die Spurtaste genau dann, wenn ihre Note die Linie berührt.',
    score: 'Genauigkeit und Combo erhöhen beide die Punktzahl.',
  },
  orbit: {
    goal: 'Halt die Feinde auf, die von allen Seiten kommen. Jeder Durchbruch kostet ein Leben.',
    how: 'Der Turm dreht sich von selbst — tippen zum Feuern, wenn er ausgerichtet ist.',
    score: 'Treffer in Folge geben einen Bonus.',
  },
  wordle: {
    goal: 'Errate das versteckte zweisilbige Wort in sechs Versuchen.',
    how: 'Buchstaben antippen, um sechs Felder zu füllen, dann abschicken. Grün ist die richtige Stelle, Gelb die falsche.',
    score: 'Weniger Versuche bringen mehr, tägliche Serien geben einen Bonus.',
  },
  omok: {
    goal: 'Schlag die KI von Stufe 1 bis 10. Schaff Stufe 10, um die Runde zu beenden.',
    how: 'Tipp auf einen Schnittpunkt, um deinen schwarzen Stein zu setzen. Ab Stufe 6 läuft deine Uhr in deinem Zug.',
    score: 'Höhere Stufen bringen mehr, ab Stufe 6 gibt übrige Zeit einen Bonus.',
  },
  deck: {
    goal: 'Kämpf dich mit deinen Karten durch die Gegner. Geht die Gesundheit aus, ist Schluss.',
    how: 'Tipp eine Handkarte an, um sie zu spielen. Die Zahl über dem Gegner ist sein kommender Schaden.',
    score: 'Je mehr Gegner besiegt, desto mehr Punkte.',
  },
  autochess: {
    goal: 'Kauf Einheiten, stell sie auf und gewinn die automatischen Kämpfe. Verlieren kostet Gesundheit.',
    how: 'Im Laden kaufen und gleiche Einheiten aufeinanderziehen zum Aufwerten.',
    score: 'Je länger du überlebst, desto mehr Punkte.',
  },
}

const ru: Record<string, Guide> = {
  suika: {
    goal: 'Одинаковые фрукты сливаются в более крупный. Если банка переполнится, игра заканчивается.',
    how: 'Двигайте влево-вправо, чтобы прицелиться, затем нажмите, чтобы бросить.',
    score: 'Крупные фрукты стоят гораздо больше.',
  },
  blockblast: {
    goal: 'Заполните целый ряд или столбец, чтобы очистить его. Если ни один блок не помещается, игра заканчивается.',
    how: 'Перетащите один из трёх блоков на поле.',
    score: 'Очистка нескольких линий сразу приносит больше.',
  },
  brick: {
    goal: 'Отбивайте мяч и разбивайте кирпичи. Если кирпичи дойдут до низа, игра заканчивается.',
    how: 'Потяните снизу, чтобы прицелиться, отпустите для запуска. Тратьте золото на урон или на дополнительные шары.',
    score: 'Продержитесь больше волн — больше очков. Улучшения обнуляются каждый раз.',
  },
  fruit2048: {
    goal: 'Сдвигайте одинаковые фрукты, чтобы объединить их. Нет ходов — игра окончена.',
    how: 'Проведите вверх, вниз, влево или вправо.',
    score: 'Полученное число и есть ваши очки.',
  },
  runner: {
    goal: 'Бегите как можно дальше, уворачиваясь от препятствий. Одно столкновение — конец.',
    how: 'Нажмите для прыжка, в воздухе ещё раз — двойной прыжок.',
    score: 'Пройденное расстояние плюс собранные монеты.',
  },
  dodge: {
    goal: 'Продержитесь как можно дольше под падающими предметами.',
    how: 'Тяните влево и вправо, чтобы двигаться.',
    score: 'Время выживания — это ваши очки.',
  },
  survivor: {
    goal: 'Выживайте в толпе врагов. Когда здоровье кончится, игра заканчивается.',
    how: 'Просто тяните, чтобы двигаться, — атака автоматическая. При повышении уровня выберите улучшение.',
    score: 'Убийства плюс время выживания.',
  },
  merge: {
    goal: 'Объединяйте растения в золотые горшки. Наберите нужное количество вовремя, чтобы пройти этап.',
    how: 'Нажмите «Создать», чтобы посадить семена, затем перетаскивайте одинаковые растения друг на друга.',
    score: '100 за горшок и ещё 5 за каждую оставшуюся секунду при прохождении этапа.',
  },
  match3: {
    goal: 'Соберите три или больше самоцветов в ряд, чтобы выполнить цель. Кончатся ходы — конец.',
    how: 'Меняйте местами два соседних самоцвета.',
    score: 'Чем больше уберёте за раз, тем лучше.',
  },
  tripeaks: {
    goal: 'Разбирайте пики, забирая карты на одно значение выше или ниже базовой.',
    how: 'Нажмите на подходящую карту. Нет ходов? Переверните карту из колоды.',
    score: 'Длинные серии повышают множитель.',
  },
  nonogram: {
    goal: 'По числам на краях закрасьте картинку. Три ошибки — конец.',
    how: 'Переключайтесь между закраской и меткой, затем нажимайте или ведите по клеткам.',
    score: 'Большие головоломки и оставшиеся жизни дают больше очков.',
  },
  sudoku: {
    goal: 'Заполните 1–9 без повторов в каждой строке, столбце и квадрате 3×3. Три ошибки — конец.',
    how: 'Выберите клетку и нажмите цифру на панели снизу.',
    score: 'Быстрое решение даёт больше очков, а ежедневная серия — бонус.',
  },
  pipes: {
    goal: 'Поворачивайте трубы, чтобы вода дошла до каждого конца. Время вышло — конец.',
    how: 'Каждое нажатие поворачивает плитку на 90 градусов.',
    score: 'Большие поля и оставшееся время дают больше очков.',
  },
  defense: {
    goal: 'Сдерживайте волны. Когда жизни кончатся, игра заканчивается.',
    how: 'Тратьте золото на башни и перетаскивайте одинаковые башни друг на друга для улучшения.',
    score: 'Чем дольше держитесь, тем больше очков.',
  },
  jump: {
    goal: 'Заберитесь как можно выше за три минуты.',
    how: 'Удерживайте для набора силы, отпустите для прыжка. Нажмите ближе к краю, чтобы прыгнуть вбок.',
    score: 'Ваша наибольшая высота в метрах.',
  },
  rhythm: {
    goal: 'Попадайте по нотам на линии. Слишком много промахов — конец.',
    how: 'Нажмите кнопку дорожки в тот момент, когда её нота касается линии.',
    score: 'И точность, и комбо повышают очки.',
  },
  orbit: {
    goal: 'Останавливайте врагов, подступающих со всех сторон. Каждый прорыв стоит жизни.',
    how: 'Турель вращается сама — нажмите, чтобы выстрелить, когда она наведена.',
    score: 'Попадания подряд дают бонус.',
  },
  wordle: {
    goal: 'Угадайте скрытое двусложное слово за шесть попыток.',
    how: 'Нажимайте буквы, чтобы заполнить шесть ячеек, и отправьте. Зелёный — верное место, жёлтый — неверное.',
    score: 'Меньше попыток — больше очков, ежедневная серия даёт бонус.',
  },
  omok: {
    goal: 'Победите ИИ с 1-го по 10-й этап. Пройдите 10-й этап, чтобы завершить игру.',
    how: 'Нажмите на пересечение, чтобы поставить чёрный камень. С 6-го этапа во время вашего хода идут часы.',
    score: 'Высокие этапы дают больше, а с 6-го оставшееся время приносит бонус.',
  },
  deck: {
    goal: 'Сражайтесь с врагами картами. Когда здоровье кончится, игра заканчивается.',
    how: 'Нажмите карту в руке, чтобы сыграть её. Число над врагом — его предстоящий урон.',
    score: 'Чем больше врагов побеждено, тем больше очков.',
  },
  autochess: {
    goal: 'Покупайте бойцов, расставляйте их и выигрывайте автобои. Поражение стоит здоровья.',
    how: 'Покупайте в магазине и перетаскивайте одинаковых бойцов друг на друга для улучшения.',
    score: 'Чем дольше выживаете, тем больше очков.',
  },
}

const id: Record<string, Guide> = {
  suika: {
    goal: 'Buah yang sama akan menyatu jadi lebih besar. Kalau meluap dari toples, permainan berakhir.',
    how: 'Geser kiri-kanan untuk membidik, lalu ketuk untuk menjatuhkan.',
    score: 'Buah yang lebih besar bernilai jauh lebih tinggi.',
  },
  blockblast: {
    goal: 'Isi satu baris atau kolom penuh untuk menghapusnya. Kalau tidak ada blok yang muat, permainan berakhir.',
    how: 'Seret salah satu dari tiga blok ke papan.',
    score: 'Menghapus beberapa baris sekaligus memberi lebih banyak nilai.',
  },
  brick: {
    goal: 'Pantulkan bola untuk memecah bata. Kalau bata sampai ke bawah, permainan berakhir.',
    how: 'Tarik dari bawah untuk membidik, lepas untuk menembak. Pakai emas untuk kerusakan atau bola tambahan.',
    score: 'Bertahan lebih banyak gelombang berarti nilai lebih tinggi. Peningkatan diulang tiap main.',
  },
  fruit2048: {
    goal: 'Dorong buah bernomor sama agar menyatu. Kalau tidak ada langkah lagi, permainan berakhir.',
    how: 'Geser ke atas, bawah, kiri, atau kanan.',
    score: 'Angka hasil penyatuan menjadi nilaimu.',
  },
  runner: {
    goal: 'Berlari sejauh mungkin sambil menghindari rintangan. Sekali tertabrak, berakhir.',
    how: 'Ketuk untuk melompat, ketuk lagi di udara untuk lompat ganda.',
    score: 'Jarak tempuh ditambah koin yang dikumpulkan.',
  },
  dodge: {
    goal: 'Bertahan selama mungkin di bawah benda yang jatuh.',
    how: 'Seret ke kiri dan kanan untuk bergerak.',
    score: 'Lama bertahan adalah nilaimu.',
  },
  survivor: {
    goal: 'Tetap hidup di tengah kerumunan. Kalau nyawa habis, permainan berakhir.',
    how: 'Cukup seret untuk bergerak — serangan otomatis. Pilih satu peningkatan saat naik level.',
    score: 'Jumlah bunuh ditambah lama bertahan.',
  },
  merge: {
    goal: 'Gabungkan tanaman menjadi pot emas. Capai jumlah target tepat waktu untuk naik tahap.',
    how: 'Ketuk Buat untuk menaruh benih, lalu seret tanaman yang sama agar bertumpuk.',
    score: '100 per pot, ditambah 5 untuk setiap detik tersisa saat menyelesaikan tahap.',
  },
  match3: {
    goal: 'Sejajarkan tiga permata atau lebih untuk mencapai target. Kalau langkah habis, berakhir.',
    how: 'Tukar dua permata yang bersebelahan.',
    score: 'Semakin banyak yang pecah sekaligus, semakin baik.',
  },
  tripeaks: {
    goal: 'Bersihkan puncak dengan mengambil kartu satu tingkat di atas atau di bawah kartu dasar.',
    how: 'Ketuk kartu yang cocok. Tidak ada langkah? Balik satu kartu dari tumpukan.',
    score: 'Rentetan panjang menambah pengali.',
  },
  nonogram: {
    goal: 'Gunakan angka di tepi untuk mengisi gambar. Tiga kesalahan mengakhiri permainan.',
    how: 'Ganti antara warnai dan tandai, lalu ketuk atau seret melintasi kotak.',
    score: 'Teka-teki lebih besar dan sisa nyawa memberi nilai lebih tinggi.',
  },
  sudoku: {
    goal: 'Isi 1–9 tanpa pengulangan di setiap baris, kolom, dan kotak 3×3. Tiga kesalahan mengakhiri permainan.',
    how: 'Pilih kotak, lalu tekan angka di papan bawah.',
    score: 'Menyelesaikan lebih cepat memberi nilai lebih tinggi, dan rentetan harian menambah bonus.',
  },
  pipes: {
    goal: 'Putar pipa agar air sampai ke setiap ujung. Kalau waktu habis, permainan berakhir.',
    how: 'Setiap ketukan memutar ubin 90 derajat.',
    score: 'Papan lebih besar dan sisa waktu memberi nilai lebih tinggi.',
  },
  defense: {
    goal: 'Tahan gelombang musuh. Kalau nyawa habis, permainan berakhir.',
    how: 'Pakai emas untuk memanggil menara, dan seret menara yang sama untuk meningkatkannya.',
    score: 'Semakin lama bertahan, semakin tinggi nilainya.',
  },
  jump: {
    goal: 'Naik setinggi mungkin dalam tiga menit.',
    how: 'Tahan untuk mengisi tenaga, lepas untuk melompat. Tekan lebih ke samping untuk melompat menyamping.',
    score: 'Titik tertinggimu dalam meter.',
  },
  rhythm: {
    goal: 'Pukul not yang jatuh tepat di garis. Terlalu banyak meleset mengakhiri permainan.',
    how: 'Ketuk tombol jalur saat notnya menyentuh garis.',
    score: 'Ketepatan dan kombo sama-sama menaikkan nilai.',
  },
  orbit: {
    goal: 'Hentikan musuh yang mendekat dari segala arah. Setiap jebolan mengurangi nyawa.',
    how: 'Meriam berputar sendiri — ketuk untuk menembak saat sudah lurus.',
    score: 'Tembakan beruntun menambah bonus.',
  },
  wordle: {
    goal: 'Tebak kata dua suku kata yang tersembunyi dalam enam percobaan.',
    how: 'Ketuk huruf untuk mengisi enam kotak lalu kirim. Hijau berarti posisi benar, kuning berarti posisi salah.',
    score: 'Semakin sedikit tebakan semakin tinggi nilainya, dan rentetan harian menambah bonus.',
  },
  omok: {
    goal: 'Kalahkan AI dari tahap 1 sampai 10. Lewati tahap 10 untuk menyelesaikan permainan.',
    how: 'Ketuk persimpangan untuk menaruh batu hitammu. Mulai tahap 6 waktumu berjalan saat giliranmu.',
    score: 'Tahap lebih tinggi memberi lebih banyak, dan mulai tahap 6 sisa waktu menambah bonus.',
  },
  deck: {
    goal: 'Lawan musuh dengan kartumu. Kalau nyawa habis, permainan berakhir.',
    how: 'Ketuk kartu di tangan untuk memainkannya. Angka di atas musuh adalah kerusakan yang akan datang.',
    score: 'Semakin banyak musuh dikalahkan, semakin tinggi nilainya.',
  },
  autochess: {
    goal: 'Beli unit, tempatkan, dan menangkan pertarungan otomatis. Kalah mengurangi nyawa.',
    how: 'Beli di toko dan seret unit yang sama untuk meningkatkannya.',
    score: 'Semakin lama bertahan, semakin tinggi nilainya.',
  },
}

const vi: Record<string, Guide> = {
  suika: {
    goal: 'Hai quả giống nhau chạm vào sẽ ghép thành quả lớn hơn. Tràn khỏi hũ là kết thúc.',
    how: 'Trượt trái phải để nhắm rồi chạm để thả.',
    score: 'Quả càng lớn điểm càng cao.',
  },
  blockblast: {
    goal: 'Lấp đầy một hàng hoặc một cột để xóa nó. Không còn chỗ đặt khối là kết thúc.',
    how: 'Kéo một trong ba khối bên dưới vào lưới.',
    score: 'Xóa nhiều hàng cùng lúc được nhiều điểm hơn.',
  },
  brick: {
    goal: 'Nảy bóng để phá gạch. Gạch xuống tới đáy là kết thúc.',
    how: 'Kéo từ dưới lên để nhắm, thả ra để bắn. Dùng vàng kiếm được cho sát thương hoặc thêm bóng.',
    score: 'Trụ được càng nhiều đợt điểm càng cao. Nâng cấp làm lại từ đầu mỗi ván.',
  },
  fruit2048: {
    goal: 'Đẩy các quả cùng số vào nhau để ghép. Hết nước đi là kết thúc.',
    how: 'Vuốt lên, xuống, trái hoặc phải.',
    score: 'Số ghép được chính là điểm của bạn.',
  },
  runner: {
    goal: 'Chạy càng xa càng tốt và né chướng ngại vật. Va một lần là kết thúc.',
    how: 'Chạm để nhảy, chạm lần nữa giữa không trung để nhảy đúp.',
    score: 'Quãng đường chạy cộng số xu nhặt được.',
  },
  dodge: {
    goal: 'Sống sót càng lâu càng tốt dưới những vật rơi xuống.',
    how: 'Kéo trái phải để di chuyển.',
    score: 'Thời gian trụ được chính là điểm.',
  },
  survivor: {
    goal: 'Sống sót giữa bầy địch. Hết máu là kết thúc.',
    how: 'Chỉ cần kéo để di chuyển — bắn tự động. Lên cấp thì chọn một nâng cấp.',
    score: 'Số địch hạ được cộng thời gian sống sót.',
  },
  merge: {
    goal: 'Ghép cây để tạo chậu vàng. Đạt đủ số lượng trong thời gian quy định để sang màn kế.',
    how: 'Chạm Tạo để thả hạt, rồi kéo các cây giống nhau chồng lên nhau.',
    score: '100 điểm mỗi chậu, cộng 5 điểm cho mỗi giây còn lại khi qua màn.',
  },
  match3: {
    goal: 'Xếp ba viên ngọc trở lên thành hàng để đạt mục tiêu. Hết lượt là kết thúc.',
    how: 'Đổi chỗ hai viên ngọc cạnh nhau.',
    score: 'Phá càng nhiều một lúc càng có lợi.',
  },
  tripeaks: {
    goal: 'Dọn các đỉnh bằng cách lấy lá bài hơn hoặc kém lá gốc một bậc.',
    how: 'Chạm vào lá bài phù hợp. Hết nước? Lật một lá từ chồng bài.',
    score: 'Chuỗi càng dài hệ số càng cao.',
  },
  nonogram: {
    goal: 'Dựa vào số ở rìa để tô kín bức tranh. Sai ba lần là kết thúc.',
    how: 'Chuyển giữa tô và đánh dấu, rồi chạm hoặc kéo qua các ô.',
    score: 'Câu đố càng lớn và càng còn nhiều mạng thì điểm càng cao.',
  },
  sudoku: {
    goal: 'Điền 1–9 không lặp trong mỗi hàng, cột và ô 3×3. Sai ba lần là kết thúc.',
    how: 'Chọn một ô rồi bấm số trên bàn phím bên dưới.',
    score: 'Giải càng nhanh điểm càng cao, chuỗi ngày liên tiếp có thưởng thêm.',
  },
  pipes: {
    goal: 'Xoay ống để nước chảy tới mọi đầu ra. Hết giờ là kết thúc.',
    how: 'Mỗi lần chạm sẽ xoay ô 90 độ.',
    score: 'Bàn càng lớn và càng dư thời gian thì điểm càng cao.',
  },
  defense: {
    goal: 'Chặn các đợt tấn công. Hết mạng là kết thúc.',
    how: 'Dùng vàng để triệu hồi trụ, kéo hai trụ giống nhau vào nhau để nâng cấp.',
    score: 'Trụ càng lâu điểm càng cao.',
  },
  jump: {
    goal: 'Leo cao nhất có thể trong ba phút.',
    how: 'Giữ để tích lực, thả để nhảy. Bấm lệch sang bên để nhảy ngang.',
    score: 'Điểm cao nhất bạn đạt tới, tính bằng mét.',
  },
  rhythm: {
    goal: 'Đánh trúng nốt rơi ngay trên vạch. Trượt quá nhiều là kết thúc.',
    how: 'Chạm nút của làn ngay khi nốt chạm vạch.',
    score: 'Cả độ chính xác lẫn chuỗi combo đều tăng điểm.',
  },
  orbit: {
    goal: 'Chặn kẻ địch áp sát từ mọi phía. Mỗi lần bị lọt là mất một mạng.',
    how: 'Tháp pháo tự xoay — chạm để bắn khi đã ngắm trúng.',
    score: 'Bắn trúng liên tiếp sẽ được thưởng thêm.',
  },
  wordle: {
    goal: 'Đoán từ hai âm tiết bị ẩn trong sáu lượt.',
    how: 'Chạm chữ để điền sáu ô rồi gửi. Xanh là đúng vị trí, vàng là sai vị trí.',
    score: 'Càng ít lượt đoán điểm càng cao, chuỗi ngày liên tiếp có thưởng thêm.',
  },
  omok: {
    goal: 'Thắng AI từ màn 1 đến màn 10. Qua màn 10 là hoàn thành.',
    how: 'Chạm vào giao điểm để đặt quân đen. Từ màn 6 đồng hồ chạy trong lượt của bạn.',
    score: 'Màn càng cao điểm càng nhiều, từ màn 6 thời gian còn lại được cộng thưởng.',
  },
  deck: {
    goal: 'Dùng bài để chiến đấu với kẻ địch. Hết máu là kết thúc.',
    how: 'Chạm lá bài trên tay để dùng. Số phía trên kẻ địch là sát thương sắp tới.',
    score: 'Hạ càng nhiều kẻ địch điểm càng cao.',
  },
  autochess: {
    goal: 'Mua quân, xếp đội hình và thắng các trận tự động. Thua sẽ mất máu.',
    how: 'Mua ở cửa hàng và kéo các quân giống nhau vào nhau để nâng cấp.',
    score: 'Sống sót càng lâu điểm càng cao.',
  },
}

const th: Record<string, Guide> = {
  suika: {
    goal: 'ผลไม้เหมือนกันชนกันจะรวมเป็นผลใหญ่ขึ้น ถ้าล้นออกจากโหลก็จบ',
    how: 'เลื่อนซ้ายขวาเพื่อเล็ง แล้วแตะเพื่อปล่อย',
    score: 'ผลไม้ยิ่งใหญ่ยิ่งได้คะแนนสูง',
  },
  blockblast: {
    goal: 'วางบล็อกให้เต็มแถวหรือคอลัมน์เพื่อล้างออก ถ้าไม่มีที่วางบล็อกก็จบ',
    how: 'ลากบล็อกหนึ่งในสามอันด้านล่างลงบนตาราง',
    score: 'ล้างหลายแถวพร้อมกันได้คะแนนมากกว่า',
  },
  brick: {
    goal: 'กระดอนลูกบอลเพื่อทุบอิฐ ถ้าอิฐลงมาถึงพื้นก็จบ',
    how: 'ลากจากด้านล่างเพื่อเล็ง ปล่อยเพื่อยิง ใช้ทองที่ได้เพิ่มพลังโจมตีหรือจำนวนลูกบอล',
    score: 'ทนได้หลายเวฟยิ่งได้คะแนนสูง การอัปเกรดเริ่มใหม่ทุกเกม',
  },
  fruit2048: {
    goal: 'ดันผลไม้ตัวเลขเดียวกันมารวมกัน ถ้าขยับไม่ได้แล้วก็จบ',
    how: 'ปัดหน้าจอขึ้น ลง ซ้าย หรือขวา',
    score: 'ตัวเลขที่รวมได้คือคะแนนของคุณ',
  },
  runner: {
    goal: 'วิ่งให้ไกลที่สุดพร้อมหลบสิ่งกีดขวาง ชนครั้งเดียวก็จบ',
    how: 'แตะเพื่อกระโดด แตะอีกครั้งกลางอากาศเพื่อกระโดดสองชั้น',
    score: 'ระยะทางที่วิ่งบวกเหรียญที่เก็บได้',
  },
  dodge: {
    goal: 'เอาตัวรอดให้นานที่สุดใต้สิ่งของที่ตกลงมา',
    how: 'ลากซ้ายขวาเพื่อเคลื่อนที่',
    score: 'เวลาที่รอดคือคะแนนของคุณ',
  },
  survivor: {
    goal: 'เอาชีวิตรอดท่ามกลางฝูงศัตรู ถ้าพลังชีวิตหมดก็จบ',
    how: 'แค่ลากเพื่อเคลื่อนที่ การโจมตีเป็นอัตโนมัติ เลือกอัปเกรดเมื่อเลเวลอัพ',
    score: 'จำนวนที่สังหารบวกเวลาที่รอด',
  },
  merge: {
    goal: 'รวมต้นไม้ให้เป็นกระถางทอง ทำครบตามเป้าในเวลาที่กำหนดเพื่อไปด่านถัดไป',
    how: 'แตะสร้างเพื่อวางเมล็ด แล้วลากต้นไม้แบบเดียวกันมาซ้อนกัน',
    score: 'กระถางละ 100 คะแนน และอีก 5 คะแนนต่อทุกวินาทีที่เหลือเมื่อผ่านด่าน',
  },
  match3: {
    goal: 'เรียงอัญมณีสามเม็ดขึ้นไปให้ถึงเป้าหมาย ถ้าเดินครบจำนวนก็จบ',
    how: 'สลับอัญมณีสองเม็ดที่อยู่ติดกัน',
    score: 'ยิ่งระเบิดได้มากในครั้งเดียวยิ่งดี',
  },
  tripeaks: {
    goal: 'เก็บไพ่ที่มีแต้มมากหรือน้อยกว่าไพ่ฐานหนึ่งแต้มเพื่อล้างกองไพ่',
    how: 'แตะไพ่ที่เข้าเงื่อนไข ถ้าไม่มีไพ่ให้ลงก็เปิดไพ่จากกอง',
    score: 'เก็บต่อเนื่องยิ่งยาวตัวคูณยิ่งสูง',
  },
  nonogram: {
    goal: 'ใช้ตัวเลขที่ขอบเป็นใบ้เพื่อระบายให้เป็นภาพ ผิดสามครั้งก็จบ',
    how: 'สลับระหว่างระบายกับทำเครื่องหมาย แล้วแตะหรือลากผ่านช่อง',
    score: 'ปริศนายิ่งใหญ่และเหลือชีวิตมากยิ่งได้คะแนนสูง',
  },
  sudoku: {
    goal: 'เติม 1–9 โดยไม่ซ้ำในทุกแถว ทุกคอลัมน์ และทุกตาราง 3×3 ผิดสามครั้งก็จบ',
    how: 'เลือกช่องแล้วกดตัวเลขจากแป้นด้านล่าง',
    score: 'แก้ได้เร็วยิ่งได้คะแนนสูง และการเล่นรายวันต่อเนื่องมีโบนัส',
  },
  pipes: {
    goal: 'หมุนท่อให้น้ำไหลจากปั๊มไปถึงปลายทุกจุด ถ้าหมดเวลาก็จบ',
    how: 'แตะแต่ละช่องเพื่อหมุนทีละ 90 องศา',
    score: 'กระดานยิ่งใหญ่และเหลือเวลามากยิ่งได้คะแนนสูง',
  },
  defense: {
    goal: 'ต้านทานศัตรูที่บุกเข้ามา ถ้าชีวิตหมดก็จบ',
    how: 'ใช้ทองเรียกป้อม แล้วลากป้อมแบบเดียวกันมารวมเพื่ออัปเกรด',
    score: 'ยิ่งต้านได้นานยิ่งได้คะแนนสูง',
  },
  jump: {
    goal: 'ปีนให้สูงที่สุดภายในสามนาที',
    how: 'กดค้างเพื่อสะสมพลัง ปล่อยเพื่อกระโดด กดเยื้องไปด้านข้างเพื่อกระโดดออกข้าง',
    score: 'จุดสูงสุดที่ไปถึง หน่วยเป็นเมตร',
  },
  rhythm: {
    goal: 'ตีโน้ตที่ตกลงมาให้ตรงเส้น ถ้าพลาดมากเกินไปก็จบ',
    how: 'แตะปุ่มของเลนตอนที่โน้ตแตะเส้นพอดี',
    score: 'ทั้งความแม่นยำและคอมโบช่วยเพิ่มคะแนน',
  },
  orbit: {
    goal: 'สกัดศัตรูที่เข้ามาจากทุกทิศ ทุกครั้งที่หลุดจะเสียชีวิตหนึ่ง',
    how: 'ป้อมหมุนเอง แตะเพื่อยิงตอนที่เล็งตรง',
    score: 'ยิงโดนต่อเนื่องจะได้โบนัส',
  },
  wordle: {
    goal: 'ทายคำสองพยางค์ที่ซ่อนอยู่ภายในหกครั้ง',
    how: 'แตะตัวอักษรให้ครบหกช่องแล้วส่ง สีเขียวคือถูกตำแหน่ง สีเหลืองคือผิดตำแหน่ง',
    score: 'ทายน้อยครั้งยิ่งได้คะแนนสูง และเล่นรายวันต่อเนื่องมีโบนัส',
  },
  omok: {
    goal: 'เอาชนะ AI ตั้งแต่ด่าน 1 ถึง 10 ผ่านด่าน 10 ถือว่าจบเกม',
    how: 'แตะจุดตัดเพื่อวางหมากดำ ตั้งแต่ด่าน 6 นาฬิกาจะเดินในตาของคุณ',
    score: 'ด่านยิ่งสูงยิ่งได้คะแนนมาก และตั้งแต่ด่าน 6 เวลาที่เหลือจะเป็นโบนัส',
  },
  deck: {
    goal: 'ใช้การ์ดสู้กับศัตรู ถ้าพลังชีวิตหมดก็จบ',
    how: 'แตะการ์ดในมือเพื่อใช้ ตัวเลขเหนือศัตรูคือความเสียหายที่กำลังจะมา',
    score: 'ล้มศัตรูได้มากยิ่งได้คะแนนสูง',
  },
  autochess: {
    goal: 'ซื้อหน่วย จัดวาง แล้วชนะการต่อสู้อัตโนมัติ ถ้าแพ้จะเสียพลังชีวิต',
    how: 'ซื้อจากร้านค้าและลากหน่วยแบบเดียวกันมารวมเพื่ออัปเกรด',
    score: 'อยู่รอดยิ่งนานยิ่งได้คะแนนสูง',
  },
}

const tr: Record<string, Guide> = {
  suika: {
    goal: 'Aynı meyveler birleşip daha büyüğünü oluşturur. Kavanoz taşarsa oyun biter.',
    how: 'Nişan almak için sağa sola kaydır, bırakmak için dokun.',
    score: 'Büyük meyveler çok daha fazla değer.',
  },
  blockblast: {
    goal: 'Bir satırı ya da sütunu tamamen doldurup temizle. Hiçbir blok sığmazsa oyun biter.',
    how: 'Alttaki üç bloktan birini ızgaraya sürükle.',
    score: 'Aynı anda birden fazla satır temizlemek daha çok kazandırır.',
  },
  brick: {
    goal: 'Topu sektirip tuğlaları kır. Tuğlalar alta ulaşırsa oyun biter.',
    how: 'Nişan almak için alttan geri çek, fırlatmak için bırak. Kazandığın altını hasara ya da fazladan topa harca.',
    score: 'Daha çok dalga dayanmak daha çok puan demek. Geliştirmeler her oyunda sıfırlanır.',
  },
  fruit2048: {
    goal: 'Aynı sayılı meyveleri birbirine itip birleştir. Hamle kalmazsa oyun biter.',
    how: 'Ekranı yukarı, aşağı, sola ya da sağa kaydır.',
    score: 'Birleşen sayı doğrudan puanın olur.',
  },
  runner: {
    goal: 'Engellerden kaçarak olabildiğince uzağa koş. Bir çarpma oyunu bitirir.',
    how: 'Zıplamak için dokun, havadayken tekrar dokunup çift zıplama yap.',
    score: 'Koşulan mesafe artı toplanan altınlar.',
  },
  dodge: {
    goal: 'Düşen cisimlerin altında olabildiğince uzun dayan.',
    how: 'Hareket etmek için sağa sola sürükle.',
    score: 'Dayandığın süre puanın olur.',
  },
  survivor: {
    goal: 'Sürünün ortasında hayatta kal. Canın biterse oyun biter.',
    how: 'Hareket için sadece sürükle — saldırı otomatik. Seviye atlayınca bir geliştirme seç.',
    score: 'Öldürme sayısı artı hayatta kalma süresi.',
  },
  merge: {
    goal: 'Bitkileri birleştirip altın saksı yap. Süre dolmadan hedef sayıya ulaşırsan bir sonraki aşamaya geçersin.',
    how: 'Tohum bırakmak için Üret\'e dokun, sonra aynı bitkileri üst üste sürükle.',
    score: 'Saksı başına 100, aşamayı geçerken kalan her saniye için 5 puan.',
  },
  match3: {
    goal: 'Hedefe ulaşmak için üç ya da daha fazla mücevheri sırala. Hamlen biterse oyun biter.',
    how: 'Yan yana iki mücevheri yer değiştir.',
    score: 'Bir seferde ne kadar çok patlatırsan o kadar iyi.',
  },
  tripeaks: {
    goal: 'Taban karttan bir üst ya da bir alt kartları alarak tepeleri temizle.',
    how: 'Uyan herhangi bir karta dokun. Hamlen mi kalmadı? Desteden bir kart çevir.',
    score: 'Uzun seriler çarpanı yükseltir.',
  },
  nonogram: {
    goal: 'Kenardaki sayıları kullanarak resmi doldur. Üç hata oyunu bitirir.',
    how: 'Doldurma ve işaretleme arasında geçiş yap, sonra karelere dokun ya da üzerlerinden sürükle.',
    score: 'Büyük bulmacalar ve kalan canlar daha çok puan verir.',
  },
  sudoku: {
    goal: 'Her satır, sütun ve 3×3 kutuya 1–9 arası sayıları tekrarsız yerleştir. Üç hata oyunu bitirir.',
    how: 'Bir kare seç, sonra alttaki tuş takımından bir sayıya bas.',
    score: 'Hızlı çözmek daha çok puan verir, günlük seriler bonus ekler.',
  },
  pipes: {
    goal: 'Boruları çevirip suyun her uca ulaşmasını sağla. Süre biterse oyun biter.',
    how: 'Her dokunuş bir karoyu 90 derece çevirir.',
    score: 'Büyük tahtalar ve kalan süre daha çok puan verir.',
  },
  defense: {
    goal: 'Dalgaları durdur. Canların biterse oyun biter.',
    how: 'Kule çağırmak için altın harca, aynı kuleleri üst üste sürükleyip yükselt.',
    score: 'Ne kadar uzun dayanırsan o kadar çok puan.',
  },
  jump: {
    goal: 'Üç dakikada olabildiğince yükseğe tırman.',
    how: 'Güç toplamak için basılı tut, zıplamak için bırak. Yana doğru bastıkça yana zıplarsın.',
    score: 'Ulaştığın en yüksek nokta, metre olarak.',
  },
  rhythm: {
    goal: 'Düşen notalara çizgi üzerinde vur. Çok kaçırırsan oyun biter.',
    how: 'Notası çizgiye değdiği anda o şeridin düğmesine dokun.',
    score: 'Hem isabet hem kombo puanı yükseltir.',
  },
  orbit: {
    goal: 'Her yönden yaklaşan düşmanları durdur. Her sızma bir cana mal olur.',
    how: 'Taret kendi kendine döner — hizalandığında ateş etmek için dokun.',
    score: 'Peş peşe isabetler bonus kazandırır.',
  },
  wordle: {
    goal: 'Gizli iki heceli kelimeyi altı denemede bul.',
    how: 'Altı kutuyu doldurmak için harflere dokun ve gönder. Yeşil doğru yer, sarı yanlış yer demek.',
    score: 'Az denemede bulmak daha çok puan verir, günlük seriler bonus ekler.',
  },
  omok: {
    goal: 'Yapay zekâyı 1. aşamadan 10. aşamaya kadar yen. 10. aşamayı geçince oyun tamamlanır.',
    how: 'Siyah taşını koymak için bir kesişime dokun. 6. aşamadan itibaren sıra sendeyken saat işler.',
    score: 'Yüksek aşamalar daha çok kazandırır, 6. aşamadan sonra kalan süre bonus ekler.',
  },
  deck: {
    goal: 'Kartlarınla düşmanlarla savaş. Canın biterse oyun biter.',
    how: 'Oynamak için elindeki bir karta dokun. Düşmanın üstündeki sayı vereceği hasardır.',
    score: 'Ne kadar çok düşman yenersen o kadar çok puan.',
  },
  autochess: {
    goal: 'Birim satın al, yerleştir ve otomatik savaşları kazan. Kaybetmek can götürür.',
    how: 'Dükkândan satın al ve aynı birimleri üst üste sürükleyip yükselt.',
    score: 'Ne kadar uzun hayatta kalırsan o kadar çok puan.',
  },
}
const TABLES: Record<Locale, Record<string, Guide>> = {
  ko,
  en,
  ja,
  'zh-CN': zhCN,
  es,
  'pt-BR': ptBR,
  fr,
  de,
  ru,
  id,
  vi,
  th,
  tr,
}

export function guideFor(slug: string): Guide | null {
  return TABLES[locale.value][slug] ?? en[slug] ?? null
}

// 게임 추가 시 가이드 누락을 잡기 위한 검사용
export const GUIDE_SLUGS = Object.keys(ko)
export const GUIDE_TABLES = TABLES
