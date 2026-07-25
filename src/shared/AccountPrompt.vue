<script setup lang="ts">
// 첫 실행 때 한 번, 허브를 가리지 않는 하단 카드로 기존 회원인지 물어본다
import { t } from '@/shared/i18n'

defineEmits<{ (e: 'answer', existing: boolean): void }>()
</script>

<template>
  <div class="prompt-layer">
    <div class="prompt-card">
      <strong>{{ t('account.promptTitle') }}</strong>
      <p>{{ t('account.promptBody') }}</p>
      <div class="prompt-actions">
        <button type="button" class="ghost" @click="$emit('answer', false)">
          {{ t('account.promptNo') }}
        </button>
        <button type="button" class="primary" @click="$emit('answer', true)">
          {{ t('account.promptYes') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prompt-layer {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px;
  /* 허브가 비치도록 옅게만 덮는다 */
  background: rgb(62 39 35 / 0.22);
}

.prompt-card {
  width: 100%;
  max-width: 420px;
  padding: 18px 18px 16px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 12px 32px rgb(62 39 35 / 0.22);
  animation: rise 0.22s ease-out;
}

.prompt-card strong {
  display: block;
  font-size: 17px;
  color: #4e342e;
}

.prompt-card p {
  margin-top: 8px;
  font-size: 13.5px;
  line-height: 1.5;
  color: #8d6e63;
  word-break: keep-all;
}

.prompt-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.prompt-actions button {
  flex: 1;
  padding: 12px 8px;
  border-radius: 11px;
  font: inherit;
  font-weight: bold;
  cursor: pointer;
}

.primary {
  border: none;
  background: #43a047;
  color: #fff;
}

.ghost {
  border: 1px solid #e0d6d1;
  background: #fff;
  color: #8d6e63;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}
</style>
