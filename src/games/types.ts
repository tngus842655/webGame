export interface GameMeta {
  slug: string
  title: string
  thumbnail: string
  loader: () => Promise<{ default: GameModule }>
}

export interface GameModule {
  mount(host: HTMLElement, ctx: GameContext): void
  // 물리 엔진·rAF·이벤트 리스너 정리 책임은 게임 모듈에 있다
  unmount(): void
}

export interface GameContext {
  submitScore(score: number): Promise<void>
  getBestScore(): Promise<number | null>
  // 광고를 노출할 수 없는 환경이면 false — 게임은 광고 버튼을 숨겨야 한다
  isRewardAdReady(): boolean
  // true = 끝까지 시청 완료(보상 지급)
  showRewardAd(placement: string): Promise<boolean>
}
