<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { GAMES } from '@/games/registry'
import { getCurrentUserId } from '@/shared/auth'
import { t } from '@/shared/i18n'
import { fetchMyProfile, updateMyNickname } from '@/shared/profile'
import { formatRankRange, thisMonthRange, thisWeekRange } from '@/shared/rankPeriod'
import { fetchLeaderboard, fetchMyStats, type LeaderboardEntry } from '@/shared/scores'
import UiIcon from '@/shared/UiIcon.vue'

const route = useRoute()
const slug = String(route.params.slug)
const game = GAMES.find((g) => g.slug === slug)

// 점수가 아니라 단계로 겨루는 게임은 숫자 옆에 단위를 붙인다 (registry의 recordUnit)
function record(value: number): string {
  const n = value.toLocaleString()
  return game?.recordUnit === 'stage' ? t('rank.stage', { n }) : n
}

// 여기까지가 상위권. 1~3위는 금·은·동을 두르고, 10위까지는 번호와 글자를 한 톤 올린다.
const TOP_TIER = 10

const period = ref<'week' | 'month'>('week')
const range = computed(() => (period.value === 'week' ? thisWeekRange() : thisMonthRange()))

// 탭 이름만으로는 구간이 정확히 어디서 끊기는지 안 보인다 — 날짜로 적어 준다
const caption = computed(() => formatRankRange(range.value))

const entries = ref<LeaderboardEntry[]>([])
const loading = ref(true)
const failed = ref(false)
const myUserId = ref<string | null>(null)

// 화면 아래에 붙여 두는 내 줄. 순위표는 50위까지만 받아 오므로 그 밖에 있으면 화면
// 어디에도 내가 없다 — 내 이름이 순위표에 걸려 있다는 것조차 모른 채 나가게 된다.
const mine = ref<{ rank: number; score: number } | null>(null)
const myNickname = ref('')
// 프로필을 못 읽었을 때 이름 유도가 뜨지 않도록 '정해 둔 것'으로 시작한다
const myNicknameSet = ref(true)

async function load() {
  loading.value = true
  failed.value = false
  try {
    entries.value = await fetchLeaderboard(slug, period.value)
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

async function loadMine() {
  // 세션이 없다 = 아직 아무것도 기록하지 않은 방문자. 여기서 계정을 만들지 않는다
  // (fetchMyProfile은 세션이 없으면 익명 로그인부터 한다).
  if (!myUserId.value) return
  try {
    const [stats, profile] = await Promise.all([fetchMyStats(range.value), fetchMyProfile()])
    const stat = stats.find((entry) => entry.game_slug === slug)
    // 이 구간에 기록이 없으면 순위표에 걸린 것도 없다 — 줄을 세우지 않는다
    mine.value =
      stat && stat.rank !== null && stat.period_best !== null
        ? { rank: stat.rank, score: stat.period_best }
        : null
    myNickname.value = profile.nickname
    myNicknameSet.value = profile.nicknameSet
  } catch {
    // 순위표 자체는 떠 있다. 덧붙이는 줄이라 조용히 접는다
    mine.value = null
  }
}

async function reload() {
  await Promise.all([load(), loadMine()])
}

onMounted(async () => {
  myUserId.value = await getCurrentUserId()
  await reload()
})
watch(period, reload)

// 이름 고치기 — 설정 화면으로 보내면 랭킹으로 돌아오는 길에 대부분 흩어진다.
// 여기서 정하고, 바뀐 이름이 순위표에 올라가는 것을 그 자리에서 본다.
const editing = ref(false)
const draft = ref('')
const saving = ref(false)
const editError = ref('')
const draftLength = computed(() => draft.value.trim().length)
const draftInput = ref<HTMLInputElement | null>(null)

function openEditor() {
  // 아직 정한 적 없는 기본 이름(Guest-xxxx)은 지우는 것부터 시키지 않는다
  draft.value = myNicknameSet.value ? myNickname.value : ''
  editError.value = ''
  editing.value = true
  void nextTick(() => draftInput.value?.focus())
}

async function saveNickname() {
  const name = draft.value.trim()
  // 설정 화면과 같은 규칙 (DB 제약은 1~12자지만 한 글자는 순위표에서 이름 구실을 못 한다)
  if (name.length < 2 || name.length > 12) {
    editError.value = t('settings.lengthError')
    return
  }
  saving.value = true
  editError.value = ''
  try {
    await updateMyNickname(name)
    myNickname.value = name
    myNicknameSet.value = true
    editing.value = false
    // 50위 안에 있었다면 순위표의 내 줄도 그 자리에서 새 이름으로 바뀐다
    await load()
  } catch {
    editError.value = t('settings.saveFailed')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="ranking">
    <header class="ranking-header">
      <RouterLink class="back" to="/ranking"><UiIcon name="back" /></RouterLink>
      <h1>{{ t('ranking.title', { name: game ? t(game.titleKey) : t('ranking.unknown') }) }}</h1>
    </header>

    <div class="tabs">
      <button type="button" :class="{ active: period === 'week' }" @click="period = 'week'">
        {{ t('ranking.week') }}
      </button>
      <button type="button" :class="{ active: period === 'month' }" @click="period = 'month'">
        {{ t('ranking.month') }}
      </button>
    </div>
    <p class="caption">{{ caption }}</p>

    <p v-if="loading" class="notice">{{ t('ranking.loading') }}</p>
    <p v-else-if="failed" class="notice">{{ t('ranking.error') }}</p>
    <p v-else-if="entries.length === 0" class="notice">{{ t('ranking.empty') }}</p>
    <ol v-else class="board">
      <li
        v-for="(entry, i) in entries"
        :key="entry.user_id"
        :class="[i < 3 ? `m${i + 1}` : '', { top: i < TOP_TIER, me: entry.user_id === myUserId }]"
      >
        <span class="rank">{{ i + 1 }}</span>
        <span class="name">{{ entry.nickname }}</span>
        <span class="score">{{ record(entry.best_score) }}</span>
      </li>
    </ol>

    <!-- 내 순위 — 위 목록은 50위까지라 그 밖이면 화면 어디에도 내가 없다.
         아직 이름을 정하지 않았으면 이 줄의 이름 자리가 곧 고치는 자리다. -->
    <div v-if="mine && !failed" class="my-rank">
      <div class="my-row">
        <span class="rank">{{ mine.rank }}</span>
        <button
          v-if="!myNicknameSet"
          type="button"
          class="name-btn"
          :aria-label="t('rank.setName')"
          @click="openEditor"
        >
          <span class="name-text">{{ myNickname }}</span>
          <UiIcon name="pencil" />
        </button>
        <span v-else class="name">{{ myNickname }}</span>
        <span class="score">{{ record(mine.score) }}</span>
      </div>
      <p v-if="!myNicknameSet" class="nudge">{{ t('rank.nameNudge') }}</p>
    </div>

    <div v-if="editing" class="name-backdrop" @click.self="editing = false">
      <div class="name-card" role="dialog" aria-modal="true">
        <h2>{{ t('settings.nickname') }}</h2>
        <div class="nick-field">
          <input
            ref="draftInput"
            v-model="draft"
            type="text"
            maxlength="12"
            :placeholder="t('settings.placeholder')"
            @keyup.enter="saveNickname"
          />
          <span class="counter" :class="{ short: draftLength < 2 }">{{ draftLength }}/12</span>
        </div>
        <p v-if="editError" class="name-error">{{ editError }}</p>
        <button type="button" class="btn btn--go" :disabled="saving" @click="saveNickname">
          {{ saving ? t('settings.saving') : t('settings.save') }}
        </button>
        <button type="button" class="btn btn--ghost" @click="editing = false">
          {{ t('rank.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ranking {
  padding: 20px 16px;
}

.ranking-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.ranking-header h1 {
  font-size: 20px;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.caption {
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--ink-faint);
}

.tabs button {
  flex: 1;
  padding: 10px 0;
  border: none;
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink-faint);
  cursor: pointer;
}

.tabs button.active {
  background: var(--ink-muted);
  color: var(--surface);
  font-weight: bold;
}

.notice {
  padding: 40px 0;
  text-align: center;
  color: var(--ink-muted);
}

.board {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.board li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--surface);
  border-radius: 12px;
}

/* 1~3위는 줄 자체가 금·은·동을 띤다 (홈의 인기 카드와 같은 결).
   1위만 그림자를 얹어 한 칸 앞으로 나오게 한다 — 순서를 색만으로 읽기는 어렵다. */
.board li.m1 {
  background: linear-gradient(168deg, #fffbf0, #fff1d2);
  outline: 2px solid #e3b35a;
  outline-offset: -2px;
  box-shadow: var(--shadow-raise);
}

.board li.m2 {
  background: linear-gradient(168deg, #fdfefe, #edf1f4);
  outline: 1.5px solid #bfc7cd;
  outline-offset: -1.5px;
  box-shadow: var(--shadow-card);
}

.board li.m3 {
  background: linear-gradient(168deg, #fff9f3, #f7e6d7);
  outline: 1.5px solid #d3a077;
  outline-offset: -1.5px;
  box-shadow: var(--shadow-card);
}

/* 금빛 판은 어두운 화면에서 혼자 밝게 뜬다. 결은 그대로 두고 명도만 내린다. */
[data-theme='dark'] .board li.m1 {
  background: linear-gradient(168deg, #3b3019, #2e2617);
  outline-color: #8a6a26;
}

[data-theme='dark'] .board li.m2 {
  background: linear-gradient(168deg, #333739, #272b2d);
  outline-color: #5c6369;
}

[data-theme='dark'] .board li.m3 {
  background: linear-gradient(168deg, #392b21, #2c211a);
  outline-color: #7c5837;
}

/* 11위부터는 한 줄 띄워 상위권과 갈린다 — 따로 문구를 붙이지 않고 자리로만 알린다 */
.board li.top + li:not(.top) {
  margin-top: 10px;
}

/* 내 기록은 어디에 있든 이 초록으로 찾는다. 메달 테두리를 이겨야 하므로 뒤에 두고,
   어두운 테마의 메달 규칙과도 무게를 맞춘다. */
.board li.me,
[data-theme='dark'] .board li.me {
  outline: 2px solid #43a047;
}

.rank {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  color: var(--ink-faint);
}

/* 상위 10위 — 번호에 판을 깔고 이름·점수를 진하게. --press는 두 테마 모두에서
   바탕보다 한 겹 도드라지는 값이라 여기 그대로 쓴다. */
.board li.top .rank {
  background: var(--press);
  color: var(--ink-body);
}

.board li.top .name {
  font-weight: 700;
  color: var(--ink);
}

.board li.top .score {
  color: var(--ink);
}

/* 메달 번호는 두 테마에서 같은 색을 쓴다 — 금·은·동은 고유색이다 */
.board li.m1 .rank {
  background: linear-gradient(#ffe9a8, #f2c65a);
  color: #6b4e0d;
}

.board li.m2 .rank {
  background: linear-gradient(#f4f7f9, #d2d9de);
  color: #4a555c;
}

.board li.m3 .rank {
  background: linear-gradient(#f7dcc5, #e0b088);
  color: #7a4a22;
}

.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score {
  font-weight: bold;
}

/* ── 내 순위 ─────────────────────────────────────────────
   위 목록은 50위까지고 대부분은 그 밖에 있다. 화면 아래에 붙여 두지 않으면
   자기 이름이 순위표에 어떻게 걸려 있는지 볼 기회 자체가 없다.
   목록 뒤에 그냥 놓인 카드이기도 해서(스크롤이 없는 화면) 붙는 자리를 따로 꾸미지 않는다. */
.my-rank {
  position: sticky;
  /* 안드로이드 15의 내비게이션 바를 덮는 띠(.app-shell::after)가 화면 맨 아래에
     고정돼 있다 — 그 높이만큼 띄워 띠 위에 뜬다 */
  bottom: calc(var(--safe-area-inset-bottom, env(safe-area-inset-bottom)) + 10px);
  z-index: 1;
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--surface);
  /* 내 기록이라 목록의 .me와 같은 초록을 두른다. 목록 위에 떠 있으므로 그림자는 한 단계 위 */
  outline: 2px solid #43a047;
  outline-offset: -2px;
  box-shadow: var(--shadow-lift);
}

.my-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 내 줄의 번호는 상위권과 같은 무게로 — 이 카드의 주인공이 이 숫자다 */
.my-rank .rank {
  background: var(--press);
  color: var(--ink-body);
}

.my-rank .name,
.name-text {
  font-weight: 700;
  color: var(--ink);
}

/* 아직 정하지 않은 이름 — 'Guest-3f2a'를 그대로 보여주되 누르면 고쳐지는 자리로 만든다.
   설정 화면까지 다녀오는 왕복이 사람들이 이름을 안 정하는 진짜 이유다. */
.name-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  /* 점수는 오른쪽 끝에 그대로 — 이름 칩만 글자 길이만큼 차지한다 */
  margin-right: auto;
  padding: 5px 11px;
  border: none;
  border-radius: 999px;
  background: var(--press);
  font: inherit;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.name-btn:active {
  transform: scale(0.96);
}

.name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name-btn svg {
  flex: none;
  width: 13px;
  height: 13px;
  color: var(--ink-muted);
}

/* 번호 자리(28px)와 사이(12px)만큼 들여 이름 바로 아래에 붙인다 */
.nudge {
  margin: 8px 0 0 40px;
  font-size: 12px;
  color: var(--ink-muted);
  word-break: keep-all;
}

/* ── 이름 고치기 팝업 ─────────────────────────────────────
   새 버전 안내(UpdatePrompt.vue)와 같은 결. 화면 아래 띠(z-index 50)는 넘고,
   업데이트 안내(60)에는 양보한다. */
.name-backdrop {
  position: fixed;
  inset: 0;
  z-index: 55;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgb(38 26 22 / 0.66);
}

.name-card {
  width: 100%;
  max-width: 320px;
  padding: 22px 20px 14px;
  border-radius: 22px;
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-lift);
}

.name-card h2 {
  margin-bottom: 12px;
  font-size: 18px;
  text-align: center;
}

/* 설정 화면의 닉네임 칸과 같은 규칙 (SettingsPage.vue) */
.nick-field {
  position: relative;
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

.name-error {
  margin-top: 10px;
  font-size: 13px;
  color: var(--danger);
}

.name-card .btn {
  margin-top: 14px;
}

.name-card .btn--ghost {
  margin-top: 4px;
}
</style>
