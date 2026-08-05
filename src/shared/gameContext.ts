import type { GameContext } from '@/games/types'
import { pauseRunningGame, resumeRunningGame } from '@/games/shell'
import { adProvider } from './ads'
import { recordAdView } from './adViews'
import { duckBgm, isBgmPlaying, resumeBgm } from './music'
import { getLocalBest, saveScore } from './scores'

// 리워드 광고에는 횟수 상한을 두지 않는다. 사용자가 버튼을 눌러야만 나오는 광고라
// 강제 노출과 달리 이탈을 만들지 않고, 빈도 조절은 광고 매체가 알아서 한다.
// (강제로 뜨는 전면 광고를 넣게 되면 그쪽에 빈도 제한을 건다)
export function createGameContext(slug: string): GameContext {
  // 판에 들어오는 순간 광고 한 편을 미리 받아 둔다. 앱인토스는 로드에만 5~20초(최대 1분)가
  // 걸려서, 버튼을 누른 뒤에 부르면 그동안 게임이 멈춰 있게 된다.
  adProvider.preload?.()
  return {
    submitScore: (score) => saveScore(slug, score),
    getBestScore: async () => getLocalBest(slug),
    isRewardAdReady: () => adProvider.isReady(),
    // 광고가 떠 있는 동안 루프를 멈춘다. 대부분의 호출부는 게임오버 뒤라 멈춰 있지만,
    // 진행 중에 부르는 곳(오목 무르기·아이스슬라이드 되돌리기)은 그렇지 않다 —
    // 오목은 제한 시간이 돌아서 광고를 보다 시간 초과로 질 수 있었다.
    // 멈추는 것은 셸이 세는 depth라 클리어 보너스처럼 이미 멈춘 위에 겹쳐도 안전하다.
    // 게임 30여 개의 광고 호출이 전부 이 한 곳을 지난다 — 기록도 여기서 남긴다.
    // BGM도 접는다 — 앱인토스 가이드가 "광고가 재생되는 동안 앱 사운드는 잠시 멈추고,
    // 끝나면 자동으로 다시 재생"을 요구한다. 결과 팝업에서 부르는 광고는 팝업이 이미
    // 접어 둔 뒤라, 원래 흐르고 있던 경우에만 되살린다.
    showRewardAd: async (placement) => {
      pauseRunningGame()
      const bgmWasPlaying = isBgmPlaying()
      duckBgm()
      try {
        const outcome = await adProvider.show(placement)
        void recordAdView(slug, placement, outcome)
        // 사용자가 스스로 닫은 경우에만 보상을 막는다. 재고 없음·상한·에러는
        // 매체 사정이라 기회를 뺏지 않는다.
        return outcome !== 'dismissed'
      } finally {
        resumeRunningGame()
        if (bgmWasPlaying) resumeBgm()
      }
    },
  }
}
