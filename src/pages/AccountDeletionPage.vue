<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { deleteMyAccount, getCurrentUserId } from '@/shared/auth'
import UiIcon from '@/shared/UiIcon.vue'

// 개인정보처리방침과 같은 이유로 운영 언어(한국어)로만 제공한다.
// Google Play 데이터 보안 양식의 '계정 삭제 URL'로 등록되는 페이지라
// 앱 이름·삭제 절차·삭제 항목·보관 기간이 모두 적혀 있어야 한다.
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
        <h1>계정 및 데이터 삭제</h1>
        <p class="effective">미니게임30 (MiniGame30)</p>
      </div>
    </header>

    <div class="card">
      <p class="intro">
        미니게임30 계정과 그동안 쌓인 게임 기록을 지웁니다. 아래 버튼을 누르면 바로 처리되며,
        되돌릴 수 없습니다.
      </p>

      <h2>삭제되는 항목</h2>
      <ul>
        <li>계정 정보: 익명 식별자, 닉네임</li>
        <li>SNS 연동 정보: 구글·카카오 계정 식별자, 프로필 사진, 이메일 주소</li>
        <li>게임 기록: 게임별 점수, 랭킹 기록, 플레이 시간</li>
      </ul>
      <p class="note">
        랭킹에서도 함께 사라집니다. 앱을 다시 실행하면 새 게스트 계정으로 처음부터 시작됩니다.
      </p>

      <h2>남는 항목</h2>
      <p>
        게임별 플레이 횟수처럼 누가 플레이했는지 알 수 없는 형태로 집계된 통계는 그대로
        남습니다. 개인을 식별할 수 있는 정보는 남기지 않습니다.
      </p>

      <div class="danger">
        <template v-if="!confirming">
          <button type="button" class="danger-btn" :disabled="!hasSession" @click="confirming = true">
            계정 삭제
          </button>
          <p v-if="!hasSession" class="note">
            로그인 정보를 찾지 못했습니다. 앱에서 게임을 한 번 실행한 뒤 다시 시도해주세요.
          </p>
        </template>
        <template v-else>
          <p class="confirm-ask">정말 삭제할까요? 기록은 복구할 수 없습니다.</p>
          <div class="confirm-row">
            <button type="button" class="ghost-btn" :disabled="deleting" @click="confirming = false">
              취소
            </button>
            <button type="button" class="danger-btn" :disabled="deleting" @click="remove">
              {{ deleting ? '삭제 중…' : '삭제' }}
            </button>
          </div>
        </template>
        <p v-if="failed" class="note error">
          삭제하지 못했습니다. 잠시 후 다시 시도하거나 아래 이메일로 알려주세요.
        </p>
      </div>

      <h2>앱을 지우기만 하면 되나요?</h2>
      <p>
        앱 삭제만으로는 서버에 저장된 기록이 지워지지 않습니다. 기록까지 지우려면 위 버튼을
        눌러주세요.
      </p>

      <h2>직접 요청하기</h2>
      <p>
        버튼이 동작하지 않거나 앱에 접근할 수 없다면 아래 이메일로 닉네임과 연동한 계정 주소를
        알려주세요. 본인 확인 후 영업일 기준 7일 이내에 처리합니다.
      </p>
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
