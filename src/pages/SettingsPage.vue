<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchMyNickname, updateMyNickname } from '@/shared/profile'
import { isSoundEnabled, setSoundEnabled } from '@/shared/sound'

const nickname = ref('')
const loaded = ref(false)
const saving = ref(false)
const message = ref('')
const sound = ref(isSoundEnabled())

onMounted(async () => {
  try {
    nickname.value = await fetchMyNickname()
    loaded.value = true
  } catch {
    message.value = '프로필을 불러오지 못했습니다. 네트워크를 확인해주세요.'
  }
})

async function save() {
  const name = nickname.value.trim()
  if (name.length < 2 || name.length > 12) {
    message.value = '닉네임은 2~12자로 입력해주세요.'
    return
  }
  saving.value = true
  message.value = ''
  try {
    await updateMyNickname(name)
    nickname.value = name
    message.value = '저장했습니다! 랭킹에 바로 반영됩니다.'
  } catch {
    message.value = '저장에 실패했습니다. 잠시 후 다시 시도해주세요.'
  } finally {
    saving.value = false
  }
}

function onSoundChange() {
  setSoundEnabled(sound.value)
}
</script>

<template>
  <div class="settings">
    <header class="settings-header">
      <RouterLink class="back" to="/">←</RouterLink>
      <h1>설정</h1>
    </header>

    <section class="section">
      <h2>닉네임</h2>
      <div class="nickname-row">
        <input
          v-model="nickname"
          type="text"
          maxlength="12"
          placeholder="2~12자"
          :disabled="!loaded"
        />
        <button type="button" :disabled="!loaded || saving" @click="save">
          {{ saving ? '저장 중…' : '저장' }}
        </button>
      </div>
      <p class="hint">랭킹에 표시되는 이름입니다.</p>
    </section>

    <section class="section">
      <h2>사운드</h2>
      <label class="toggle-row">
        <input v-model="sound" type="checkbox" @change="onSoundChange" />
        효과음 켜기
      </label>
    </section>

    <p v-if="message" class="message">{{ message }}</p>
    <p class="hint">게스트 계정으로 플레이 중입니다. 소셜 로그인 연결은 추후 제공됩니다.</p>
  </div>
</template>

<style scoped>
.settings {
  padding: 20px 16px;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.back {
  font-size: 22px;
  padding: 4px 8px;
}

.settings-header h1 {
  font-size: 20px;
}

.section {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
}

.section h2 {
  font-size: 16px;
  margin-bottom: 10px;
}

.nickname-row {
  display: flex;
  gap: 8px;
}

.nickname-row input {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #d7ccc8;
  border-radius: 10px;
  font: inherit;
}

.nickname-row button {
  padding: 10px 18px;
  border: none;
  border-radius: 10px;
  background: #43a047;
  color: #fff;
  font-weight: bold;
  cursor: pointer;
}

.nickname-row button:disabled {
  background: #d7ccc8;
  cursor: default;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toggle-row input {
  width: 20px;
  height: 20px;
  accent-color: #43a047;
}

.hint {
  margin-top: 8px;
  font-size: 13px;
  color: #bcaaa4;
}

.message {
  padding: 4px 2px;
  font-size: 14px;
  color: #5d4037;
}
</style>
