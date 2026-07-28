// 머지 가든 아이템 벡터 아트 — 12단계 식물 성장 (이모지 대체)

type Draw = (c: CanvasRenderingContext2D, r: number) => void

const POT = '#B5734A'
const POT_DARK = '#8A5433'
const LEAF = '#4CAF50'
const LEAF_DARK = '#2E7D32'
const STEM = '#5D9C4A'

export function drawPlant(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  level: number,
) {
  c.save()
  c.translate(x, y)
  // 바닥 그림자
  c.fillStyle = 'rgb(93 64 55 / 0.14)'
  c.beginPath()
  c.ellipse(0, r * 0.86, r * 0.62, r * 0.16, 0, 0, Math.PI * 2)
  c.fill()

  const draw = LEVELS[Math.min(LEVELS.length, Math.max(1, level)) - 1]
  draw(c, r)
  c.restore()
}

function stem(c: CanvasRenderingContext2D, r: number, height: number) {
  c.strokeStyle = STEM
  c.lineWidth = Math.max(r * 0.09, 2)
  c.lineCap = 'round'
  c.beginPath()
  c.moveTo(0, r * 0.7)
  c.lineTo(0, r * (0.7 - height))
  c.stroke()
}

function leaf(c: CanvasRenderingContext2D, r: number, dx: number, dy: number, size: number, flip: number) {
  c.save()
  c.translate(dx * r, dy * r)
  c.rotate(flip * 0.5)
  const grad = c.createLinearGradient(0, -size * r, 0, size * r)
  grad.addColorStop(0, LEAF)
  grad.addColorStop(1, LEAF_DARK)
  c.fillStyle = grad
  c.beginPath()
  c.ellipse(flip * size * r * 0.7, 0, size * r, size * r * 0.45, flip * 0.4, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

function pot(c: CanvasRenderingContext2D, r: number) {
  c.fillStyle = POT_DARK
  c.beginPath()
  c.roundRect(-r * 0.5, r * 0.3, r, r * 0.55, r * 0.12)
  c.fill()
  c.fillStyle = POT
  c.beginPath()
  c.roundRect(-r * 0.54, r * 0.2, r * 1.08, r * 0.24, r * 0.1)
  c.fill()
}

function bloom(c: CanvasRenderingContext2D, r: number, y: number, size: number, petal: string, core: string, count = 5) {
  c.save()
  c.translate(0, y * r)
  c.fillStyle = petal
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    c.beginPath()
    c.ellipse(Math.cos(a) * size * r * 0.62, Math.sin(a) * size * r * 0.62, size * r * 0.42, size * r * 0.32, a, 0, Math.PI * 2)
    c.fill()
  }
  c.fillStyle = core
  c.beginPath()
  c.arc(0, 0, size * r * 0.34, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

const LEVELS: Draw[] = [
  // 1 씨앗
  (c, r) => {
    c.fillStyle = '#8D6E63'
    c.beginPath()
    c.ellipse(0, r * 0.35, r * 0.3, r * 0.4, 0.3, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = 'rgb(255 255 255 / 0.35)'
    c.beginPath()
    c.ellipse(-r * 0.1, r * 0.2, r * 0.1, r * 0.14, 0.3, 0, Math.PI * 2)
    c.fill()
  },
  // 2 새싹
  (c, r) => {
    stem(c, r, 0.5)
    leaf(c, r, 0, 0.28, 0.3, -1)
    leaf(c, r, 0, 0.34, 0.26, 1)
  },
  // 3 어린잎
  (c, r) => {
    stem(c, r, 0.85)
    leaf(c, r, 0, 0.1, 0.36, -1)
    leaf(c, r, 0, 0.3, 0.32, 1)
    leaf(c, r, 0, -0.12, 0.28, -1)
  },
  // 4 클로버
  (c, r) => {
    stem(c, r, 0.7)
    c.fillStyle = LEAF
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4
      c.beginPath()
      c.ellipse(Math.cos(a) * r * 0.3, -r * 0.15 + Math.sin(a) * r * 0.3, r * 0.26, r * 0.26, 0, 0, Math.PI * 2)
      c.fill()
    }
  },
  // 5 튤립
  (c, r) => {
    stem(c, r, 0.8)
    leaf(c, r, 0, 0.3, 0.3, 1)
    c.fillStyle = '#EC407A'
    c.beginPath()
    c.moveTo(-r * 0.3, -r * 0.1)
    c.quadraticCurveTo(-r * 0.34, -r * 0.62, 0, -r * 0.5)
    c.quadraticCurveTo(r * 0.34, -r * 0.62, r * 0.3, -r * 0.1)
    c.quadraticCurveTo(0, r * 0.1, -r * 0.3, -r * 0.1)
    c.fill()
  },
  // 6 장미
  (c, r) => {
    stem(c, r, 0.75)
    leaf(c, r, 0, 0.32, 0.28, -1)
    bloom(c, r, -0.2, 0.85, '#E53935', '#B71C1C', 6)
  },
  // 7 해바라기
  (c, r) => {
    stem(c, r, 0.8)
    leaf(c, r, 0, 0.3, 0.3, 1)
    bloom(c, r, -0.22, 0.95, '#FFC107', '#6D4C41', 9)
  },
  // 8 화분 나무
  (c, r) => {
    pot(c, r)
    c.strokeStyle = '#795548'
    c.lineWidth = Math.max(r * 0.12, 3)
    c.beginPath()
    c.moveTo(0, r * 0.24)
    c.lineTo(0, -r * 0.2)
    c.stroke()
    c.fillStyle = LEAF
    c.beginPath()
    c.arc(0, -r * 0.42, r * 0.46, 0, Math.PI * 2)
    c.arc(-r * 0.32, -r * 0.2, r * 0.3, 0, Math.PI * 2)
    c.arc(r * 0.32, -r * 0.2, r * 0.3, 0, Math.PI * 2)
    c.fill()
  },
  // 9 열매 나무
  (c, r) => {
    pot(c, r)
    c.strokeStyle = '#795548'
    c.lineWidth = Math.max(r * 0.12, 3)
    c.beginPath()
    c.moveTo(0, r * 0.24)
    c.lineTo(0, -r * 0.2)
    c.stroke()
    c.fillStyle = LEAF_DARK
    c.beginPath()
    c.arc(0, -r * 0.45, r * 0.5, 0, Math.PI * 2)
    c.arc(-r * 0.34, -r * 0.2, r * 0.32, 0, Math.PI * 2)
    c.arc(r * 0.34, -r * 0.2, r * 0.32, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#EF5350'
    for (const [fx, fy] of [[-0.3, -0.5], [0.24, -0.62], [0.1, -0.24]] as Array<[number, number]>) {
      c.beginPath()
      c.arc(fx * r, fy * r, r * 0.11, 0, Math.PI * 2)
      c.fill()
    }
  },
  // 10 벚나무
  (c, r) => {
    pot(c, r)
    c.strokeStyle = '#6D4C41'
    c.lineWidth = Math.max(r * 0.13, 3)
    c.beginPath()
    c.moveTo(0, r * 0.24)
    c.lineTo(0, -r * 0.18)
    c.stroke()
    c.fillStyle = '#F8BBD0'
    c.beginPath()
    c.arc(0, -r * 0.46, r * 0.5, 0, Math.PI * 2)
    c.arc(-r * 0.36, -r * 0.2, r * 0.32, 0, Math.PI * 2)
    c.arc(r * 0.36, -r * 0.2, r * 0.32, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#F06292'
    for (const [fx, fy] of [[-0.26, -0.52], [0.2, -0.58], [0, -0.3]] as Array<[number, number]>) {
      c.beginPath()
      c.arc(fx * r, fy * r, r * 0.09, 0, Math.PI * 2)
      c.fill()
    }
  },
  // 11 무지개 꽃
  (c, r) => {
    stem(c, r, 0.75)
    leaf(c, r, 0, 0.32, 0.28, -1)
    const colors = ['#EF5350', '#FFA726', '#FFEE58', '#66BB6A', '#42A5F5', '#AB47BC']
    c.save()
    c.translate(0, -r * 0.22)
    for (let i = 0; i < colors.length; i++) {
      const a = (i / colors.length) * Math.PI * 2
      c.fillStyle = colors[i]
      c.beginPath()
      c.ellipse(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.34, r * 0.26, a, 0, Math.PI * 2)
      c.fill()
    }
    c.fillStyle = '#FFF9C4'
    c.beginPath()
    c.arc(0, 0, r * 0.26, 0, Math.PI * 2)
    c.fill()
    c.restore()
  },
  // 12 황금 화분 — 이름 그대로 화분이 주인공. 꽃은 장식으로만 얹는다
  (c, r) => {
    // 몸통: 아래로 좁아지는 사다리꼴 + 금속 그라데이션(왼쪽 광원)
    const body = c.createLinearGradient(-r * 0.6, 0, r * 0.6, 0)
    body.addColorStop(0, '#8D6E00')
    body.addColorStop(0.28, '#FFE082')
    body.addColorStop(0.55, '#FFC107')
    body.addColorStop(1, '#7A5D00')
    c.fillStyle = body
    c.beginPath()
    c.moveTo(-r * 0.5, -r * 0.02)
    c.lineTo(r * 0.5, -r * 0.02)
    c.lineTo(r * 0.34, r * 0.74)
    c.lineTo(-r * 0.34, r * 0.74)
    c.closePath()
    c.fill()

    // 테두리(림) — 화분임을 한눈에 알리는 요소
    const rim = c.createLinearGradient(0, -r * 0.26, 0, r * 0.02)
    rim.addColorStop(0, '#FFF8E1')
    rim.addColorStop(0.5, '#FFD54F')
    rim.addColorStop(1, '#C79100')
    c.fillStyle = rim
    c.beginPath()
    c.roundRect(-r * 0.6, -r * 0.24, r * 1.2, r * 0.26, r * 0.09)
    c.fill()

    // 몸통 하이라이트 + 굽
    c.fillStyle = 'rgb(255 255 255 / 0.5)'
    c.beginPath()
    c.ellipse(-r * 0.2, r * 0.3, r * 0.07, r * 0.26, 0.06, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#C79100'
    c.beginPath()
    c.roundRect(-r * 0.4, r * 0.68, r * 0.8, r * 0.12, r * 0.05)
    c.fill()

    // 화분 위로 살짝 보이는 금빛 꽃 (작게)
    c.strokeStyle = '#C79100'
    c.lineWidth = Math.max(r * 0.07, 2)
    c.beginPath()
    c.moveTo(0, -r * 0.2)
    c.lineTo(0, -r * 0.42)
    c.stroke()
    bloom(c, r, -0.56, 0.5, '#FFD54F', '#FF8F00', 6)

    // 반짝임
    c.fillStyle = '#FFFDE7'
    for (const [sx, sy, ss] of [[-0.62, -0.5, 0.1], [0.6, -0.62, 0.08], [0.5, 0.02, 0.06]] as Array<[number, number, number]>) {
      c.save()
      c.translate(sx * r, sy * r)
      c.beginPath()
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        const rad = i % 2 === 0 ? ss * r * 2.2 : ss * r * 0.8
        const px = Math.cos(a) * rad
        const py = Math.sin(a) * rad
        if (i === 0) c.moveTo(px, py)
        else c.lineTo(px, py)
      }
      c.closePath()
      c.fill()
      c.restore()
    }
  },
]
