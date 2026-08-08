import { createRouter, createWebHistory } from 'vue-router'
import { ensureAdminChecked } from '@/shared/admin'
import HomePage from '@/pages/HomePage.vue'
import AdminPage from '@/pages/AdminPage.vue'
import AdminFeaturedPage from '@/pages/AdminFeaturedPage.vue'
import AdminFeedbackPage from '@/pages/AdminFeedbackPage.vue'
import AdminTrashPage from '@/pages/AdminTrashPage.vue'
import AdminVotesPage from '@/pages/AdminVotesPage.vue'
import TrashPage from '@/pages/TrashPage.vue'
import GamePlayPage from '@/pages/GamePlayPage.vue'
import RankingHubPage from '@/pages/RankingHubPage.vue'
import RankingPage from '@/pages/RankingPage.vue'
import SettingsPage from '@/pages/SettingsPage.vue'
import StatsPage from '@/pages/StatsPage.vue'
import StatsPlayersPage from '@/pages/StatsPlayersPage.vue'
import StatsAdsPage from '@/pages/StatsAdsPage.vue'
import DevNotesPage from '@/pages/DevNotesPage.vue'
import FeedbackPage from '@/pages/FeedbackPage.vue'
import PrivacyPage from '@/pages/PrivacyPage.vue'
import TermsPage from '@/pages/TermsPage.vue'
import AccountDeletionPage from '@/pages/AccountDeletionPage.vue'
import EventPage from '@/pages/EventPage.vue'
import { isInToss } from '@/shared/toss'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/play/:slug', component: GamePlayPage },
    { path: '/ranking', component: RankingHubPage },
    { path: '/ranking/:slug', component: RankingPage },
    { path: '/settings', component: SettingsPage },
    { path: '/stats', component: StatsPage, meta: { admin: true } },
    { path: '/stats/players', component: StatsPlayersPage, meta: { admin: true } },
    { path: '/stats/ads', component: StatsAdsPage, meta: { admin: true } },
    { path: '/admin', component: AdminPage, meta: { admin: true } },
    { path: '/admin/trash', component: AdminTrashPage, meta: { admin: true } },
    { path: '/admin/feedback', component: AdminFeedbackPage, meta: { admin: true } },
    { path: '/admin/featured', component: AdminFeaturedPage, meta: { admin: true } },
    { path: '/admin/votes', component: AdminVotesPage, meta: { admin: true } },
    { path: '/trash', component: TrashPage },
    { path: '/notes', component: DevNotesPage },
    { path: '/feedback', component: FeedbackPage },
    { path: '/terms', component: TermsPage },
    { path: '/privacy', component: PrivacyPage },
    { path: '/account-deletion', component: AccountDeletionPage },
    // 프로모션은 앱인토스에서만 돈다. isInToss가 빌드 때 정해지는 상수라 웹·안드로이드
    // 번들에는 이 줄도 EventPage도 실리지 않는다 (없는 주소라 홈으로 떨어진다).
    ...(isInToss ? [{ path: '/event', component: EventPage }] : []),
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// 화면을 막는 것은 안내일 뿐이고, 실제 차단은 RLS와 get_game_stats()의 관리자 검사가 한다
router.beforeEach(async (to) => {
  if (!to.meta.admin) return true
  return (await ensureAdminChecked()) ? true : '/'
})
