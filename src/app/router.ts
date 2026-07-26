import { createRouter, createWebHistory } from 'vue-router'
import { ensureAdminChecked } from '@/shared/admin'
import HomePage from '@/pages/HomePage.vue'
import AdminPage from '@/pages/AdminPage.vue'
import GamePlayPage from '@/pages/GamePlayPage.vue'
import RankingHubPage from '@/pages/RankingHubPage.vue'
import RankingPage from '@/pages/RankingPage.vue'
import SettingsPage from '@/pages/SettingsPage.vue'
import StatsPage from '@/pages/StatsPage.vue'
import DevNotesPage from '@/pages/DevNotesPage.vue'
import PrivacyPage from '@/pages/PrivacyPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/play/:slug', component: GamePlayPage },
    { path: '/ranking', component: RankingHubPage },
    { path: '/ranking/:slug', component: RankingPage },
    { path: '/settings', component: SettingsPage },
    { path: '/stats', component: StatsPage, meta: { admin: true } },
    { path: '/admin', component: AdminPage, meta: { admin: true } },
    { path: '/notes', component: DevNotesPage },
    { path: '/privacy', component: PrivacyPage },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// 화면을 막는 것은 안내일 뿐이고, 실제 차단은 RLS와 get_game_stats()의 관리자 검사가 한다
router.beforeEach(async (to) => {
  if (!to.meta.admin) return true
  return (await ensureAdminChecked()) ? true : '/'
})
