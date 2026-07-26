<script setup lang="ts">
// 첫 실행 온보딩 — 언어 → 기존 회원 유무 → 닉네임 순으로 물어본다.
// 이 흐름을 마치기 전까지는 계정을 만들지 않는다. 사이트만 열고 나간 사람까지
// 익명 계정이 쌓이던 문제와, 무작위 '게스트-xxxx' 닉네임이 랭킹에 나가던 문제를 함께 없앤다.
import { ref } from 'vue'
import { LOCALES, locale, setLocale, t, type Locale } from './i18n'
import { ensureUserId, signInSocial, type SocialProvider } from './auth'
import { updateMyNickname } from './profile'
import { flushPendingScores } from './scores'

const emit = defineEmits<{ done: [] }>()

type Step = 'lang' | 'account' | 'nickname'
const step = ref<Step>('lang')
const nickname = ref('')
const busy = ref(false)
const error = ref('')

function pickLocale(code: Locale) {
  setLocale(code)
}

async function signIn(provider: SocialProvider) {
  busy.value = true
  error.value = ''
  try {
    // 소셜 로그인은 리다이렉트로 나갔다 돌아온다 — 돌아온 뒤엔 이미 계정이 있으므로
    // 온보딩을 마친 것으로 본다 (아래 finish에서 플래그를 남긴다)
    await signInSocial(provider)
  } catch {
    busy.value = false
    error.value = t('onboard.failed')
  }
}

async function start() {
  const name = nickname.value.trim()
  if (name.length < 2 || name.length > 12) {
    error.value = t('settings.lengthError')
    return
  }
  busy.value = true
  error.value = ''
  try {
    await ensureUserId()
    await updateMyNickname(name)
    await flushPendingScores().catch(() => {})
    emit('done')
  } catch {
    busy.value = false
    error.value = t('onboard.failed')
  }
}
</script>

<template>
  <div class="onboard">
    <div class="card">
      <!-- 1. 언어 -->
      <template v-if="step === 'lang'">
        <h2>{{ t('onboard.langTitle') }}</h2>
        <div class="langs">
          <button
            v-for="option in LOCALES"
            :key="option.code"
            type="button"
            class="lang"
            :class="{ on: locale === option.code }"
            @click="pickLocale(option.code)"
          >
            {{ option.label }}
          </button>
        </div>
        <button type="button" class="primary" @click="step = 'account'">
          {{ t('onboard.next') }}
        </button>
      </template>

      <!-- 2. 기존 회원 유무 -->
      <template v-else-if="step === 'account'">
        <h2>{{ t('onboard.accountTitle') }}</h2>
        <p class="body">{{ t('onboard.accountBody') }}</p>
        <div class="socials">
          <button type="button" class="social" :disabled="busy" @click="signIn('google')">
            {{ t('account.google') }}
          </button>
          <button type="button" class="social" :disabled="busy" @click="signIn('kakao')">
            {{ t('account.kakao') }}
          </button>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="button" class="ghost" :disabled="busy" @click="step = 'nickname'">
          {{ t('onboard.accountNo') }}
        </button>
      </template>

      <!-- 3. 닉네임 -->
      <template v-else>
        <h2>{{ t('onboard.nickTitle') }}</h2>
        <p class="body">{{ t('settings.nicknameHint') }}</p>
        <input
          v-model="nickname"
          class="nick"
          type="text"
          maxlength="12"
          :placeholder="t('settings.placeholder')"
          :disabled="busy"
          @keyup.enter="start"
        />
        <p v-if="error" class="error">{{ error }}</p>
        <button type="button" class="primary" :disabled="busy" @click="start">
          {{ busy ? t('onboard.saving') : t('onboard.start') }}
        </button>
        <button type="button" class="back" :disabled="busy" @click="step = 'account'">
          {{ t('onboard.back') }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.onboard {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #fff8e1;
}

.card {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  text-align: center;
}

h2 {
  font-size: 22px;
  color: #4e342e;
}

.body {
  font-size: 14px;
  line-height: 1.5;
  color: #8d6e63;
}

.langs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  max-height: 46vh;
  overflow-y: auto;
}

.lang {
  padding: 12px 8px;
  border: 2px solid transparent;
  border-radius: 14px;
  background: #fff;
  color: #5d4037;
  font-size: 15px;
  cursor: pointer;
}

.lang.on {
  border-color: #43a047;
  background: #e8f5e9;
  font-weight: bold;
}

.socials {
  display: flex;
  gap: 8px;
}

.social {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 16px;
  background: #fff;
  color: #5d4037;
  font-size: 15px;
  font-weight: bold;
  cursor: pointer;
}

.nick {
  padding: 14px;
  border: 2px solid #d7ccc8;
  border-radius: 16px;
  background: #fff;
  color: #4e342e;
  font-size: 17px;
  text-align: center;
}

.primary {
  padding: 15px;
  border: none;
  border-radius: 16px;
  background: #43a047;
  color: #fff;
  font-size: 17px;
  font-weight: bold;
  cursor: pointer;
}

.ghost,
.back {
  padding: 12px;
  border: none;
  border-radius: 16px;
  background: transparent;
  color: #8d6e63;
  font-size: 15px;
  cursor: pointer;
}

.error {
  font-size: 13px;
  color: #c62828;
}

button:disabled {
  opacity: 0.55;
  cursor: default;
}
</style>
