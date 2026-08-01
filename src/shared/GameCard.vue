<script setup lang="ts">
// 홈과 휴지통이 함께 쓰는 게임 카드.
// 두 화면은 어느 칸에 놓이느냐만 다르고 순위는 하나를 나눠 쓴다 — 휴지통에 있던
// 게임이 다시 올라오면 그 자리에서 바로 메달이 붙어야 하므로 카드를 하나로 둔다.
import { useRouter } from 'vue-router'
import FavoriteButton from './FavoriteButton.vue'
import GameIcon from './GameIcon.vue'
import { t, type TranslationKey } from './i18n'

const props = defineProps<{
  slug: string
  titleKey: TranslationKey
  rank: number | null
  // 최고 기록·내 순위 — 문구는 화면마다 달라서 밖에서 넘겨받는다
  label: string
  // 홈에서만 별을 붙인다. 휴지통 게임은 즐겨찾기 칸(주 목록 기준)에 올라오지
  // 못하므로, 눌러도 아무 데도 안 나타나는 별을 보여주지 않는다.
  favoritable?: boolean
}>()

// RouterLink(<a>)였을 때는 카드를 길게 누르면 웹뷰가 링크 주소를 띄웠다.
// contextmenu를 막아도 그대로여서 — 웹뷰가 웹 이벤트를 거치지 않고 네이티브에서
// 처리한다 — 링크 자체를 없앤다. 새 탭으로 열기는 잃지만 모바일 전용 화면이라 쓸 일이 없다.
const router = useRouter()

function open() {
  void router.push(`/play/${props.slug}`)
}

// 1~3위만 메달로 꾸민다
function rankClass(rank: number): string {
  return rank <= 3 ? `medal m${rank}` : ''
}
</script>

<template>
  <!-- 별은 카드 버튼 안에 넣을 수 없다 (버튼 안의 버튼). 겹쳐 두고 과녁만 나눈다. -->
  <div class="game-slot">
    <button type="button" class="game-card" @click="open">
      <span v-if="rank !== null" class="rank" :class="rankClass(rank)">{{ rank }}</span>
      <span class="thumb"><GameIcon :slug="slug" /></span>
      <strong>{{ t(titleKey) }}</strong>
      <small>{{ label }}</small>
    </button>
    <FavoriteButton v-if="favoritable" :slug="slug" />
  </div>
</template>

<style scoped>
.game-slot {
  position: relative;
}

.game-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 100%;
  padding: 12px 6px 10px;
  border: none;
  background: var(--surface);
  border-radius: 16px;
  cursor: pointer;
  box-shadow: var(--shadow-raise);
  text-align: center;
  transition:
    transform 0.1s ease,
    box-shadow 0.1s ease;
}

/* 눌리는 게 손끝에 느껴지도록 살짝 가라앉힌다 */
.game-card:active {
  transform: scale(0.96);
  box-shadow: 0 1px 3px rgb(93 64 55 / 0.1);
}

/* 카드 크기는 그대로 두고 왼쪽 위 여백에 얹는다 */
.rank {
  position: absolute;
  top: 5px;
  left: 5px;
  display: grid;
  place-items: center;
  min-width: 21px;
  height: 21px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--line-soft);
  color: var(--ink-faint);
  font-size: 12px;
  font-weight: bold;
  line-height: 1;
}

/* 1~3위는 메달로 */
.rank.medal {
  color: #fff;
  font-size: 13px;
  text-shadow: 0 1px 1px rgb(0 0 0 / 0.2);
}

.rank.m1 {
  background: linear-gradient(#ffd54f, #f9a825);
  box-shadow: 0 2px 6px rgb(249 168 37 / 0.5);
}

.rank.m2 {
  background: linear-gradient(#eceff1, #b0bec5);
  box-shadow: 0 2px 6px rgb(120 144 156 / 0.4);
}

.rank.m3 {
  background: linear-gradient(#d9a679, #b07d4e);
  box-shadow: 0 2px 6px rgb(141 110 99 / 0.4);
}

.thumb {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  padding: 2px;
  background: linear-gradient(#fffdf6, #fff2d4);
  border-radius: 14px;
  margin-bottom: 3px;
}

strong {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--ink);
  word-break: keep-all;
}

/* 서버에서 순위가 도착하기 전에도 카드 높이가 같도록 한 줄을 비워둔다 */
small {
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
  min-height: 14px;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--ink-faint);
}
</style>
