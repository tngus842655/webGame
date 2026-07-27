<script setup lang="ts">
// 첫 실행 온보딩 — 언어 → 기존 회원 유무 → 닉네임 순으로 물어본다.
// 이 흐름을 마치기 전까지는 계정을 만들지 않는다. 사이트만 열고 나간 사람까지
// 익명 계정이 쌓이던 문제와, 무작위 '게스트-xxxx' 닉네임이 랭킹에 나가던 문제를 함께 없앤다.
import { computed, ref } from 'vue'
import { LOCALES, locale, setLocale, t, type Locale } from './i18n'
import { ensureUserId, signInSocial, type SocialProvider } from './auth'
import { updateMyNickname } from './profile'
import { flushPendingScores } from './scores'
import UiIcon from './UiIcon.vue'

const emit = defineEmits<{ done: [] }>()

const STEPS = ['lang', 'account', 'nickname'] as const
type Step = (typeof STEPS)[number]

const step = ref<Step>('lang')
const nickname = ref('')
const busy = ref(false)
const error = ref('')

// 세 걸음 중 어디인지 — 몇 개가 남았는지 보이지 않으면 첫 화면에서 그냥 나간다
const stepIndex = computed(() => STEPS.indexOf(step.value))
const nickLength = computed(() => nickname.value.trim().length)

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
      <header class="brand">
        <p class="app-name">{{ t('app.title') }}</p>
        <div class="dots" aria-hidden="true">
          <span v-for="(name, i) in STEPS" :key="name" :class="{ done: i <= stepIndex }" />
        </div>
      </header>

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
            <span>{{ option.label }}</span>
            <UiIcon v-if="locale === option.code" name="check" />
          </button>
        </div>
        <button type="button" class="btn btn--go" @click="step = 'account'">
          {{ t('onboard.next') }}
        </button>
      </template>

      <!-- 2. 기존 회원 유무 -->
      <template v-else-if="step === 'account'">
        <h2>{{ t('onboard.accountTitle') }}</h2>
        <p class="body">{{ t('onboard.accountBody') }}</p>
        <div class="socials">
          <button type="button" class="social google" :disabled="busy" @click="signIn('google')">
            {{ t('account.google') }}
          </button>
          <button type="button" class="social kakao" :disabled="busy" @click="signIn('kakao')">
            {{ t('account.kakao') }}
          </button>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="button" class="btn btn--ghost" :disabled="busy" @click="step = 'nickname'">
          {{ t('onboard.accountNo') }}
        </button>
      </template>

      <!-- 3. 닉네임 -->
      <template v-else>
        <h2>{{ t('onboard.nickTitle') }}</h2>
        <p class="body">{{ t('settings.nicknameHint') }}</p>
        <div class="nick-field">
          <input
            v-model="nickname"
            class="nick"
            type="text"
            maxlength="12"
            :placeholder="t('settings.placeholder')"
            :disabled="busy"
            @keyup.enter="start"
          />
          <!-- 2~12자 규칙을 눌러보고 나서야 알게 되던 것을 입력 중에 알려준다 -->
          <span class="counter" :class="{ short: nickLength < 2 }">{{ nickLength }}/12</span>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="button" class="btn btn--go" :disabled="busy" @click="start">
          {{ busy ? t('onboard.saving') : t('onboard.start') }}
        </button>
        <button type="button" class="btn btn--ghost" :disabled="busy" @click="step = 'account'">
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
  padding: 24px 20px calc(24px + env(safe-area-inset-bottom));
  background: linear-gradient(#fff8e1, #ffe0b2);
}

.card {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  text-align: center;
}

.brand {
  margin-bottom: 6px;
}

.app-name {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #c0a695;
}

/* 세 걸음 중 어디까지 왔는지 */
.dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
}

.dots span {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: rgb(141 110 99 / 0.22);
  transition:
    width 0.2s ease,
    background-color 0.2s ease;
}

.dots span.done {
  width: 20px;
  background: #43a047;
}

h2 {
  font-size: 23px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #4e342e;
}

.body {
  font-size: 14px;
  line-height: 1.55;
  color: #8d6e63;
  word-break: keep-all;
}

.langs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  max-height: 44vh;
  padding: 2px;
  overflow-y: auto;
}

.lang {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 13px 8px;
  border: 2px solid transparent;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 3px rgb(93 64 55 / 0.07);
  color: #5d4037;
  font-size: 15px;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.lang:active {
  transform: scale(0.97);
}

/* 테두리만 바뀌면 어느 쪽이 골라졌는지 흘긋 봐서는 모른다 */
.lang.on {
  border-color: #43a047;
  background: #e8f5e9;
  color: #2e7d32;
  font-weight: 700;
}

.lang svg {
  width: 15px;
  height: 15px;
  color: #43a047;
}

.socials {
  display: flex;
  gap: 8px;
}

.social {
  flex: 1;
  padding: 15px 10px;
  border: none;
  border-radius: 16px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.social:not(:disabled):active {
  transform: scale(0.97);
}

/* 두 서비스의 브랜드 색을 따른다 — 흰 버튼 둘이면 어느 쪽인지 글자를 읽어야 안다 */
.social.google {
  background: #fff;
  box-shadow:
    inset 0 0 0 1.5px #e0d8d3,
    0 1px 4px rgb(93 64 55 / 0.08);
  color: #3c4043;
}

.social.kakao {
  background: #fee500;
  box-shadow: 0 1px 4px rgb(93 64 55 / 0.12);
  color: #191600;
}

.nick-field {
  position: relative;
}

.nick {
  width: 100%;
  padding: 15px 62px 15px 18px;
  border: 2px solid #e2d8d2;
  border-radius: 16px;
  background: #fff;
  color: #4e342e;
  font-size: 17px;
  font-weight: 600;
  text-align: center;
}

.nick:focus {
  border-color: #66bb6a;
  outline: none;
}

.counter {
  position: absolute;
  top: 50%;
  right: 16px;
  transform: translateY(-50%);
  font-size: 12px;
  font-weight: 700;
  color: #a1887f;
  pointer-events: none;
}

.counter.short {
  color: #d7ccc8;
}

.error {
  font-size: 13px;
  font-weight: 600;
  color: #c62828;
}

button:disabled {
  opacity: 0.55;
  cursor: default;
}
</style>
