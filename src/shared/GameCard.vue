<script setup lang="ts">
// 홈과 휴지통이 함께 쓰는 게임 카드.
// 두 화면은 어느 칸에 놓이느냐만 다르고 순위는 하나를 나눠 쓴다 — 휴지통에 있던
// 게임이 다시 올라오면 그 자리에서 바로 메달이 붙어야 하므로 카드를 하나로 둔다.
import GameIcon from './GameIcon.vue'
import { t, type TranslationKey } from './i18n'

defineProps<{
  slug: string
  titleKey: TranslationKey
  rank: number | null
  // 최고 기록·내 순위 — 문구는 화면마다 달라서 밖에서 넘겨받는다
  label: string
}>()

// 1~3위만 메달로 꾸민다
function rankClass(rank: number): string {
  return rank <= 3 ? `medal m${rank}` : ''
}
</script>

<template>
  <RouterLink class="game-card" :to="`/play/${slug}`">
    <span v-if="rank !== null" class="rank" :class="rankClass(rank)">{{ rank }}</span>
    <span class="thumb"><GameIcon :slug="slug" /></span>
    <strong>{{ t(titleKey) }}</strong>
    <small>{{ label }}</small>
  </RouterLink>
</template>

<style scoped>
.game-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 12px 6px 10px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgb(93 64 55 / 0.08);
  text-align: center;
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
  background: #f3eeec;
  color: #a1887f;
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
  width: 48px;
  height: 48px;
  font-size: 30px;
  background: #fff8e1;
  border-radius: 12px;
  margin-bottom: 2px;
}

strong {
  font-size: 13px;
  line-height: 1.25;
  word-break: keep-all;
}

/* 서버에서 순위가 도착하기 전에도 카드 높이가 같도록 한 줄을 비워둔다 */
small {
  font-size: 11px;
  line-height: 14px;
  min-height: 14px;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #bcaaa4;
}
</style>
