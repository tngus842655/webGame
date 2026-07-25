import { drawFruit } from '../fruitArt'
import { FRUIT_TIERS } from './config'

// 타일 하나를 그린다. 티어 1~10은 공용 과일 아트, 11~12는 전용 심볼.
export function drawTile(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  tier: number,
) {
  if (tier <= FRUIT_TIERS) {
    drawFruit(c, x, y, 0, tier - 1, r)
    return
  }
  if (tier === FRUIT_TIERS + 1) drawStar(c, x, y, r)
  else drawCrown(c, x, y, r)
}

function drawStar(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.save()
  c.translate(x, y)
  const grad = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r)
  grad.addColorStop(0, '#FFF9C4')
  grad.addColorStop(0.55, '#FFD54F')
  grad.addColorStop(1, '#F9A825')
  c.fillStyle = grad
  c.beginPath()
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    const radius = i % 2 === 0 ? r : r * 0.45
    const px = Math.cos(angle) * radius
    const py = Math.sin(angle) * radius
    if (i === 0) c.moveTo(px, py)
    else c.lineTo(px, py)
  }
  c.closePath()
  c.fill()
  c.strokeStyle = '#F57F17'
  c.lineWidth = Math.max(r * 0.06, 2)
  c.lineJoin = 'round'
  c.stroke()
  drawFace(c, r * 0.8, '#8D5A00')
  c.restore()
}

function drawCrown(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.save()
  c.translate(x, y)
  const grad = c.createLinearGradient(0, -r, 0, r)
  grad.addColorStop(0, '#FFF176')
  grad.addColorStop(0.5, '#FFC107')
  grad.addColorStop(1, '#E08600')
  c.fillStyle = grad
  c.beginPath()
  c.moveTo(-r * 0.9, r * 0.55)
  c.lineTo(-r * 0.75, -r * 0.5)
  c.lineTo(-r * 0.35, r * 0.02)
  c.lineTo(0, -r * 0.85)
  c.lineTo(r * 0.35, r * 0.02)
  c.lineTo(r * 0.75, -r * 0.5)
  c.lineTo(r * 0.9, r * 0.55)
  c.closePath()
  c.fill()
  c.strokeStyle = '#B26A00'
  c.lineWidth = Math.max(r * 0.06, 2)
  c.lineJoin = 'round'
  c.stroke()

  // 보석
  for (const [gx, color] of [[-0.45, '#EF5350'], [0, '#42A5F5'], [0.45, '#66BB6A']] as Array<[number, string]>) {
    c.fillStyle = color
    c.beginPath()
    c.arc(gx * r, r * 0.3, r * 0.11, 0, Math.PI * 2)
    c.fill()
  }
  c.restore()
}

function drawFace(c: CanvasRenderingContext2D, r: number, color: string) {
  const eyeR = Math.max(r * 0.09, 2)
  c.fillStyle = color
  c.beginPath()
  c.ellipse(-r * 0.26, -r * 0.05, eyeR * 0.85, eyeR * 1.15, 0, 0, Math.PI * 2)
  c.ellipse(r * 0.26, -r * 0.05, eyeR * 0.85, eyeR * 1.15, 0, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = color
  c.lineWidth = Math.max(r * 0.05, 1.5)
  c.lineCap = 'round'
  c.beginPath()
  c.arc(0, r * 0.18, r * 0.18, 0.2 * Math.PI, 0.8 * Math.PI)
  c.stroke()
}
