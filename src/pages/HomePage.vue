<script lang="ts">
type TabKey = 'new' | 'favorite' | 'more'

// 게임에 들어갔다 나오면 홈은 새로 만들어진다. 고른 탭과 캐러셀이 멈춘 자리는
// 컴포넌트 밖에 둬야 그 사이를 건너뛴다. 앱을 껐다 켜면 기본값으로 돌아간다.
let keptTab: TabKey = 'more'
let keptScroll = 0
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { GAMES } from '@/games/registry'
import FavoriteButton from '@/shared/FavoriteButton.vue'
import GameCard from '@/shared/GameCard.vue'
import GameIcon from '@/shared/GameIcon.vue'
import { t, type TranslationKey } from '@/shared/i18n'
import { favorites, recents } from '@/shared/library'
import { isInToss } from '@/shared/toss'
import { promotionStatus } from '@/shared/tossPromotion'
import UiIcon from '@/shared/UiIcon.vue'
import {
  featuredSlugs,
  fetchMyStats,
  hasCachedFlags,
  getLocalBest,
  refreshPopularity,
  sortByPopularity,
  syncLocalBests,
  trashedGames,
  type MyGameStat,
} from '@/shared/scores'
import { ensureAdminChecked, fetchGameFlags, isAdmin } from '@/shared/admin'
import { refreshUnreadFeedback, unreadFeedback } from '@/shared/feedback'

const router = useRouter()

// 앱인토스 프로모션 배너. 상태를 못 읽었으면(비로그인·조회 실패) 아예 안 그린다.
// 웹·안드로이드에서는 상태가 채워질 일이 없지만(claimTossPromotion이 즉시 빠져나온다),
// 배너 문구는 이 컴포넌트에 그대로 있으므로 조건에서 한 번 더 막는다.
const promo = computed(() => (isInToss ? promotionStatus.value : null))
const promoHeadline = computed(() => {
  const status = promotionStatus.value
  if (!status) return ''
  if (status.granted >= status.total) return '토스포인트 100원을 다 받았어요'
  if (status.granted > 0) return `${status.total - status.granted}원 더 받을 수 있어요`
  return '게임 3판이면 토스포인트 100원'
})

// 기록이 없어도 빈 문자열을 반환해 한 줄을 차지한다 (CSS에서 높이 확보)
function scoreLabel(card: { best: number | null; stat: MyGameStat | null }): string {
  if (card.stat) {
    return t('home.myRank', {
      score: card.stat.best_score.toLocaleString(),
      rank: card.stat.rank,
    })
  }
  return card.best === null ? '' : t('home.best', { n: card.best.toLocaleString() })
}

function play(slug: string) {
  void router.push(`/play/${slug}`)
}

// 카드 순서는 캐시된 인기순으로 처음부터 확정하고, 서버 응답으로는 내 기록만 채운다.
const cards = ref(
  sortByPopularity(GAMES).map((game) => ({
    ...game,
    best: getLocalBest(game.slug),
    stat: null as MyGameStat | null,
  })),
)

// sortByPopularity가 신규(관리자가 올린 것)를 이미 앞에 세워두므로 여기서는 가르기만 한다
const featured = ref(featuredSlugs())
const fresh = computed(() => cards.value.filter((card) => featured.value.has(card.slug)))
const ranked = computed(() => cards.value.filter((card) => !featured.value.has(card.slug)))

const top3 = computed(() => ranked.value.slice(0, 3))
const moreGames = computed(() => ranked.value.slice(3))

// 최근에 담은 것이 앞 (library가 새 슬러그를 앞에 넣는다)
const favoriteGames = computed(() => {
  const order = new Map(favorites.value.map((slug, index) => [slug, index]))
  return cards.value
    .filter((card) => order.has(card.slug))
    .sort((a, b) => order.get(a.slug)! - order.get(b.slug)!)
})

// 휴지통·숨김 게임은 cards에 없으므로 여기서 자연히 빠진다
const recentGames = computed(() => {
  const bySlug = new Map(cards.value.map((card) => [card.slug, card]))
  return recents.value.flatMap((slug) => bySlug.get(slug) ?? [])
})

const TABS: Array<{ key: TabKey; labelKey: TranslationKey; icon: 'sparkle' | 'star' | 'gamepad' }> =
  [
    { key: 'new', labelKey: 'home.sectionNew', icon: 'sparkle' },
    { key: 'favorite', labelKey: 'home.sectionFavorites', icon: 'star' },
    { key: 'more', labelKey: 'home.sectionMore', icon: 'gamepad' },
  ]

// 게임을 다녀오면 보던 탭으로 돌아온다. 처음 켰을 때의 기본은 '더 많은 게임' —
// 셋 중 유일하게 항상 차 있다 (신규는 관리자가 안 올렸을 수 있고, 즐겨찾기는 비어 있다).
const tab = ref<TabKey>(keptTab)
watch(tab, (key) => {
  keptTab = key
})

// ── 좌우로 흐르는 카드 (끝이 없다) ─────────────────────
// 같은 목록을 세 벌 이어 붙이고 가운데 벌에서만 논다. 손을 뗀 뒤 가운데 벌을
// 벗어나 있으면 한 벌 폭만큼 소리 없이 되돌린다 — 되돌리는 거리가 칸 간격의
// 정확한 배수라 눈에 보이는 것은 그대로고, 사용자에게는 끝이 없는 줄이 된다.
// 되돌리기를 스크롤 도중에 하면 튕긴 힘이 그 자리에서 죽어버려서 멈춘 뒤에 한다.
const LOOP_COPIES = 3
const SETTLE_MS = 140

const track = ref<HTMLDivElement | null>(null)
const centerIndex = ref(0)
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
let frame = 0
let settleTimer = 0

// 순서가 바뀌지 않는 목록이라 순번을 key로 써도 카드가 뒤섞이지 않는다
const loopGames = computed(() => {
  const games = moreGames.value
  return Array.from({ length: LOOP_COPIES * games.length }, (_, i) => games[i % games.length])
})

// 카드 폭·간격이 모두 같아서 첫 장 위치와 칸 간격만 재면 나머지는 계산으로 나온다.
// 카드마다 위치를 물으면 여든 번 넘게 레이아웃을 읽어야 해서 스크롤이 걸린다.
function metrics(el: HTMLElement) {
  const slots = el.children as HTMLCollectionOf<HTMLElement>
  if (slots.length === 0) return null
  const originLeft = slots[0].offsetLeft
  const cardWidth = slots[0].offsetWidth
  const step = slots.length > 1 ? slots[1].offsetLeft - originLeft : cardWidth
  return { slots, originLeft, cardWidth, step }
}

function paintCarousel() {
  frame = 0
  const el = track.value
  if (!el || el.clientWidth === 0) return
  const m = metrics(el)
  if (!m || m.step === 0) return

  const mid = el.scrollLeft + el.clientWidth / 2
  let nearest = 0
  let nearestGap = Infinity

  for (let i = 0; i < m.slots.length; i++) {
    const gap = (m.originLeft + i * m.step + m.cardWidth / 2 - mid) / m.step
    const away = Math.abs(gap)
    // 옆으로 한 칸을 넘어가면 더 눕지도 작아지지도 않는다 (가운데 120 : 양옆 60).
    // 양옆이 반으로 줄면서 벌어진 자리는 안쪽으로 당겨 메운다.
    const turn = Math.max(-1, Math.min(1, gap))
    const slot = m.slots[i]
    slot.style.transform =
      `perspective(620px) translateX(${(-turn * 24).toFixed(1)}px)` +
      ` rotateY(${(turn * 20).toFixed(1)}deg) scale(${(1 - Math.min(away, 1) * 0.5).toFixed(3)})`
    slot.style.opacity = (1 - Math.min(away, 2) * 0.2).toFixed(2)
    slot.style.zIndex = String(30 - Math.round(Math.min(away, 2) * 10))
    if (away < nearestGap) {
      nearestGap = away
      nearest = i
    }
  }

  centerIndex.value = nearest
}

function scheduleCarousel() {
  if (frame) return
  frame = requestAnimationFrame(paintCarousel)
}

// 가운데 벌의 첫 장이 화면 한가운데에 서는 자리
function homeOffset(el: HTMLElement): number {
  const m = metrics(el)
  return m ? moreGames.value.length * m.step : 0
}

function normalizeLoop() {
  const el = track.value
  if (!el || el.clientWidth === 0) return
  const copy = homeOffset(el)
  if (copy === 0) return
  let left = el.scrollLeft
  while (left < copy) left += copy
  while (left >= copy * 2) left -= copy
  if (Math.abs(left - el.scrollLeft) < 0.5) return
  el.scrollLeft = left
  paintCarousel()
}

function onTrackScroll() {
  scheduleCarousel()
  clearTimeout(settleTimer)
  settleTimer = window.setTimeout(() => {
    normalizeLoop()
    // 멈출 때마다 남겨둔다 — 게임에 들어가면 이 자리로 돌아온다
    if (track.value) keptScroll = track.value.scrollLeft
  }, SETTLE_MS)
}

// 처음이면 가운데 벌의 첫 장에서, 다녀온 뒤라면 멈췄던 자리에서 시작한다.
// 첫 장 왼쪽에도 카드가 서 있어야 끝이 없어 보인다.
function restoreCarousel() {
  const el = track.value
  if (!el || el.clientWidth === 0) return
  const start = keptScroll > 0 ? keptScroll : homeOffset(el)
  if (Math.abs(el.scrollLeft - start) > 0.5) el.scrollLeft = start
  paintCarousel()
}

function focusCard(index: number) {
  const el = track.value
  const m = el ? metrics(el) : null
  if (!el || !m) return
  el.scrollTo({
    left: m.originLeft + index * m.step + m.cardWidth / 2 - el.clientWidth / 2,
    behavior: calm ? 'auto' : 'smooth',
  })
}

// 가운데 카드는 바로 실행, 옆 카드는 먼저 가운데로 데려온다
function tapCard(index: number, slug: string) {
  if (index === centerIndex.value) play(slug)
  else focusCard(index)
}

// 서른 개가 넘으니 뭘 할지 못 정하는 사람이 있다. 아무거나 눌러 바로 들어가게 한다.
// 후보는 캐러셀이 아니라 지금 즐길 수 있는 게임 전부다 — 인기 셋도 뽑힌다.
// 방금 한 게임만 빼는데, 안 그러면 연달아 눌렀을 때 같은 게임이 나와 고장 난 것처럼 보인다.
function playRandom() {
  const pool = cards.value.filter((card) => card.slug !== recents.value[0])
  const list = pool.length > 0 ? pool : cards.value
  if (list.length === 0) return
  play(list[Math.floor(Math.random() * list.length)].slug)
}

const centerGame = computed(() => {
  const games = moreGames.value
  return games.length > 0 ? games[centerIndex.value % games.length] : null
})

// 탭을 눌러 다시 보이게 됐을 때 — 숨어 있는 동안에는 폭이 0이라 그릴 수 없었다
watch(tab, async (key) => {
  if (key !== 'more') return
  await nextTick()
  restoreCarousel()
})

// 휴지통에 아무것도 없으면 입구를 만들지 않는다
const trashCount = trashedGames(GAMES).length

onMounted(async () => {
  restoreCarousel()
  window.addEventListener('resize', scheduleCarousel)
  // 설치하고 처음 켠 순간에는 노출 설정 캐시가 비어 있다. 관리자가 신규로 올린
  // 게임이 있어도 '신규 게임' 칸이 빈 채로 뜨던 이유다 — 다른 화면을 다녀오면
  // 그제서야 채워졌다. 아직 아무 배열도 보지 않은 때라 미룰 이유가 없으니,
  // 이때만 응답을 기다렸다 목록을 세운다.
  const firstRun = !hasCachedFlags()
  const flags = fetchGameFlags().catch(() => {})
  void ensureAdminChecked().then((ok) => {
    if (ok) void refreshUnreadFeedback()
  })
  const [, , myStats] = await Promise.all([
    flags,
    refreshPopularity(),
    fetchMyStats().catch(() => [] as MyGameStat[]),
  ])
  // 서버 기록을 로컬에 되먹인다 — 안 하면 플레이 화면의 최고 기록이 이 기기 값에 머문다
  syncLocalBests(myStats)
  const statBySlug = new Map(myStats.map((stat) => [stat.game_slug, stat]))
  if (firstRun) {
    featured.value = featuredSlugs()
    cards.value = sortByPopularity(GAMES).map((game) => ({
      ...game,
      best: getLocalBest(game.slug),
      stat: statBySlug.get(game.slug) ?? null,
    }))
    await nextTick()
    restoreCarousel()
    return
  }
  // 두 번째부터는 예전대로 — 캐시된 배열을 그대로 두고 내 기록만 채운다
  cards.value = cards.value.map((card) => ({ ...card, stat: statBySlug.get(card.slug) ?? null }))
})

onBeforeUnmount(() => {
  // 손을 뗀 직후 카드를 눌러 들어가면 아직 안 남았을 수 있다
  if (track.value && track.value.scrollLeft > 0) keptScroll = track.value.scrollLeft
  window.removeEventListener('resize', scheduleCarousel)
  clearTimeout(settleTimer)
  if (frame) cancelAnimationFrame(frame)
})
</script>

<template>
  <div class="home">
    <nav class="home-header">
      <RouterLink to="/ranking" :aria-label="t('home.ranking')"><UiIcon name="trophy" /></RouterLink>
      <RouterLink v-if="isAdmin" class="admin-link" to="/admin" :aria-label="t('admin.title')">
        <UiIcon name="wrench" />
        <!-- 새 의견이 왔다는 것을 앱을 열자마자 알아야 한다 -->
        <span v-if="unreadFeedback > 0" class="dot" :aria-label="t('admin.feedbackNew')" />
      </RouterLink>
      <RouterLink to="/settings" :aria-label="t('settings.title')"><UiIcon name="gear" /></RouterLink>
    </nav>

    <!-- 앱인토스 프로모션. 미니앱 빌드에서만, 그리고 지급 상태를 읽어온 뒤에만 뜬다.
         고지 화면으로 가는 유일한 입구라 다 받은 뒤에도 남긴다 -->
    <RouterLink v-if="promo" class="promo" to="/event">
      <span class="promo-text">
        <strong>{{ promoHeadline }}</strong>
        <small>접속 20원 · 1판 30원 · 3판 50원</small>
      </span>
      <UiIcon name="chevron" />
    </RouterLink>

    <section v-if="top3.length > 0" class="shelf top3">
      <h2><UiIcon name="flame" />{{ t('home.sectionPopular') }}</h2>
      <div class="game-grid">
        <GameCard
          v-for="(game, index) in top3"
          :key="game.slug"
          favoritable
          :slug="game.slug"
          :title-key="game.titleKey"
          :medal="index + 1"
          :label="scoreLabel(game)"
        />
      </div>
    </section>

    <section v-if="recentGames.length > 0" class="shelf recent">
      <h2><UiIcon name="clock" />{{ t('home.sectionRecent') }}</h2>
      <div class="recent-row">
        <button
          v-for="game in recentGames"
          :key="game.slug"
          type="button"
          class="recent-item"
          @click="play(game.slug)"
        >
          <span class="recent-thumb"><GameIcon :slug="game.slug" /></span>
          <span class="recent-name">{{ t(game.titleKey) }}</span>
        </button>
      </div>
    </section>

    <div class="tabs" role="tablist">
      <button
        v-for="item in TABS"
        :key="item.key"
        type="button"
        role="tab"
        :id="`tab-${item.key}`"
        :aria-selected="tab === item.key"
        :aria-controls="`panel-${item.key}`"
        @click="tab = item.key"
      >
        <UiIcon :name="item.icon" /><span>{{ t(item.labelKey) }}</span>
      </button>
    </div>

    <section class="shelf panel">
      <div v-show="tab === 'new'" id="panel-new" role="tabpanel" aria-labelledby="tab-new" class="pad">
        <div v-if="fresh.length > 0" class="game-grid">
          <GameCard
            v-for="game in fresh"
            :key="game.slug"
            favoritable
            :slug="game.slug"
            :title-key="game.titleKey"
            :label="scoreLabel(game)"
          />
        </div>
        <p v-else class="empty">{{ t('home.newEmpty') }}</p>
      </div>

      <div
        v-show="tab === 'favorite'"
        id="panel-favorite"
        role="tabpanel"
        aria-labelledby="tab-favorite"
        class="pad"
      >
        <div v-if="favoriteGames.length > 0" class="game-grid">
          <GameCard
            v-for="game in favoriteGames"
            :key="game.slug"
            favoritable
            :slug="game.slug"
            :title-key="game.titleKey"
            :label="scoreLabel(game)"
          />
        </div>
        <p v-else class="empty">{{ t('home.favoritesEmpty') }}</p>
      </div>

      <div v-show="tab === 'more'" id="panel-more" role="tabpanel" aria-labelledby="tab-more">
        <div ref="track" class="cf-track" @scroll.passive="onTrackScroll">
          <div
            v-for="(game, index) in loopGames"
            :key="index"
            class="cf-slot"
            :class="{ 'is-center': index === centerIndex }"
          >
            <button type="button" class="cf-card" @click="tapCard(index, game.slug)">
              <span class="thumb"><GameIcon :slug="game.slug" /></span>
              <strong>{{ t(game.titleKey) }}</strong>
              <small>{{ scoreLabel(game) }}</small>
            </button>
            <FavoriteButton :slug="game.slug" />
          </div>
        </div>

        <div v-if="centerGame" class="cf-foot">
          <button
            type="button"
            class="play-btn"
            :aria-label="t(centerGame.titleKey)"
            @click="play(centerGame.slug)"
          >
            <UiIcon name="play" />{{ t('home.play') }}
          </button>
          <button type="button" class="random-btn" @click="playRandom">
            <UiIcon name="dice" />{{ t('home.random') }}
          </button>
        </div>
      </div>
    </section>

    <RouterLink v-if="trashCount > 0" class="trash-entry" to="/trash">
      <span class="trash-label"><UiIcon name="trash" />{{ t('trash.title') }}</span>
      <span class="count">{{ trashCount }}<UiIcon name="chevron" /></span>
    </RouterLink>
  </div>
</template>

<style scoped>
.home {
  padding: 14px 16px 24px;
}

/* 제목을 뺀 자리 — 트로피와 설정만 오른쪽에 붙인다.
   이모지 링크였을 때는 기기마다 크기가 제각각이고 과녁도 작았다. */
.home-header {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-bottom: 18px;
}

/* 프로모션 배너 — 게임 목록 위 한 줄. 카드보다 낮고 얇게 둬서 목록을 밀어내지 않는다 */
.promo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  padding: 12px 14px;
  border: 1px solid #ffe0b2;
  border-radius: 14px;
  background: linear-gradient(#fffaf2, #fff8e1);
  color: var(--ink);
}

.promo:active {
  background: #fff3d8;
}

.promo-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.promo-text strong {
  font-size: 14px;
  font-weight: 700;
}

.promo-text small {
  font-size: 12px;
  color: #a9743a;
}

/* UiIcon은 놓이는 자리가 크기를 정한다(:where(.ui-icon)이 100%다) — 안 주면 줄을 통째로 채운다 */
.promo > svg {
  flex: none;
  width: 18px;
  height: 18px;
  color: #c66d20;
}

.home-header a {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--ink-muted);
  transition: background-color 0.12s ease;
}

.home-header a:active {
  background: var(--press);
}

.admin-link {
  position: relative;
}

/* 아이콘 오른쪽 위에 걸친다. 바탕색 테두리를 둘러 아이콘 선과 붙어 보이지 않게 */
.admin-link .dot {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #e53935;
  box-shadow: 0 0 0 2px var(--bg-top);
}

.home-header svg {
  width: 23px;
  height: 23px;
}

/* 칸마다 테두리 색을 달리하고, 제목표를 윗선에 걸쳐 놓는다 */
.shelf {
  position: relative;
  padding: 22px 12px 14px;
  margin-bottom: 22px;
  border: 2px solid;
  border-radius: 22px;
}

.shelf h2 {
  position: absolute;
  top: -12px;
  left: 14px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 13px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #fff;
}

.shelf h2 svg {
  width: 13px;
  height: 13px;
}

/* 1~3위 칸만 바탕을 깔아 나머지와 층을 나눈다. 위쪽에서 빛이 떨어지는 결이라
   금색 테두리와 메달이 같은 광원을 쓰는 것처럼 보인다. */
.top3 {
  border-color: #f2ba62;
  background:
    radial-gradient(130% 80% at 50% -25%, rgb(255 255 255 / 0.92), rgb(255 255 255 / 0) 62%),
    linear-gradient(158deg, #fff6e2, #ffe8bf);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.9),
    0 6px 18px rgb(176 122 40 / 0.13);
}

.top3 h2 {
  background: linear-gradient(#ffa22b, #ee6c00);
  box-shadow: 0 3px 8px rgb(216 105 0 / 0.34);
}

.panel {
  padding: 14px 0;
  border-color: var(--line);
  background: var(--surface-soft);
}

.pad {
  padding: 0 12px;
}

.recent {
  padding: 22px 0 14px;
  border-color: var(--line);
  background: var(--surface-soft);
}

.recent h2 {
  background: var(--ink-muted);
  box-shadow: 0 2px 6px rgb(141 110 99 / 0.3);
}

.game-grid {
  display: grid;
  /* 1fr의 최소 폭은 min-content라 기록 문구(nowrap)가 열을 밀어낸다 — 화면이
     좁아지면 칸째로 오른쪽으로 넘쳤다. 0까지 줄어들게 열어두면 문구가 말줄임된다. */
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.empty {
  padding: 26px 8px;
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
  color: var(--ink-faint);
  word-break: keep-all;
}

/* ── 탭 ───────────────────────────────────────────── */
/* 셋 다 같은 캡슐이다. 고르지 않은 것도 눌리는 것처럼 보이도록 옅은 판과
   가는 테를 두르고, 고른 것만 판을 채우고 떠오른다. */
.tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}

.tabs button {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  padding: 10px 8px;
  border: none;
  border-radius: 999px;
  background: var(--surface-soft);
  box-shadow: inset 0 0 0 1px var(--line);
  color: var(--ink-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: -0.02em;
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    box-shadow 0.14s ease,
    color 0.14s ease;
}

.tabs button span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tabs svg {
  flex-shrink: 0;
  width: 13px;
  height: 13px;
}

.tabs button[aria-selected='true'] {
  background: var(--surface);
  box-shadow: var(--shadow-card);
  color: var(--ink);
}

.tabs button:active {
  transform: scale(0.97);
}

/* 어두운 테마에서는 판 색이 반투명 판과 밝기가 가까워 고른 탭이 묻힌다.
   한 단계 더 밝은 면으로 띄운다. */
[data-theme='dark'] .tabs button[aria-selected='true'] {
  background: var(--surface-press);
}

/* 화면 크게를 올린 기기는 한 줄에 아이콘과 글자가 다 들어가지 않는다.
   글자를 자르느니 아이콘을 위로 올린다 (러시아어·독일어도 여기서 살아난다). */
@media (max-width: 330px) {
  .tabs button {
    flex-direction: column;
    gap: 2px;
    padding: 8px 4px;
  }
}

/* ── 좌우로 흐르는 카드 ────────────────────────────── */
/* 좌우 잘림은 트랙이 맡는다. 원근은 카드마다 따로 준다 — 스크롤되는 상자에
   perspective를 걸면 브라우저마다 소실점이 스크롤을 따라 흔들린다. */
.cf-track {
  position: relative;
  display: flex;
  gap: 12px;
  /* 첫 장과 끝 장도 한가운데에 설 수 있도록 양옆을 카드 반쪽만큼 비운다.
     아래 여백은 가운데 카드 그림자가 앉을 자리다 — 이 값이 곧 카드와 플레이
     버튼 사이 간격이라 그림자를 낮게 깔고 여백도 같이 줄였다. */
  padding: 14px calc(50% - 66px) 16px;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}

.cf-track::-webkit-scrollbar {
  display: none;
}

/* will-change는 일부러 걸지 않는다 — 카드가 스물여덟 장이라 전부 합성 레이어로
   올리면 저사양 기기에서 메모리만 먹는다. 변형은 스크롤 중에만 바뀐다. */
.cf-slot {
  position: relative;
  flex: 0 0 132px;
  scroll-snap-align: center;
}

.cf-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 15px 9px 13px;
  border: none;
  border-radius: 20px;
  background: var(--surface);
  text-align: center;
  cursor: pointer;
  box-shadow: var(--shadow-raise);
  transition: box-shadow 0.18s ease;
}

/* 가운데만 바닥에서 확실히 떠 있게 — 크기 차이만으로는 앞뒤가 덜 읽힌다 */
.is-center .cf-card {
  box-shadow:
    0 2px 4px rgb(93 64 55 / 0.1),
    0 8px 18px rgb(93 64 55 / 0.2);
}

[data-theme='dark'] .is-center .cf-card {
  box-shadow:
    0 2px 4px rgb(0 0 0 / 0.4),
    0 8px 18px rgb(0 0 0 / 0.55);
}

.cf-card .thumb {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  padding: 3px;
  border-radius: 18px;
  background: linear-gradient(#fffdf6, #fff2d4);
  margin-bottom: 2px;
}

.cf-card strong {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.015em;
  color: var(--ink);
  word-break: keep-all;
}

.cf-card small {
  display: block;
  max-width: 100%;
  overflow: hidden;
  font-size: 11px;
  font-weight: 600;
  line-height: 15px;
  min-height: 15px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--ink-faint);
}

/* 화면이 좁고 낱말이 긴 언어(프랑스어·러시아어·베트남어)에서는 둘이 한 줄에
   못 선다. 넘치게 두느니 랜덤 쪽을 아래로 내린다. */
.cf-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 12px;
}

/* 눌리면 아래 턱이 줄면서 실제로 내려앉는다 (게임 팝업 버튼과 같은 결) */
.play-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 42px;
  padding: 0 24px;
  border: none;
  border-radius: 21px;
  background: linear-gradient(#ffb454, #f28e30);
  box-shadow:
    0 4px 0 #c96f18,
    0 7px 16px rgb(201 111 24 / 0.28);
  color: #fff;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.01em;
  text-shadow: 0 1px 0 rgb(140 68 8 / 0.32);
  cursor: pointer;
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}

.play-btn:active {
  transform: translateY(3px);
  box-shadow:
    0 1px 0 #c96f18,
    0 2px 6px rgb(201 111 24 / 0.24);
}

.play-btn svg {
  width: 14px;
  height: 14px;
}

/* 옆에 서지만 주인공은 아니다 — 같은 높이에 판만 얹고 턱은 주지 않는다 */
.random-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 42px;
  padding: 0 18px;
  border: none;
  border-radius: 21px;
  background: var(--surface);
  box-shadow:
    inset 0 0 0 1.5px var(--line),
    var(--shadow-card);
  color: var(--ink-muted);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: transform 0.09s ease;
}

.random-btn:active {
  transform: scale(0.96);
}

.random-btn svg {
  width: 16px;
  height: 16px;
}

/* ── 최근 플레이 ───────────────────────────────────── */
.recent-row {
  display: flex;
  gap: 10px;
  padding: 0 12px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}

.recent-row::-webkit-scrollbar {
  display: none;
}

.recent-item {
  display: flex;
  flex: 0 0 62px;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.recent-item:active {
  transform: scale(0.94);
}

.recent-thumb {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 3px;
  border-radius: 15px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.recent-name {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.02em;
  color: var(--ink-muted);
  word-break: keep-all;
}

.trash-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 14px 16px;
  background: var(--surface-soft);
  border-radius: 16px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-muted);
}

.trash-entry:active {
  background: var(--surface);
}

.trash-label,
.trash-entry .count {
  display: flex;
  align-items: center;
  gap: 8px;
}

.trash-entry .count {
  gap: 2px;
  color: var(--ink-faint);
}

.trash-label svg {
  width: 18px;
  height: 18px;
}

.trash-entry .count svg {
  width: 16px;
  height: 16px;
}

/* TOP3 칸의 금빛 바탕과 아래 칸의 반투명 흰 판은 어두운 화면에서 혼자 밝게 뜬다.
   결은 그대로 두고 명도만 내린다 — 게임 썸네일 받침은 아이콘이 밝은 바탕에
   맞춰 그려져 있어 두 테마에서 그대로 둔다. */
[data-theme='dark'] .top3 {
  border-color: #7a5a22;
  background:
    radial-gradient(130% 80% at 50% -25%, rgb(255 213 130 / 0.12), rgb(255 255 255 / 0) 62%),
    linear-gradient(158deg, #3a2c17, #2c2114);
  box-shadow:
    inset 0 1px 0 rgb(255 213 130 / 0.14),
    0 6px 18px rgb(0 0 0 / 0.4);
}
</style>
