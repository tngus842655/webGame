import { t } from '@/shared/i18n'
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

// 점수판 머리줄에 함께 그릴 최고 기록. 예전에는 화면 맨 위에 따로 칩을 띄웠는데,
// 캔버스는 레터박스로 가운데 정렬이라 세로가 짧은 기기에서는 점수판이 그 칩 밑까지
// 올라와 현재 점수가 가려졌다. 한 카드에 넣으면 화면 비율과 무관하게 겹칠 자리가 없다.
// 값은 플레이 화면이 채워 넣는다 — 게임 30여 개가 저마다 기록을 챙기지 않도록.
let hudBest: number | null = null
let hudLive = 0

export function setHudBest(best: number | null, live: number) {
  // 0점 기록은 없는 것과 같다 ("최고 0"은 보여줄 값이 아니다)
  hudBest = best !== null && best > 0 ? best : null
  hudLive = live
}

// 머리줄에 덧붙일 최고 기록. 기록이 없으면 빈 문자열 — 라벨만 그대로 둔다.
// 넘어선 뒤에는 이미 지나친 숫자 대신 '신기록'을 띄운다. 방금 깬 기록보다
// 깼다는 사실이 다음 판을 부르고, 큰 숫자와 따로 노는 숫자도 안 생긴다.
function bestHead(): { text: string; record: boolean } {
  if (hudBest === null) return { text: '', record: false }
  if (hudLive > hudBest) return { text: t('over.newRecord'), record: true }
  return { text: t('hud.best', { n: hudBest.toLocaleString() }), record: false }
}

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
  // 머리줄 = 라벨 + 최고 기록. 기록을 넘어선 동안에는 줄 전체가 점수 색으로 굵어진다 —
  // 넘어서는 순간이 눈에 걸려야 "한 판 더"가 나온다.
  const valueColor = o.valueColor ?? '#FFFFFF'
  const head = bestHead()
  const line = head.text === '' ? o.label : `${o.label}  ·  ${head.text}`
  c.fillStyle = head.record ? valueColor : (o.labelColor ?? 'rgb(255 255 255 / 0.5)')
  c.font = font(18, head.record)
  // 라벨에 진행 상황을 담는 게임(서바이버)과 긴 번역이 만나면 줄이 판 밖으로 나간다
  const over = c.measureText(line).width / (panelW - 36)
  if (over > 1) c.font = font(Math.max(13, Math.floor(18 / over)), head.record)
  c.fillText(line, cx, labelY)
  c.fillStyle = valueColor
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
