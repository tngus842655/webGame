<script setup lang="ts">
// 카드 오른쪽 위에 얹는 별. 격자 카드와 캐러셀 카드가 같은 것을 쓴다.
// 놓는 쪽이 position: relative여야 한다 — 카드 모서리에 절대 위치로 붙는다.
import { computed } from 'vue'
import { t } from './i18n'
import { isFavorite, toggleFavorite } from './library'
import UiIcon from './UiIcon.vue'

const props = defineProps<{ slug: string }>()

const starred = computed(() => isFavorite(props.slug))
</script>

<template>
  <button
    type="button"
    class="fav"
    :class="{ on: starred }"
    :aria-pressed="starred"
    :aria-label="t(starred ? 'home.favoriteRemove' : 'home.favoriteAdd')"
    @click="toggleFavorite(slug)"
  >
    <UiIcon :name="starred ? 'star-fill' : 'star'" />
  </button>
</template>

<style scoped>
/* 별은 16px이지만 과녁은 30px로 잡는다 — 카드가 작아 손끝이 잘 걸리지 않았다.
   꺼진 별을 흐리게 두어야 카드 수십 장에 별이 흩뿌려진 것처럼 보이지 않는다. */
.fav {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  background: none;
  color: var(--line);
  cursor: pointer;
  transition:
    color 0.12s ease,
    transform 0.12s ease;
}

.fav svg {
  width: 16px;
  height: 16px;
}

.fav.on {
  color: #f5a623;
}

.fav:active {
  transform: scale(0.84);
}
</style>
