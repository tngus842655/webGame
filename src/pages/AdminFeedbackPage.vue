<script setup lang="ts">
// 운영자 전용 — 사용자가 보낸 의견을 최신순으로 읽는다.
// 답변 기능은 없다. 여기서 하는 일은 읽고 다음 커밋에 반영할지 판단하는 것까지다.
import { onMounted, ref } from 'vue'
import { fetchFeedback, FEEDBACK_KINDS, type FeedbackItem } from '@/shared/feedback'
import { locale, t, type TranslationKey } from '@/shared/i18n'
import UiIcon from '@/shared/UiIcon.vue'

const items = ref<FeedbackItem[]>([])
const loading = ref(true)
const failed = ref(false)

const KIND_LABELS = new Map<string, TranslationKey>(
  FEEDBACK_KINDS.map((option) => [option.kind, option.labelKey]),
)

onMounted(async () => {
  try {
    items.value = await fetchFeedback()
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})

// 언제 온 것인지가 판단 재료라 날짜와 시각을 함께 본다
function when(iso: string): string {
  return new Date(iso).toLocaleString(locale.value, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="admin-feedback">
    <header class="page-header">
      <RouterLink class="back" to="/admin"><UiIcon name="back" /></RouterLink>
      <h1>{{ t('admin.feedback') }}</h1>
      <span v-if="items.length" class="total">{{ items.length }}</span>
    </header>

    <p v-if="loading" class="notice">{{ t('ranking.loading') }}</p>
    <p v-else-if="failed" class="notice">{{ t('ranking.error') }}</p>
    <p v-else-if="items.length === 0" class="notice">{{ t('admin.feedbackEmpty') }}</p>
    <ul v-else class="list">
      <li v-for="item in items" :key="item.id" class="card">
        <div class="head">
          <span class="badge" :class="item.kind">{{ t(KIND_LABELS.get(item.kind)!) }}</span>
          <span class="who">{{ item.nickname }}</span>
          <time>{{ when(item.createdAt) }}</time>
        </div>
        <h2>{{ item.title }}</h2>
        <p class="body">{{ item.body }}</p>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.admin-feedback {
  padding: 20px 16px 32px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.page-header h1 {
  flex: 1;
  font-size: 20px;
}

.total {
  font-size: 13px;
  color: var(--ink-faint);
}

.notice {
  padding: 40px 0;
  text-align: center;
  color: var(--ink-muted);
}

.list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card {
  padding: 14px 16px;
  background: var(--surface);
  border-radius: 14px;
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 11px;
  color: var(--ink-faint);
}

.badge {
  padding: 3px 9px;
  border-radius: 999px;
  font-weight: bold;
}

/* 버그가 먼저 눈에 띄어야 한다 — 나머지 둘은 읽는 순서가 급하지 않다 */
.badge.bug {
  background: #ffebee;
  color: #c62828;
}

.badge.ask {
  background: #e3f2fd;
  color: #1565c0;
}

.badge.idea {
  background: #e8f5e9;
  color: #2e7d32;
}

.who {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ink-muted);
}

.card h2 {
  font-size: 15px;
  line-height: 1.4;
  color: var(--ink);
  word-break: keep-all;
}

.body {
  margin-top: 6px;
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--ink-body);
  /* 사용자가 나눈 줄바꿈을 그대로 살린다 */
  white-space: pre-wrap;
  word-break: break-word;
  /* 길게 쓴 글이 목록을 다 밀어내지 않도록 카드 안에서 굴린다 */
  max-height: 300px;
  overflow-y: auto;
}

[data-theme='dark'] .badge.bug {
  background: rgb(198 40 40 / 0.22);
  color: #ef9a9a;
}

[data-theme='dark'] .badge.ask {
  background: rgb(21 101 192 / 0.24);
  color: #90caf9;
}

[data-theme='dark'] .badge.idea {
  background: rgb(46 125 50 / 0.22);
  color: #a5d6a7;
}
</style>
