// 마작 패 드로잉 — 외부 에셋 없이 전부 캔버스 벡터로 그린다
import { TILE_H, TILE_W } from './state'

// 문양 1~9개 배치용 3×3 격자 자리표 (주사위식 배열)
const GRID: [number, number][][] = [
  [[1, 1]],
  [
    [1, 0],
    [1, 2],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ],
]

function gridXY(px: number, py: number, col: number, row: number): [number, number] {
  return [px + TILE_W * (0.26 + 0.24 * col), py + TILE_H * (0.25 + 0.25 * row)]
}

// 대나무 막대 하나 (마디 두 줄 포함)
function stick(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.fillStyle = '#2E7D32'
  c.beginPath()
  c.roundRect(x - w / 2, y - h / 2, w, h, w / 2)
  c.fill()
  c.fillStyle = '#1B5E20'
  c.fillRect(x - w / 2, y - h / 6, w, 2.5)
  c.fillRect(x - w / 2, y + h / 6, w, 2.5)
}

function drawFace(c: CanvasRenderingContext2D, px: number, py: number, kind: string) {
  if (kind.startsWith('dot')) {
    // 통수: 원 문양 1~9개, 초록·파랑 교차
    const n = Number(kind[3])
    const r = n === 1 ? 16 : n <= 6 ? 10 : 8
    GRID[n - 1].forEach(([col, row], i) => {
      const [x, y] = gridXY(px, py, col, row)
      const green = (i + n) % 2 === 0
      c.fillStyle = green ? '#2E7D32' : '#1565C0'
      c.beginPath()
      c.arc(x, y, r, 0, Math.PI * 2)
      c.fill()
      c.strokeStyle = green ? '#1B5E20' : '#0D47A1'
      c.lineWidth = 2
      c.stroke()
      c.fillStyle = '#FFFDF4'
      c.beginPath()
      c.arc(x, y, r * 0.3, 0, Math.PI * 2)
      c.fill()
    })
  } else if (kind.startsWith('man')) {
    // 만수: 큰 숫자 + 빨간 포인트
    c.save()
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillStyle = '#1A237E'
    c.font = 'bold 54px sans-serif'
    c.fillText(kind[3], px + TILE_W / 2, py + TILE_H * 0.4)
    c.restore()
    c.fillStyle = '#C62828'
    c.beginPath()
    c.roundRect(px + TILE_W / 2 - 17, py + TILE_H * 0.68, 34, 13, 6)
    c.fill()
  } else if (kind.startsWith('bam')) {
    // 삭수: 대나무 막대 문양
    const n = Number(kind[3])
    if (n === 1) {
      stick(c, px + TILE_W / 2, py + TILE_H / 2, 18, 52)
    } else {
      const w = n <= 6 ? 12 : 10
      const h = n <= 6 ? 26 : 22
      for (const [col, row] of GRID[n - 1]) {
        const [x, y] = gridXY(px, py, col, row)
        stick(c, x, y, w, h)
      }
    }
  } else if (kind.startsWith('wind')) {
    // 바람: N/E/S/W 남색 글자
    c.save()
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillStyle = '#283593'
    c.font = 'bold 56px sans-serif'
    c.fillText(kind.slice(4), px + TILE_W / 2, py + TILE_H / 2 + 2)
    c.restore()
  } else if (kind === 'dragR') {
    // 빨간 용: 사각 테두리 + 중앙 점
    c.strokeStyle = '#C62828'
    c.lineWidth = 7
    c.beginPath()
    c.roundRect(px + TILE_W / 2 - 21, py + TILE_H / 2 - 21, 42, 42, 8)
    c.stroke()
    c.fillStyle = '#C62828'
    c.beginPath()
    c.arc(px + TILE_W / 2, py + TILE_H / 2, 7, 0, Math.PI * 2)
    c.fill()
  } else {
    // 초록 용: 마름모 문양
    c.save()
    c.translate(px + TILE_W / 2, py + TILE_H / 2)
    c.rotate(Math.PI / 4)
    c.fillStyle = '#2E7D32'
    c.beginPath()
    c.roundRect(-19, -19, 38, 38, 6)
    c.fill()
    c.strokeStyle = '#FFFDF4'
    c.lineWidth = 3
    c.strokeRect(-10, -10, 20, 20)
    c.restore()
  }
}

// 패 한 장: 밑면·옆면으로 입체감을 주고 얼굴 문양을 그린다
export function drawTile(
  c: CanvasRenderingContext2D,
  px: number,
  py: number,
  kind: string,
  selected: boolean,
) {
  c.fillStyle = 'rgb(0 0 0 / 0.22)'
  c.beginPath()
  c.roundRect(px + 5, py + 8, TILE_W, TILE_H, 10)
  c.fill()
  c.fillStyle = '#C9AE7E'
  c.beginPath()
  c.roundRect(px + 4, py + 5, TILE_W, TILE_H, 10)
  c.fill()
  const grad = c.createLinearGradient(px, py, px, py + TILE_H)
  grad.addColorStop(0, '#FFFDF4')
  grad.addColorStop(1, '#EFE5CB')
  c.fillStyle = grad
  c.beginPath()
  c.roundRect(px, py, TILE_W, TILE_H, 10)
  c.fill()
  c.lineWidth = selected ? 5 : 2
  c.strokeStyle = selected ? '#FFB300' : '#C3B491'
  c.stroke()
  drawFace(c, px, py, kind)
}
