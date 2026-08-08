<script setup lang="ts">
// 새 버전 안내. Play가 대신 띄워주는 다이얼로그를 쓰지 않는 이유는 appUpdate.ts에 있다.
//
// 바깥을 눌러도 닫히지 않는다 — 게임 화면 위로 뜰 수도 있어서(주소를 바로 열고 들어온
// 경우) 오터치로 사라지면 물어본 적도 없는 것처럼 24시간을 넘긴다.
import { dismissAppUpdate, startAppUpdate, updateAvailable } from './appUpdate'
import { t } from './i18n'
</script>

<template>
  <div v-if="updateAvailable" class="update-backdrop">
    <div class="update-card" role="dialog" aria-modal="true">
      <h2>{{ t('update.title') }}</h2>
      <p>{{ t('update.body') }}</p>
      <button type="button" class="btn btn--go" @click="startAppUpdate">
        {{ t('update.now') }}
      </button>
      <button type="button" class="btn btn--ghost" @click="dismissAppUpdate">
        {{ t('update.later') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.update-backdrop {
  position: fixed;
  inset: 0;
  /* .app-shell::after(내비게이션 바를 덮는 아래 띠)가 50이라 그 위에 선다 */
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgb(38 26 22 / 0.66);
}

.update-card {
  width: 100%;
  max-width: 320px;
  padding: 24px 20px 14px;
  border-radius: 22px;
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 18px 40px rgb(0 0 0 / 0.28);
  text-align: center;
}

.update-card h2 {
  font-size: 20px;
}

.update-card p {
  margin-top: 10px;
  font-size: 15px;
  line-height: 1.5;
  color: var(--ink-muted);
}

/* 일시정지 시트와 같은 간격 (GamePlayPage.vue) */
.update-card .btn {
  margin-top: 18px;
}

.update-card .btn--ghost {
  margin-top: 6px;
}
</style>
