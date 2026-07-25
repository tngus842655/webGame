import type { GameContext } from '@/games/types'

// M3에서 Supabase 제출로 교체하고, localStorage 저장은 오프라인 대비로 병행 유지한다
export function createLocalGameContext(slug: string): GameContext {
  const key = `webgame:best:${slug}`
  return {
    async submitScore(score: number) {
      const best = Number(localStorage.getItem(key) ?? '0')
      if (score > best) localStorage.setItem(key, String(score))
    },
    async getBestScore() {
      const raw = localStorage.getItem(key)
      return raw === null ? null : Number(raw)
    },
  }
}
