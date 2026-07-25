<script setup lang="ts">
import { GAMES } from '@/games/registry'
</script>

<template>
  <div class="home">
    <header class="home-header">
      <h1>웹게임 허브</h1>
      <RouterLink class="settings-link" to="/settings" aria-label="설정">⚙️</RouterLink>
    </header>

    <main class="game-list">
      <article v-for="game in GAMES" :key="game.slug" class="game-card">
        <RouterLink class="card-main" :to="`/play/${game.slug}`">
          <span class="thumb">{{ game.thumbnail }}</span>
          <span class="info">
            <strong>{{ game.title }}</strong>
            <small>바로 플레이</small>
          </span>
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

.game-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.game-card {
  background: #fff;
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 2px 8px rgb(93 64 55 / 0.08);
}

.card-main {
  display: flex;
  align-items: center;
  gap: 14px;
}

.thumb {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  font-size: 34px;
  background: #fff8e1;
  border-radius: 12px;
}

.info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info strong {
  font-size: 18px;
}

.info small {
  color: #bcaaa4;
}

.rank-link {
  display: inline-block;
  margin-top: 10px;
  font-size: 14px;
  color: #8d6e63;
}
</style>
