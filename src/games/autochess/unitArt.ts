// 오토 배틀 말 그림 4종. 예전엔 색 원 위에 아이콘을 얹어서, 작게 보면 색만 남고
// 네 종족이 다 같은 동그라미였다. 어깨선·모자·무기로 실루엣을 갈라 둔다.
//
// 그림은 (0,0)을 발밑으로 두고 위로 자란다. 크기 s = 말 한 마리의 반높이.
// facing 1이면 오른쪽, -1이면 왼쪽을 본다. 광원은 왼쪽 위.

interface Skin {
  cloth: string
  clothDark: string
  metal: string
  metalDark: string
}

const SKINS: Skin[] = [
  { cloth: '#E05A50', clothDark: '#9C2F28', metal: '#D5DCE2', metalDark: '#8B98A3' }, // 전사
  { cloth: '#5BA95F', clothDark: '#2F6B33', metal: '#C9A227', metalDark: '#8A6C12' }, // 궁수
  { cloth: '#4E8FD6', clothDark: '#255C99', metal: '#D5DCE2', metalDark: '#7C8A96' }, // 방패병
  { cloth: '#9B62C9', clothDark: '#5E3182', metal: '#FFD54F', metalDark: '#C79A16' }, // 마법사
]
const SKIN_TONE = '#F2C9A0'
const SKIN_SHADE = '#D3A276'

// 받침대 — 레벨이 오르면 돌에서 은, 금으로 바뀐다 (별 개수와 함께 두 번 알린다)
const BASE_COLORS = [
  { top: '#7E8A94', side: '#4E585F' },
  { top: '#D7DEE4', side: '#93A0AA' },
  { top: '#FFD76A', side: '#C79318' },
]

function base(c: CanvasRenderingContext2D, s: number, level: number) {
  const col = BASE_COLORS[Math.min(level, BASE_COLORS.length) - 1]
  c.fillStyle = col.side
  c.beginPath()
  c.ellipse(0, s * 0.06, s * 0.72, s * 0.19, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = col.top
  c.beginPath()
  c.ellipse(0, 0, s * 0.72, s * 0.19, 0, 0, Math.PI * 2)
  c.fill()
}

function head(c: CanvasRenderingContext2D, s: number, y: number, r: number) {
  c.fillStyle = SKIN_TONE
  c.beginPath()
  c.arc(0, y, r, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = SKIN_SHADE
  c.beginPath()
  c.arc(r * 0.34, y + r * 0.12, r * 0.7, -0.9, 1.5)
  c.fill()
  // 눈 — 작게 두 점이면 얼굴이 산다
  c.fillStyle = '#3B2A20'
  c.beginPath()
  c.arc(-r * 0.3, y - r * 0.05, r * 0.15, 0, Math.PI * 2)
  c.arc(r * 0.32, y - r * 0.05, r * 0.15, 0, Math.PI * 2)
  c.fill()
  void s
}

function drawShape(c: CanvasRenderingContext2D, species: number, s: number) {
  const skin = SKINS[species]
  switch (species) {
    // 전사 — 각진 어깨에 검을 세워 든다
    case 0: {
      c.fillStyle = skin.clothDark
      c.beginPath()
      c.roundRect(-s * 0.3, -s * 0.42, s * 0.6, s * 0.44, s * 0.08)
      c.fill()
      c.fillStyle = skin.cloth
      c.beginPath()
      c.moveTo(-s * 0.52, -s * 0.44)
      c.lineTo(s * 0.52, -s * 0.44)
      c.lineTo(s * 0.4, -s * 1.06)
      c.lineTo(-s * 0.4, -s * 1.06)
      c.closePath()
      c.fill()
      // 어깨 갑
      c.fillStyle = skin.metal
      c.beginPath()
      c.ellipse(-s * 0.46, -s * 0.98, s * 0.24, s * 0.17, -0.3, 0, Math.PI * 2)
      c.ellipse(s * 0.46, -s * 0.98, s * 0.24, s * 0.17, 0.3, 0, Math.PI * 2)
      c.fill()
      head(c, s, -s * 1.32, s * 0.3)
      // 투구
      c.fillStyle = skin.metal
      c.beginPath()
      c.arc(0, -s * 1.34, s * 0.32, Math.PI, 0)
      c.lineTo(s * 0.36, -s * 1.24)
      c.lineTo(-s * 0.36, -s * 1.24)
      c.closePath()
      c.fill()
      c.fillStyle = skin.clothDark
      c.beginPath()
      c.roundRect(-s * 0.06, -s * 1.82, s * 0.12, s * 0.3, s * 0.05)
      c.fill()
      // 검
      c.fillStyle = skin.metalDark
      c.beginPath()
      c.roundRect(s * 0.5, -s * 1.5, s * 0.16, s * 1.1, s * 0.05)
      c.fill()
      c.fillStyle = skin.metal
      c.beginPath()
      c.roundRect(s * 0.5, -s * 1.5, s * 0.08, s * 1.1, s * 0.04)
      c.fill()
      c.fillStyle = '#C9A227'
      c.beginPath()
      c.roundRect(s * 0.34, -s * 0.44, s * 0.48, s * 0.12, s * 0.05)
      c.fill()
      break
    }
    // 궁수 — 후드를 쓰고 활을 든 날씬한 실루엣
    case 1: {
      c.fillStyle = skin.cloth
      c.beginPath()
      c.moveTo(-s * 0.38, -s * 0.4)
      c.lineTo(s * 0.38, -s * 0.4)
      c.lineTo(s * 0.28, -s * 1.02)
      c.lineTo(-s * 0.28, -s * 1.02)
      c.closePath()
      c.fill()
      c.fillStyle = skin.clothDark
      c.beginPath()
      c.moveTo(s * 0.05, -s * 0.4)
      c.lineTo(s * 0.38, -s * 0.4)
      c.lineTo(s * 0.28, -s * 1.02)
      c.lineTo(s * 0.05, -s * 1.02)
      c.closePath()
      c.fill()
      head(c, s, -s * 1.24, s * 0.27)
      // 후드 — 뒤로 뾰족하게 흐른다
      c.fillStyle = skin.clothDark
      c.beginPath()
      c.moveTo(-s * 0.34, -s * 1.16)
      c.quadraticCurveTo(-s * 0.1, -s * 1.68, s * 0.3, -s * 1.42)
      c.quadraticCurveTo(s * 0.1, -s * 1.34, -s * 0.02, -s * 1.5)
      c.quadraticCurveTo(-s * 0.2, -s * 1.36, -s * 0.34, -s * 1.16)
      c.closePath()
      c.fill()
      // 활
      c.strokeStyle = skin.metal
      c.lineWidth = s * 0.12
      c.lineCap = 'round'
      c.beginPath()
      c.arc(s * 0.36, -s * 0.86, s * 0.6, -1.1, 1.1)
      c.stroke()
      c.strokeStyle = 'rgb(255 255 255 / 0.7)'
      c.lineWidth = s * 0.05
      c.beginPath()
      c.moveTo(s * 0.63, -s * 1.39)
      c.lineTo(s * 0.63, -s * 0.33)
      c.stroke()
      break
    }
    // 방패병 — 낮고 넓다. 큰 방패가 실루엣의 절반이다.
    case 2: {
      c.fillStyle = skin.cloth
      c.beginPath()
      c.moveTo(-s * 0.56, -s * 0.38)
      c.lineTo(s * 0.56, -s * 0.38)
      c.lineTo(s * 0.44, -s * 0.96)
      c.lineTo(-s * 0.44, -s * 0.96)
      c.closePath()
      c.fill()
      head(c, s, -s * 1.2, s * 0.28)
      c.fillStyle = skin.metal
      c.beginPath()
      c.arc(0, -s * 1.22, s * 0.3, Math.PI, 0)
      c.lineTo(s * 0.3, -s * 1.12)
      c.lineTo(-s * 0.3, -s * 1.12)
      c.closePath()
      c.fill()
      // 방패
      c.fillStyle = skin.metalDark
      c.beginPath()
      c.moveTo(s * 0.34, -s * 1.16)
      c.lineTo(s * 0.96, -s * 1.02)
      c.lineTo(s * 0.96, -s * 0.42)
      c.quadraticCurveTo(s * 0.9, -s * 0.06, s * 0.34, -s * 0.1)
      c.closePath()
      c.fill()
      c.fillStyle = skin.metal
      c.beginPath()
      c.moveTo(s * 0.4, -s * 1.1)
      c.lineTo(s * 0.88, -s * 0.99)
      c.lineTo(s * 0.88, -s * 0.46)
      c.quadraticCurveTo(s * 0.84, -s * 0.16, s * 0.4, -s * 0.18)
      c.closePath()
      c.fill()
      c.fillStyle = skin.cloth
      c.beginPath()
      c.arc(s * 0.64, -s * 0.62, s * 0.15, 0, Math.PI * 2)
      c.fill()
      break
    }
    // 마법사 — 뾰족한 모자와 아래로 퍼지는 로브
    default: {
      c.fillStyle = skin.cloth
      c.beginPath()
      c.moveTo(-s * 0.54, -s * 0.34)
      c.quadraticCurveTo(-s * 0.36, -s * 1.02, -s * 0.24, -s * 1.06)
      c.lineTo(s * 0.24, -s * 1.06)
      c.quadraticCurveTo(s * 0.36, -s * 1.02, s * 0.54, -s * 0.34)
      c.closePath()
      c.fill()
      c.fillStyle = skin.clothDark
      c.beginPath()
      c.moveTo(s * 0.06, -s * 0.34)
      c.quadraticCurveTo(s * 0.3, -s * 1.0, s * 0.24, -s * 1.06)
      c.lineTo(s * 0.06, -s * 1.06)
      c.closePath()
      c.fill()
      head(c, s, -s * 1.24, s * 0.26)
      // 모자
      c.fillStyle = skin.clothDark
      c.beginPath()
      c.moveTo(-s * 0.44, -s * 1.36)
      c.lineTo(s * 0.44, -s * 1.36)
      c.quadraticCurveTo(s * 0.1, -s * 1.5, -s * 0.16, -s * 1.98)
      c.quadraticCurveTo(-s * 0.34, -s * 1.5, -s * 0.44, -s * 1.36)
      c.closePath()
      c.fill()
      c.fillStyle = skin.metal
      c.beginPath()
      c.roundRect(-s * 0.44, -s * 1.42, s * 0.88, s * 0.13, s * 0.06)
      c.fill()
      // 지팡이와 구슬
      c.strokeStyle = '#8D6E63'
      c.lineWidth = s * 0.1
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(s * 0.56, -s * 0.24)
      c.lineTo(s * 0.62, -s * 1.24)
      c.stroke()
      c.fillStyle = skin.metal
      c.beginPath()
      c.arc(s * 0.63, -s * 1.36, s * 0.19, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = 'rgb(255 255 255 / 0.75)'
      c.beginPath()
      c.arc(s * 0.57, -s * 1.42, s * 0.07, 0, Math.PI * 2)
      c.fill()
      break
    }
  }
}

// 원거리 종족(궁수·마법사)은 탄을 날린다
export const isRanged = (species: number) => species === 1 || species === 3

// (x, y)는 말의 발밑. size = 말 반높이.
export function drawUnitArt(
  c: CanvasRenderingContext2D,
  species: number,
  level: number,
  x: number,
  y: number,
  size: number,
  facing = 1,
) {
  c.save()
  c.translate(x, y)
  c.scale(facing, 1)
  c.lineJoin = 'round'
  base(c, size, level)
  drawShape(c, species, size)
  c.restore()
}
