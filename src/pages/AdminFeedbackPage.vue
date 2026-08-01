<script setup lang="ts">
// 운영자 전용 — 사용자가 보낸 의견을 최신순으로 읽는다.
// 답변 기능은 없다. 여기서 하는 일은 읽고 다음 커밋에 반영할지 판단하는 것까지다.
import { onMounted, ref } from 'vue'
import {
  deleteFeedback,
  feedbackSeenAt,
  fetchFeedback,
  FEEDBACK_KINDS,
  markFeedbackSeen,
  unreadFeedback,
  type FeedbackItem,
} from '@/shared/feedback'
import { locale, t, type TranslationKey } from '@/shared/i18n'
import UiIcon from '@/shared/UiIcon.vue'

const items = ref<FeedbackItem[]>([])
const loading = ref(true)
const failed = ref(false)

const KIND_LABELS = new Map<string, TranslationKey>(
  FEEDBACK_KINDS.map((option) => [option.kind, option.labelKey]),
)

// 들어오자마자 읽은 것으로 처리하므로, 표시 기준은 그 전에 붙잡아 둔다.
// 그러지 않으면 이번에 온 새 글에 표시가 하나도 안 붙는다.
let seenBefore = 0

function isNew(item: FeedbackItem): boolean {
  return new Date(item.createdAt).getTime() > seenBefore
}

onMounted(async () => {
  const seen = feedbackSeenAt()
  seenBefore = seen ? new Date(seen).getTime() : 0
  try {
    items.value = await fetchFeedback()
    markFeedbackSeen(items.value[0]?.createdAt)
    unreadFeedback.value = 0
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})

// 지우기 — 되돌릴 수 없으니 한 번 더 묻는다. 목록 안에서 묻는 일이라 팝업을 띄우지
// 않고 그 카드의 버튼 자리에서 물어본다 (계정 삭제 화면과 같은 방식).
const pending = ref(0)
const deleting = ref(false)
const error = ref('')

async function remove(item: FeedbackItem) {
  deleting.value = true
  error.value = ''
  try {
    await deleteFeedback(item.id)
    items.value = items.value.filter((row) => row.id !== item.id)
    pending.value = 0
  } catch {
    error.value = t('admin.feedbackDeleteFailed')
  } finally {
    deleting.value = false
  }
}

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

    <p v-if="error" class="error">{{ error }}</p>

    <p v-if="loading" class="notice">{{ t('ranking.loading') }}</p>
    <p v-else-if="failed" class="notice">{{ t('admin.feedbackFailed') }}</p>
    <p v-else-if="items.length === 0" class="notice">{{ t('admin.feedbackEmpty') }}</p>
    <ul v-else class="list">
      <li v-for="item in items" :key="item.id" class="card" :class="{ unread: isNew(item) }">
        <div class="head">
          <span v-if="isNew(item)" class="dot" :aria-label="t('admin.feedbackNew')" />
          <span class="badge" :class="item.kind">{{ t(KIND_LABELS.get(item.kind)!) }}</span>
          <span class="who">{{ item.nickname }}</span>
          <time>{{ when(item.createdAt) }}</time>
        </div>
        <h2>{{ item.title }}</h2>
        <p class="body">{{ item.body }}</p>
        <div class="actions">
          <template v-if="pending === item.id">
            <span class="ask">{{ t('admin.feedbackDeleteAsk') }}</span>
            <button type="button" class="ghost" :disabled="deleting" @click="pending = 0">
              {{ t('account.cancel') }}
            </button>
            <button type="button" class="danger" :disabled="deleting" @click="remove(item)">
              {{ t('admin.feedbackDelete') }}
            </button>
          </template>
          <button v-else type="button" class="ghost" @click="pending = item.id">
            {{ t('admin.feedbackDelete') }}
          </button>
        </div>
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

/* 아직 안 읽은 것 — 왼쪽 띠로 목록을 훑을 때 걸리게 하고, 점은 그 줄에서 확인한다 */
.card.unread {
  box-shadow: inset 3px 0 0 #e53935;
}

.dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #e53935;
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

.error {
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--danger);
}

/* 지우기는 자주 쓰는 동작이 아니라 카드 오른쪽 아래에 옅게 둔다 */
.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 10px;
}

.ask {
  margin-right: auto;
  font-size: 12px;
  color: var(--ink-muted);
}

.actions button {
  padding: 5px 12px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
}

.actions button:disabled {
  opacity: 0.5;
  cursor: default;
}

.ghost {
  border: none;
  background: none;
  color: var(--ink-faint);
}

.danger {
  border: 1px solid #ffccbc;
  background: var(--surface);
  color: #e65100;
}

[data-theme='dark'] .danger {
  border-color: rgb(230 81 0 / 0.45);
  color: #ffab91;
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
