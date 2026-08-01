import { t } from '@/shared/i18n'
import type { GameShell } from './shell'

// 광고가 끝나자마자 조작이 돌아오면, 30초쯤 광고를 보고 온 사람은 손이 준비되기도
// 전에 다시 죽는다. 장애물을 비우고 시간을 넉넉히 줘도 마찬가지였다 — 문제는
// 게임 상태가 아니라 사람 쪽이라, 준비됐다는 신호를 직접 받아야 풀린다.
//
// 손을 떼면 세상이 알아서 흘러가는 게임에만 쓴다. 스도쿠·워들처럼 내가 두기 전에는
// 아무것도 안 움직이는 게임에서는 탭 한 번이 군더더기다.
export interface ResumeGate {
  // 화면을 덮고 탭할 때까지 기다린다. 그동안 게임 루프는 멈춰 있다.
  wait(): Promise<void>
}

export function createResumeGate(shell: GameShell): ResumeGate {
  const root = document.createElement('div')
  root.className = 'gui-scrim'
  root.innerHTML = '<p class="gui-gate"></p>'
  shell.wrapper.appendChild(root)

  let release: (() => void) | null = null
  // 기다리는 중에 화면을 떠나면 약속이 영영 안 풀린다 — 셸이 죽을 때 같이 걷는다
  shell.addCleanup(() => release?.())

  return {
    wait() {
      if (shell.isDestroyed()) return Promise.resolve()
      const label = root.querySelector('p')
      if (label) label.textContent = t('over.tapResume')
      shell.pause()
      root.classList.add('is-open')
      // 광고를 닫은 그 손짓이 곧바로 게이트까지 눌러버리면 멈춘 적이 없는 것과 같다
      const openedAt = performance.now()
      return new Promise<void>((resolve) => {
        release = () => {
          release = null
          root.removeEventListener('pointerdown', onTap)
          root.classList.remove('is-open')
          shell.resume()
          resolve()
        }
        const onTap = () => {
          if (performance.now() - openedAt < 300) return
          release?.()
        }
        root.addEventListener('pointerdown', onTap)
      })
    },
  }
}
