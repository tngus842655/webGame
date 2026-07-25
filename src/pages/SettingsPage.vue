<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  linkedProvider,
  linkSocial,
  signInSocial,
  takeRedirectError,
  type SocialProvider,
} from '@/shared/auth'
import { LOCALES, locale, setLocale, t, type Locale } from '@/shared/i18n'
import { adoptSocialNickname, fetchMyProfile, updateMyNickname } from '@/shared/profile'
import { isSoundEnabled, setSoundEnabled } from '@/shared/sound'

const nickname = ref('')
const loaded = ref(false)
const saving = ref(false)
const message = ref('')
const sound = ref(isSoundEnabled())
const lang = ref<Locale>(locale.value)
// 연동하려는 계정이 이미 다른 계정에 붙어 있을 때 = 기존 회원 → 불러오기 안내
const existingAccount = ref<SocialProvider | null>(null)
const busy = ref<SocialProvider | null>(null)
const accountError = ref('')

onMounted(async () => {
  const failed = takeRedirectError()
  if (failed) {
    if (failed.alreadyLinked && failed.provider) existingAccount.value = failed.provider
    else accountError.value = t('account.failed')
  }

  try {
    const profile = await fetchMyProfile()
    // 연동 직후 돌아온 경우, 닉네임을 직접 정한 적이 없으면 소셜 닉네임을 쓴다
    nickname.value = (await adoptSocialNickname(profile).catch(() => null)) ?? profile.nickname
    loaded.value = true
  } catch {
    message.value = t('settings.loadFailed')
  }
})

function providerLabel(provider: SocialProvider) {
  return provider === 'google' ? t('account.google') : t('account.kakao')
}

async function link(provider: SocialProvider) {
  busy.value = provider
  accountError.value = ''
  try {
    await linkSocial(provider)
  } catch {
    busy.value = null
    accountError.value = t('account.failed')
  }
}

async function restore(provider: SocialProvider) {
  busy.value = provider
  accountError.value = ''
  try {
    await signInSocial(provider)
  } catch {
    busy.value = null
    accountError.value = t('account.failed')
  }
}

async function save() {
  const name = nickname.value.trim()
  if (name.length < 2 || name.length > 12) {
    message.value = t('settings.lengthError')
    return
  }
  saving.value = true
  message.value = ''
  try {
    await updateMyNickname(name)
    nickname.value = name
    message.value = t('settings.saved')
  } catch {
    message.value = t('settings.saveFailed')
  } finally {
    saving.value = false
  }
}

function onSoundChange() {
  setSoundEnabled(sound.value)
}

function onLangChange() {
  setLocale(lang.value)
}
</script>

<template>
  <div class="settings">
    <header class="settings-header">
      <RouterLink class="back" to="/">←</RouterLink>
      <h1>{{ t('settings.title') }}</h1>
    </header>

    <section class="section">
      <h2>{{ t('account.title') }}</h2>

      <p v-if="linkedProvider" class="linked">
        {{ t('account.linked', { provider: providerLabel(linkedProvider) }) }}
      </p>

      <template v-else>
        <div v-if="existingAccount" class="restore">
          <p>{{ t('account.exists', { provider: providerLabel(existingAccount) }) }}</p>
          <p class="warn">{{ t('account.existsWarn') }}</p>
          <button type="button" @click="restore(existingAccount)">
            {{ busy === existingAccount ? t('account.linking') : t('account.restore') }}
          </button>
        </div>

        <div class="social-row">
          <button type="button" class="social google" :disabled="!!busy" @click="link('google')">
            <svg class="logo" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#4285f4"
                d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
              />
              <path
                fill="#34a853"
                d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
              />
              <path
                fill="#fbbc05"
                d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
              />
              <path
                fill="#ea4335"
                d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
              />
            </svg>
            <span>{{ busy === 'google' ? t('account.linking') : t('account.linkGoogle') }}</span>
          </button>
          <button type="button" class="social kakao" :disabled="!!busy" @click="link('kakao')">
            <svg class="logo" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#3c1e1e"
                d="M12 3.4c-5.08 0-9.2 3.26-9.2 7.27 0 2.55 1.67 4.79 4.19 6.08-.18.66-.67 2.46-.77 2.84-.12.48.18.47.37.34.15-.1 2.39-1.62 3.36-2.29.66.1 1.35.15 2.05.15 5.08 0 9.2-3.26 9.2-7.12S17.08 3.4 12 3.4z"
              />
            </svg>
            <span>{{ busy === 'kakao' ? t('account.linking') : t('account.linkKakao') }}</span>
          </button>
        </div>
        <p class="hint">{{ t('account.hint') }}</p>
      </template>

      <p v-if="accountError" class="message">{{ accountError }}</p>
    </section>

    <section class="section">
      <h2>{{ t('settings.language') }}</h2>
      <select v-model="lang" class="lang-select" @change="onLangChange">
        <option v-for="option in LOCALES" :key="option.code" :value="option.code">
          {{ option.label }}
        </option>
      </select>
    </section>

    <section class="section">
      <h2>{{ t('settings.nickname') }}</h2>
      <div class="nickname-row">
        <input
          v-model="nickname"
          type="text"
          maxlength="12"
          :placeholder="t('settings.placeholder')"
          :disabled="!loaded"
        />
        <button type="button" :disabled="!loaded || saving" @click="save">
          {{ saving ? t('settings.saving') : t('settings.save') }}
        </button>
      </div>
      <p class="hint">{{ t('settings.nicknameHint') }}</p>
    </section>

    <section class="section">
      <h2>{{ t('settings.sound') }}</h2>
      <label class="toggle-row">
        <input v-model="sound" type="checkbox" @change="onSoundChange" />
        {{ t('settings.soundOn') }}
      </label>
    </section>

    <RouterLink class="menu-link" to="/notes">
      <span>{{ t('notes.title') }}</span>
      <span class="arrow">›</span>
    </RouterLink>

    <p v-if="message" class="message">{{ message }}</p>
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

.social-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.social {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 12px;
  border-radius: 10px;
  font: inherit;
  font-weight: bold;
  cursor: pointer;
}

.logo {
  width: 18px;
  height: 18px;
  flex: none;
}

.social:disabled {
  opacity: 0.55;
  cursor: default;
}

.social.google {
  border: 1px solid #d7ccc8;
  background: #fff;
  color: #4a4a4a;
}

.social.kakao {
  border: none;
  background: #fee500;
  color: #3c1e1e;
}

.linked {
  font-size: 14px;
  color: #5d4037;
}

.restore {
  padding: 12px;
  margin-bottom: 12px;
  border-radius: 12px;
  background: #fff8e1;
  font-size: 14px;
  line-height: 1.45;
  color: #5d4037;
}

.restore .warn {
  margin-top: 6px;
  color: #c62828;
}

.restore button {
  margin-top: 10px;
  padding: 9px 16px;
  border: none;
  border-radius: 9px;
  background: #43a047;
  color: #fff;
  font: inherit;
  font-weight: bold;
  cursor: pointer;
}

.lang-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d7ccc8;
  border-radius: 10px;
  font: inherit;
  background: #fff;
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

.menu-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #fff;
  border-radius: 16px;
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: bold;
}

.menu-link .arrow {
  color: #bcaaa4;
  font-size: 20px;
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
