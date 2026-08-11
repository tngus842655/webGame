<script setup lang="ts">
// 운영자 전용 입구 — 하는 일은 각 화면으로 나뉘어 있고 여기는 문만 나란히 세운다.
// (신규 선정이 이 화면에 함께 있었는데, 게임 목록이 길어 다른 문을 밀어냈다)
import { onMounted, ref } from 'vue'
import { fetchGameFlags } from '@/shared/admin'
import { refreshUnreadFeedback, unreadFeedback } from '@/shared/feedback'
import { t } from '@/shared/i18n'
import UiIcon from '@/shared/UiIcon.vue'

const trashedCount = ref(0)

onMounted(async () => {
  void refreshUnreadFeedback()
  // 개수 배지일 뿐이라 실패해도 화면을 막지 않는다
  try {
    trashedCount.value = (await fetchGameFlags()).filter((flag) => flag.trashedAt).length
  } catch {
    /* 배지 없이 그대로 둔다 */
  }
})
</script>

<template>
  <div class="admin">
    <header class="admin-header">
      <RouterLink class="back" to="/"><UiIcon name="back" /></RouterLink>
      <h1>{{ t('admin.title') }}</h1>
      <RouterLink class="stats-link" to="/stats">{{ t('stats.title') }}</RouterLink>
    </header>

    <RouterLink class="menu-link" to="/admin/trash">
      <span class="menu-label"><UiIcon name="trash" />{{ t('admin.trash') }}</span>
      <span class="count">{{ trashedCount > 0 ? trashedCount : '' }}<UiIcon name="chevron" /></span>
    </RouterLink>

    <RouterLink class="menu-link" to="/admin/feedback">
      <span class="menu-label"><UiIcon name="message" />{{ t('admin.feedback') }}</span>
      <span class="count">
        <span v-if="unreadFeedback > 0" class="new">{{ unreadFeedback }}</span>
        <UiIcon name="chevron" />
      </span>
    </RouterLink>

    <RouterLink class="menu-link" to="/admin/featured">
      <span class="menu-label"><UiIcon name="sparkle" />{{ t('admin.featuredPick') }}</span>
      <span class="count"><UiIcon name="chevron" /></span>
    </RouterLink>

    <RouterLink class="menu-link" to="/admin/votes">
      <span class="menu-label"><UiIcon name="arrow-up" />{{ t('admin.votes') }}</span>
      <span class="count"><UiIcon name="chevron" /></span>
    </RouterLink>
  </div>
</template>

<style scoped>
.admin {
  padding: 20px 16px;
}

.admin-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.admin-header h1 {
  flex: 1;
  font-size: 20px;
}

.stats-link {
  font-size: 13px;
  color: var(--ink-muted);
  text-decoration: underline;
}

.menu-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  margin-bottom: 12px;
  background: var(--surface);
  border-radius: 14px;
  font-size: 15px;
  font-weight: bold;
}

.menu-label,
.menu-link .count {
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-link .count {
  gap: 2px;
  color: var(--ink-faint);
}

.menu-label svg {
  width: 18px;
  height: 18px;
}

.menu-link .count svg {
  width: 16px;
  height: 16px;
}

.count {
  color: var(--ink-faint);
  font-weight: normal;
}

/* 새로 온 의견 수 — 휴지통 개수와 달리 그냥 지나쳐선 안 되는 값이다 */
.new {
  min-width: 20px;
  margin-right: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  background: #e53935;
  color: #fff;
  font-size: 12px;
  font-weight: bold;
  text-align: center;
}
</style>
