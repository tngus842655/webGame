import type { GameContext } from '@/games/types'
import { adProvider } from './ads'
import { getLocalBest, saveScore } from './scores'

export function createGameContext(slug: string): GameContext {
  return {
    submitScore: (score) => saveScore(slug, score),
    getBestScore: async () => getLocalBest(slug),
    isRewardAdReady: () => adProvider.isReady(),
    showRewardAd: (placement) => adProvider.show(placement),
  }
}
