<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { deleteMyAccount, getCurrentUserId } from '@/shared/auth'
import { t } from '@/shared/i18n'
import { isInToss } from '@/shared/toss'
import UiIcon from '@/shared/UiIcon.vue'

// 약관·처리방침과 달리 이 화면은 13개 언어를 다 채운다. 법적 고지가 아니라
// 사용자가 직접 누르는 조작 화면이라, 읽지 못하면 삭제 자체를 못 한다.
// Google Play 데이터 보안 양식의 '계정 삭제 URL'로 등록되는 페이지라
// 앱 이름·삭제 절차·삭제 항목이 모두 적혀 있어야 한다.
const CONTACT_EMAIL = 'tngus842655@gmail.com'

const router = useRouter()
const hasSession = ref(false)
const confirming = ref(false)
const deleting = ref(false)
const failed = ref(false)

onMounted(async () => {
  hasSession.value = !!(await getCurrentUserId().catch(() => null))
})

async function remove() {
  deleting.value = true
  failed.value = false
  try {
    await deleteMyAccount()
    router.replace('/')
  } catch {
    failed.value = true
    deleting.value = false
    confirming.value = false
  }
}
</script>

<template>
  <div class="deletion">
    <header class="deletion-header">
      <RouterLink class="back" to="/settings"><UiIcon name="back" /></RouterLink>
      <div>
        <h1>{{ t('del.title') }}</h1>
        <p class="effective">{{ t('app.title') }}</p>
      </div>
    </header>

    <div class="card">
      <p class="intro">{{ t('del.intro') }}</p>

      <h2>{{ t('del.removedTitle') }}</h2>
      <ul>
        <li>{{ t('del.removedAccount') }}</li>
        <li>{{ isInToss ? t('del.removedToss') : t('del.removedSocial') }}</li>
        <li>{{ t('del.removedRecords') }}</li>
      </ul>
      <p class="note">{{ t('del.removedNote') }}</p>

      <div class="danger">
        <template v-if="!confirming">
          <button type="button" class="danger-btn" :disabled="!hasSession" @click="confirming = true">
            {{ t('del.button') }}
          </button>
          <p v-if="!hasSession" class="note">{{ t('del.noSession') }}</p>
        </template>
        <template v-else>
          <p class="confirm-ask">{{ t('del.confirmAsk') }}</p>
          <div class="confirm-row">
            <button type="button" class="ghost-btn" :disabled="deleting" @click="confirming = false">
              {{ t('del.cancel') }}
            </button>
            <button type="button" class="danger-btn" :disabled="deleting" @click="remove">
              {{ deleting ? t('del.deleting') : t('del.confirm') }}
            </button>
          </div>
        </template>
        <p v-if="failed" class="note error">{{ t('del.failed') }}</p>
      </div>

      <h2>{{ t('del.uninstallTitle') }}</h2>
      <p>{{ t('del.uninstallBody') }}</p>

      <h2>{{ t('del.askTitle') }}</h2>
      <p>{{ t('del.askBody') }}</p>
      <p class="contact">{{ CONTACT_EMAIL }}</p>
    </div>
  </div>
</template>

<style scoped>
.deletion {
  padding: 20px 16px 40px;
}

.deletion-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}

.deletion-header h1 {
  font-size: 20px;
}

.effective {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--ink-faint);
}

.card {
  background: var(--surface);
  border-radius: 16px;
  padding: 18px 16px;
}

.intro {
  margin-bottom: 4px;
}

.card h2 {
  font-size: 15px;
  margin: 18px 0 8px;
}

.card p,
.card li {
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--ink-body);
  word-break: keep-all;
}

.card ul {
  padding-left: 18px;
}

.card li {
  margin-bottom: 4px;
}

.note {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--ink-muted);
}

.error {
  color: var(--danger);
}

.contact {
  margin-top: 6px;
  font-weight: bold;
}

.danger {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--line-soft);
}

.confirm-ask {
  margin-bottom: 10px;
  font-weight: bold;
}

.confirm-row {
  display: flex;
  gap: 8px;
}

.danger-btn,
.ghost-btn {
  flex: 1;
  padding: 12px 16px;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
}

.danger-btn {
  width: 100%;
  background: #c62828;
  color: #fff;
}

.danger-btn:disabled {
  background: var(--line);
  cursor: default;
}

.ghost-btn {
  background: var(--line-soft);
  color: var(--ink-body);
}
</style>
