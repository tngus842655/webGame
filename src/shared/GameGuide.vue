<script setup lang="ts">
// 게임 설명 팝업 — 플레이 화면의 ? 버튼으로 연다.
// 게임 화면 위에 뜨므로 바깥을 눌러도 닫히지 않는다 (오터치로 사라지면 성가시다)
import { computed } from 'vue'
import { guideFor } from './guides'
import { t } from './i18n'
import UiIcon from './UiIcon.vue'

const props = defineProps<{ slug: string; title: string }>()
defineEmits<{ close: [] }>()

// guideFor는 locale을 읽으므로 computed로 감싼다 — 한 번만 읽어두면 언어를 바꿔도
// 팝업 본문만 이전 언어로 남는다 (주변 라벨은 t()라 바로 바뀐다)
const guide = computed(() => guideFor(props.slug))
</script>

<template>
  <div class="guide-backdrop">
    <div class="guide-card" role="dialog" aria-modal="true">
      <h2>{{ title }}</h2>

      <dl v-if="guide">
        <div class="row">
          <dt><UiIcon name="target" /> {{ t('guide.goal') }}</dt>
          <dd>{{ guide.goal }}</dd>
        </div>
        <div class="row">
          <dt><UiIcon name="tap" /> {{ t('guide.how') }}</dt>
          <dd>{{ guide.how }}</dd>
        </div>
        <div class="row">
          <dt><UiIcon name="star" /> {{ t('guide.score') }}</dt>
          <dd>{{ guide.score }}</dd>
        </div>
      </dl>

      <button type="button" class="close btn btn--go" @click="$emit('close')">{{ t('guide.close') }}</button>
    </div>
  </div>
</template>

<style scoped>
.guide-backdrop {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgb(38 26 22 / 0.66);
}

.guide-card {
  width: 100%;
  max-width: 360px;
  max-height: 100%;
  overflow-y: auto;
  padding: 22px 20px 18px;
  border-radius: 22px;
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 18px 40px rgb(0 0 0 / 0.28);
}

.guide-card h2 {
  margin-bottom: 16px;
  font-size: 21px;
  text-align: center;
}

.row + .row {
  margin-top: 14px;
}

dt {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-faint);
}

dt svg {
  width: 15px;
  height: 15px;
}

dd {
  font-size: 15px;
  line-height: 1.5;
}

.close {
  margin-top: 22px;
}
</style>
