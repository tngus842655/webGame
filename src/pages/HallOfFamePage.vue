<script setup lang="ts">
// 명예의 전당 — 지난달(KST) 게임별 1~3위를 시상대에 세운다.
// 지난 구간은 다시 계산해도 같은 답이라(scores는 수정·삭제 불가) 스냅샷 없이 매번 조회한다.
import { onMounted, ref } from 'vue'
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { t, type TranslationKey } from '@/shared/i18n'
import { prevMonthLabel } from '@/shared/rankPeriod'
import { fetchHallOfFame, rankedGames, type HallEntry } from '@/shared/scores'
import UiIcon from '@/shared/UiIcon.vue'

const month = prevMonthLabel()

interface Board {
  slug: string
  titleKey: TranslationKey
  stage: boolean
  entries: HallEntry[]
}

const boards = ref<Board[]>([])
const loading = ref(true)
const failed = ref(false)

onMounted(async () => {
  try {
    const byGame = new Map<string, HallEntry[]>()
    for (const row of await fetchHallOfFame()) {
      const list = byGame.get(row.game_slug)
      if (list) list.push(row)
      else byGame.set(row.game_slug, [row])
    }
    // 게임 순서는 랭킹보기와 같은 인기순 — 두 화면을 오가도 같은 자리에서 찾는다.
    // 지난달 기록이 없는 게임은 세울 사람이 없으니 시상대도 없다.
    boards.value = rankedGames(GAMES).flatMap((game) => {
      const entries = byGame.get(game.slug)
      if (!entries) return []
      return [
        {
          slug: game.slug,
          titleKey: game.titleKey,
          stage: game.recordUnit === 'stage',
          entries,
        },
      ]
    })
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})

// 시상대는 2·1·3 순서로 선다
const PODIUM = [2, 1, 3] as const

function at(board: Board, rank: number): HallEntry | null {
  return board.entries.find((entry) => entry.rank === rank) ?? null
}

function record(board: Board, value: number): string {
  const n = value.toLocaleString()
  return board.stage ? t('rank.stage', { n }) : n
}
</script>

<template>
  <div class="hall">
    <header class="hall-header">
      <RouterLink class="back" to="/ranking"><UiIcon name="back" /></RouterLink>
      <h1>{{ t('hall.title') }}</h1>
    </header>
    <p class="month">{{ t('hall.period', { y: month.y, m: month.m }) }}</p>

    <p v-if="loading" class="notice">{{ t('ranking.loading') }}</p>
    <p v-else-if="failed" class="notice">{{ t('ranking.error') }}</p>
    <p v-else-if="boards.length === 0" class="notice">{{ t('hall.empty') }}</p>

    <ul v-else class="boards">
      <li v-for="board in boards" :key="board.slug" class="board">
        <!-- 게임 아이콘이 곧 그 게임의 컨셉 그림이다. 크게 블러를 먹여 게임마다
             다른 색 워시를 깔고, 한 장을 더 또렷하게 뒤에 눕혀 모티프를 남긴다 —
             흰 카드 서른 장이 똑같아 보이지 않도록. 에셋 없이 아이콘을 재활용한다. -->
        <!-- 아이콘 크기는 감싸는 span이 정한다 — svg에 직접 클래스를 얹으면
             GameIcon 자신의 width/height 100% 규칙과 특정도가 같아 승자가 빌드 순서에 갈린다 -->
        <span class="board-art" aria-hidden="true">
          <span class="art-wash"><GameIcon :slug="board.slug" /></span>
          <span class="art-mark"><GameIcon :slug="board.slug" /></span>
        </span>
        <RouterLink class="game" :to="`/ranking/${board.slug}`">
          <span class="game-thumb"><GameIcon :slug="board.slug" /></span>
          <span class="game-title">{{ t(board.titleKey) }}</span>
          <span class="game-arrow"><UiIcon name="chevron" /></span>
        </RouterLink>

        <div class="podium">
          <div v-for="rank in PODIUM" :key="rank" class="spot" :class="`p${rank}`">
            <template v-if="at(board, rank)">
              <span v-if="rank === 1" class="crown"><UiIcon name="crown" /></span>
              <span class="name">{{ at(board, rank)!.nickname }}</span>
              <span class="score">{{ record(board, at(board, rank)!.best_score) }}</span>
            </template>
            <!-- 지난달에 두 명만 겨뤘어도 단은 셋 다 세운다 — 빈 단이 빈 자리를 말해준다 -->
            <span v-else class="name vacant">–</span>
            <div class="block"><span class="num">{{ rank }}</span></div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.hall {
  padding: 20px 16px;
}

.hall-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hall-header h1 {
  font-size: 20px;
}

/* 제목 바로 아래, 어느 달의 시상식인지 */
.month {
  margin: 2px 0 16px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-muted);
}

.notice {
  padding: 40px 0;
  text-align: center;
  color: var(--ink-muted);
}

.boards {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.board {
  position: relative;
  /* 배경 그림이 둥근 모서리 밖으로 튀어나오지 않게 */
  overflow: hidden;
  padding: 4px 14px 16px;
  background: var(--surface);
  border-radius: 16px;
  box-shadow: var(--shadow-card);
}

.board-art {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* 색 워시 — 아이콘을 카드보다 크게 늘리고 뭉개서 색만 남긴다.
   블러 반지름이 아이콘 폭에 비해 커서 형체는 사라지고 게임 고유의 색구름이 된다. */
.art-wash {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 125%;
  aspect-ratio: 1;
  transform: translate(-50%, -52%);
  filter: blur(32px) saturate(1.4);
  opacity: 0.3;
}

/* 모티프 — 같은 아이콘을 또렷하게 우하단에 눕힌다. 시상대 뒤로 반쯤 걸친다. */
.art-mark {
  position: absolute;
  right: -20px;
  bottom: -16px;
  width: 130px;
  height: 130px;
  transform: rotate(-12deg);
  opacity: 0.1;
}

/* 배경 그림은 position이 걸려 있어 가만히 두면 내용 위에 얹힌다 — 내용을 한 층 올린다 */
.game,
.podium {
  position: relative;
}

/* 게임 이름 줄 — 누르면 그 게임의 이번 랭킹으로 간다 (지난달을 봤으면 다음은 이번 달이다) */
.game {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
}

.game-thumb {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
}

.game-title {
  flex: 1;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.game-arrow {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  color: var(--ink-faint);
}

/* ── 시상대 ─────────────────────────────────────────── */
/* 2·1·3이 바닥을 맞추고 단 높이로 순서를 말한다. 윗면을 얇게 얹어
   위에서 내려다본 단상처럼 보이게 한다 — 참고한 시상대 사진의 결이다. */
.podium {
  display: flex;
  align-items: flex-end;
  gap: 5px;
  padding: 4px 6px 0;
}

.spot {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.crown {
  width: 20px;
  height: 20px;
  margin-bottom: 1px;
  color: #e8a812;
  filter: drop-shadow(0 1px 1px rgb(140 68 8 / 0.35));
}

.name {
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--ink);
}

.vacant {
  color: var(--ink-faint);
}

.score {
  margin-bottom: 5px;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ink-muted);
}

.name + .block {
  margin-top: 5px;
}

/* 단상 — 앞면 위에 밝은 윗면을 얹는다. 숫자는 사진처럼 세리프로,
   흰 글자가 금·은·동 어느 앞면에서도 읽히도록 옅은 그림자를 깐다. */
.block {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  border-radius: 3px 3px 5px 5px;
}

.block::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 7px;
  border-radius: 3px 3px 0 0;
  background: rgb(255 255 255 / 0.5);
}

.num {
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px rgb(0 0 0 / 0.28);
}

/* 금·은·동 앞면. 목록 메달과 같은 계열이되 큰 면이라 한 톤 진하게 —
   판 전체가 파스텔이면 시상식이 아니라 안내판이 된다. */
.p1 .block {
  height: 74px;
  background: linear-gradient(#ffd34e, #f5a623);
}

.p2 .block {
  height: 54px;
  background: linear-gradient(#ccd2d8, #a8b1b9);
}

.p3 .block {
  height: 42px;
  background: linear-gradient(#cf7d4a, #b05c2d);
}

.p1 .num {
  font-size: 26px;
}

.p2 .num,
.p3 .num {
  font-size: 20px;
}

/* 어두운 화면에서는 단의 명도만 한 겹 내린다 — 왕관·숫자는 고유색 그대로 */
[data-theme='dark'] .p1 .block {
  background: linear-gradient(#d9a930, #b3821c);
}

[data-theme='dark'] .p2 .block {
  background: linear-gradient(#9aa3ab, #7d868e);
}

[data-theme='dark'] .p3 .block {
  background: linear-gradient(#b0663a, #8f4a22);
}

[data-theme='dark'] .block::before {
  background: rgb(255 255 255 / 0.32);
}

/* 어두운 판에서는 색이 형광으로 뜬다 — 워시를 낮추고 채도도 덜 올린다 */
[data-theme='dark'] .art-wash {
  filter: blur(32px) saturate(1.15);
  opacity: 0.2;
}

[data-theme='dark'] .art-mark {
  opacity: 0.08;
}
</style>
