import './ui.css'

// 캔버스 글씨체 — ui.css의 .gui-scrim과 같은 스택이다. 한쪽만 고치지 말 것.
// ui-rounded는 iOS에서 SF Pro Rounded로 잡히고, 나머지 기기는 시스템 고딕으로 내려간다.
const UI_FONT =
  "ui-rounded, 'SF Pro Rounded', system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif"

export function font(size: number, bold = false): string {
  return `${bold ? 'bold ' : ''}${size}px ${UI_FONT}`
}

// 상단 점수판 — 게임마다 위치(y 18~40)·투명도(0.09~0.94)·글자 크기(44~54)가
// 조금씩 달라 게임을 옮겨 다닐 때 숫자가 흔들려 보였다. 하나로 맞춘다.
// 아랫줄(sub)이 있으면 판이 그만큼 길어지고, 그 줄은 게임이 SCORE_PANEL.subY에 그린다.
export const SCORE_PANEL = {
  x: 140,
  y: 22,
  w: 440,
  cx: 360,
  labelY: 58,
  valueY: 114,
  subY: 152,
  // 아랫줄을 좌우로 붙일 때 쓰는 안쪽 여백
  left: 176,
  right: 544,
} as const

export interface ScorePanelOptions {
  label: string
  value: string
  // 판 안에 아랫줄을 그릴 때 true — 판이 길어진다
  sub?: boolean
  // 낙하물처럼 위에서 내려오는 것을 가리면 안 되거나 판이 고정된 게임은 좁게.
  // 글자 자리(labelY·valueY)는 그대로라 게임을 옮겨 다녀도 숫자 높이는 같다.
  compact?: boolean
  // 밝은 배경 위에 놓는 게임은 불투명한 흰 판에 게임 팔레트 색을 쓴다
  panelColor?: string
  labelColor?: string
  valueColor?: string
}

export function drawScorePanel(c: CanvasRenderingContext2D, o: ScorePanelOptions) {
  const { y, w, cx, labelY, valueY } = SCORE_PANEL
  const panelW = o.compact ? 260 : w
  c.save()
  c.fillStyle = o.panelColor ?? 'rgb(255 255 255 / 0.1)'
  c.beginPath()
  c.roundRect(cx - panelW / 2, y, panelW, o.sub ? 150 : 118, 26)
  c.fill()
  c.restore()
  c.textAlign = 'center'
  c.textBaseline = 'alphabetic'
  c.fillStyle = o.labelColor ?? 'rgb(255 255 255 / 0.5)'
  c.font = font(18)
  c.fillText(o.label, cx, labelY)
  c.fillStyle = o.valueColor ?? '#FFFFFF'
  c.font = font(50, true)
  c.fillText(o.value, cx, valueY)
}

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
