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
          <button type="button" @click="restore(existingAccount)">
            {{ busy === existingAccount ? t('account.linking') : t('account.restore') }}
          </button>
        </div>

        <div class="social-row">
          <button type="button" class="social google" :disabled="!!busy" @click="link('google')">
            {{ busy === 'google' ? t('account.linking') : t('account.linkGoogle') }}
          </button>
          <button type="button" class="social kakao" :disabled="!!busy" @click="link('kakao')">
            {{ busy === 'kakao' ? t('account.linking') : t('account.linkKakao') }}
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
  padding: 12px;
  border-radius: 10px;
  font: inherit;
  font-weight: bold;
  cursor: pointer;
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
