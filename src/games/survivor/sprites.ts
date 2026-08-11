// 서바이버 캐릭터·적·투사체·아이템 벡터 아트

import type { ItemKind } from './state'

// 체력 하트. HUD 하트 줄과 강화 아이콘, 회복 아이템이 같은 그림을 쓴다
export function drawHeart(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  filled: boolean,
) {
  c.save()
  c.translate(x, y)
  c.beginPath()
  c.moveTo(0, r * 0.75)
  c.bezierCurveTo(-r * 1.4, -r * 0.3, -r * 0.5, -r * 1.2, 0, -r * 0.4)
  c.bezierCurveTo(r * 0.5, -r * 1.2, r * 1.4, -r * 0.3, 0, r * 0.75)
  c.closePath()
  if (filled) {
    c.fillStyle = '#E53935'
    c.fill()
    c.strokeStyle = '#9B1B18'
  } else {
    c.fillStyle = 'rgb(141 110 99 / 0.18)'
    c.fill()
    c.strokeStyle = 'rgb(141 110 99 / 0.35)'
  }
  c.lineWidth = 2
  c.stroke()
  c.restore()
}

// 바닥에 떨어진 아이템. 셋이 같은 받침을 쓰고 속 그림으로만 갈린다 —
// 멀리서도 "주울 것"이라는 것부터 읽혀야 한다
export function drawItem(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: ItemKind,
  life: number,
  phase: number,
) {
  // 사라지기 전 3초는 깜빡인다
  if (life < 3 && Math.floor(life * 6) % 2 === 0) return
  const bob = Math.sin(phase) * 3

  c.save()
  c.translate(x, y)

  // 여기 있다고 알리는 물결
  const ripple = (phase / 6) % 1
  c.globalAlpha = 0.3 * (1 - ripple)
  c.strokeStyle = '#FFB300'
  c.lineWidth = 3
  c.beginPath()
  c.arc(0, 0, 22 + ripple * 20, 0, Math.PI * 2)
  c.stroke()
  c.globalAlpha = 1

  c.fillStyle = 'rgb(93 64 55 / 0.18)'
  c.beginPath()
  c.ellipse(0, 25, 15, 5, 0, 0, Math.PI * 2)
  c.fill()

  c.translate(0, bob)
  c.fillStyle = '#FFF3E0'
  c.strokeStyle = '#6D4C41'
  c.lineWidth = 3
  c.beginPath()
  c.arc(0, 0, 21, 0, Math.PI * 2)
  c.fill()
  c.stroke()

  if (kind === 'heal') {
    drawHeart(c, 0, 1, 12, true)
  } else if (kind === 'rapid') {
    c.fillStyle = '#F9A825'
    c.beginPath()
    c.moveTo(3, -14)
    c.lineTo(-9, 2)
    c.lineTo(-1, 2)
    c.lineTo(-3, 14)
    c.lineTo(9, -2)
    c.lineTo(1, -2)
    c.closePath()
    c.fill()
  } else {
    // 폭탄 — 심지에 불이 붙어 있다
    c.strokeStyle = '#8D6E63'
    c.lineWidth = 3
    c.beginPath()
    c.moveTo(4, -8)
    c.quadraticCurveTo(11, -13, 9, -18)
    c.stroke()
    c.fillStyle = '#FF7043'
    c.beginPath()
    c.arc(9, -19, 3.2, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#37474F'
    c.beginPath()
    c.arc(-1, 3, 11, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = 'rgb(255 255 255 / 0.35)'
    c.beginPath()
    c.arc(-5, -1, 3.2, 0, Math.PI * 2)
    c.fill()
  }

  c.restore()
}

export function drawHero(c: CanvasRenderingContext2D, x: number, y: number, r: number, faceDir: number) {
  c.save()
  c.translate(x, y)

  // 그림자
  c.fillStyle = 'rgb(93 64 55 / 0.18)'
  c.beginPath()
  c.ellipse(0, r * 0.95, r * 0.8, r * 0.28, 0, 0, Math.PI * 2)
  c.fill()

  // 망토
  c.fillStyle = '#1565C0'
  c.beginPath()
  c.ellipse(0, r * 0.15, r * 0.95, r * 0.85, 0, 0, Math.PI * 2)
  c.fill()

  // 몸통
  const body = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r)
  body.addColorStop(0, '#8ECAFF')
  body.addColorStop(0.55, '#42A5F5')
  body.addColorStop(1, '#1B6BB5')
  c.fillStyle = body
  c.beginPath()
  c.arc(0, 0, r * 0.86, 0, Math.PI * 2)
  c.fill()

  // 얼굴
  const eyeX = r * 0.28
  const look = Math.max(-1, Math.min(1, faceDir)) * r * 0.08
  c.fillStyle = '#0D2C45'
  c.beginPath()
  c.ellipse(-eyeX + look, -r * 0.12, r * 0.1, r * 0.14, 0, 0, Math.PI * 2)
  c.ellipse(eyeX + look, -r * 0.12, r * 0.1, r * 0.14, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#FFFFFF'
  c.beginPath()
  c.arc(-eyeX + look + r * 0.04, -r * 0.18, r * 0.04, 0, Math.PI * 2)
  c.arc(eyeX + look + r * 0.04, -r * 0.18, r * 0.04, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = '#0D2C45'
  c.lineWidth = Math.max(r * 0.06, 1.5)
  c.lineCap = 'round'
  c.beginPath()
  c.arc(0, r * 0.14, r * 0.2, 0.2 * Math.PI, 0.8 * Math.PI)
  c.stroke()

  c.restore()
}

export function drawEnemy(c: CanvasRenderingContext2D, x: number, y: number, r: number, hp: number) {
  c.save()
  c.translate(x, y)

  c.fillStyle = 'rgb(93 64 55 / 0.16)'
  c.beginPath()
  c.ellipse(0, r * 0.92, r * 0.72, r * 0.24, 0, 0, Math.PI * 2)
  c.fill()

  // 체력이 높을수록 짙은 색
  const tough = Math.min(1, (hp - 1) / 5)
  const light = tough > 0.5 ? '#FFB3A7' : '#FF9E93'
  const base = tough > 0.5 ? '#C62828' : '#EF5350'
  const dark = tough > 0.5 ? '#7B1010' : '#9B1F1F'

  const body = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r)
  body.addColorStop(0, light)
  body.addColorStop(0.5, base)
  body.addColorStop(1, dark)
  c.fillStyle = body
  c.beginPath()
  c.arc(0, 0, r, 0, Math.PI * 2)
  c.fill()

  // 뿔
  c.fillStyle = dark
  for (const dir of [-1, 1]) {
    c.beginPath()
    c.moveTo(dir * r * 0.45, -r * 0.72)
    c.lineTo(dir * r * 0.78, -r * 1.25)
    c.lineTo(dir * r * 0.2, -r * 0.95)
    c.closePath()
    c.fill()
  }

  // 사나운 눈
  c.fillStyle = '#FFF3E0'
  c.beginPath()
  c.ellipse(-r * 0.3, -r * 0.1, r * 0.2, r * 0.15, 0.35, 0, Math.PI * 2)
  c.ellipse(r * 0.3, -r * 0.1, r * 0.2, r * 0.15, -0.35, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#3E0A0A'
  c.beginPath()
  c.arc(-r * 0.28, -r * 0.08, r * 0.09, 0, Math.PI * 2)
  c.arc(r * 0.28, -r * 0.08, r * 0.09, 0, Math.PI * 2)
  c.fill()

  c.restore()
}

export function drawBullet(c: CanvasRenderingContext2D, x: number, y: number) {
  c.save()
  c.globalAlpha = 0.3
  c.fillStyle = '#FFD54F'
  c.beginPath()
  c.arc(x, y, 13, 0, Math.PI * 2)
  c.fill()
  c.globalAlpha = 1
  const grad = c.createRadialGradient(x - 2, y - 2, 1, x, y, 7)
  grad.addColorStop(0, '#FFFDE7')
  grad.addColorStop(1, '#FFA000')
  c.fillStyle = grad
  c.beginPath()
  c.arc(x, y, 7, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

export function drawOrb(c: CanvasRenderingContext2D, x: number, y: number, phase: number) {
  const pulse = 1 + Math.sin(phase) * 0.12
  c.save()
  c.globalAlpha = 0.35
  c.fillStyle = '#66BB6A'
  c.beginPath()
  c.arc(x, y, 15 * pulse, 0, Math.PI * 2)
  c.fill()
  c.globalAlpha = 1
  const grad = c.createRadialGradient(x - 2, y - 3, 1, x, y, 9 * pulse)
  grad.addColorStop(0, '#E8F5E9')
  grad.addColorStop(0.5, '#66BB6A')
  grad.addColorStop(1, '#2E7D32')
  c.fillStyle = grad
  c.beginPath()
  c.arc(x, y, 9 * pulse, 0, Math.PI * 2)
  c.fill()
  c.restore()
}
