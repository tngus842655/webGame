import type { TranslationKey } from '@/shared/i18n'

export interface GameMeta {
  slug: string
  titleKey: TranslationKey // 표시할 때 t()로 변환
  loader: () => Promise<{ default: GameModule }>
}

export interface GameModule {
  mount(host: HTMLElement, ctx: GameContext): void
  // 물리 엔진·rAF·이벤트 리스너 정리 책임은 게임 모듈에 있다
  unmount(): void
  // 진행 중 점수 — 게임오버 전에 나가도 기록이 남도록 허브가 주기적으로 읽는다 (0 = 아직 없음)
  currentScore(): number
  // 관리자 전용 '다음 단계'를 지원하는 게임인지 (mount 뒤에 물어야 한다)
  canAdminSkip(): boolean
  // 점수는 그대로 두고 판만 넘긴다. 지원하지 않는 게임에서는 아무 일도 하지 않는다
  adminSkip(): void
  // 관리자 전용 '진도 초기화'를 지원하는 게임인지 (mount 뒤에 물어야 한다).
  // 기기에 진도를 저장해 두는 게임에서만 참이다 — 테스트로 올려둔 단계를 되돌릴 길이 필요하다
  canAdminReset(): boolean
  // 저장해 둔 진도와 이 기기의 최고 기록을 지우고 처음부터. 지원하지 않으면 아무 일도 하지 않는다
  adminReset(): void
}

export interface GameContext {
  submitScore(score: number): Promise<void>
  getBestScore(): Promise<number | null>
  // 광고를 노출할 수 없는 환경이면 false — 게임은 광고 버튼을 숨겨야 한다
  isRewardAdReady(): boolean
  // true = 끝까지 시청 완료(보상 지급)
  showRewardAd(placement: string): Promise<boolean>
}
