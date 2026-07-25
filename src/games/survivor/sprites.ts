// 서바이버 캐릭터·적·투사체 벡터 아트

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
