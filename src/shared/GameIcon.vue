<script setup lang="ts">
// 게임 썸네일 아이콘 — 이모지 대신 인라인 SVG (에셋 없음, 어떤 해상도에서도 선명)
defineProps<{ slug: string }>()
</script>

<template>
  <svg class="game-icon" viewBox="0 0 48 48" aria-hidden="true">
    <!-- 수박 합치기 -->
    <g v-if="slug === 'suika'">
      <circle cx="24" cy="26" r="17" fill="#5CB85C" />
      <path d="M13 13 Q11 26 13 39" stroke="#17591B" stroke-width="3.4" fill="none" />
      <path d="M21 10 Q19 26 21 42" stroke="#17591B" stroke-width="3.8" fill="none" />
      <path d="M29 10 Q31 26 29 42" stroke="#17591B" stroke-width="3.8" fill="none" />
      <path d="M36 13 Q38 26 36 39" stroke="#17591B" stroke-width="3.4" fill="none" />
      <circle cx="24" cy="26" r="17" fill="none" stroke="#0F3D12" stroke-width="2" />
      <path d="M24 9 Q26 5 30 4" stroke="#6D4C2F" stroke-width="2.6" fill="none" stroke-linecap="round" />
      <ellipse cx="33" cy="5" rx="4" ry="2" fill="#4CAF50" transform="rotate(-20 33 5)" />
    </g>

    <!-- 블록 블라스트 -->
    <g v-else-if="slug === 'blockblast'">
      <rect x="5" y="5" width="17" height="17" rx="4" fill="#3D9BF0" />
      <rect x="5" y="5" width="17" height="6" rx="3" fill="#7EC4FF" />
      <rect x="26" y="5" width="17" height="17" rx="4" fill="#FF9F2E" />
      <rect x="26" y="5" width="17" height="6" rx="3" fill="#FFC978" />
      <rect x="5" y="26" width="17" height="17" rx="4" fill="#4CAF50" />
      <rect x="5" y="26" width="17" height="6" rx="3" fill="#8BE08F" />
      <rect x="26" y="26" width="17" height="17" rx="4" fill="#A055C8" />
      <rect x="26" y="26" width="17" height="6" rx="3" fill="#CE94E6" />
    </g>

    <!-- 벽돌깨기 RPG -->
    <g v-else-if="slug === 'brick'">
      <rect x="4" y="6" width="18" height="10" rx="2.5" fill="#EF5350" />
      <rect x="26" y="6" width="18" height="10" rx="2.5" fill="#FFB300" />
      <rect x="4" y="19" width="18" height="10" rx="2.5" fill="#42A5F5" />
      <rect x="26" y="19" width="18" height="10" rx="2.5" fill="#66BB6A" />
      <circle cx="16" cy="39" r="5" fill="#FF9800" />
      <circle cx="14.5" cy="37.5" r="1.8" fill="#FFF3E0" />
      <path d="M24 43 L34 34" stroke="#8D6E63" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 4" />
    </g>

    <!-- 과일 2048 -->
    <g v-else-if="slug === 'fruit2048'">
      <rect x="4" y="4" width="19" height="19" rx="5" fill="#F2456E" />
      <circle cx="13.5" cy="13.5" r="5.5" fill="#FF8FB0" />
      <rect x="25" y="4" width="19" height="19" rx="5" fill="#FFA22B" />
      <circle cx="34.5" cy="13.5" r="5.5" fill="#FFD08A" />
      <rect x="14" y="25" width="19" height="19" rx="5" fill="#5CB85C" />
      <circle cx="23.5" cy="34.5" r="6" fill="#9BE09B" />
      <path d="M31 22 L27 27 L33 27 L29 33" stroke="#FFF" stroke-width="2" fill="none" stroke-linecap="round" />
    </g>

    <!-- 무한 러너 -->
    <g v-else-if="slug === 'runner'">
      <rect x="2" y="34" width="44" height="10" rx="3" fill="#8D6E63" />
      <rect x="2" y="34" width="44" height="3.5" rx="1.75" fill="#7CB342" />
      <circle cx="22" cy="12" r="5" fill="#F4511E" />
      <path d="M22 17 L22 27" stroke="#F4511E" stroke-width="5" stroke-linecap="round" />
      <path d="M22 27 L15 34 M22 27 L30 33" stroke="#3E2723" stroke-width="3.4" stroke-linecap="round" />
      <path d="M22 20 L31 17 M22 21 L14 25" stroke="#F4511E" stroke-width="3.4" stroke-linecap="round" />
      <path d="M5 16 h7 M3 23 h9" stroke="#90CAF9" stroke-width="2.6" stroke-linecap="round" />
    </g>

    <!-- 낙하물 회피 -->
    <g v-else-if="slug === 'dodge'">
      <path d="M11 6 L18 9 L17 17 L9 18 L6 11 Z" fill="#607D8B" />
      <path d="M34 3 L41 7 L39 15 L31 15 L29 8 Z" fill="#78909C" />
      <path d="M24 19 L30 23 L28 30 L20 30 L18 23 Z" fill="#546E7A" />
      <circle cx="24" cy="39" r="7" fill="#42A5F5" />
      <path d="M17 32 L31 32 L24 39 Z" fill="#FFC107" />
      <circle cx="21.5" cy="39" r="1.6" fill="#0D2C45" />
      <circle cx="26.5" cy="39" r="1.6" fill="#0D2C45" />
    </g>

    <!-- 미니 골프 -->
    <g v-else-if="slug === 'golf'">
      <rect x="3" y="14" width="42" height="30" rx="6" fill="#6FBF63" />
      <rect x="3" y="22" width="42" height="6" fill="#7FCC72" />
      <rect x="3" y="36" width="42" height="6" fill="#7FCC72" />
      <ellipse cx="31" cy="29" rx="7" ry="5" fill="#2E2E2E" />
      <path d="M31 27 L31 6" stroke="#ECEFF1" stroke-width="2.6" stroke-linecap="round" />
      <path d="M31 6 Q39 8 44 11 Q37 13 31 15 Z" fill="#E53935" />
      <circle cx="13" cy="34" r="5.5" fill="#FFFFFF" />
      <circle cx="11.2" cy="32.2" r="1.8" fill="#F0F4F6" />
    </g>

    <!-- 서바이버 -->
    <g v-else-if="slug === 'survivor'">
      <circle cx="16" cy="26" r="11" fill="#42A5F5" />
      <path d="M5 26 a11 11 0 0 1 22 0 Z" fill="#1565C0" opacity="0.35" />
      <circle cx="12.5" cy="24" r="2" fill="#0D2C45" />
      <circle cx="19.5" cy="24" r="2" fill="#0D2C45" />
      <circle cx="37" cy="14" r="7" fill="#EF5350" />
      <path d="M32 8 L30 3 L35 6 Z M42 8 L44 3 L39 6 Z" fill="#9B1F1F" />
      <circle cx="34.5" cy="13" r="1.7" fill="#3E0A0A" />
      <circle cx="39.5" cy="13" r="1.7" fill="#3E0A0A" />
      <path d="M27 30 L42 30" stroke="#607D8B" stroke-width="3.4" stroke-linecap="round" />
      <path d="M28 27 L28 33" stroke="#8D6E63" stroke-width="3.4" stroke-linecap="round" />
    </g>

    <!-- 모의 주식 -->
    <g v-else-if="slug === 'stock'">
      <rect x="3" y="6" width="42" height="36" rx="6" fill="#FFFFFF" stroke="#CFD8DC" stroke-width="2" />
      <path d="M8 34 L18 24 L25 29 L40 12" stroke="#E5393C" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M8 34 L18 24 L25 29 L40 12 L40 37 L8 37 Z" fill="#E5393C" opacity="0.14" />
      <path d="M33 12 h7 v7" stroke="#E5393C" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </g>

    <!-- 머지 가든 -->
    <g v-else-if="slug === 'merge'">
      <path d="M13 30 h22 l-3 13 a2 2 0 0 1 -2 2 h-12 a2 2 0 0 1 -2 -2 Z" fill="#B5734A" />
      <rect x="11" y="26" width="26" height="6" rx="3" fill="#C98356" />
      <path d="M24 26 L24 12" stroke="#5D9C4A" stroke-width="3" stroke-linecap="round" />
      <ellipse cx="16" cy="18" rx="7" ry="4" fill="#4CAF50" transform="rotate(-24 16 18)" />
      <ellipse cx="32" cy="21" rx="6.5" ry="3.6" fill="#3E9E43" transform="rotate(22 32 21)" />
      <circle cx="24" cy="9" r="5" fill="#EC407A" />
      <circle cx="24" cy="9" r="2" fill="#FFF176" />
    </g>

    <!-- 보석 매치3 -->
    <g v-else-if="slug === 'match3'">
      <path d="M10 6 L17 10 L17 18 L10 22 L3 18 L3 10 Z" fill="#E5407A" />
      <path d="M10 6 L17 10 L10 14 L3 10 Z" fill="#FF7FA8" />
      <path d="M31 4 L40 12 L31 21 L22 12 Z" fill="#3D9BF0" />
      <path d="M31 4 L40 12 L31 12 Z" fill="#7EC4FF" />
      <circle cx="12" cy="35" r="8.5" fill="#FFB300" />
      <circle cx="9.5" cy="32.5" r="3" fill="#FFE082" />
      <path d="M34 27 L38 34 L45 35 L39.5 40 L41 47 L34 43.5 L27 47 L28.5 40 L23 35 L30 34 Z" fill="#8E4DC8" transform="scale(0.92) translate(2 0)" />
    </g>

    <!-- 트라이픽스 솔리테어 -->
    <g v-else-if="slug === 'tripeaks'">
      <rect x="4" y="12" width="16" height="22" rx="3" fill="#ECEFF1" transform="rotate(-12 12 23)" />
      <rect x="28" y="12" width="16" height="22" rx="3" fill="#CFD8DC" transform="rotate(12 36 23)" />
      <rect x="15" y="9" width="18" height="26" rx="3" fill="#FFFFFF" stroke="#B0BEC5" stroke-width="1.4" />
      <path d="M24 15 C21 12 16 14 17 18 C18 21 24 25 24 25 C24 25 30 21 31 18 C32 14 27 12 24 15 Z" fill="#E5393C" />
      <path d="M8 40 L14 44 M34 44 L40 40" stroke="#8D6E63" stroke-width="2.6" stroke-linecap="round" />
      <circle cx="24" cy="41" r="4.5" fill="#FFB300" />
      <circle cx="22.6" cy="39.6" r="1.5" fill="#FFE082" />
    </g>

    <!-- 마작 솔리테어 -->
    <g v-else-if="slug === 'mahjong'">
      <rect x="7" y="16" width="18" height="24" rx="3.5" fill="#C8E6C9" />
      <rect x="7" y="16" width="18" height="20" rx="3.5" fill="#F5F5F0" />
      <circle cx="16" cy="26" r="5.5" fill="#43A047" />
      <circle cx="16" cy="26" r="2.4" fill="#F5F5F0" />
      <rect x="24" y="8" width="18" height="24" rx="3.5" fill="#FFCCBC" />
      <rect x="24" y="8" width="18" height="20" rx="3.5" fill="#FFFFFF" />
      <circle cx="30" cy="14" r="2.6" fill="#E5393C" />
      <circle cx="36" cy="14" r="2.6" fill="#1565C0" />
      <circle cx="30" cy="21" r="2.6" fill="#1565C0" />
      <circle cx="36" cy="21" r="2.6" fill="#E5393C" />
      <rect x="16" y="30" width="18" height="14" rx="3.5" fill="#D7CCC8" opacity="0.55" />
    </g>

    <!-- 네모로직 -->
    <g v-else-if="slug === 'nonogram'">
      <rect x="12" y="12" width="32" height="32" rx="4" fill="#FFFFFF" stroke="#B0BEC5" stroke-width="1.6" />
      <rect x="14" y="14" width="9" height="9" fill="#37474F" rx="1.5" />
      <rect x="24" y="14" width="9" height="9" fill="#37474F" rx="1.5" />
      <rect x="24" y="24" width="9" height="9" fill="#37474F" rx="1.5" />
      <rect x="34" y="24" width="9" height="9" fill="#42A5F5" rx="1.5" />
      <rect x="14" y="34" width="9" height="9" fill="#42A5F5" rx="1.5" />
      <path d="M35.5 35.5 L41.5 41.5 M41.5 35.5 L35.5 41.5" stroke="#E5393C" stroke-width="2.2" stroke-linecap="round" />
      <path d="M6 16 h3 M6 26 h3 M6 36 h3" stroke="#607D8B" stroke-width="2.4" stroke-linecap="round" />
      <path d="M16 6 v3 M26 6 v3 M36 6 v3" stroke="#607D8B" stroke-width="2.4" stroke-linecap="round" />
    </g>

    <!-- 등록되지 않은 게임 -->
    <g v-else>
      <rect x="6" y="6" width="36" height="36" rx="9" fill="#D7CCC8" />
      <circle cx="24" cy="24" r="7" fill="#FFFFFF" />
    </g>
  </svg>
</template>

<style scoped>
.game-icon {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
