import { ref } from 'vue'

// 테마 — 라이트·다크·시스템. 고른 값은 이 기기에만 남는다.
//
// 색은 styles/main.css에 사용자 지정 속성으로 모아두고 여기서는 <html>의
// data-theme만 갈아 끼운다. 게임 화면(캔버스)은 각자 자기 그림을 그리므로
// 테마를 타지 않는다 — 바뀌는 것은 허브 화면과 게임 위에 뜨는 조작 UI다.
//
// 첫 칠 이전에 정해야 다크로 들어갈 때 밝은 화면이 한 번 스치지 않는다.
// 그래서 최초 적용은 index.html의 인라인 스크립트가 하고, 여기서는 그 뒤를
// 이어받는다 — 저장소 키를 바꾸면 index.html도 같이 고쳐야 한다.

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'webgame:theme'

// 안드로이드 상태 표시줄과 브라우저 주소창이 이 값을 따라간다 (--bg-top과 같은 색)
const BAR_COLOR: Record<'light' | 'dark', string> = {
  light: '#fff8e1',
  dark: '#211b18',
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function readMode(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

export const themeMode = ref<ThemeMode>(readMode())

// 캔버스는 CSS 변수를 못 읽으므로 게임은 이 값을 보고 판 색을 고른다.
// 게임은 매 프레임 다시 그리니 테마를 바꾼 순간 바로 반영된다 (i18n과 같다).
let dark = false

export function isDarkTheme(): boolean {
  return dark
}

function apply() {
  const mode = themeMode.value
  const theme = mode === 'system' ? (darkQuery.matches ? 'dark' : 'light') : mode
  dark = theme === 'dark'
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[theme])
}

export function setThemeMode(mode: ThemeMode): void {
  themeMode.value = mode
  localStorage.setItem(STORAGE_KEY, mode)
  apply()
}

// 시스템을 고른 사람은 폰 설정이 바뀌는 즉시 따라가야 한다
darkQuery.addEventListener('change', () => {
  if (themeMode.value === 'system') apply()
})

apply()
