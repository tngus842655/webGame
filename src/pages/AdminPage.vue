<script setup lang="ts">
// 운영자 전용 화면 — 홈 목록에 게임을 어떻게 내보낼지 정한다.
// 신규 게임은 기록이 없어 인기순 정렬에서 맨 뒤로 밀리므로 '상단 고정'으로 끌어올린다.
import { computed, onMounted, ref } from 'vue'
import { GAMES } from '@/games/registry'
import GameIcon from '@/shared/GameIcon.vue'
import { t, type TranslationKey } from '@/shared/i18n'
import {
  FEATURED_MAX,
  fetchGameFlags,
  saveGameFlag,
  TOP_KEEP,
  type GameFlag,
} from '@/shared/admin'
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

const featuredCount = computed(() => rows.value.filter((row) => row.flag.featured).length)

// 남은 신규 게임의 순서를 1부터 다시 매긴다 (2번을 빼면 3번이 2번이 되도록)
async function renumber() {
  const featured = rows.value
    .filter((row) => row.flag.featured)
    .sort((a, b) => a.flag.sortOrder - b.flag.sortOrder)
  for (const [index, row] of featured.entries()) {
    if (row.flag.sortOrder === index + 1) continue
    row.flag.sortOrder = index + 1
    await save(row.flag)
  }
}

async function toggleFeatured(flag: GameFlag) {
  // 홈 '신규' 칸이 한 줄뿐이라 넘치면 되돌린다
  if (flag.featured && featuredCount.value > FEATURED_MAX) {
    flag.featured = false
    error.value = t('admin.featuredMax', { n: FEATURED_MAX })
    return
  }
  // 체크한 순서대로 뒤에 붙이고, 풀면 그 자리를 메운다
  flag.sortOrder = flag.featured ? featuredCount.value : 0
  await save(flag)
  if (!flag.featured) await renumber()
}

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

// 버리기 확인 — 브라우저 confirm()은 앱 밖 창처럼 보여서 직접 그린다
const pending = ref<Row | null>(null)

async function moveToTrash() {
  const row = pending.value
  if (!row) return
  pending.value = null
  // 내려보내면서 고정도 푼다 — 되돌렸을 때 신규 칸이 3개를 넘지 않도록
  const next = {
    ...row.flag,
    featured: false,
    sortOrder: 0,
    trashedAt: new Date().toISOString(),
  }
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
              <input
                v-model="row.flag.featured"
                type="checkbox"
                @change="toggleFeatured(row.flag)"
              />
              {{ t('admin.featured') }}
            </label>
            <!-- 순서는 체크한 차례대로 정해진다 — 보여주기만 한다 -->
            <span v-if="row.flag.featured" class="order">
              {{ t('admin.order') }} {{ row.flag.sortOrder }}
            </span>
            <button type="button" class="trash-btn" @click="pending = row">
              {{ t('admin.toTrash') }}
            </button>
          </div>
        </div>
      </li>
    </ul>

    <div v-if="pending" class="dim" @click="pending = null">
      <div class="dialog" @click.stop>
        <p class="ask">{{ t('admin.trashConfirm', { name: t(pending.titleKey) }) }}</p>
        <div class="dialog-buttons">
          <button type="button" class="cancel" @click="pending = null">
            {{ t('account.cancel') }}
          </button>
          <button type="button" class="danger" @click="moveToTrash">
            {{ t('admin.toTrash') }}
          </button>
        </div>
      </div>
    </div>
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

.order {
  padding: 2px 9px;
  border-radius: 999px;
  background: #e8f5e9;
  color: #2e7d32;
  font-weight: bold;
}


.dim {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(62 39 35 / 0.45);
}

.dialog {
  width: 100%;
  max-width: 320px;
  padding: 22px 20px 16px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 12px 32px rgb(62 39 35 / 0.25);
}

.ask {
  font-size: 15px;
  line-height: 1.55;
  color: #4e342e;
  text-align: center;
  word-break: keep-all;
}

.dialog-buttons {
  display: flex;
  gap: 8px;
  margin-top: 20px;
}

.dialog-buttons button {
  flex: 1;
  padding: 13px 0;
  border: none;
  border-radius: 13px;
  font: inherit;
  font-size: 15px;
  font-weight: bold;
  cursor: pointer;
}

.cancel {
  background: #efebe9;
  color: #6d4c41;
}

.danger {
  background: #e65100;
  color: #fff;
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
