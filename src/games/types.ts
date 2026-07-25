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
  // 확장 지점(MVP 미구현): showRewardAd(placement): Promise<boolean>
}
