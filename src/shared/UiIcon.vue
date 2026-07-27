<script setup lang="ts">
// 화면 조작용 아이콘 — 이모지(🏆 🛠️ ⚙️ 🗑️)와 맨글자 화살표(← ›)를 대신한다.
// 게임 썸네일(GameIcon)이 색이 있는 그림이라면 이쪽은 선으로만 그린 도구 아이콘이고,
// currentColor를 따라가므로 놓이는 자리의 글자색을 그대로 쓴다.
defineProps<{
  name: 'back' | 'chevron' | 'trophy' | 'gear' | 'wrench' | 'trash' | 'target' | 'tap' | 'star'
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

    <g v-else-if="name === 'target'">
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="3.9" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </g>

    <g v-else-if="name === 'tap'">
      <path d="M9 11V5.6a2 2 0 0 1 4 0v7.1" />
      <path d="M13 10.4a1.8 1.8 0 0 1 3.6 0v1a1.8 1.8 0 0 1 3.5.6c0 4.6-2 8.4-6 8.4-3.4 0-5.1-2-6.4-4.4l-2.3-4a1.8 1.8 0 0 1 3-2z" />
    </g>

    <path
      v-else
      d="M12 3.4l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.8l-5.3 2.8 1.1-5.9L3.5 9.6l5.9-.8z"
    />
  </svg>
</template>

<style scoped>
.ui-icon {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
