<script setup lang="ts">
// 통계 세 화면(/stats, /stats/players, /stats/ads)이 함께 쓰는 기간 탭.
// 고른 값은 화면이 아니라 모듈이 들고 있어, 상세로 들어갔다 나와도 그대로다.
import { HALVES, PERIODS, statsCaption, statsHalf, statsPeriod } from './adminPeriod'
import { t } from './i18n'
</script>

<template>
  <div class="tabs">
    <button
      v-for="p in PERIODS"
      :key="p.key"
      type="button"
      :class="{ active: statsPeriod === p.key }"
      @click="statsPeriod = p.key"
    >
      {{ t(p.labelKey) }}
    </button>
  </div>

  <div v-if="statsPeriod !== 'all'" class="tabs halves">
    <button type="button" :class="{ active: statsHalf === 'prev' }" @click="statsHalf = 'prev'">
      {{ t(HALVES[statsPeriod][0]) }}
    </button>
    <button type="button" :class="{ active: statsHalf === 'curr' }" @click="statsHalf = 'curr'">
      {{ t(HALVES[statsPeriod][1]) }}
    </button>
  </div>

  <p v-if="statsCaption" class="caption">{{ statsCaption }}</p>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.tabs button {
  flex: 1;
  padding: 10px 0;
  border: none;
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink-faint);
  font: inherit;
  font-size: 13.5px;
  cursor: pointer;
}

.tabs button.active {
  background: var(--ink-muted);
  color: var(--surface);
  font-weight: bold;
}

/* 기간 탭과 한 묶음으로 읽히도록 붙여 둔다 (인기도 화면과 같다) */
.halves {
  margin-top: -6px;
}

.caption {
  margin: -6px 0 12px;
  font-size: 12px;
  color: var(--ink-faint);
}
</style>
