<script setup lang="ts">
// 화면 조작용 아이콘 — 이모지(🏆 🛠️ ⚙️ 🗑️)와 맨글자 화살표(← ›)를 대신한다.
// 게임 썸네일(GameIcon)이 색이 있는 그림이라면 이쪽은 선으로만 그린 도구 아이콘이고,
// currentColor를 따라가므로 놓이는 자리의 글자색을 그대로 쓴다.
defineProps<{
  name:
    | 'back'
    | 'chevron'
    | 'trophy'
    | 'gear'
    | 'wrench'
    | 'trash'
    | 'message'
    | 'target'
    | 'tap'
    | 'star'
    | 'star-fill'
    | 'flame'
    | 'sparkle'
    | 'gamepad'
    | 'clock'
    | 'dice'
    | 'play'
    | 'check'
    | 'arrow-up'
    | 'arrow-down'
    | 'crown'
}>()
</script>

<template>
  <svg
    class="ui-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-if="name === 'back'" d="M15 4.5 7.5 12 15 19.5" />

    <path v-else-if="name === 'check'" d="M4.8 12.6 9.6 17.4 19.2 6.6" stroke-width="2.6" />

    <path v-else-if="name === 'chevron'" d="M9 4.5 16.5 12 9 19.5" />

    <g v-else-if="name === 'trophy'">
      <path d="M7.5 3.5h9v5.5a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 5H4.5v1.2a3.4 3.4 0 0 0 3 3.3" />
      <path d="M16.5 5h3v1.2a3.4 3.4 0 0 1-3 3.3" />
      <path d="M12 13.5v3.2M8 20.5h8l-.9-3.8H8.9z" />
    </g>

    <g v-else-if="name === 'gear'">
      <circle cx="12" cy="12" r="6.1" stroke-width="2.1" />
      <g fill="currentColor" stroke="none">
        <rect x="10.9" y="1.5" width="2.2" height="3.6" rx="1.1" />
        <rect x="10.9" y="1.5" width="2.2" height="3.6" rx="1.1" transform="rotate(45 12 12)" />
        <rect x="10.9" y="1.5" width="2.2" height="3.6" rx="1.1" transform="rotate(90 12 12)" />
        <rect x="10.9" y="1.5" width="2.2" height="3.6" rx="1.1" transform="rotate(135 12 12)" />
        <rect x="10.9" y="1.5" width="2.2" height="3.6" rx="1.1" transform="rotate(180 12 12)" />
        <rect x="10.9" y="1.5" width="2.2" height="3.6" rx="1.1" transform="rotate(225 12 12)" />
        <rect x="10.9" y="1.5" width="2.2" height="3.6" rx="1.1" transform="rotate(270 12 12)" />
        <rect x="10.9" y="1.5" width="2.2" height="3.6" rx="1.1" transform="rotate(315 12 12)" />
      </g>
      <circle cx="12" cy="12" r="2.2" stroke-width="1.8" />
    </g>

    <path
      v-else-if="name === 'wrench'"
      d="M17.6 3.4a4.7 4.7 0 0 0-6 6L4.2 16.8a2.3 2.3 0 0 0 3.2 3.2l7.4-7.4a4.7 4.7 0 0 0 6-6l-2.9 2.9-2.5-.6-.6-2.5z"
    />

    <g v-else-if="name === 'trash'">
      <path d="M4 6.8h16M9.8 3.8h4.4" />
      <path d="M6.2 6.8 7.3 20.2h9.4L17.8 6.8" />
      <path d="M10.2 10.6v5.8M13.8 10.6v5.8" />
    </g>

    <path
      v-else-if="name === 'message'"
      d="M4.5 4h15a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H10.5L6 20v-3.5H4.5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
    />

    <g v-else-if="name === 'target'">
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="3.9" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </g>

    <g v-else-if="name === 'tap'">
      <path d="M9 11V5.6a2 2 0 0 1 4 0v7.1" />
      <path d="M13 10.4a1.8 1.8 0 0 1 3.6 0v1a1.8 1.8 0 0 1 3.5.6c0 4.6-2 8.4-6 8.4-3.4 0-5.1-2-6.4-4.4l-2.3-4a1.8 1.8 0 0 1 3-2z" />
    </g>

    <!-- 즐겨찾기가 켜진 상태 — 같은 별을 속만 채운다 -->
    <path
      v-else-if="name === 'star-fill'"
      fill="currentColor"
      stroke="none"
      d="M12 3.4l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.8l-5.3 2.8 1.1-5.9L3.5 9.6l5.9-.8z"
    />

    <!-- 칸 제목표에 들어가는 것들은 12px 남짓으로 줄어든다.
         선으로 그리면 그 크기에서 뭉개져서 면으로 채운다. -->
    <path
      v-else-if="name === 'flame'"
      fill="currentColor"
      stroke="none"
      d="M12 2.2c4.2 3.6 6.4 6.6 6.4 9.8a6.4 6.4 0 0 1-12.8 0c0-3.2 2.2-6.2 6.4-9.8z"
    />

    <g v-else-if="name === 'sparkle'" fill="currentColor" stroke="none">
      <path d="M10.6 2.4 12.3 7.6 17.5 9.3 12.3 11 10.6 16.2 8.9 11 3.7 9.3 8.9 7.6z" />
      <path d="M17.4 13.6 18.3 16.4 21.1 17.3 18.3 18.2 17.4 21 16.5 18.2 13.7 17.3 16.5 16.4z" />
    </g>

    <g v-else-if="name === 'gamepad'">
      <path
        d="M8.3 7.6h7.4a5 5 0 0 1 4.9 4l.7 3.9a2.7 2.7 0 0 1-5 1.9L15.3 16H8.7l-1 1.4a2.7 2.7 0 0 1-5-1.9l.7-3.9a5 5 0 0 1 4.9-4z"
      />
      <path d="M6.9 11.7v2.1M5.9 12.8h2" />
      <circle cx="16.1" cy="12.1" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="14" r="1.1" fill="currentColor" stroke="none" />
    </g>

    <g v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.1V12l3.4 2" />
    </g>

    <g v-else-if="name === 'dice'">
      <rect x="3.7" y="3.7" width="16.6" height="16.6" rx="4.4" />
      <g fill="currentColor" stroke="none">
        <circle cx="8.4" cy="8.4" r="1.35" />
        <circle cx="12" cy="12" r="1.35" />
        <circle cx="15.6" cy="15.6" r="1.35" />
      </g>
    </g>

    <path v-else-if="name === 'play'" fill="currentColor" stroke="none" d="M7.8 5.2 19.2 12 7.8 18.8z" />

    <!-- 좋아요·싫어요 화살표. 한 붓으로 닫아 두었으니 놓이는 자리에서 fill만 켜면
         속이 찬 화살표가 된다 (별처럼 아이콘을 둘로 두지 않아도 된다). -->
    <path v-else-if="name === 'arrow-up'" d="M12 4.2 18 11.8h-3.2v8h-5.6v-8H6z" />

    <path v-else-if="name === 'arrow-down'" d="M12 19.8 18 12.2h-3.2v-8h-5.6v8H6z" />

    <!-- 명예의 전당 왕관 — 시상대 위 1위 머리에 얹는다. 작게 놓이므로 면으로 채운다. -->
    <g v-else-if="name === 'crown'" fill="currentColor" stroke="none">
      <path d="M3 7.8 7.7 11 12 5.2 16.3 11 21 7.8 19.2 17H4.8z" />
      <rect x="4.6" y="18.4" width="14.8" height="2.2" rx="1.1" />
    </g>

    <path
      v-else
      d="M12 3.4l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.8l-5.3 2.8 1.1-5.9L3.5 9.6l5.9-.8z"
    />
  </svg>
</template>

<style scoped>
/* 크기는 놓이는 자리가 정하고, 여기 값은 아무도 안 정했을 때의 바탕이다.
   :where()로 감싸 특정도를 0으로 만들지 않으면 이 규칙이 (클래스 + 스코프 속성)
   바깥의 `dt svg`·`.back svg`처럼 클래스 없는 규칙을 이겨서, 아이콘이 지정한
   크기를 무시하고 칸을 통째로 채운다 — 설명 팝업과 뒤로가기가 그랬다. */
:where(.ui-icon) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
