import { COLORS, type BlockColor } from './config'

// 블록 벡터 아트 — 입체감 있는 캔디 블록. 셀 하나를 정사각 영역(px, py, size)에 그린다.

export function drawBlock(
  c: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  colorIndex: number,
) {
  const color = COLORS[colorIndex] ?? COLORS[0]
  paintBlock(c, px, py, size, color)
}

function paintBlock(
  c: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
  color: BlockColor,
) {
  const gap = size * 0.06
  const x = px + gap
  const y = py + gap
  const w = size - gap * 2
  const r = w * 0.22

  // 바닥 그림자 (두께감)
  c.fillStyle = color.dark
  c.beginPath()
  c.roundRect(x, y + w * 0.08, w, w * 0.92, r)
  c.fill()

  // 본체
  const body = c.createLinearGradient(x, y, x, y + w)
  body.addColorStop(0, color.light)
  body.addColorStop(0.45, color.base)
  body.addColorStop(1, color.base)
  c.fillStyle = body
  c.beginPath()
  c.roundRect(x, y, w, w * 0.92, r)
  c.fill()

  // 윗면 광택
  c.save()
  c.beginPath()
  c.roundRect(x, y, w, w * 0.92, r)
  c.clip()
  c.globalAlpha = 0.5
  c.fillStyle = '#FFFFFF'
  c.beginPath()
  c.roundRect(x + w * 0.14, y + w * 0.1, w * 0.72, w * 0.2, w * 0.1)
  c.fill()
  c.restore()

  // 안쪽 테두리
  c.strokeStyle = 'rgb(255 255 255 / 0.35)'
  c.lineWidth = Math.max(size * 0.02, 1)
  c.beginPath()
  c.roundRect(x + c.lineWidth, y + c.lineWidth, w - c.lineWidth * 2, w * 0.92 - c.lineWidth * 2, r * 0.85)
  c.stroke()
}

// 빈 칸 — 살짝 파인 홈
export function drawEmptyCell(
  c: CanvasRenderingContext2D,
  px: number,
  py: number,
  size: number,
) {
  const gap = size * 0.06
  const x = px + gap
  const y = py + gap
  const w = size - gap * 2
  const r = w * 0.22

  c.fillStyle = 'rgb(93 64 55 / 0.09)'
  c.beginPath()
  c.roundRect(x, y, w, w, r)
  c.fill()
  c.strokeStyle = 'rgb(93 64 55 / 0.06)'
  c.lineWidth = Math.max(size * 0.02, 1)
  c.beginPath()
  c.roundRect(x, y, w, w * 0.5, r)
  c.stroke()
}
