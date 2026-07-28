import type { CardId } from './state'

// 카드 그림 8종. 카드 이름은 13개 언어를 채워야 해서 작은 손패에서는 끝까지
// 읽히지 않는다 — 먼저 읽히는 건 그림이고 이름은 확인용이다. 그래서 여덟 장이
// 색이 아니라 실루엣으로 갈려야 한다.
//
// 각 그림은 (0,0)을 중심으로 한 [-1,1] 상자 안에 그려두고 drawCardArt가 확대한다.
// 광원은 왼쪽 위 — 왼쪽 면이 밝고 오른쪽 아래가 어둡다. (icons.ts와 같은 규칙)

const STEEL = '#CFD8DC'
const STEEL_DARK = '#78909C'
const WOOD = '#8D6E63'
const WOOD_DARK = '#5D4037'
const GOLD = '#FFCA28'

function blade(c: CanvasRenderingContext2D, len: number, halfW: number) {
  c.beginPath()
  c.moveTo(0, -len)
  c.lineTo(halfW, -len + halfW * 1.6)
  c.lineTo(halfW, 0.1)
  c.lineTo(-halfW, 0.1)
  c.lineTo(-halfW, -len + halfW * 1.6)
  c.closePath()
  c.fillStyle = STEEL
  c.fill()
  // 날의 등 — 빛을 받는 쪽
  c.beginPath()
  c.moveTo(-halfW * 0.35, -len + halfW * 1.2)
  c.lineTo(halfW * 0.15, -len + halfW * 1.8)
  c.lineTo(halfW * 0.15, 0.1)
  c.lineTo(-halfW * 0.35, 0.1)
  c.closePath()
  c.fillStyle = 'rgb(255 255 255 / 0.75)'
  c.fill()
}

function hilt(c: CanvasRenderingContext2D, guardW: number) {
  c.fillStyle = GOLD
  c.beginPath()
  c.roundRect(-guardW, 0.02, guardW * 2, 0.18, 0.08)
  c.fill()
  c.fillStyle = WOOD
  c.beginPath()
  c.roundRect(-0.13, 0.2, 0.26, 0.52, 0.1)
  c.fill()
  c.fillStyle = GOLD
  c.beginPath()
  c.arc(0, 0.8, 0.16, 0, Math.PI * 2)
  c.fill()
}

function drawShape(c: CanvasRenderingContext2D, id: CardId) {
  switch (id) {
    // 짧은 검 한 자루
    case 'strike': {
      c.translate(0, 0.1)
      blade(c, 1.05, 0.19)
      hilt(c, 0.42)
      break
    }
    // 둥근 방패 — 가운데 보스가 튀어나와 있다
    case 'defend': {
      c.beginPath()
      c.moveTo(0, -1)
      c.quadraticCurveTo(0.92, -0.82, 0.86, 0.02)
      c.quadraticCurveTo(0.78, 0.74, 0, 1.02)
      c.quadraticCurveTo(-0.78, 0.74, -0.86, 0.02)
      c.quadraticCurveTo(-0.92, -0.82, 0, -1)
      c.closePath()
      c.fillStyle = '#5C89C4'
      c.fill()
      c.save()
      c.clip()
      c.fillStyle = 'rgb(255 255 255 / 0.28)'
      c.beginPath()
      c.moveTo(-1.1, -1.1)
      c.lineTo(0.1, -1.1)
      c.lineTo(-0.5, 1.1)
      c.lineTo(-1.1, 1.1)
      c.closePath()
      c.fill()
      c.restore()
      c.strokeStyle = '#2F4F7A'
      c.lineWidth = 0.12
      c.stroke()
      c.fillStyle = STEEL
      c.beginPath()
      c.arc(0, -0.02, 0.26, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = 'rgb(255 255 255 / 0.7)'
      c.beginPath()
      c.arc(-0.09, -0.11, 0.1, 0, Math.PI * 2)
      c.fill()
      break
    }
    // 양손 망치 — 머리가 크고 자루가 길다
    case 'bash': {
      c.fillStyle = WOOD
      c.beginPath()
      c.roundRect(-0.11, -0.3, 0.22, 1.3, 0.1)
      c.fill()
      c.fillStyle = WOOD_DARK
      c.beginPath()
      c.roundRect(0.02, -0.3, 0.09, 1.3, 0.05)
      c.fill()
      c.fillStyle = STEEL_DARK
      c.beginPath()
      c.roundRect(-0.74, -0.94, 1.48, 0.66, 0.14)
      c.fill()
      c.fillStyle = STEEL
      c.beginPath()
      c.roundRect(-0.74, -0.94, 1.48, 0.34, 0.14)
      c.fill()
      c.fillStyle = 'rgb(255 255 255 / 0.55)'
      c.beginPath()
      c.roundRect(-0.66, -0.86, 0.5, 0.16, 0.08)
      c.fill()
      break
    }
    // 교차한 단검 두 자루 — 두 번 때린다는 게 개수로 보인다
    case 'flurry': {
      for (const dir of [-1, 1]) {
        c.save()
        c.translate(dir * 0.3, 0.14)
        c.rotate(dir * 0.42)
        c.scale(0.78, 0.78)
        blade(c, 1.05, 0.17)
        hilt(c, 0.34)
        c.restore()
      }
      break
    }
    // 돌벽 — 벽돌을 어긋나게 쌓아 두께를 보인다
    case 'wall': {
      const rows = [-0.78, -0.26, 0.26]
      c.fillStyle = '#8A99A6'
      c.beginPath()
      c.roundRect(-0.95, -0.86, 1.9, 1.66, 0.1)
      c.fill()
      c.strokeStyle = '#5C6B75'
      c.lineWidth = 0.07
      c.lineCap = 'round'
      for (const y of rows) {
        c.beginPath()
        c.moveTo(-0.95, y + 0.52)
        c.lineTo(0.95, y + 0.52)
        c.stroke()
      }
      for (let i = 0; i < 3; i++) {
        const y = rows[i]
        const off = i % 2 === 0 ? 0 : 0.48
        for (const x of [-0.47 + off, 0.49 + off]) {
          if (x > 0.9) continue
          c.beginPath()
          c.moveTo(x, y)
          c.lineTo(x, y + 0.52)
          c.stroke()
        }
      }
      c.fillStyle = 'rgb(255 255 255 / 0.3)'
      c.beginPath()
      c.roundRect(-0.95, -0.86, 1.9, 0.2, 0.08)
      c.fill()
      break
    }
    // 흡혈 — 검을 타고 붉은 방울이 위로 빨려 올라간다
    case 'drain': {
      c.save()
      c.translate(-0.16, 0.12)
      c.scale(0.86, 0.86)
      blade(c, 1.05, 0.18)
      hilt(c, 0.38)
      c.restore()
      c.fillStyle = '#E53935'
      for (const [dx, dy, r] of [
        [0.5, 0.38, 0.19],
        [0.66, -0.06, 0.14],
        [0.76, -0.46, 0.1],
      ]) {
        c.beginPath()
        c.moveTo(dx, dy - r * 1.7)
        c.bezierCurveTo(dx + r * 1.3, dy - r * 0.3, dx + r, dy + r * 0.6, dx, dy + r * 0.9)
        c.bezierCurveTo(dx - r, dy + r * 0.6, dx - r * 1.3, dy - r * 0.3, dx, dy - r * 1.7)
        c.closePath()
        c.fill()
      }
      c.fillStyle = 'rgb(255 255 255 / 0.55)'
      c.beginPath()
      c.ellipse(0.44, 0.4, 0.05, 0.08, -0.3, 0, Math.PI * 2)
      c.fill()
      break
    }
    // 두 장 더 뽑기 — 부채처럼 펼쳐진 카드
    case 'focus': {
      const cards: Array<[number, number]> = [
        [-0.42, -0.42],
        [0, 0],
        [0.42, 0.42],
      ]
      cards.forEach(([dx, rot], i) => {
        c.save()
        c.translate(dx, 0.06)
        c.rotate(rot)
        c.fillStyle = i === 1 ? '#FFF8E7' : '#E4D9C4'
        c.beginPath()
        c.roundRect(-0.42, -0.86, 0.84, 1.5, 0.14)
        c.fill()
        c.strokeStyle = '#8D6E63'
        c.lineWidth = 0.07
        c.stroke()
        if (i === 1) {
          c.fillStyle = '#7E57C2'
          c.beginPath()
          c.moveTo(0, -0.42)
          c.lineTo(0.24, 0)
          c.lineTo(0, 0.42)
          c.lineTo(-0.24, 0)
          c.closePath()
          c.fill()
        }
        c.restore()
      })
      break
    }
    // 폭발 — 사방으로 뻗는 빛
    case 'nova': {
      c.fillStyle = '#FF7043'
      c.beginPath()
      for (let i = 0; i < 16; i++) {
        const r = i % 2 === 0 ? 1.02 : 0.42
        const a = -Math.PI / 2 + (i * Math.PI) / 8
        const x = Math.cos(a) * r
        const y = Math.sin(a) * r
        if (i === 0) c.moveTo(x, y)
        else c.lineTo(x, y)
      }
      c.closePath()
      c.fill()
      c.fillStyle = '#FFB74D'
      c.beginPath()
      c.arc(0, 0, 0.5, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#FFF3E0'
      c.beginPath()
      c.arc(0, 0, 0.27, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = 'rgb(255 255 255 / 0.8)'
      c.beginPath()
      c.arc(-0.11, -0.11, 0.1, 0, Math.PI * 2)
      c.fill()
      break
    }
  }
}

// (x, y)를 중심으로 size 크기의 카드 그림을 그린다. size = 그림 반높이.
export function drawCardArt(
  c: CanvasRenderingContext2D,
  id: CardId,
  x: number,
  y: number,
  size: number,
) {
  c.save()
  c.translate(x, y)
  c.scale(size, size)
  c.lineJoin = 'round'
  drawShape(c, id)
  c.restore()
}
