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

    <!-- 스도쿠 데일리 -->
    <g v-else-if="slug === 'sudoku'">
      <rect x="5" y="5" width="38" height="38" rx="4" fill="#FFFFFF" stroke="#00695C" stroke-width="2.4" />
      <rect x="18.5" y="18.5" width="11" height="11" fill="#B2DFDB" />
      <path d="M17.5 6 V42 M30.5 6 V42 M6 17.5 H42 M6 30.5 H42" stroke="#00897B" stroke-width="2" />
      <text x="11.5" y="15.5" font-size="10" font-weight="bold" fill="#263238" text-anchor="middle">5</text>
      <text x="37" y="15.5" font-size="10" font-weight="bold" fill="#00897B" text-anchor="middle">3</text>
      <text x="24" y="28.3" font-size="10" font-weight="bold" fill="#00897B" text-anchor="middle">7</text>
      <text x="11.5" y="41" font-size="10" font-weight="bold" fill="#00897B" text-anchor="middle">9</text>
      <text x="37" y="41" font-size="10" font-weight="bold" fill="#263238" text-anchor="middle">1</text>
    </g>

    <!-- 파이프 연결 -->
    <g v-else-if="slug === 'pipes'">
      <rect x="4" y="4" width="40" height="40" rx="6" fill="#E3F2FD" />
      <path d="M14 4 V24 H34 V44" stroke="#29B6F6" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M34 14 H44" stroke="#90A4AE" stroke-width="7" stroke-linecap="round" />
      <path d="M4 34 H14" stroke="#90A4AE" stroke-width="7" stroke-linecap="round" />
      <rect x="9" y="-1" width="10" height="10" rx="3" fill="#43A047" />
      <circle cx="34" cy="44" r="5" fill="#FFB300" />
      <circle cx="34" cy="44" r="2.2" fill="#FFFFFF" />
    </g>

    <!-- 타워 디펜스 -->
    <g v-else-if="slug === 'defense'">
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#9CCC65" />
      <path d="M4 14 H30 Q36 14 36 20 V28 Q36 34 30 34 H4" stroke="#BCAAA4" stroke-width="9" fill="none" stroke-linecap="round" />
      <circle cx="12" cy="14" r="5.5" fill="#EF5350" />
      <circle cx="10.2" cy="12.8" r="1.5" fill="#FFFFFF" />
      <circle cx="13.8" cy="12.8" r="1.5" fill="#FFFFFF" />
      <rect x="14" y="38" width="20" height="4" rx="2" fill="#5D4037" />
      <rect x="17" y="24" width="14" height="16" rx="2.5" fill="#6D4C41" />
      <path d="M16 20 h4 v3 h4 v-3 h4 v3 h4 v-3 v10 h-16 Z" fill="#5D4037" />
      <circle cx="24" cy="32" r="4" fill="#1E88E5" />
    </g>

    <!-- 점프 챌린지 -->
    <g v-else-if="slug === 'jump'">
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#8ED0F5" />
      <rect x="6" y="38" width="16" height="6" rx="3" fill="#8D6E63" />
      <rect x="6" y="36" width="16" height="4" rx="2" fill="#66BB6A" />
      <rect x="28" y="22" width="14" height="5" rx="2.5" fill="#8D6E63" />
      <rect x="28" y="20" width="14" height="4" rx="2" fill="#66BB6A" />
      <ellipse cx="10" cy="12" rx="6" ry="3" fill="#FFFFFF" opacity="0.8" />
      <rect x="12" y="22" width="12" height="11" rx="5" fill="#FF7043" transform="rotate(-14 18 27)" />
      <circle cx="16.5" cy="24.5" r="1.7" fill="#FFFFFF" />
      <circle cx="21.5" cy="23.5" r="1.7" fill="#FFFFFF" />
      <path d="M26 33 Q22 36 20 34" stroke="#E64A19" stroke-width="2" fill="none" stroke-linecap="round" />
      <path d="M33 14 L35 10 L37 14 M35 10 V17" stroke="#FFFFFF" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
    </g>

    <!-- 리듬 탭 -->
    <g v-else-if="slug === 'rhythm'">
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#1A1130" />
      <rect x="8" y="8" width="8" height="14" rx="3" fill="#FF5A8C" />
      <rect x="18" y="16" width="8" height="14" rx="3" fill="#FFC94D" />
      <rect x="28" y="6" width="8" height="14" rx="3" fill="#4DD679" />
      <rect x="8" y="26" width="8" height="6" rx="2.5" fill="#FF5A8C" opacity="0.4" />
      <rect x="28" y="24" width="8" height="6" rx="2.5" fill="#4DD679" opacity="0.4" />
      <path d="M6 36 H42" stroke="#D1C4E9" stroke-width="2.6" stroke-linecap="round" />
      <circle cx="22" cy="36" r="4.5" fill="none" stroke="#FFD54F" stroke-width="2" />
    </g>

    <!-- 궤도 슈팅 -->
    <g v-else-if="slug === 'orbit'">
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#101638" />
      <circle cx="24" cy="24" r="15" fill="none" stroke="#3A4373" stroke-width="1.6" />
      <circle cx="24" cy="24" r="8" fill="#1E2749" stroke="#5C6BC0" stroke-width="1.8" />
      <rect x="28" y="21.6" width="9" height="4.8" rx="2" fill="#7986CB" />
      <circle cx="24" cy="24" r="3" fill="#C5CAE9" />
      <circle cx="40" cy="24" r="2.2" fill="#80D8FF" />
      <circle cx="10" cy="13" r="4.6" fill="#FF7043" />
      <circle cx="8.6" cy="12" r="1.3" fill="#FFFFFF" />
      <circle cx="11.8" cy="12" r="1.3" fill="#FFFFFF" />
      <circle cx="36" cy="38" r="5" fill="#AB47BC" />
      <circle cx="36" cy="38" r="3" fill="none" stroke="#E1BEE7" stroke-width="1.4" />
    </g>

    <!-- 부동산 타이쿤 -->
    <g v-else-if="slug === 'estate'">
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#455A64" />
      <rect x="8" y="20" width="11" height="20" rx="2" fill="#90A4AE" />
      <rect x="10.5" y="23" width="2.6" height="2.6" fill="#ECEFF1" />
      <rect x="14.5" y="23" width="2.6" height="2.6" fill="#ECEFF1" />
      <rect x="10.5" y="28" width="2.6" height="2.6" fill="#ECEFF1" />
      <rect x="14.5" y="28" width="2.6" height="2.6" fill="#ECEFF1" />
      <rect x="21" y="12" width="13" height="28" rx="2" fill="#CFD8DC" />
      <rect x="24" y="16" width="3" height="3" fill="#546E7A" />
      <rect x="29" y="16" width="3" height="3" fill="#546E7A" />
      <rect x="24" y="22" width="3" height="3" fill="#546E7A" />
      <rect x="29" y="22" width="3" height="3" fill="#546E7A" />
      <rect x="24" y="28" width="3" height="3" fill="#546E7A" />
      <rect x="29" y="28" width="3" height="3" fill="#546E7A" />
      <rect x="36" y="26" width="8" height="14" rx="2" fill="#78909C" />
      <path d="M8 14 L15 7 L22 14" stroke="#E5393C" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="38" cy="12" r="6" fill="#FFB300" />
      <text x="38" y="15.4" font-size="9" font-weight="bold" fill="#7A4F01" text-anchor="middle">$</text>
    </g>

    <!-- 편의점 운영 -->
    <g v-else-if="slug === 'store'">
      <rect x="5" y="14" width="38" height="28" rx="4" fill="#ECEFF1" />
      <path d="M4 14 L8 6 H40 L44 14 Z" fill="#43A047" />
      <path d="M4 14 h8 v-2 h8 v2 h8 v-2 h8 v2 h8" stroke="#2E7D32" stroke-width="1.4" fill="none" />
      <rect x="10" y="20" width="12" height="9" rx="2" fill="#FFCC80" />
      <rect x="26" y="20" width="12" height="9" rx="2" fill="#80DEEA" />
      <rect x="10" y="32" width="12" height="9" rx="2" fill="#EF9A9A" />
      <rect x="26" y="31" width="12" height="11" rx="2" fill="#6D4C41" />
      <rect x="30.5" y="35" width="3" height="7" fill="#3E2723" />
    </g>

    <!-- 유튜버 시뮬 -->
    <g v-else-if="slug === 'tuber'">
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#FCE4EC" />
      <rect x="8" y="12" width="32" height="22" rx="5" fill="#D32F2F" />
      <path d="M21 18 L29 23 L21 28 Z" fill="#FFFFFF" />
      <path d="M14 38 h20" stroke="#B71C1C" stroke-width="2.6" stroke-linecap="round" />
      <path d="M18 41.5 h12" stroke="#EF9A9A" stroke-width="2.4" stroke-linecap="round" />
      <circle cx="39" cy="10" r="5.5" fill="#FF6F00" />
      <path d="M39 7.4 v3.2 l2 1.6" stroke="#FFF3E0" stroke-width="1.6" fill="none" stroke-linecap="round" />
    </g>

    <!-- 국가 운영 -->
    <g v-else-if="slug === 'reigns'">
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#5D4037" />
      <rect x="15" y="14" width="24" height="28" rx="3.5" fill="#BCAAA4" transform="rotate(8 27 28)" />
      <rect x="9" y="12" width="24" height="28" rx="3.5" fill="#EFEBE9" />
      <circle cx="21" cy="22" r="4.5" fill="#8D6E63" />
      <path d="M14 32 h14 M14 36 h10" stroke="#A1887F" stroke-width="2" stroke-linecap="round" />
      <path d="M17 6 L21 9 L24 5 L27 9 L31 6 L30 11 H18 Z" fill="#FFB300" />
    </g>

    <!-- 집중 나무 -->
    <g v-else-if="slug === 'focus'">
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#C4E6FA" />
      <rect x="4" y="36" width="40" height="8" rx="3" fill="#8BC34A" />
      <path d="M24 38 Q22 28 24 20" stroke="#6D4C41" stroke-width="4.5" fill="none" stroke-linecap="round" />
      <circle cx="24" cy="15" r="8.5" fill="#66BB6A" />
      <circle cx="16.5" cy="19" r="6" fill="#43A047" />
      <circle cx="31.5" cy="19" r="6" fill="#43A047" />
      <circle cx="20" cy="11" r="2" fill="#F48FB1" />
      <circle cx="28.5" cy="13.5" r="2" fill="#F48FB1" />
      <circle cx="38" cy="10" r="4.6" fill="#FFEE58" />
    </g>

    <!-- 한글 워들 -->
    <g v-else-if="slug === 'wordle'">
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#ECEFF1" />
      <rect x="8" y="8" width="10" height="10" rx="2.5" fill="#6AAA64" />
      <rect x="19" y="8" width="10" height="10" rx="2.5" fill="#C9B458" />
      <rect x="30" y="8" width="10" height="10" rx="2.5" fill="#787C7E" />
      <rect x="8" y="19" width="10" height="10" rx="2.5" fill="#787C7E" />
      <rect x="19" y="19" width="10" height="10" rx="2.5" fill="#6AAA64" />
      <rect x="30" y="19" width="10" height="10" rx="2.5" fill="#C9B458" />
      <text x="13" y="16" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">ㅎ</text>
      <text x="24" y="16" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">ㅏ</text>
      <text x="35" y="16" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">ㄴ</text>
      <text x="13" y="27" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">ㄱ</text>
      <text x="24" y="27" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">ㅡ</text>
      <text x="35" y="27" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">ㄹ</text>
      <rect x="8" y="32" width="32" height="8" rx="2.5" fill="#CFD8DC" />
    </g>

    <!-- 오목 -->
    <g v-else-if="slug === 'omok'">
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#D7A86E" />
      <path d="M12 8 V40 M22 8 V40 M32 8 V40 M8 14 H40 M8 24 H40 M8 34 H40" stroke="#8D6E63" stroke-width="1.4" />
      <circle cx="22" cy="24" r="5.5" fill="#212121" />
      <circle cx="32" cy="14" r="5.5" fill="#FAFAFA" stroke="#BDBDBD" stroke-width="1" />
      <circle cx="12" cy="34" r="5.5" fill="#212121" />
      <circle cx="32" cy="34" r="5.5" fill="#FAFAFA" stroke="#BDBDBD" stroke-width="1" />
      <circle cx="12" cy="14" r="5.5" fill="#212121" />
      <circle cx="20.5" cy="22.5" r="1.6" fill="#616161" />
      <circle cx="10.5" cy="12.5" r="1.6" fill="#616161" />
    </g>

    <!-- 카드 배틀 -->
    <g v-else-if="slug === 'deck'">
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#2A2138" />
      <rect x="7" y="14" width="16" height="24" rx="3" fill="#ECEFF1" transform="rotate(-10 15 26)" />
      <rect x="15" y="12" width="16" height="24" rx="3" fill="#FFFFFF" stroke="#C62828" stroke-width="1.6" />
      <path d="M23 17 L25.5 22 L23 27 L20.5 22 Z" fill="#C62828" />
      <rect x="26" y="15" width="16" height="24" rx="3" fill="#FFFFFF" stroke="#1565C0" stroke-width="1.6" transform="rotate(10 34 27)" />
      <circle cx="12" cy="10" r="4.6" fill="#FF8F00" />
      <text x="12" y="13.2" font-size="8" font-weight="bold" fill="#FFFFFF" text-anchor="middle">1</text>
    </g>

    <!-- 오토 배틀 -->
    <g v-else-if="slug === 'autochess'">
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#37474F" />
      <circle cx="14" cy="18" r="7" fill="#E57373" />
      <circle cx="14" cy="34" r="7" fill="#64B5F6" />
      <circle cx="34" cy="18" r="7" fill="#BA68C8" />
      <circle cx="34" cy="34" r="7" fill="#81C784" />
      <path d="M22 22 L26 30 M26 22 L22 30" stroke="#FFD54F" stroke-width="2.6" stroke-linecap="round" />
      <path d="M11 8.5 L14 5.5 L17 8.5" stroke="#FFD54F" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="14" cy="16" r="2" fill="#FFFFFF" opacity="0.65" />
      <circle cx="34" cy="16" r="2" fill="#FFFFFF" opacity="0.65" />
    </g>

    <!-- 룰렛 데일리 -->
    <g v-else-if="slug === 'roulette'">
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#6A1B9A" />
      <g>
        <path d="M24 26 L24 8 A18 18 0 0 1 36.7 13.3 Z" fill="#EF5350" />
        <path d="M24 26 L36.7 13.3 A18 18 0 0 1 42 26 Z" fill="#42A5F5" />
        <path d="M24 26 L42 26 A18 18 0 0 1 36.7 38.7 Z" fill="#FFB300" />
        <path d="M24 26 L36.7 38.7 A18 18 0 0 1 24 44 Z" fill="#66BB6A" />
        <path d="M24 26 L24 44 A18 18 0 0 1 11.3 38.7 Z" fill="#AB47BC" />
        <path d="M24 26 L11.3 38.7 A18 18 0 0 1 6 26 Z" fill="#26C6DA" />
        <path d="M24 26 L6 26 A18 18 0 0 1 11.3 13.3 Z" fill="#FF7043" />
        <path d="M24 26 L11.3 13.3 A18 18 0 0 1 24 8 Z" fill="#9CCC65" />
      </g>
      <circle cx="24" cy="26" r="18" fill="none" stroke="#FFD54F" stroke-width="2.4" />
      <circle cx="24" cy="26" r="5" fill="#4A148C" stroke="#FFD54F" stroke-width="1.6" />
      <path d="M20 6 L24 12 L28 6 Z" fill="#FFD54F" />
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
