<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  linkedProvider,
  linkSocial,
  loginWithToss,
  signInSocial,
  takeRedirectError,
  type LinkedAccount,
  type SocialProvider,
} from '@/shared/auth'
import { isInToss } from '@/shared/toss'
import { LOCALES, locale, setLocale, t, type Locale, type TranslationKey } from '@/shared/i18n'
import { adoptSocialNickname, fetchMyProfile, updateMyNickname } from '@/shared/profile'
import { isMusicEnabled, setMusicEnabled } from '@/shared/music'
import { isSoundEnabled, setSoundEnabled } from '@/shared/sound'
import { setThemeMode, themeMode, type ThemeMode } from '@/shared/theme'
import SocialLogo from '@/shared/SocialLogo.vue'
import UiIcon from '@/shared/UiIcon.vue'

// 셋뿐이라 목록을 열 것 없이 나란히 놓는다
const THEME_OPTIONS: Array<{ mode: ThemeMode; labelKey: TranslationKey }> = [
  { mode: 'light', labelKey: 'settings.themeLight' },
  { mode: 'dark', labelKey: 'settings.themeDark' },
  { mode: 'system', labelKey: 'settings.themeSystem' },
]

const nickname = ref('')
const loaded = ref(false)
const saving = ref(false)
const message = ref('')
const sound = ref(isSoundEnabled())
const music = ref(isMusicEnabled())
const lang = ref<Locale>(locale.value)
// 연동하려는 계정이 이미 다른 계정에 붙어 있을 때 = 기존 회원 → 불러오기 안내
const existingAccount = ref<SocialProvider | null>(null)
const busy = ref<SocialProvider | null>(null)
// 앱인토스는 버튼이 하나뿐이라 어느 제공자인지 구분할 것이 없다
const tossBusy = ref(false)
const accountError = ref('')
// 실패 원인을 못 알아본 경우에도 '이미 가입한 계정' 경로를 열어두기 위해 제공자를 기억한다
const failedProvider = ref<SocialProvider | null>(null)
// 계정 전환: 게스트를 거치지 않고 곧바로 다른 소셜 계정으로 로그인한다
const switching = ref(false)
// 소셜 닉네임이 자동 적용됐을 때의 안내 (랭킹에 실명이 노출될 수 있어 반드시 알린다)
const nicknameNotice = ref('')
const nickLength = computed(() => nickname.value.trim().length)

// 소셜 화면에서 뒤로가기로 돌아오면 버튼이 '여는 중…'에 잠긴 채 복원된다
function resetBusy() {
  busy.value = null
}

// 웹에서는 소셜 화면에서 리다이렉트로 돌아올 때 이 화면이 통째로 다시 뜨므로 onMounted가 곧 이 일이다.
// 네이티브는 로그인 창(커스텀 탭)만 닫히고 화면이 그대로 살아 있어서, 돌아온 뒤 직접 한 번 더 부른다.
async function readAccountState() {
  const failed = takeRedirectError()
  if (failed) {
    if (failed.alreadyLinked && failed.provider) existingAccount.value = failed.provider
    else {
      accountError.value = t('account.failed')
      failedProvider.value = failed.provider
    }
  }

  try {
    const profile = await fetchMyProfile()
    // 연동 직후 돌아온 경우, 닉네임을 직접 정한 적이 없으면 소셜 닉네임을 쓴다
    const applied = await adoptSocialNickname(profile).catch(() => null)
    nickname.value = applied ?? profile.nickname
    if (applied) nicknameNotice.value = t('account.nicknameApplied', { name: applied })
    loaded.value = true
  } catch {
    message.value = t('settings.loadFailed')
  }
}

// 로그인이 끝나고 돌아온 뒤의 뒷정리. 그냥 닫고 나왔으면(done=false) 화면을 건드리지 않는다
async function afterSocial(done: boolean) {
  busy.value = null
  if (done) {
    switching.value = false
    existingAccount.value = null
  }
  await readAccountState()
}

onMounted(async () => {
  window.addEventListener('pageshow', resetBusy)
  await readAccountState()
})

onUnmounted(() => window.removeEventListener('pageshow', resetBusy))

function tryExisting() {
  existingAccount.value = failedProvider.value
  accountError.value = ''
}

function providerLabel(provider: LinkedAccount) {
  if (provider === 'toss') return t('account.toss')
  return provider === 'google' ? t('account.google') : t('account.kakao')
}

// 앱인토스 전용. 로그인 창이 토스 앱 안에서 열리고 닫혀서 화면이 그대로 살아 있다 —
// 구글·카카오처럼 리다이렉트로 돌아오는 경로가 없다
async function loginToss() {
  tossBusy.value = true
  accountError.value = ''
  try {
    await loginWithToss()
    await readAccountState()
  } catch {
    accountError.value = t('account.failed')
  } finally {
    tossBusy.value = false
  }
}

async function link(provider: SocialProvider) {
  busy.value = provider
  accountError.value = ''
  try {
    // 웹은 여기서 페이지가 넘어가 아래 줄이 실행되지 않는다
    await afterSocial(await linkSocial(provider))
  } catch {
    busy.value = null
    accountError.value = t('account.failed')
  }
}

// 기존 기록 불러오기 · 계정 전환 공통 — 해당 소셜 계정으로 바로 로그인한다
async function signIn(provider: SocialProvider) {
  busy.value = provider
  accountError.value = ''
  try {
    await afterSocial(await signInSocial(provider))
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

function onMusicChange() {
  setMusicEnabled(music.value)
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
      <RouterLink class="back" to="/"><UiIcon name="back" /></RouterLink>
      <h1>{{ t('settings.title') }}</h1>
    </header>

    <section class="section" :class="{ flagged: nicknameNotice }">
      <h2>{{ t('settings.nickname') }}</h2>
      <p v-if="nicknameNotice" class="notice">{{ nicknameNotice }}</p>
      <div class="nickname-row">
        <div class="nick-field">
          <input
            v-model="nickname"
            type="text"
            maxlength="12"
            :placeholder="t('settings.placeholder')"
            :disabled="!loaded"
            @keyup.enter="save"
          />
          <!-- 2~12자 규칙을 저장을 눌러보고 나서야 알던 것을 입력 중에 알려준다 -->
          <span class="counter" :class="{ short: nickLength < 2 }">{{ nickLength }}/12</span>
        </div>
        <button
          type="button"
          class="btn btn--go btn--sm"
          :disabled="!loaded || saving"
          @click="save"
        >
          {{ saving ? t('settings.saving') : t('settings.save') }}
        </button>
      </div>
      <p v-if="message" class="message">{{ message }}</p>
      <p class="hint">{{ t('settings.nicknameHint') }}</p>
    </section>

    <section class="section">
      <h2>{{ t('account.title') }}</h2>

      <!-- 앱인토스는 미니앱 안에서 구글·카카오를 쓸 수 없다(토스 정책). 토스 로그인만 남긴다.
           계정이 토스 앱 하나로 정해져 있어 '다른 계정으로 전환'도 뜻이 없다 -->
      <template v-if="isInToss">
        <p v-if="linkedProvider" class="linked">
          {{ t('account.linked', { provider: providerLabel(linkedProvider) }) }}
        </p>
        <template v-else>
          <div class="social-row">
            <button type="button" class="social toss" :disabled="tossBusy" @click="loginToss">
              <span>{{ tossBusy ? t('account.linking') : t('account.tossLogin') }}</span>
            </button>
          </div>
          <p class="hint">{{ t('account.hint') }}</p>
        </template>
      </template>

      <template v-else-if="linkedProvider && !switching">
        <p class="linked">
          {{ t('account.linked', { provider: providerLabel(linkedProvider) }) }}
        </p>
        <button type="button" class="text-link" @click="switching = true">
          {{ t('account.switch') }}
        </button>
      </template>

      <template v-else>
        <div v-if="existingAccount" class="restore">
          <p>{{ t('account.exists', { provider: providerLabel(existingAccount) }) }}</p>
          <p class="warn">{{ t('account.existsWarn') }}</p>
          <button type="button" class="btn btn--go btn--sm" @click="signIn(existingAccount)">
            {{ busy === existingAccount ? t('account.linking') : t('account.restore') }}
          </button>
        </div>

        <p v-if="switching" class="hint switch-hint">{{ t('account.switchHint') }}</p>

        <div class="social-row">
          <button
            type="button"
            class="social google"
            :disabled="!!busy"
            @click="switching ? signIn('google') : link('google')"
          >
            <SocialLogo provider="google" />
            <span>{{ busy === 'google' ? t('account.linking') : t('account.google') }}</span>
          </button>
          <button
            type="button"
            class="social kakao"
            :disabled="!!busy"
            @click="switching ? signIn('kakao') : link('kakao')"
          >
            <SocialLogo provider="kakao" />
            <span>{{ busy === 'kakao' ? t('account.linking') : t('account.kakao') }}</span>
          </button>
        </div>

        <button v-if="switching" type="button" class="text-link" @click="switching = false">
          {{ t('account.cancel') }}
        </button>
        <p v-else class="hint">{{ t('account.hint') }}</p>
      </template>

      <p v-if="accountError" class="message">{{ accountError }}</p>
      <button
        v-if="accountError && failedProvider"
        type="button"
        class="text-link"
        @click="tryExisting"
      >
        {{ t('account.maybeExists') }}
      </button>
    </section>

    <section class="section">
      <h2>{{ t('settings.sound') }}</h2>
      <label class="toggle">
        <span>{{ t('settings.soundOn') }}</span>
        <input v-model="sound" type="checkbox" @change="onSoundChange" />
        <span class="switch"></span>
      </label>
      <label class="toggle">
        <span>{{ t('settings.musicOn') }}</span>
        <input v-model="music" type="checkbox" @change="onMusicChange" />
        <span class="switch"></span>
      </label>
    </section>

    <section class="section">
      <h2>{{ t('settings.theme') }}</h2>
      <div class="theme-row" role="group" :aria-label="t('settings.theme')">
        <button
          v-for="option in THEME_OPTIONS"
          :key="option.mode"
          type="button"
          class="theme-btn"
          :class="{ on: themeMode === option.mode }"
          :aria-pressed="themeMode === option.mode"
          @click="setThemeMode(option.mode)"
        >
          {{ t(option.labelKey) }}
        </button>
      </div>
    </section>

    <section class="section">
      <h2>{{ t('settings.language') }}</h2>
      <!-- 목록은 OS가 띄우게 두고(13개라 자체 목록은 화면을 다 먹는다) 닫힌 모습만 앱에 맞춘다 -->
      <div class="lang-field">
        <select v-model="lang" class="lang-select" @change="onLangChange">
          <option v-for="option in LOCALES" :key="option.code" :value="option.code">
            {{ option.label }}
          </option>
        </select>
        <UiIcon name="chevron" />
      </div>
    </section>

    <RouterLink class="menu-link" to="/feedback">
      <span>{{ t('fb.title') }}</span>
      <span class="arrow"><UiIcon name="chevron" /></span>
    </RouterLink>

    <RouterLink class="menu-link" to="/notes">
      <span>{{ t('notes.title') }}</span>
      <span class="arrow"><UiIcon name="chevron" /></span>
    </RouterLink>

    <footer class="settings-footer">
      <RouterLink to="/terms">{{ t('terms.title') }}</RouterLink>
      <RouterLink to="/privacy">{{ t('privacy.title') }}</RouterLink>
      <RouterLink to="/account-deletion">{{ t('del.button') }}</RouterLink>
    </footer>
  </div>
</template>

<style scoped>
.settings {
  padding: 20px 16px 8px;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.settings-header h1 {
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.section {
  background: var(--surface);
  border-radius: 18px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-card);
}

.section h2 {
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--ink-faint);
}

.social-row {
  display: flex;
  gap: 8px;
}

.social {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 13px 10px;
  border-radius: 14px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.social:not(:disabled):active {
  transform: scale(0.97);
}

.social:disabled {
  opacity: 0.55;
  cursor: default;
}

.social.google {
  border: none;
  background: #fff;
  box-shadow: inset 0 0 0 1px #747775;
  color: #1f1f1f;
}

.social.kakao {
  border: none;
  background: #fee500;
  color: rgb(25 22 0 / 0.85);
}

/* 토스 브랜드 블루. 앱인토스 빌드에서만 쓰인다 */
.social.toss {
  border: none;
  background: #0064ff;
  color: #fff;
}

.linked {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink-body);
}

/* 계정 전환·취소 — 자주 쓰지 않는 동작이라 버튼 대신 옅은 링크로 둔다 */
.text-link {
  margin-top: 10px;
  padding: 2px 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 13px;
  color: var(--ink-faint);
  text-decoration: underline;
  cursor: pointer;
}

.switch-hint {
  margin: 0 0 10px;
}

/* 자동으로 정해진 닉네임은 랭킹에 그대로 공개되므로 눈에 띄게 알린다 */
.section.flagged {
  box-shadow: 0 0 0 2px #ffd54f;
}

.notice {
  padding: 10px 12px;
  margin-bottom: 10px;
  border-radius: 12px;
  background: var(--surface-tint);
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink-body);
  word-break: keep-all;
}

.restore {
  padding: 14px;
  margin-bottom: 12px;
  border-radius: 14px;
  background: var(--surface-tint);
  font-size: 14px;
  line-height: 1.45;
  color: var(--ink-body);
}

.restore .warn {
  margin-top: 6px;
  color: var(--danger);
}

.restore .btn {
  height: 42px;
  margin-top: 12px;
}

/* 목록은 OS가 그리지만 닫힌 모습은 앱에 맞춘다 */
.lang-field {
  position: relative;
}

.lang-select {
  width: 100%;
  padding: 14px 42px 14px 15px;
  border: none;
  border-radius: 14px;
  box-shadow: inset 0 0 0 1.5px var(--line);
  background: var(--surface);
  font: inherit;
  font-weight: 600;
  color: var(--ink);
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.lang-field svg {
  position: absolute;
  top: 50%;
  right: 15px;
  width: 15px;
  height: 15px;
  color: var(--ink-faint);
  transform: translateY(-50%) rotate(90deg);
  pointer-events: none;
}

.nickname-row {
  display: flex;
  gap: 8px;
}

.nick-field {
  position: relative;
  flex: 1;
  min-width: 0;
}

.nick-field input {
  width: 100%;
  padding: 13px 54px 13px 15px;
  border: none;
  border-radius: 14px;
  box-shadow: inset 0 0 0 1.5px var(--line);
  background: var(--surface);
  font: inherit;
  font-weight: 600;
  color: var(--ink);
}

.nick-field input:focus {
  outline: none;
  box-shadow: inset 0 0 0 2px #66bb6a;
}

.counter {
  position: absolute;
  top: 50%;
  right: 14px;
  transform: translateY(-50%);
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-faint);
  pointer-events: none;
}

.counter.short {
  color: var(--line);
}

/* 기본 체크박스를 스위치로 — 켜짐/꺼짐이 한눈에 보이고 과녁도 줄 전체가 된다 */
.toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 2px;
  font-size: 15px;
  font-weight: 600;
  color: var(--ink-body);
  cursor: pointer;
}

.toggle + .toggle {
  border-top: 1px solid var(--line-soft);
}

.toggle input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.switch {
  position: relative;
  flex: none;
  width: 48px;
  height: 28px;
  border-radius: 999px;
  background: var(--line);
  transition: background-color 0.18s ease;
}

.switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgb(62 39 35 / 0.3);
  transition: transform 0.18s ease;
}

.toggle input:checked ~ .switch {
  background: #43a047;
}

.toggle input:checked ~ .switch::after {
  transform: translateX(20px);
}

.toggle input:focus-visible ~ .switch {
  outline: 2px solid #66bb6a;
  outline-offset: 2px;
}

.menu-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--surface);
  border-radius: 18px;
  margin-bottom: 12px;
  box-shadow: var(--shadow-card);
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
}

.menu-link:active {
  background: var(--surface-press);
}

.menu-link .arrow {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  color: var(--ink-faint);
}

.hint {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--ink-faint);
  word-break: keep-all;
}

.message {
  padding: 6px 2px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink-body);
}

/* 고른 것만 판 위로 올린다 — 홈의 탭과 같은 결 */
.theme-row {
  display: flex;
  gap: 3px;
  padding: 4px;
  border-radius: 16px;
  background: var(--line-soft);
}

.theme-btn {
  flex: 1 1 0;
  min-width: 0;
  padding: 11px 6px;
  border: none;
  border-radius: 12px;
  background: none;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-faint);
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    color 0.14s ease;
}

.theme-btn.on {
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-card);
}

.settings-footer {
  display: flex;
  justify-content: center;
  gap: 14px;
  margin-top: 18px;
  padding-bottom: 16px;
}

.settings-footer a {
  font-size: 12px;
  color: var(--ink-faint);
  text-decoration: underline;
}
</style>
