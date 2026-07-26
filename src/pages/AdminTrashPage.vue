<script setup lang="ts">
// 삭제 대기 화면 — 인기 순위 밖으로 밀려 휴지통에 넣은 게임을 보관 기간과 함께 보여준다.
// 여기서 지우는 것은 '목록에서 빼는 것'까지고, 실제 삭제(코드 제거)는 커밋으로 한다.
import { computed, onMounted, ref } from 'vue'
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { t, locale, type TranslationKey } from '@/shared/i18n'
import { daysLeft, fetchGameFlags, RETENTION_DAYS, saveGameFlag, type GameFlag } from '@/shared/admin'
import { popularityRanks } from '@/shared/scores'

interface Row {
  slug: string
  titleKey: TranslationKey
  rank: number | null
  flag: GameFlag
  trashedAt: string
}

const rows = ref<Row[]>([])
const loading = ref(true)
const failed = ref(false)
const saving = ref('')
const error = ref('')

const removable = computed(() => rows.value.filter((row) => daysLeft(row.trashedAt) === 0))

onMounted(async () => {
  try {
    const titleBySlug = new Map(GAMES.map((game) => [game.slug, game.titleKey]))
    // 휴지통 게임도 사용자가 계속 즐길 수 있어 순위가 움직인다 — 되돌릴지 판단하는 재료다
    const ranks = popularityRanks(GAMES)
    const flags = await fetchGameFlags()
    rows.value = flags
      .filter((flag): flag is GameFlag & { trashedAt: string } => !!flag.trashedAt)
      // 레지스트리에서 이미 지운 게임의 행은 남아 있을 수 있다 — 보여줄 게 없으니 뺀다
      .filter((flag) => titleBySlug.has(flag.slug))
      .map((flag) => ({
        slug: flag.slug,
        titleKey: titleBySlug.get(flag.slug)!,
        rank: ranks.get(flag.slug) ?? null,
        flag,
        trashedAt: flag.trashedAt,
      }))
      .sort((a, b) => a.trashedAt.localeCompare(b.trashedAt))
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})

async function restore(row: Row) {
  saving.value = row.slug
  error.value = ''
  try {
    await saveGameFlag({ ...row.flag, trashedAt: null })
    rows.value = rows.value.filter((item) => item.slug !== row.slug)
  } catch {
    error.value = t('admin.saveFailed')
  } finally {
    saving.value = ''
  }
}

// 숨김을 켜면 사용자 휴지통에서도 사라진다 = 어디에도 안 나온다
async function toggleHidden(row: Row) {
  saving.value = row.slug
  error.value = ''
  try {
    await saveGameFlag(row.flag)
  } catch {
    row.flag.hidden = !row.flag.hidden
    error.value = t('admin.saveFailed')
  } finally {
    saving.value = ''
  }
}

function trashedOn(iso: string): string {
  return new Date(iso).toLocaleDateString(locale.value)
}
</script>

<template>
  <div class="trash">
    <header class="trash-header">
      <RouterLink class="back" to="/admin">←</RouterLink>
      <h1>{{ t('admin.trash') }}</h1>
    </header>

    <p class="hint">{{ t('admin.trashHint', { days: RETENTION_DAYS }) }}</p>
    <p v-if="error" class="error">{{ error }}</p>

    <p v-if="loading" class="notice">{{ t('ranking.loading') }}</p>
    <p v-else-if="failed" class="notice">{{ t('ranking.error') }}</p>
    <p v-else-if="rows.length === 0" class="notice">{{ t('admin.trashEmpty') }}</p>
    <template v-else>
      <p v-if="removable.length > 0" class="ready">
        {{ t('admin.removableNotice', { n: removable.length }) }}
      </p>
      <ul class="list">
        <li v-for="row in rows" :key="row.slug" class="row" :class="{ busy: saving === row.slug }">
          <span class="thumb"><GameIcon :slug="row.slug" /></span>
          <div class="info">
            <div class="title-line">
              <strong>{{ t(row.titleKey) }}</strong>
              <span class="rank">
                {{ row.rank === null ? t('admin.unranked') : t('admin.rank', { n: row.rank }) }}
              </span>
            </div>
            <div class="meta">
              <span>{{ t('admin.trashedOn', { date: trashedOn(row.trashedAt) }) }}</span>
              <span v-if="daysLeft(row.trashedAt) > 0">
                {{ t('admin.daysLeft', { n: daysLeft(row.trashedAt) }) }}
              </span>
              <span v-else class="over">{{ t('admin.removable') }}</span>
            </div>
            <label class="hide">
              <input v-model="row.flag.hidden" type="checkbox" @change="toggleHidden(row)" />
              {{ t('admin.hidden') }}
            </label>
          </div>
          <button type="button" class="restore" :disabled="!!saving" @click="restore(row)">
            {{ t('admin.restore') }}
          </button>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.trash {
  padding: 20px 16px;
}

.trash-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.back {
  font-size: 22px;
  padding: 4px 8px;
}

.trash-header h1 {
  font-size: 20px;
}

.hint {
  margin-bottom: 12px;
  font-size: 13px;
  line-height: 1.5;
  color: #bcaaa4;
  word-break: keep-all;
}

.error {
  margin-bottom: 10px;
  font-size: 13px;
  color: #c62828;
}

.notice {
  padding: 40px 0;
  text-align: center;
  color: #8d6e63;
}

/* 코드에서 지워도 되는 게임이 쌓였다는 신호 */
.ready {
  padding: 10px 12px;
  margin-bottom: 10px;
  border-radius: 10px;
  background: #fff8e1;
  font-size: 13px;
  line-height: 1.5;
  color: #6d4c41;
  word-break: keep-all;
}

.list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #fff;
  border-radius: 14px;
}

.row.busy {
  opacity: 0.5;
}

.thumb {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  opacity: 0.5;
}

.info {
  flex: 1;
  min-width: 0;
}

.title-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.info strong {
  font-size: 14px;
  color: #8d6e63;
}

.rank {
  flex: none;
  font-size: 11px;
  color: #bcaaa4;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 3px;
  font-size: 11px;
  color: #bcaaa4;
}

.meta .over {
  color: #e65100;
  font-weight: bold;
}

.hide {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  font-size: 12px;
  color: #8d6e63;
}

.hide input {
  width: 17px;
  height: 17px;
  accent-color: #e65100;
}

.restore {
  flex: none;
  padding: 7px 14px;
  border: none;
  border-radius: 9px;
  background: #43a047;
  color: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
}

.restore:disabled {
  background: #d7ccc8;
  cursor: default;
}
</style>
