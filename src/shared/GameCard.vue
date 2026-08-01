<script setup lang="ts">
// 홈과 휴지통이 함께 쓰는 게임 카드.
import { useRouter } from 'vue-router'
import FavoriteButton from './FavoriteButton.vue'
import GameIcon from './GameIcon.vue'
import { t, type TranslationKey } from './i18n'

const props = defineProps<{
  slug: string
  titleKey: TranslationKey
  // 1~3위에만 넘긴다. 번호표를 달지 않고 카드 자체를 금·은·동으로 물들인다 —
  // 번호가 스물몇 장에 흩어져 있으면 정작 상위 셋이 눈에 안 들어왔다.
  // 꾸밈이 붙는 값은 1~3뿐이고 그 밖의 숫자가 오면 아무 일도 일어나지 않는다.
  medal?: number
  // 최고 기록·내 순위 — 문구는 화면마다 달라서 밖에서 넘겨받는다
  label: string
  // 홈에서만 별을 붙인다. 휴지통 게임은 즐겨찾기 칸(주 목록 기준)에 올라오지
  // 못하므로, 눌러도 아무 데도 안 나타나는 별을 보여주지 않는다.
  favoritable?: boolean
}>()

// RouterLink(<a>)였을 때는 카드를 길게 누르면 웹뷰가 링크 주소를 띄웠다.
// contextmenu를 막아도 그대로여서 — 웹뷰가 웹 이벤트를 거치지 않고 네이티브에서
// 처리한다 — 링크 자체를 없앤다. 새 탭으로 열기는 잃지만 모바일 전용 화면이라 쓸 일이 없다.
const router = useRouter()

function open() {
  void router.push(`/play/${props.slug}`)
}

</script>

<template>
  <!-- 별은 카드 버튼 안에 넣을 수 없다 (버튼 안의 버튼). 겹쳐 두고 과녁만 나눈다. -->
  <div class="game-slot">
    <button type="button" class="game-card" :class="medal ? `m${medal}` : ''" @click="open">
      <span class="thumb"><GameIcon :slug="slug" /></span>
      <strong>{{ t(titleKey) }}</strong>
      <small>{{ label }}</small>
    </button>
    <FavoriteButton v-if="favoritable" :slug="slug" />
  </div>
</template>

<style scoped>
.game-slot {
  position: relative;
}

/* 이름이 두 줄로 넘어간 카드만 혼자 길어지던 것을 막는다 — 칸의 높이는
   가장 긴 카드가 정하고, 기록 문구는 어느 카드든 맨 아래에 나란히 선다. */
.game-slot,
.game-card {
  height: 100%;
}

.game-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 100%;
  padding: 12px 6px 10px;
  border: none;
  background: var(--surface);
  border-radius: 16px;
  cursor: pointer;
  box-shadow: var(--shadow-raise);
  text-align: center;
  transition:
    transform 0.1s ease,
    box-shadow 0.1s ease;
}

/* 눌리는 게 손끝에 느껴지도록 살짝 가라앉힌다 */
.game-card:active {
  transform: scale(0.96);
  box-shadow: 0 1px 3px rgb(93 64 55 / 0.1);
}

/* 1~3위는 번호 대신 카드 자체가 금·은·동을 띤다. 1위만 테두리를 굵히고
   그림자를 얹어 한 칸 앞으로 나오게 한다 — 순서를 색만으로 읽기는 어렵다. */
.game-card.m1 {
  background: linear-gradient(168deg, #fffbf0, #fff1d2);
  outline: 2px solid #e3b35a;
  outline-offset: -2px;
  box-shadow: var(--shadow-lift);
}

.game-card.m2 {
  background: linear-gradient(168deg, #fdfefe, #edf1f4);
  outline: 1.5px solid #bfc7cd;
  outline-offset: -1.5px;
  box-shadow: var(--shadow-raise);
}

.game-card.m3 {
  background: linear-gradient(168deg, #fff9f3, #f7e6d7);
  outline: 1.5px solid #d3a077;
  outline-offset: -1.5px;
  box-shadow: var(--shadow-raise);
}

[data-theme='dark'] .game-card.m1 {
  background: linear-gradient(168deg, #3b3019, #2e2617);
  outline: 2px solid #8a6a26;
  outline-offset: -2px;
  box-shadow: var(--shadow-lift);
}

[data-theme='dark'] .game-card.m2 {
  background: linear-gradient(168deg, #333739, #272b2d);
  outline: 1.5px solid #5c6369;
  outline-offset: -1.5px;
  box-shadow: var(--shadow-raise);
}

[data-theme='dark'] .game-card.m3 {
  background: linear-gradient(168deg, #392b21, #2c211a);
  outline: 1.5px solid #7c5837;
  outline-offset: -1.5px;
  box-shadow: var(--shadow-raise);
}

.thumb {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  padding: 2px;
  background: linear-gradient(#fffdf6, #fff2d4);
  border-radius: 14px;
  margin-bottom: 3px;
}

strong {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--ink);
  word-break: keep-all;
}

/* 서버에서 순위가 도착하기 전에도 카드 높이가 같도록 한 줄을 비워둔다 */
small {
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
  min-height: 14px;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--ink-faint);
  margin-top: auto;
  padding-top: 2px;
}
</style>
