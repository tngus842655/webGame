import type { GameContext } from '@/games/types'
import { adProvider } from './ads'
import { getLocalBest, saveScore } from './scores'

// 리워드 광고에는 횟수 상한을 두지 않는다. 사용자가 버튼을 눌러야만 나오는 광고라
// 강제 노출과 달리 이탈을 만들지 않고, 빈도 조절은 광고 매체가 알아서 한다.
// (강제로 뜨는 전면 광고를 넣게 되면 그쪽에 빈도 제한을 건다)
export function createGameContext(slug: string): GameContext {
  return {
    submitScore: (score) => saveScore(slug, score),
    getBestScore: async () => getLocalBest(slug),
    isRewardAdReady: () => adProvider.isReady(),
    showRewardAd: (placement) => adProvider.show(placement),
  }
}
