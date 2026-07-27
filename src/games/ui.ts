import './ui.css'

// 게임 위에 뜨는 팝업(게임오버·클리어 보너스)이 함께 쓰는 껍데기.
// 생김새는 ui.css에 있고, 여기서는 만들고 열고 닫는 일만 한다.
export interface Sheet {
  find<T extends HTMLElement>(selector: string): T | null
  open(): void
  close(): void
}

export function createSheet(parent: HTMLElement, innerHtml: string): Sheet {
  const root = document.createElement('div')
  root.className = 'gui-scrim'
  root.innerHTML = `<div class="gui-sheet">${innerHtml}</div>`
  parent.appendChild(root)

  return {
    find<T extends HTMLElement>(selector: string) {
      return root.querySelector<T>(selector)
    },
    open() {
      root.classList.add('is-open')
    },
    close() {
      root.classList.remove('is-open')
    },
  }
}

// 결과 점수를 0에서 굴려 올린다. 팝업을 닫을 때 끊으려고 취소 함수를 돌려준다.
export function countUp(el: HTMLElement, to: number, ms = 620): () => void {
  const settle = () => {
    el.textContent = to.toLocaleString()
  }
  if (to <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    settle()
    return () => {}
  }
  let raf = 0
  const start = performance.now()
  const tick = (now: number) => {
    const k = Math.min(1, (now - start) / ms)
    if (k >= 1) {
      settle()
      return
    }
    el.textContent = Math.round(to * (1 - (1 - k) ** 3)).toLocaleString()
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}
