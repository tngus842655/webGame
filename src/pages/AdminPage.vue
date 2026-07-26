<script setup lang="ts">
// 운영자 전용 화면 — 홈 목록에 게임을 어떻게 내보낼지 정한다.
// 신규 게임은 기록이 없어 인기순 정렬에서 맨 뒤로 밀리므로 '상단 고정'으로 끌어올린다.
import { computed, onMounted, ref } from 'vue'
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { t, type TranslationKey } from '@/shared/i18n'
import { fetchGameFlags, saveGameFlag, TOP_KEEP, type GameFlag } from '@/shared/admin'
import { popularityRanks } from '@/shared/scores'

interface Row {
  slug: string
  titleKey: TranslationKey
  rank: number | null
  flag: GameFlag
}

const all = ref<Row[]>([])
const loading = ref(true)
const failed = ref(false)
const saving = ref('')
const error = ref('')

const rows = computed(() => all.value.filter((row) => !row.flag.trashedAt))
const trashedCount = computed(() => all.value.length - rows.value.length)

onMounted(async () => {
  try {
    const bySlug = new Map((await fetchGameFlags()).map((flag) => [flag.slug, flag]))
    const ranks = popularityRanks()
    // 등록 순서 그대로 — 숨긴 게임도 여기서는 보여야 다시 켤 수 있다
    all.value = GAMES.map((game) => ({
      slug: game.slug,
      titleKey: game.titleKey,
      rank: ranks.get(game.slug) ?? null,
      flag: bySlug.get(game.slug) ?? {
        slug: game.slug,
        featured: false,
        hidden: false,
        sortOrder: 0,
        trashedAt: null,
      },
    }))
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})

async function save(flag: GameFlag) {
  saving.value = flag.slug
  error.value = ''
  try {
    await saveGameFlag(flag)
  } catch {
    error.value = t('admin.saveFailed')
  } finally {
    saving.value = ''
  }
}

async function moveToTrash(row: Row) {
  if (!confirm(t('admin.trashConfirm', { name: t(row.titleKey) }))) return
  const next = { ...row.flag, trashedAt: new Date().toISOString() }
  await save(next)
  if (!error.value) row.flag = next
}
</script>

<template>
  <div class="admin">
    <header class="admin-header">
      <RouterLink class="back" to="/">←</RouterLink>
      <h1>{{ t('admin.title') }}</h1>
      <RouterLink class="stats-link" to="/stats">{{ t('stats.title') }}</RouterLink>
    </header>

    <RouterLink class="menu-link" to="/admin/trash">
      <span>🗑️ {{ t('admin.trash') }}</span>
      <span class="count">{{ trashedCount > 0 ? trashedCount : '' }} ›</span>
    </RouterLink>

    <p class="hint">{{ t('admin.hint') }}</p>
    <p v-if="error" class="error">{{ error }}</p>

    <p v-if="loading" class="notice">{{ t('ranking.loading') }}</p>
    <p v-else-if="failed" class="notice">{{ t('ranking.error') }}</p>
    <ul v-else class="list">
      <li v-for="row in rows" :key="row.slug" class="row" :class="{ busy: saving === row.slug }">
        <span class="thumb"><GameIcon :slug="row.slug" /></span>
        <div class="info">
          <div class="title-line">
            <strong>{{ t(row.titleKey) }}</strong>
            <span v-if="row.rank === null" class="rank">{{ t('admin.unranked') }}</span>
            <span v-else class="rank" :class="{ out: row.rank > TOP_KEEP }">
              {{ t('admin.rank', { n: row.rank }) }}
            </span>
          </div>
          <div class="controls">
            <label>
              <input v-model="row.flag.featured" type="checkbox" @change="save(row.flag)" />
              {{ t('admin.featured') }}
            </label>
            <label>
              <input v-model="row.flag.hidden" type="checkbox" @change="save(row.flag)" />
              {{ t('admin.hidden') }}
            </label>
            <label class="order">
              {{ t('admin.order') }}
              <input
                v-model.number="row.flag.sortOrder"
                type="number"
                min="0"
                max="99"
                @change="save(row.flag)"
              />
            </label>
            <button type="button" class="trash-btn" @click="moveToTrash(row)">
              {{ t('admin.toTrash') }}
            </button>
          </div>
        </div>
      </li>
    </ul>
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

.back {
  font-size: 22px;
  padding: 4px 8px;
}

.admin-header h1 {
  flex: 1;
  font-size: 20px;
}

.stats-link {
  font-size: 13px;
  color: #8d6e63;
  text-decoration: underline;
}

.menu-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  margin-bottom: 12px;
  background: #fff;
  border-radius: 14px;
  font-size: 15px;
  font-weight: bold;
}

.count {
  color: #bcaaa4;
  font-weight: normal;
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

.title-line strong {
  font-size: 14px;
}

.rank {
  flex: none;
  font-size: 11px;
  color: #bcaaa4;
}

/* 30위 밖 = 휴지통 후보 */
.rank.out {
  color: #e65100;
  font-weight: bold;
}

.controls {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 6px;
  font-size: 12px;
  color: #8d6e63;
}

.controls label {
  display: flex;
  align-items: center;
  gap: 5px;
}

.controls input[type='checkbox'] {
  width: 17px;
  height: 17px;
  accent-color: #43a047;
}

.order input {
  width: 46px;
  padding: 3px 6px;
  border: 1px solid #d7ccc8;
  border-radius: 7px;
  font: inherit;
}

.trash-btn {
  margin-left: auto;
  padding: 4px 10px;
  border: 1px solid #ffccbc;
  border-radius: 8px;
  background: #fff;
  font: inherit;
  font-size: 12px;
  color: #e65100;
  cursor: pointer;
}
</style>
