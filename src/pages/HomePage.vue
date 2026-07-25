<script setup lang="ts">
import { GAMES } from '@/games/registry'
import { getLocalBest } from '@/shared/scores'

const cards = GAMES.map((game) => ({ ...game, best: getLocalBest(game.slug) }))
</script>

<template>
  <div class="home">
    <header class="home-header">
      <h1>웹게임 허브</h1>
      <RouterLink class="settings-link" to="/settings" aria-label="설정">⚙️</RouterLink>
    </header>

    <main class="game-grid">
      <article v-for="game in cards" :key="game.slug" class="game-card">
        <RouterLink class="card-main" :to="`/play/${game.slug}`">
          <span class="thumb">{{ game.thumbnail }}</span>
          <strong>{{ game.title }}</strong>
          <small>{{ game.best !== null ? `최고 ${game.best.toLocaleString()}` : '바로 플레이' }}</small>
        </RouterLink>
        <RouterLink class="rank-link" :to="`/ranking/${game.slug}`">랭킹 보기</RouterLink>
      </article>
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

.settings-link {
  font-size: 22px;
}

.game-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.game-card {
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 2px 8px rgb(93 64 55 / 0.08);
}

.card-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}

.thumb {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  font-size: 40px;
  background: #fff8e1;
  border-radius: 14px;
  margin-bottom: 4px;
}

.card-main strong {
  font-size: 16px;
}

.card-main small {
  color: #bcaaa4;
}

.rank-link {
  margin-top: 10px;
  font-size: 13px;
  color: #8d6e63;
  text-align: center;
}
</style>
