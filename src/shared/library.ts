import { ref } from 'vue'

// 즐겨찾기·최근 플레이 — 둘 다 이 기기에만 남는다.
// 계정 없이 처음 켠 사람도 바로 눌러야 하고, 잃어도 다시 누르면 그만이라
// 점수처럼 서버까지 태울 값이 아니다.

const FAVORITES_KEY = 'webgame:favorites'
const RECENTS_KEY = 'webgame:recents'

// 홈의 최근 플레이 줄에 들어가는 만큼만 — 그 뒤는 화면에 나오지 않는다
const RECENTS_MAX = 8

function read(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

// ref로 두어야 카드의 별을 누른 순간 즐겨찾기 탭까지 함께 바뀐다
export const favorites = ref<string[]>(read(FAVORITES_KEY))
export const recents = ref<string[]>(read(RECENTS_KEY))

export function isFavorite(slug: string): boolean {
  return favorites.value.includes(slug)
}

// 새로 담은 것이 앞에 온다 — 즐겨찾기 칸이 담은 순서의 역순으로 쌓인다
export function toggleFavorite(slug: string): void {
  favorites.value = isFavorite(slug)
    ? favorites.value.filter((s) => s !== slug)
    : [slug, ...favorites.value]
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites.value))
}

// 플레이 화면에 들어설 때 부른다. 같은 게임을 다시 열면 맨 앞으로 올라온다.
export function markPlayed(slug: string): void {
  recents.value = [slug, ...recents.value.filter((s) => s !== slug)].slice(0, RECENTS_MAX)
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.value))
}
