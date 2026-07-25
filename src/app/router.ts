import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'
import GamePlayPage from '@/pages/GamePlayPage.vue'
import RankingHubPage from '@/pages/RankingHubPage.vue'
import RankingPage from '@/pages/RankingPage.vue'
import SettingsPage from '@/pages/SettingsPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomePage },
    { path: '/play/:slug', component: GamePlayPage },
    { path: '/ranking', component: RankingHubPage },
    { path: '/ranking/:slug', component: RankingPage },
    { path: '/settings', component: SettingsPage },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
