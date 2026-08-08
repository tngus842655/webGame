<script lang="ts">
type ListKey = 'new' | 'favorite'

// 게임에 들어갔다 나오면 홈은 새로 만들어진다. 열어둔 목록은 컴포넌트 밖에 둬야
// 그 사이를 건너뛴다. 앱을 껐다 켜면 닫힌 채로 돌아간다.
let keptList: ListKey | null = null
</script>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { dailySeed } from '@/games/daily'
import { GAMES } from '@/games/registry'
import GameCard from '@/shared/GameCard.vue'
import GameIcon from '@/shared/GameIcon.vue'
import { APP_NAME, t, type TranslationKey } from '@/shared/i18n'
import { favorites, recents } from '@/shared/library'
import { isInToss } from '@/shared/toss'
import { promotionStatus } from '@/shared/tossPromotion'
import UiIcon from '@/shared/UiIcon.vue'
import {
  featuredSlugs,
  fetchMyStats,
  hasCachedFlags,
  getLocalBest,
  popularityRanks,
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
  const status = promo.value
  if (!status) return ''
  // 다 받았다는 사실은 이벤트가 끝나도 변하지 않는다 — 종료보다 먼저 본다
  if (status.granted >= status.total) return '토스포인트 100원을 다 받았어요'
  if (status.ended) return '토스포인트 이벤트가 끝났어요'
  if (status.granted > 0) return `${status.total - status.granted}원 더 받을 수 있어요`
  return '게임 3판이면 토스포인트 100원'
})

// 끝난 뒤에도 조건표를 띄우면 이제 못 받는 조건을 계속 광고하는 셈이 된다.
// 그 자리에 받은 포인트가 어디 있는지를 넣는다 — 종료 직후에 가장 많이 묻는 것이다.
const promoNote = computed(() =>
  promo.value?.ended
    ? '받은 포인트는 토스 혜택 탭에서 볼 수 있어요'
    : '접속 20원 · 1판 30원 · 3판 50원',
)

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

// ── 오늘의 추천 ────────────────────────────────────────
// 복잡한 개인화 대신 단순 규칙으로 시작한다: 인기순 상위(신규는 sortByPopularity가
// 이미 앞에 세운다)에서 최근 플레이한 게임을 빼고, 남은 상위 후보 중 날짜로 하나를
// 고른다. 하루 동안은 같은 게임이 서고, 자정이 지나면 다음 후보로 넘어간다.
const HERO_POOL = 5

const heroGame = computed(() => {
  const pool = cards.value.filter((card) => !recents.value.includes(card.slug))
  const picks = (pool.length > 0 ? pool : cards.value).slice(0, HERO_POOL)
  return picks.length > 0 ? picks[dailySeed() % picks.length] : null
})

// 추천 이유 — 데이터로 말할 수 있는 것만 말한다. 신규 > 인기 1위 > 안 해본 게임 순.
// 순위는 화면에 선 게임끼리 매긴다 — 휴지통 게임이 1위를 쥐고 있으면 아무도 1위가 못 된다.
const heroRanks = computed(() => popularityRanks(cards.value))

const heroReason = computed(() => {
  const game = heroGame.value
  if (!game) return ''
  if (featured.value.has(game.slug)) return t('home.reasonNew')
  if (heroRanks.value.get(game.slug) === 1) return t('home.reasonTop')
  if (game.best === null && !game.stat) return t('home.reasonTry')
  return t('home.reasonPopular')
})

// 인기 칸 — 추천으로 올라간 게임은 빼고 다음 순위로 채운다. 같은 화면에 같은
// 게임이 두 번 서 있으면 추천이 아니라 중복으로 읽힌다.
const top3 = computed(() =>
  ranked.value.filter((card) => card.slug !== heroGame.value?.slug).slice(0, 3),
)

// 게임 둘러보기 — 홈은 맛보기 여섯 장만 세운다. 추천·인기에 이미 선 게임을 빼고
// 다음 순서(신규 먼저, 그다음 인기순)로 채우며, 전체 목록은 /games 화면이 맡는다.
const BROWSE_COUNT = 6

const browseGames = computed(() => {
  const shown = new Set(top3.value.map((card) => card.slug))
  if (heroGame.value) shown.add(heroGame.value.slug)
  return cards.value.filter((card) => !shown.has(card.slug)).slice(0, BROWSE_COUNT)
})

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

const LISTS: Array<{ key: ListKey; labelKey: TranslationKey; icon: 'sparkle' | 'star' }> = [
  { key: 'new', labelKey: 'home.sectionNew', icon: 'sparkle' },
  { key: 'favorite', labelKey: 'home.sectionFavorites', icon: 'star' },
]

// 눌러서 여닫는 목록. 기본은 닫힘 — 홈은 선별된 것만 보여주고, 찾는 사람에게만 편다.
// 같은 것을 한 번 더 누르면 닫힌다.
const openList = ref<ListKey | null>(keptList)

function toggleList(key: ListKey) {
  openList.value = openList.value === key ? null : key
  keptList = openList.value
}

// 서른 개가 넘으니 뭘 할지 못 정하는 사람이 있다. 아무거나 눌러 바로 들어가게 한다.
// 후보는 지금 즐길 수 있는 게임 전부다 — 인기 셋도 뽑힌다.
// 방금 한 게임만 빼는데, 안 그러면 연달아 눌렀을 때 같은 게임이 나와 고장 난 것처럼 보인다.
function playRandom() {
  const pool = cards.value.filter((card) => card.slug !== recents.value[0])
  const list = pool.length > 0 ? pool : cards.value
  if (list.length === 0) return
  play(list[Math.floor(Math.random() * list.length)].slug)
}

// 휴지통에 아무것도 없으면 입구를 만들지 않는다
const trashCount = trashedGames(GAMES).length

onMounted(async () => {
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
    return
  }
  // 두 번째부터는 예전대로 — 캐시된 배열을 그대로 두고 내 기록만 채운다
  cards.value = cards.value.map((card) => ({ ...card, stat: statBySlug.get(card.slug) ?? null }))
})
</script>

<template>
  <div class="home">
    <nav class="home-header">
      <strong class="logo">{{ APP_NAME }}</strong>
      <RouterLink to="/ranking" :aria-label="t('home.ranking')"><UiIcon name="trophy" /></RouterLink>
      <RouterLink v-if="isAdmin" class="admin-link" to="/admin" :aria-label="t('admin.title')">
        <UiIcon name="wrench" />
        <!-- 새 의견이 왔다는 것을 앱을 열자마자 알아야 한다 -->
        <span v-if="unreadFeedback > 0" class="dot" :aria-label="t('admin.feedbackNew')" />
      </RouterLink>
      <RouterLink to="/settings" :aria-label="t('settings.title')"><UiIcon name="gear" /></RouterLink>
    </nav>

    <!-- 앱인토스 프로모션. 미니앱 빌드에서만, 그리고 지급 상태를 읽어온 뒤에만 뜬다.
         고지 화면으로 가는 유일한 입구라 다 받은 뒤에도, 이벤트가 끝난 뒤에도 남긴다 —
         "왜 안 들어오냐"가 가장 많이 몰리는 때가 끝난 직후다 -->
    <RouterLink v-if="promo" class="promo" to="/event">
      <span class="promo-text">
        <strong>{{ promoHeadline }}</strong>
        <small>{{ promoNote }}</small>
      </span>
      <UiIcon name="chevron" />
    </RouterLink>

    <!-- 오늘의 추천 — 이 화면의 주인공이되 화면을 다 쓰지는 않는다. 왼쪽에 큰
         아이콘, 오른쪽에 이름·이유·버튼을 세워 높이를 줄인다.
         랜덤은 두 번째 길이라 글자를 떼고 주사위만 버튼 오른쪽에 붙인다. -->
    <section v-if="heroGame" class="shelf hero">
      <h2><UiIcon name="star-fill" />{{ t('home.heroTitle') }}</h2>
      <div class="hero-body">
        <span class="hero-thumb"><GameIcon :slug="heroGame.slug" /></span>
        <div class="hero-info">
          <strong class="hero-name">{{ t(heroGame.titleKey) }}</strong>
          <span class="hero-reason">{{ heroReason }}</span>
          <div class="hero-actions">
            <button
              type="button"
              class="hero-play"
              :aria-label="t(heroGame.titleKey)"
              @click="play(heroGame.slug)"
            >
              <UiIcon name="play" />{{ t('home.heroPlay') }}
            </button>
            <button
              type="button"
              class="hero-dice"
              :aria-label="t('home.random')"
              @click="playRandom"
            >
              <UiIcon name="dice" />
            </button>
          </div>
        </div>
      </div>
    </section>

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

    <section class="shelf recent">
      <h2><UiIcon name="clock" />{{ t('home.sectionRecent') }}</h2>
      <div v-if="recentGames.length > 0" class="recent-row">
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
      <!-- 기록이 없는 사람에게는 빈 칸 대신 다음 행동을 보여준다 -->
      <p v-else class="empty">{{ t('home.recentEmpty') }}</p>
    </section>

    <!-- 탐색 메뉴 — 기능은 그대로, 시각적 무게만 내린다. 신규·즐겨찾기는 눌러서
         여닫는 목록이고, 게임 전체보기는 전체 목록 화면으로 가는 길이다. -->
    <div class="explore">
      <button
        v-for="item in LISTS"
        :key="item.key"
        type="button"
        :aria-expanded="openList === item.key"
        :aria-controls="`panel-${item.key}`"
        @click="toggleList(item.key)"
      >
        <UiIcon :name="item.icon" /><span>{{ t(item.labelKey) }}</span>
      </button>
      <RouterLink class="explore-all" to="/games">
        <span>{{ t('home.sectionAll') }}</span><UiIcon name="chevron" />
      </RouterLink>
    </div>

    <section v-if="openList" class="shelf panel">
      <div v-show="openList === 'new'" id="panel-new" class="pad">
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

      <div v-show="openList === 'favorite'" id="panel-favorite" class="pad">
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
    </section>

    <!-- 게임 둘러보기 — 전체를 다 세우면 둘러보기가 아니라 벽이 된다.
         맛보기 여섯 장만 두고, 나머지는 전체보기 화면으로 보낸다. -->
    <section v-if="browseGames.length > 0" class="shelf browse">
      <h2><UiIcon name="gamepad" />{{ t('home.sectionBrowse') }}</h2>
      <div class="pad">
        <div class="game-grid">
          <GameCard
            v-for="game in browseGames"
            :key="game.slug"
            favoritable
            :slug="game.slug"
            :title-key="game.titleKey"
            :label="scoreLabel(game)"
          />
        </div>
      </div>
      <RouterLink class="browse-all" to="/games">
        {{ t('home.sectionAll') }}<UiIcon name="chevron" />
      </RouterLink>
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

/* 왼쪽 이름표, 오른쪽 도구. 이모지 링크였을 때는 기기마다 크기가 제각각이고
   과녁도 작았다. */
.home-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-bottom: 18px;
}

.logo {
  margin-right: auto;
  font-size: 17px;
  font-weight: 900;
  letter-spacing: -0.03em;
  color: var(--ink);
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

/* ── 오늘의 추천 ───────────────────────────────────── */
/* 화면의 주인공이되 화면을 다 쓰지는 않는다. 금빛 판은 여기 하나만 쓴다 —
   두 곳이 같이 빛나면 둘 다 안 빛난다. */
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 26px 14px 18px;
  border-color: #f2ba62;
  background:
    radial-gradient(130% 80% at 50% -25%, rgb(255 255 255 / 0.92), rgb(255 255 255 / 0) 62%),
    linear-gradient(158deg, #fff6e2, #ffe8bf);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.9),
    0 6px 18px rgb(176 122 40 / 0.13);
}

.hero h2 {
  background: linear-gradient(#ffa22b, #ee6c00);
  box-shadow: 0 3px 8px rgb(216 105 0 / 0.34);
}

/* 왼쪽에 큰 아이콘, 오른쪽에 이름·이유·버튼. 아이콘 높이가 오른쪽 세 줄과
   맞아떨어져 한 덩어리로 읽힌다. 아이콘은 화면 폭을 따라 같이 줄어든다 —
   좁은 기기에서 아이콘이 버티면 버튼 글자가 설 자리가 없다. */
.hero-body {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}

.hero-thumb {
  flex: none;
  display: grid;
  place-items: center;
  width: clamp(72px, 24vw, 96px);
  height: clamp(72px, 24vw, 96px);
  padding: 4px;
  border-radius: 26px;
  background: linear-gradient(#fffdf6, #fff2d4);
  box-shadow: var(--shadow-card);
}

.hero-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.hero-name {
  font-size: 20px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.03em;
  color: var(--ink);
  word-break: keep-all;
}

.hero-reason {
  margin-top: 3px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
  color: #b06c1f;
  word-break: keep-all;
}

/* 바로 플레이가 남은 줄을 채우고, 주사위는 오른쪽 끝에 정사각형으로 붙는다 */
.hero-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

/* 이 화면에서 가장 눈에 띄어야 하는 것 — 게임 아이콘보다도 이 버튼이다.
   눌리면 아래 턱이 줄면서 실제로 내려앉는다 (게임 팝업 버튼과 같은 결) */
.hero-play {
  display: inline-flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 46px;
  padding: 0 10px;
  border: none;
  border-radius: 23px;
  background: linear-gradient(#ffb454, #f28e30);
  box-shadow:
    0 4px 0 #c96f18,
    0 7px 16px rgb(201 111 24 / 0.28);
  color: #fff;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-shadow: 0 1px 0 rgb(140 68 8 / 0.32);
  cursor: pointer;
  transition:
    transform 0.08s ease,
    box-shadow 0.08s ease;
}

.hero-play:active {
  transform: translateY(3px);
  box-shadow:
    0 1px 0 #c96f18,
    0 3px 8px rgb(201 111 24 / 0.26);
}

.hero-play svg {
  flex: none;
  width: 13px;
  height: 13px;
}

/* 글자를 뗀 자리 — 주사위 하나로 무슨 버튼인지 읽히도록 판을 정사각으로 두고,
   턱은 주지 않는다. 바로 플레이와 같은 무게로 보이면 안 된다. */
.hero-dice {
  display: grid;
  flex: none;
  place-items: center;
  width: 46px;
  height: 46px;
  border: none;
  border-radius: 23px;
  background: var(--surface);
  box-shadow:
    inset 0 0 0 1.5px var(--line),
    var(--shadow-card);
  color: var(--ink-muted);
  cursor: pointer;
  transition: transform 0.09s ease;
}

.hero-dice:active {
  transform: scale(0.94);
}

.hero-dice svg {
  width: 20px;
  height: 20px;
}

/* 아주 좁은 기기에서는 오른쪽 칸이 버튼 글자를 다 못 받는다.
   여백과 주사위를 한 치수씩 덜어 한 줄을 지킨다. */
@media (max-width: 340px) {
  .hero {
    padding: 26px 10px 18px;
  }

  .hero-body {
    gap: 11px;
  }

  .hero-play {
    font-size: 14px;
  }

  .hero-dice {
    width: 42px;
    height: 42px;
  }
}

/* 인기 칸 — 추천보다 한 층 낮춘다. 제목표의 불꽃과 카드 메달이 이미 말하고
   있으니 판까지 금빛일 필요가 없다. */
.top3 {
  border-color: var(--line);
  background: var(--surface-soft);
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

/* ── 탐색 메뉴 ─────────────────────────────────────── */
/* 캡슐 탭이었던 자리. 메인 콘텐츠와 경쟁하지 않도록 글자만 남긴다.
   신규·즐겨찾기는 여닫는 목록이고, 오른쪽 전체보기는 화면 이동이다. */
.explore {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 20px;
  padding: 0 6px;
}

.explore button,
.explore-all {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  padding: 9px 8px 12px;
  border: none;
  background: none;
  color: var(--ink-faint);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.02em;
  cursor: pointer;
  transition: color 0.14s ease;
}

.explore span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.explore svg {
  flex-shrink: 0;
  width: 13px;
  height: 13px;
}

.explore button {
  position: relative;
}

.explore button[aria-expanded='true'] {
  color: var(--ink);
}

/* 열린 목록 밑에만 짧은 줄 — 판을 채우는 것보다 조용하고, 그래도 자리는 분명하다 */
.explore button[aria-expanded='true']::after {
  content: '';
  position: absolute;
  bottom: 3px;
  left: 50%;
  width: 22px;
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(#ffa22b, #ee6c00);
  transform: translateX(-50%);
}

/* 전체보기는 오른쪽 끝 — 화살표가 목록 여닫기가 아니라 화면 이동임을 말한다 */
.explore-all {
  gap: 2px;
  margin-left: auto;
}

.explore-all:active {
  color: var(--ink);
}

.explore-all svg {
  width: 12px;
  height: 12px;
}

/* ── 게임 둘러보기 ─────────────────────────────────── */
.browse {
  padding: 22px 0 6px;
  border-color: var(--line);
  background: var(--surface-soft);
}

.browse h2 {
  background: var(--ink-muted);
  box-shadow: 0 2px 6px rgb(141 110 99 / 0.3);
}

/* 카드 아래 한 줄 전부가 과녁 — 목록 끝에서 자연스럽게 전체보기로 이어진다 */
.browse-all {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  margin-top: 2px;
  padding: 12px 0;
  color: var(--ink-muted);
  font-size: 13px;
  font-weight: 700;
}

.browse-all:active {
  color: var(--ink);
}

.browse-all svg {
  width: 13px;
  height: 13px;
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

/* 금빛 바탕은 어두운 화면에서 혼자 밝게 뜬다. 결은 그대로 두고 명도만 내린다 —
   게임 썸네일 받침은 아이콘이 밝은 바탕에 맞춰 그려져 있어 두 테마에서 그대로 둔다. */
[data-theme='dark'] .hero {
  border-color: #7a5a22;
  background:
    radial-gradient(130% 80% at 50% -25%, rgb(255 213 130 / 0.12), rgb(255 255 255 / 0) 62%),
    linear-gradient(158deg, #3a2c17, #2c2114);
  box-shadow:
    inset 0 1px 0 rgb(255 213 130 / 0.14),
    0 6px 18px rgb(0 0 0 / 0.4);
}

[data-theme='dark'] .hero-reason {
  color: #e6a94f;
}
</style>
