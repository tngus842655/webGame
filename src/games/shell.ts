import type { GameContext, GameModule } from './types'

// 게임 세션 공통 골격: wrapper DOM + rAF 루프(dt 클램프) + 백그라운드 일시정지 + 정리 관리.
// 각 게임은 onFrame(dt)에 갱신·렌더링만 작성하면 된다.
export interface GameShell {
  readonly wrapper: HTMLDivElement
  isDestroyed(): boolean
  // destroy 시 등록 역순으로 실행된다
  addCleanup(fn: () => void): void
  // 화면을 덮는 팝업 동안 루프를 멈춘다 (제한 시간·적 이동이 뒤에서 계속되면 안 되므로)
  pause(): void
  resume(): void
  destroy(): void
}

// 실행 중인 셸 (한 번에 한 게임) — 가이드 팝업처럼 화면을 덮을 때 잠시 멈추기 위해 모아둔다.
// 게임 코드는 rAF 루프를 직접 다루지 않으므로 여기서만 관리하면 된다
const running = new Set<{ pause(): void; resume(): void }>()

export function pauseRunningGame() {
  for (const shell of running) shell.pause()
}

export function resumeRunningGame() {
  for (const shell of running) shell.resume()
}

export function createGameShell(host: HTMLElement, onFrame: (dt: number) => void): GameShell {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:absolute;inset:0;overflow:hidden;'
  host.appendChild(wrapper)

  let destroyed = false
  // 가이드 팝업과 클리어 보너스가 겹칠 수 있어 중첩을 센다 (하나가 닫혀도 나머지가 남아 있으면 계속 멈춤)
  let pauseDepth = 0
  const cleanups: Array<() => void> = []

  let rafId = 0
  let last = performance.now()
  const frame = (now: number) => {
    rafId = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    onFrame(dt)
  }
  // 멈췄다 돌아올 때 그동안의 시간이 한 프레임에 몰리지 않도록 기준을 다시 잡는다
  const startLoop = () => {
    last = performance.now()
    rafId = requestAnimationFrame(frame)
  }
  const onVisibility = () => {
    if (destroyed) return
    if (document.hidden) cancelAnimationFrame(rafId)
    else if (pauseDepth === 0) startLoop()
  }
  document.addEventListener('visibilitychange', onVisibility)
  startLoop()

  const shell = {
    wrapper,
    isDestroyed: () => destroyed,
    addCleanup(fn: () => void) {
      cleanups.push(fn)
    },
    pause() {
      if (destroyed) return
      pauseDepth += 1
      if (pauseDepth === 1) cancelAnimationFrame(rafId)
    },
    resume() {
      if (destroyed || pauseDepth === 0) return
      pauseDepth -= 1
      if (pauseDepth === 0 && !document.hidden) startLoop()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      running.delete(shell)
      cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', onVisibility)
      for (const fn of cleanups.reverse()) fn()
      wrapper.remove()
    },
  }
  running.add(shell)
  return shell
}

export interface GameSession {
  destroy(): void
  // 지금까지의 점수 (게임오버 시 제출하는 값과 같은 식) — 중도 이탈 기록 보존에 쓰인다.
  // 제한 시간을 다 써야 결과가 확정되는 게임은 생략한다 = 완주했을 때만 기록
  getScore?(): number
  // 관리자 전용 '다음 단계' — 판이 나뉘는 게임만 구현한다. 점수는 건드리지 않는다
  adminSkip?(): void
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
      return session?.getScore?.() ?? 0
    },
    canAdminSkip() {
      return !!session?.adminSkip
    },
    adminSkip() {
      session?.adminSkip?.()
    },
  }
}
