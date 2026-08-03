// 벽돌·공 벡터 아트 — HP 크기에 따라 색이 단계적으로 바뀐다(위험도 인지용)

import { font } from '../ui'

interface Palette {
  base: string
  light: string
  dark: string
}

const HP_PALETTE: Palette[] = [
  { base: '#5EC8F2', light: '#A6E4FF', dark: '#2A7EA0' }, // 1
  { base: '#4CAF50', light: '#8FE193', dark: '#256B29' }, // 2~3
  { base: '#C0CA33', light: '#E6EE7A', dark: '#7A8215' }, // 4~7
  { base: '#FFB300', light: '#FFD97A', dark: '#B37700' }, // 8~15
  { base: '#FB8C00', light: '#FFBA65', dark: '#B35B00' }, // 16~31
  { base: '#E53935', light: '#FF8A85', dark: '#9B1B18' }, // 32~63
  { base: '#8E24AA', light: '#C77BDD', dark: '#521063' }, // 64+
]

function paletteOf(hp: number): Palette {
  const index = Math.min(HP_PALETTE.length - 1, Math.max(0, Math.floor(Math.log2(Math.max(1, hp)))))
  return HP_PALETTE[index]
}

export function drawBrick(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  hp: number,
  maxHp: number,
  item: boolean,
) {
  const p = paletteOf(hp)
  const r = Math.min(w, h) * 0.22
  // 칸이 47px로 줄어 고정 px는 전부 비율로 잡는다
  const depth = Math.max(2, Math.round(h * 0.07)) // 아래쪽 두께감
  const face = h - depth

  // 두께감
  c.fillStyle = p.dark
  c.beginPath()
  c.roundRect(x, y + depth, w, face, r)
  c.fill()

  // 본체
  const body = c.createLinearGradient(x, y, x, y + h)
  body.addColorStop(0, p.light)
  body.addColorStop(0.5, p.base)
  body.addColorStop(1, p.base)
  c.fillStyle = body
  c.beginPath()
  c.roundRect(x, y, w, face, r)
  c.fill()

  // 남은 체력 띠 (아래쪽 얇은 바)
  if (hp < maxHp) {
    const bandH = Math.max(4, Math.round(h * 0.11))
    const bandY = y + face - bandH
    c.save()
    c.beginPath()
    c.roundRect(x, y, w, face, r)
    c.clip()
    c.fillStyle = 'rgb(0 0 0 / 0.22)'
    c.fillRect(x, bandY, w, bandH)
    c.fillStyle = 'rgb(255 255 255 / 0.75)'
    c.fillRect(x + 3, bandY, (w - 6) * (hp / maxHp), bandH)
    c.restore()
  }

  // 윗면 광택
  c.save()
  c.beginPath()
  c.roundRect(x, y, w, face, r)
  c.clip()
  c.globalAlpha = 0.42
  c.fillStyle = '#FFFFFF'
  c.beginPath()
  c.roundRect(x + w * 0.08, y + h * 0.1, w * 0.84, h * 0.16, h * 0.08)
  c.fill()
  c.restore()

  // 아이템 벽돌 — 부수면 공격력이 오른다. 좁은 칸에서 아이콘은 뭉개지므로
  // 흰 테두리 하나로 알린다 (마지막 줄의 빨간 테두리와는 색으로 갈린다)
  if (item) {
    const lw = Math.max(2.5, w * 0.07)
    c.save()
    c.strokeStyle = '#FFFFFF'
    c.lineWidth = lw
    c.beginPath()
    c.roundRect(x + lw / 2, y + lw / 2, w - lw, face - lw, r)
    c.stroke()
    c.restore()
  }

  // HP 숫자
  const size = Math.round(h * 0.5)
  c.save()
  c.textAlign = 'center'
  c.font = font(size, true)
  c.lineWidth = Math.max(2, size * 0.18)
  c.strokeStyle = p.dark
  c.strokeText(String(hp), x + w / 2, y + h / 2 + h * 0.11)
  c.fillStyle = '#FFFFFF'
  c.fillText(String(hp), x + w / 2, y + h / 2 + h * 0.11)
  c.restore()
}

export function drawBall(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  // 잔광
  c.save()
  c.globalAlpha = 0.28
  c.fillStyle = '#FFB74D'
  c.beginPath()
  c.arc(x, y, r * 2.1, 0, Math.PI * 2)
  c.fill()
  c.restore()

  const grad = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r)
  grad.addColorStop(0, '#FFF3E0')
  grad.addColorStop(0.5, '#FF9800')
  grad.addColorStop(1, '#E65100')
  c.fillStyle = grad
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fill()
}

// 발사대 — 공이 나오는 포신
export function drawLauncher(c: CanvasRenderingContext2D, x: number, y: number, count: number) {
  c.save()
  // 받침
  c.fillStyle = '#6D4C41'
  c.beginPath()
  c.roundRect(x - 34, y - 6, 68, 20, 10)
  c.fill()
  // 포신
  const grad = c.createLinearGradient(x - 16, y - 26, x + 16, y + 6)
  grad.addColorStop(0, '#A1887F')
  grad.addColorStop(1, '#5D4037')
  c.fillStyle = grad
  c.beginPath()
  c.roundRect(x - 16, y - 26, 32, 34, 12)
  c.fill()
  c.fillStyle = '#FFCC80'
  c.beginPath()
  c.arc(x, y - 18, 8, 0, Math.PI * 2)
  c.fill()

  // 보유 공 개수 (숫자만)
  c.textAlign = 'center'
  c.fillStyle = '#8D6E63'
  c.font = font(22, true)
  c.fillText(`×${count}`, x, y + 44)
  c.restore()
}
