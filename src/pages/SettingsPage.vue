<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { LOCALES, locale, setLocale, t, type Locale } from '@/shared/i18n'
import { fetchMyNickname, updateMyNickname } from '@/shared/profile'
import { isSoundEnabled, setSoundEnabled } from '@/shared/sound'

const nickname = ref('')
const loaded = ref(false)
const saving = ref(false)
const message = ref('')
const sound = ref(isSoundEnabled())
const lang = ref<Locale>(locale.value)

onMounted(async () => {
  try {
    nickname.value = await fetchMyNickname()
    loaded.value = true
  } catch {
    message.value = t('settings.loadFailed')
  }
})

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
    <p class="hint">{{ t('settings.guest') }}</p>
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
