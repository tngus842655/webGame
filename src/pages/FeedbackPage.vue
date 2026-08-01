<script setup lang="ts">
// 의견 보내기 — 버그 제보·문의·개선 제안을 한 장으로 받는다.
// 답변은 하지 않으므로 보낸 뒤의 목록도 두지 않는다. 대신 보냈다는 것만은 분명히 알린다.
import { computed, ref } from 'vue'
import {
  BODY_MAX,
  FEEDBACK_KINDS,
  submitFeedback,
  TITLE_MAX,
  type FeedbackKind,
} from '@/shared/feedback'
import { t } from '@/shared/i18n'
import UiIcon from '@/shared/UiIcon.vue'

const kind = ref<FeedbackKind>('bug')
const title = ref('')
const body = ref('')
const sending = ref(false)
const sent = ref(false)
const error = ref('')

const ready = computed(() => !!title.value.trim() && !!body.value.trim())

async function send() {
  if (!ready.value || sending.value) return
  sending.value = true
  error.value = ''
  try {
    await submitFeedback(kind.value, title.value.trim(), body.value.trim())
    sent.value = true
  } catch {
    error.value = t('fb.failed')
  } finally {
    sending.value = false
  }
}

// 하나 더 보내기 — 종류는 방금 고른 것을 그대로 둔다 (연달아 보내는 쪽이 대개 같은 종류다)
function again() {
  title.value = ''
  body.value = ''
  sent.value = false
}
</script>

<template>
  <div class="feedback">
    <header class="feedback-header">
      <RouterLink class="back" to="/settings"><UiIcon name="back" /></RouterLink>
      <h1>{{ t('fb.title') }}</h1>
    </header>

    <section v-if="sent" class="section done">
      <span class="seal"><UiIcon name="check" /></span>
      <h2>{{ t('fb.thanksTitle') }}</h2>
      <p>{{ t('fb.thanksBody') }}</p>
      <RouterLink class="btn btn--go" to="/settings">{{ t('fb.done') }}</RouterLink>
      <button type="button" class="text-link" @click="again">{{ t('fb.more') }}</button>
    </section>

    <template v-else>
      <div class="section">
        <div class="kind-row" role="group" :aria-label="t('fb.title')">
          <button
            v-for="option in FEEDBACK_KINDS"
            :key="option.kind"
            type="button"
            class="kind-btn"
            :class="{ on: kind === option.kind }"
            :aria-pressed="kind === option.kind"
            @click="kind = option.kind"
          >
            {{ t(option.labelKey) }}
          </button>
        </div>

        <div class="field">
          <div class="field-head">
            <label for="fb-subject">{{ t('fb.subject') }}</label>
            <span class="count">{{ title.length }}/{{ TITLE_MAX }}</span>
          </div>
          <input
            id="fb-subject"
            v-model="title"
            type="text"
            :maxlength="TITLE_MAX"
            :placeholder="t('fb.subjectPlaceholder')"
          />
        </div>

        <div class="field">
          <div class="field-head">
            <label for="fb-body">{{ t('fb.body') }}</label>
            <span class="count">{{ body.length }}/{{ BODY_MAX }}</span>
          </div>
          <textarea
            id="fb-body"
            v-model="body"
            rows="7"
            :maxlength="BODY_MAX"
            :placeholder="t('fb.bodyPlaceholder')"
          />
        </div>
      </div>

      <p class="hint">{{ t('fb.hint') }}</p>
      <p v-if="error" class="error">{{ error }}</p>

      <button type="button" class="btn btn--go" :disabled="!ready || sending" @click="send">
        {{ sending ? t('fb.sending') : t('fb.send') }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.feedback {
  padding: 20px 16px 32px;
}

.feedback-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.feedback-header h1 {
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

/* 셋뿐이라 목록을 열 것 없이 나란히 놓는다 (설정의 테마 고르기와 같은 결) */
.kind-row {
  display: flex;
  gap: 3px;
  padding: 4px;
  margin-bottom: 18px;
  border-radius: 16px;
  background: var(--line-soft);
}

.kind-btn {
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

.kind-btn.on {
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-card);
}

.field + .field {
  margin-top: 16px;
}

.field-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
}

.field-head label {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--ink-faint);
}

.count {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-faint);
}

.field input,
.field textarea {
  display: block;
  width: 100%;
  padding: 13px 15px;
  border: none;
  border-radius: 14px;
  box-shadow: inset 0 0 0 1.5px var(--line);
  background: var(--surface);
  font: inherit;
  font-weight: 600;
  color: var(--ink);
}

.field textarea {
  font-weight: 500;
  line-height: 1.55;
  resize: none;
}

.field input:focus,
.field textarea:focus {
  outline: none;
  box-shadow: inset 0 0 0 2px #66bb6a;
}

.field input::placeholder,
.field textarea::placeholder {
  font-weight: 500;
  color: var(--ink-faint);
}

.hint {
  margin: 0 2px 14px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink-faint);
  word-break: keep-all;
}

.error {
  margin: 0 2px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--danger);
}

/* 보낸 뒤 — 폼 자리를 그대로 이어받는다 */
.done {
  padding: 30px 20px 20px;
  text-align: center;
}

.seal {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: #e8f5e9;
  color: #43a047;
}

.seal svg {
  width: 26px;
  height: 26px;
}

.done h2 {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.done p {
  margin: 10px 0 22px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--ink-muted);
  word-break: keep-all;
}

.done .btn {
  text-align: center;
}

.text-link {
  margin-top: 14px;
  padding: 2px 0;
  border: none;
  background: none;
  font: inherit;
  font-size: 13px;
  color: var(--ink-faint);
  text-decoration: underline;
  cursor: pointer;
}

[data-theme='dark'] .seal {
  background: rgb(67 160 71 / 0.18);
  color: #81c784;
}
</style>
