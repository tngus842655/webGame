<script setup lang="ts">
import { GAMES } from '@/games/registry'
import { t } from '@/shared/i18n'
import { getLocalBest } from '@/shared/scores'

const cards = GAMES.map((game) => ({ ...game, best: getLocalBest(game.slug) }))
</script>

<template>
  <div class="home">
    <header class="home-header">
      <h1>{{ t('app.title') }}</h1>
      <nav class="header-links">
        <RouterLink to="/ranking" :aria-label="t('home.ranking')">🏆</RouterLink>
        <RouterLink to="/settings" :aria-label="t('settings.title')">⚙️</RouterLink>
      </nav>
    </header>

    <main class="game-grid">
      <RouterLink
        v-for="game in cards"
        :key="game.slug"
        class="game-card"
        :to="`/play/${game.slug}`"
      >
        <span class="thumb">{{ game.thumbnail }}</span>
        <strong>{{ t(game.titleKey) }}</strong>
        <small v-if="game.best !== null">{{ t('home.best', { n: game.best.toLocaleString() }) }}</small>
      </RouterLink>
    </main>
  </div>
</template>

<style scoped>
.home {
  padding: 20px 16px;
}

.home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.home-header h1 {
  font-size: 24px;
}

.header-links {
  display: flex;
  gap: 14px;
  font-size: 22px;
}

.game-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.game-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 12px 6px 10px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgb(93 64 55 / 0.08);
  text-align: center;
}

.thumb {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  font-size: 30px;
  background: #fff8e1;
  border-radius: 12px;
  margin-bottom: 2px;
}

.game-card strong {
  font-size: 13px;
  line-height: 1.25;
  word-break: keep-all;
}

.game-card small {
  font-size: 11px;
  color: #bcaaa4;
}
</style>
