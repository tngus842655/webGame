import type { GameContext } from '@/games/types'
import { adProvider } from './ads'
import { getLocalBest, saveScore } from './scores'

// 한 판이 짧은 게임(회피·러너·궤도·리듬 등)은 이어하기 광고가 몇 분 만에 반복 노출된다.
// 광고 정책상으로도 사용자 이탈 면에서도 좋지 않아 게임 화면에 머무는 동안의 상한을 둔다.
const AD_LIMIT_PER_VISIT = 5

export function createGameContext(slug: string): GameContext {
  let adsShown = 0
  return {
    submitScore: (score) => saveScore(slug, score),
    getBestScore: async () => getLocalBest(slug),
    isRewardAdReady: () => adsShown < AD_LIMIT_PER_VISIT && adProvider.isReady(),
    showRewardAd: (placement) => {
      if (adsShown >= AD_LIMIT_PER_VISIT) return Promise.resolve(false)
      adsShown += 1
      return adProvider.show(placement)
    },
  }
}
