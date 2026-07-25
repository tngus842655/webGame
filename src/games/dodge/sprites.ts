import type { HazardKind } from './state'

// 낙하물·플레이어 벡터 아트

export function drawHazard(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  kind: HazardKind,
  spin: number,
) {
  c.save()
  c.translate(x, y)
  c.rotate(spin + y * 0.006)
  switch (kind) {
    case 'rock':
      chunk(c, r, '#90A4AE', '#607D8B', '#37474F', 7)
      break
    case 'ice':
      ice(c, r)
      break
    case 'log':
      log(c, r)
      break
    case 'anvil':
      anvil(c, r)
      break
    case 'meteor':
      meteor(c, r)
      break
  }
  c.restore()
}

// 각진 덩어리 (돌·얼음 공통 형태)
function chunk(
  c: CanvasRenderingContext2D,
  r: number,
  light: string,
  base: string,
  dark: string,
  sides: number,
) {
  const grad = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r)
  grad.addColorStop(0, light)
  grad.addColorStop(0.6, base)
  grad.addColorStop(1, dark)
  c.fillStyle = grad
  c.beginPath()
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2
    const rad = r * (0.82 + ((i * 37) % 10) / 40)
    const px = Math.cos(a) * rad
    const py = Math.sin(a) * rad
    if (i === 0) c.moveTo(px, py)
    else c.lineTo(px, py)
  }
  c.closePath()
  c.fill()
  c.strokeStyle = 'rgb(38 50 56 / 0.35)'
  c.lineWidth = 2
  c.stroke()
}

function ice(c: CanvasRenderingContext2D, r: number) {
  chunk(c, r, '#E1F5FE', '#81D4FA', '#0288D1', 6)
  c.save()
  c.globalAlpha = 0.65
  c.strokeStyle = '#FFFFFF'
  c.lineWidth = Math.max(r * 0.09, 2)
  c.lineCap = 'round'
  c.beginPath()
  c.moveTo(-r * 0.4, r * 0.2)
  c.lineTo(0, -r * 0.45)
  c.lineTo(r * 0.35, r * 0.1)
  c.stroke()
  c.restore()
}

function log(c: CanvasRenderingContext2D, r: number) {
  const w = r * 2.1
  const h = r * 1.05
  const grad = c.createLinearGradient(0, -h / 2, 0, h / 2)
  grad.addColorStop(0, '#A1785A')
  grad.addColorStop(1, '#6D4C31')
  c.fillStyle = grad
  c.beginPath()
  c.roundRect(-w / 2, -h / 2, w, h, h * 0.32)
  c.fill()
  // 나이테
  c.fillStyle = '#C89B72'
  c.beginPath()
  c.ellipse(-w / 2 + h * 0.28, 0, h * 0.26, h * 0.42, 0, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = '#8A6742'
  c.lineWidth = Math.max(r * 0.06, 1.5)
  c.beginPath()
  c.ellipse(-w / 2 + h * 0.28, 0, h * 0.13, h * 0.22, 0, 0, Math.PI * 2)
  c.stroke()
}

function anvil(c: CanvasRenderingContext2D, r: number) {
  const grad = c.createLinearGradient(0, -r, 0, r)
  grad.addColorStop(0, '#78909C')
  grad.addColorStop(1, '#37474F')
  c.fillStyle = grad
  c.beginPath()
  c.moveTo(-r * 0.95, -r * 0.55)
  c.lineTo(r * 0.95, -r * 0.55)
  c.lineTo(r * 0.55, -r * 0.05)
  c.lineTo(r * 0.4, r * 0.35)
  c.lineTo(r * 0.75, r * 0.72)
  c.lineTo(-r * 0.75, r * 0.72)
  c.lineTo(-r * 0.4, r * 0.35)
  c.lineTo(-r * 0.55, -r * 0.05)
  c.closePath()
  c.fill()
  c.fillStyle = 'rgb(255 255 255 / 0.3)'
  c.beginPath()
  c.roundRect(-r * 0.85, -r * 0.5, r * 1.7, r * 0.16, r * 0.08)
  c.fill()
}

function meteor(c: CanvasRenderingContext2D, r: number) {
  // 꼬리 (진행 방향 반대 = 위쪽)
  c.save()
  c.globalAlpha = 0.55
  const tail = c.createLinearGradient(0, -r * 3.2, 0, 0)
  tail.addColorStop(0, 'rgb(255 152 0 / 0)')
  tail.addColorStop(1, '#FF9800')
  c.fillStyle = tail
  c.beginPath()
  c.moveTo(-r * 0.55, 0)
  c.lineTo(0, -r * 3.2)
  c.lineTo(r * 0.55, 0)
  c.closePath()
  c.fill()
  c.restore()

  const grad = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r)
  grad.addColorStop(0, '#FFE082')
  grad.addColorStop(0.5, '#F4511E')
  grad.addColorStop(1, '#5D2A12')
  c.fillStyle = grad
  c.beginPath()
  c.arc(0, 0, r, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = 'rgb(0 0 0 / 0.25)'
  c.beginPath()
  c.arc(r * 0.3, r * 0.25, r * 0.2, 0, Math.PI * 2)
  c.arc(-r * 0.25, r * 0.35, r * 0.13, 0, Math.PI * 2)
  c.fill()
}

// 사람 형체 플레이어 — 달리는 다리, 팔, 머리
export function drawRunner(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  time: number,
  moving: number,
) {
  const swing = Math.sin(time * 12) * (0.4 + Math.abs(moving) * 0.6)
  const lean = Math.max(-0.28, Math.min(0.28, moving * 0.3))

  c.save()
  // 그림자
  c.fillStyle = 'rgb(0 0 0 / 0.16)'
  c.beginPath()
  c.ellipse(x, y + r * 1.35, r * 0.8, r * 0.22, 0, 0, Math.PI * 2)
  c.fill()

  c.translate(x, y)
  c.rotate(lean)

  // 다리
  c.strokeStyle = '#37474F'
  c.lineWidth = r * 0.26
  c.lineCap = 'round'
  for (const dir of [-1, 1]) {
    c.beginPath()
    c.moveTo(0, r * 0.35)
    c.lineTo(dir * swing * r * 0.7, r * 1.25)
    c.stroke()
  }

  // 몸통
  const body = c.createLinearGradient(0, -r * 0.4, 0, r * 0.5)
  body.addColorStop(0, '#64B5F6')
  body.addColorStop(1, '#1565C0')
  c.fillStyle = body
  c.beginPath()
  c.roundRect(-r * 0.42, -r * 0.35, r * 0.84, r * 0.85, r * 0.3)
  c.fill()

  // 팔
  c.strokeStyle = '#1565C0'
  c.lineWidth = r * 0.2
  for (const dir of [-1, 1]) {
    c.beginPath()
    c.moveTo(dir * r * 0.36, -r * 0.15)
    c.lineTo(dir * r * 0.78, r * 0.2 - dir * swing * r * 0.35)
    c.stroke()
  }

  // 머리
  c.fillStyle = '#FFCC9E'
  c.beginPath()
  c.arc(0, -r * 0.72, r * 0.36, 0, Math.PI * 2)
  c.fill()
  // 머리카락
  c.fillStyle = '#4E342E'
  c.beginPath()
  c.arc(0, -r * 0.82, r * 0.37, Math.PI * 1.05, Math.PI * 2.05)
  c.fill()
  // 눈
  c.fillStyle = '#3E2723'
  c.beginPath()
  c.arc(-r * 0.13, -r * 0.68, r * 0.06, 0, Math.PI * 2)
  c.arc(r * 0.13, -r * 0.68, r * 0.06, 0, Math.PI * 2)
  c.fill()

  c.restore()
}
