<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  linkedProvider,
  linkSocial,
  signInSocial,
  takeRedirectError,
  type SocialProvider,
} from '@/shared/auth'
import { LOCALES, locale, setLocale, t, type Locale } from '@/shared/i18n'
import { adoptSocialNickname, fetchMyProfile, updateMyNickname } from '@/shared/profile'
import { isMusicEnabled, setMusicEnabled } from '@/shared/music'
import { isSoundEnabled, setSoundEnabled } from '@/shared/sound'
import SocialLogo from '@/shared/SocialLogo.vue'
import UiIcon from '@/shared/UiIcon.vue'

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

function providerLabel(provider: SocialProvider) {
  return provider === 'google' ? t('account.google') : t('account.kakao')
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
          <!-- 2~12자 규칙을 저장을 눌러보고 나서야 알던 것을 입력 중에 알려준다 (온보딩과 같다) -->
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

      <template v-if="linkedProvider && !switching">
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

    <RouterLink class="menu-link" to="/notes">
      <span>{{ t('notes.title') }}</span>
      <span class="arrow"><UiIcon name="chevron" /></span>
    </RouterLink>

    <footer class="settings-footer">
      <RouterLink to="/privacy">{{ t('privacy.title') }}</RouterLink>
      <RouterLink to="/account-deletion">계정 삭제</RouterLink>
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
  color: #4e342e;
}

.section {
  background: #fff;
  border-radius: 18px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgb(93 64 55 / 0.06);
}

.section h2 {
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #b09a8c;
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

.linked {
  font-size: 15px;
  font-weight: 600;
  color: #5d4037;
}

/* 계정 전환·취소 — 자주 쓰지 않는 동작이라 버튼 대신 옅은 링크로 둔다 */
.text-link {
  margin-top: 10px;
  padding: 2px 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 13px;
  color: #a1887f;
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
  background: #fff8e1;
  font-size: 13px;
  line-height: 1.5;
  color: #6d4c41;
  word-break: keep-all;
}

.restore {
  padding: 14px;
  margin-bottom: 12px;
  border-radius: 14px;
  background: #fff8e1;
  font-size: 14px;
  line-height: 1.45;
  color: #5d4037;
}

.restore .warn {
  margin-top: 6px;
  color: #c62828;
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
  box-shadow: inset 0 0 0 1.5px #e2d8d2;
  background: #fff;
  font: inherit;
  font-weight: 600;
  color: #4e342e;
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
  color: #bcaaa4;
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
  box-shadow: inset 0 0 0 1.5px #e2d8d2;
  font: inherit;
  font-weight: 600;
  color: #4e342e;
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
  color: #a1887f;
  pointer-events: none;
}

.counter.short {
  color: #d7ccc8;
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
  color: #5d4037;
  cursor: pointer;
}

.toggle + .toggle {
  border-top: 1px solid #f5efeb;
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
  background: #ded4cf;
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
  background: #fff;
  border-radius: 18px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgb(93 64 55 / 0.06);
  font-size: 15px;
  font-weight: 700;
  color: #4e342e;
}

.menu-link:active {
  background: #fffaf2;
}

.menu-link .arrow {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  color: #cbbcb5;
}

.hint {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.45;
  color: #bcaaa4;
  word-break: keep-all;
}

.message {
  padding: 6px 2px 0;
  font-size: 14px;
  font-weight: 600;
  color: #5d4037;
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
  color: #bcaaa4;
  text-decoration: underline;
}
</style>
