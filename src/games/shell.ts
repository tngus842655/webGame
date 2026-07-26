import type { GameContext, GameModule } from './types'

// 게임 세션 공통 골격: wrapper DOM + rAF 루프(dt 클램프) + 백그라운드 일시정지 + 정리 관리.
// 각 게임은 onFrame(dt)에 갱신·렌더링만 작성하면 된다.
export interface GameShell {
  readonly wrapper: HTMLDivElement
  isDestroyed(): boolean
  // destroy 시 등록 역순으로 실행된다
  addCleanup(fn: () => void): void
  destroy(): void
}

export function createGameShell(host: HTMLElement, onFrame: (dt: number) => void): GameShell {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:absolute;inset:0;overflow:hidden;'
  host.appendChild(wrapper)

  let destroyed = false
  const cleanups: Array<() => void> = []

  let rafId = 0
  let last = performance.now()
  const frame = (now: number) => {
    rafId = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    onFrame(dt)
  }
  const onVisibility = () => {
    if (destroyed) return
    if (document.hidden) {
      cancelAnimationFrame(rafId)
    } else {
      last = performance.now()
      rafId = requestAnimationFrame(frame)
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  rafId = requestAnimationFrame(frame)

  return {
    wrapper,
    isDestroyed: () => destroyed,
    addCleanup(fn) {
      cleanups.push(fn)
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', onVisibility)
      for (const fn of cleanups.reverse()) fn()
      wrapper.remove()
    },
  }
}

export interface GameSession {
  destroy(): void
  // 지금까지의 점수 (게임오버 시 제출하는 값과 같은 식) — 중도 이탈 기록 보존에 쓰인다
  getScore(): number
}

// GameModule의 mount/unmount 보일러플레이트 제거용
export function defineGame(
  create: (host: HTMLElement, ctx: GameContext) => GameSession,
): GameModule {
  let session: GameSession | null = null
  return {
    mount(host, ctx) {
      session = create(host, ctx)
    },
    unmount() {
      session?.destroy()
      session = null
    },
    currentScore() {
      return session?.getScore() ?? 0
    },
  }
}
