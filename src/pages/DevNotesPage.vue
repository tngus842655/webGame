<script setup lang="ts">
import { computed } from 'vue'
import { DEV_NOTES } from '@/shared/devNotes'
import { t } from '@/shared/i18n'

// 최신 기록이 위로
const notes = computed(() => [...DEV_NOTES].sort((a, b) => b.date.localeCompare(a.date)))
</script>

<template>
  <div class="notes">
    <header class="notes-header">
      <RouterLink class="back" to="/settings">←</RouterLink>
      <h1>{{ t('notes.title') }}</h1>
    </header>

    <ol class="timeline">
      <li v-for="(note, i) in notes" :key="i" class="entry">
        <div class="marker" />
        <article class="card">
          <div class="meta">
            <time>{{ note.date }}</time>
            <h2>{{ note.title }}</h2>
          </div>
          <ul>
            <li v-for="(item, j) in note.items" :key="j">{{ item }}</li>
          </ul>
        </article>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.notes {
  padding: 20px 16px 40px;
}

.notes-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.back {
  font-size: 22px;
  padding: 4px 8px;
}

.notes-header h1 {
  font-size: 20px;
}

.timeline {
  list-style: none;
  position: relative;
  padding-left: 22px;
}

/* 세로 타임라인 선 */
.timeline::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  background: rgb(141 110 99 / 0.22);
}

.entry {
  position: relative;
  margin-bottom: 14px;
}

.marker {
  position: absolute;
  left: -22px;
  top: 20px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #43a047;
  box-shadow: 0 0 0 3px #fff8e1;
}

.card {
  background: #fff;
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 2px 8px rgb(93 64 55 / 0.07);
}

.meta {
  margin-bottom: 8px;
}

.meta time {
  font-size: 12px;
  color: #bcaaa4;
}

.meta h2 {
  font-size: 16px;
  margin-top: 2px;
}

.card ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card li {
  position: relative;
  padding-left: 12px;
  font-size: 13.5px;
  line-height: 1.5;
  color: #6d5750;
}

.card li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #d7ccc8;
}
</style>
