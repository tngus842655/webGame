// 캔버스 HUD 아이콘 — 이모지 대신 벡터로 그린다.
// 이모지는 기기마다 그림이 다르고, 글자로 찍히니 숫자와 높이가 어긋나고,
// 게임 팔레트에 맞춰 색을 바꿀 수도 없었다.
//
// 각 아이콘은 (0,0)을 중심으로 한 [-1,1] 상자 안에 그려두고, drawIcon이
// size만큼 확대한다. 그래서 아래 좌표와 선 굵기는 전부 "반지름 1" 기준이다.

export type IconName =
  | 'heart'
  | 'coin'
  | 'star'
  | 'sword'
  | 'shield'
  | 'bow'
  | 'orb'
  | 'bolt'
  | 'card'
  | 'drop'
  | 'timer'
  | 'trophy'
  | 'dice'
  | 'cross'
  | 'backspace'

export interface IconOptions {
  // 잃은 목숨·아직 채우지 않은 자리 — 회색으로 죽여서 그린다
  dim?: boolean
  alpha?: number
  // 바탕색에 맞춰야 할 때 주 색을 갈아끼운다 (그림자·무늬 같은 보조 색은 그대로)
  color?: string
}

const DIM = '#9E9E9E'

function fill(c: CanvasRenderingContext2D, color: string) {
  c.fillStyle = color
  c.fill()
}

function drawShape(c: CanvasRenderingContext2D, name: IconName, main: string, plain: boolean) {
  // plain = dim 상태. 보조 색·하이라이트를 생략해 실루엣만 남긴다.
  switch (name) {
    case 'heart': {
      c.beginPath()
      c.moveTo(0, 0.88)
      c.bezierCurveTo(-1.3, -0.06, -0.82, -1.1, 0, -0.42)
      c.bezierCurveTo(0.82, -1.1, 1.3, -0.06, 0, 0.88)
      fill(c, main)
      if (plain) break
      c.beginPath()
      c.ellipse(-0.42, -0.34, 0.22, 0.14, -0.7, 0, Math.PI * 2)
      fill(c, 'rgb(255 255 255 / 0.55)')
      break
    }
    case 'coin': {
      c.beginPath()
      c.arc(0, 0, 1, 0, Math.PI * 2)
      fill(c, plain ? main : '#D98A0C')
      if (plain) break
      c.beginPath()
      c.arc(0, -0.06, 0.8, 0, Math.PI * 2)
      fill(c, main)
      c.beginPath()
      c.ellipse(-0.3, -0.36, 0.26, 0.15, -0.6, 0, Math.PI * 2)
      fill(c, 'rgb(255 255 255 / 0.65)')
      break
    }
    case 'star': {
      c.beginPath()
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 1 : 0.45
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const x = Math.cos(a) * r
        const y = Math.sin(a) * r
        if (i === 0) c.moveTo(x, y)
        else c.lineTo(x, y)
      }
      c.closePath()
      fill(c, main)
      if (plain) break
      c.beginPath()
      c.moveTo(0, -0.86)
      c.lineTo(0.24, -0.2)
      c.lineTo(0, -0.06)
      c.lineTo(-0.24, -0.2)
      c.closePath()
      fill(c, 'rgb(255 255 255 / 0.5)')
      break
    }
    case 'sword': {
      c.rotate(-0.32)
      // 날
      c.beginPath()
      c.moveTo(0, -1.05)
      c.lineTo(0.2, -0.72)
      c.lineTo(0.2, 0.18)
      c.lineTo(-0.2, 0.18)
      c.lineTo(-0.2, -0.72)
      c.closePath()
      fill(c, main)
      if (!plain) {
        c.beginPath()
        c.moveTo(-0.05, -0.9)
        c.lineTo(0.07, -0.66)
        c.lineTo(0.07, 0.18)
        c.lineTo(-0.05, 0.18)
        c.closePath()
        fill(c, 'rgb(255 255 255 / 0.55)')
      }
      // 코등이 + 자루 + 손잡이 끝
      c.beginPath()
      c.roundRect(-0.62, 0.18, 1.24, 0.24, 0.1)
      fill(c, plain ? main : '#8E6A3F')
      c.beginPath()
      c.roundRect(-0.15, 0.42, 0.3, 0.42, 0.1)
      fill(c, plain ? main : '#5E432A')
      c.beginPath()
      c.arc(0, 0.94, 0.19, 0, Math.PI * 2)
      fill(c, plain ? main : '#8E6A3F')
      break
    }
    case 'shield': {
      c.beginPath()
      c.moveTo(0, -1)
      c.lineTo(0.88, -0.62)
      c.lineTo(0.88, 0.12)
      c.quadraticCurveTo(0.88, 0.72, 0, 1.04)
      c.quadraticCurveTo(-0.88, 0.72, -0.88, 0.12)
      c.lineTo(-0.88, -0.62)
      c.closePath()
      fill(c, main)
      if (plain) break
      c.save()
      c.clip()
      c.beginPath()
      c.moveTo(0, -1.1)
      c.lineTo(-1, -0.7)
      c.lineTo(-1, 1.1)
      c.lineTo(0, 1.1)
      c.closePath()
      fill(c, 'rgb(255 255 255 / 0.25)')
      c.restore()
      break
    }
    case 'bow': {
      c.lineCap = 'round'
      c.strokeStyle = plain ? main : '#8E6A3F'
      c.lineWidth = 0.26
      c.beginPath()
      c.arc(0.34, 0, 0.9, 2.1, -2.1)
      c.stroke()
      c.strokeStyle = plain ? main : 'rgb(255 255 255 / 0.75)'
      c.lineWidth = 0.1
      c.beginPath()
      c.moveTo(-0.12, -0.78)
      c.lineTo(-0.12, 0.78)
      c.stroke()
      // 화살
      c.strokeStyle = main
      c.lineWidth = 0.16
      c.beginPath()
      c.moveTo(-0.5, 0)
      c.lineTo(0.62, 0)
      c.stroke()
      c.beginPath()
      c.moveTo(1, 0)
      c.lineTo(0.55, -0.3)
      c.lineTo(0.55, 0.3)
      c.closePath()
      fill(c, main)
      break
    }
    case 'orb': {
      c.beginPath()
      c.arc(0, 0.06, 0.88, 0, Math.PI * 2)
      fill(c, main)
      if (plain) break
      c.beginPath()
      c.ellipse(-0.3, -0.3, 0.3, 0.18, -0.6, 0, Math.PI * 2)
      fill(c, 'rgb(255 255 255 / 0.6)')
      c.beginPath()
      c.arc(0.72, -0.72, 0.16, 0, Math.PI * 2)
      c.arc(-0.78, 0.6, 0.11, 0, Math.PI * 2)
      fill(c, 'rgb(255 255 255 / 0.8)')
      break
    }
    case 'bolt': {
      c.beginPath()
      c.moveTo(0.2, -1)
      c.lineTo(-0.66, 0.16)
      c.lineTo(-0.06, 0.16)
      c.lineTo(-0.2, 1)
      c.lineTo(0.66, -0.18)
      c.lineTo(0.06, -0.18)
      c.closePath()
      fill(c, main)
      break
    }
    case 'card': {
      c.beginPath()
      c.roundRect(-0.62, -0.9, 1.24, 1.8, 0.22)
      fill(c, main)
      if (plain) break
      c.beginPath()
      c.moveTo(0, -0.42)
      c.lineTo(0.3, 0)
      c.lineTo(0, 0.42)
      c.lineTo(-0.3, 0)
      c.closePath()
      fill(c, '#D64550')
      break
    }
    case 'drop': {
      c.beginPath()
      c.moveTo(0, -1)
      c.bezierCurveTo(0.72, -0.18, 0.86, 0.24, 0.86, 0.36)
      c.arc(0, 0.36, 0.86, 0, Math.PI)
      c.bezierCurveTo(-0.86, 0.24, -0.72, -0.18, 0, -1)
      c.closePath()
      fill(c, main)
      if (plain) break
      c.beginPath()
      c.ellipse(-0.3, 0.36, 0.16, 0.28, 0.2, 0, Math.PI * 2)
      fill(c, 'rgb(255 255 255 / 0.6)')
      break
    }
    case 'timer': {
      c.beginPath()
      c.roundRect(-0.26, -1.16, 0.52, 0.26, 0.1)
      fill(c, plain ? main : 'rgb(119 135 145 / 0.6)')
      c.beginPath()
      c.arc(0, 0.08, 0.94, 0, Math.PI * 2)
      fill(c, main)
      if (plain) break
      c.beginPath()
      c.arc(0, 0.08, 0.74, 0, Math.PI * 2)
      fill(c, 'rgb(255 255 255 / 0.9)')
      c.strokeStyle = main
      c.lineCap = 'round'
      c.lineWidth = 0.16
      c.beginPath()
      c.moveTo(0, 0.08)
      c.lineTo(0, -0.44)
      c.moveTo(0, 0.08)
      c.lineTo(0.4, 0.24)
      c.stroke()
      break
    }
    case 'trophy': {
      // 손잡이 두 개
      c.strokeStyle = main
      c.lineWidth = 0.18
      c.beginPath()
      c.arc(-0.6, -0.44, 0.34, -1.5, 1.5, true)
      c.stroke()
      c.beginPath()
      c.arc(0.6, -0.44, 0.34, 1.5, -1.5, true)
      c.stroke()
      // 컵
      c.beginPath()
      c.moveTo(-0.66, -0.94)
      c.lineTo(0.66, -0.94)
      c.lineTo(0.6, -0.24)
      c.quadraticCurveTo(0.5, 0.24, 0, 0.3)
      c.quadraticCurveTo(-0.5, 0.24, -0.6, -0.24)
      c.closePath()
      fill(c, main)
      // 기둥·받침
      c.beginPath()
      c.roundRect(-0.16, 0.28, 0.32, 0.32, 0.06)
      c.roundRect(-0.56, 0.6, 1.12, 0.32, 0.12)
      fill(c, plain ? main : '#C98A18')
      if (plain) break
      c.beginPath()
      c.moveTo(-0.36, -0.86)
      c.lineTo(-0.16, -0.86)
      c.lineTo(-0.3, 0.1)
      c.lineTo(-0.46, -0.3)
      c.closePath()
      fill(c, 'rgb(255 255 255 / 0.45)')
      break
    }
    case 'dice': {
      c.beginPath()
      c.roundRect(-0.94, -0.94, 1.88, 1.88, 0.44)
      fill(c, main)
      if (plain) break
      c.beginPath()
      for (const [px, py] of [
        [-0.46, -0.46],
        [0.46, -0.46],
        [0, 0],
        [-0.46, 0.46],
        [0.46, 0.46],
      ]) {
        c.moveTo(px + 0.17, py)
        c.arc(px, py, 0.17, 0, Math.PI * 2)
      }
      fill(c, '#3B2A20')
      break
    }
    case 'cross': {
      c.strokeStyle = main
      c.lineCap = 'round'
      c.lineWidth = 0.34
      c.beginPath()
      c.moveTo(-0.66, -0.66)
      c.lineTo(0.66, 0.66)
      c.moveTo(0.66, -0.66)
      c.lineTo(-0.66, 0.66)
      c.stroke()
      break
    }
    case 'backspace': {
      // 키캡 위에 얹히므로 속을 채우지 않고 윤곽선으로 그린다
      c.strokeStyle = main
      c.lineWidth = 0.17
      c.lineJoin = 'round'
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(-1.02, 0)
      c.lineTo(-0.38, -0.7)
      c.lineTo(1.02, -0.7)
      c.lineTo(1.02, 0.7)
      c.lineTo(-0.38, 0.7)
      c.closePath()
      c.stroke()
      c.beginPath()
      c.moveTo(-0.02, -0.28)
      c.lineTo(0.62, 0.28)
      c.moveTo(0.62, -0.28)
      c.lineTo(-0.02, 0.28)
      c.stroke()
      break
    }
  }
}

const NATURAL: Record<IconName, string> = {
  heart: '#E5484D',
  coin: '#FFC93C',
  star: '#FFC93C',
  sword: '#C7D0D8',
  shield: '#4A90D9',
  bow: '#E8C36B',
  orb: '#A45FD6',
  bolt: '#FFC93C',
  card: '#F7F3EC',
  drop: '#3FB2E8',
  timer: '#607D8B',
  trophy: '#F5B324',
  dice: '#FFF6E4',
  cross: '#EF5350',
  backspace: '#8D7B72',
}

// (x, y)를 중심으로 size 크기의 아이콘을 그린다. size = 아이콘 반높이.
export function drawIcon(
  c: CanvasRenderingContext2D,
  name: IconName,
  x: number,
  y: number,
  size: number,
  opts: IconOptions = {},
) {
  c.save()
  if (opts.alpha !== undefined) c.globalAlpha *= opts.alpha
  if (opts.dim) c.globalAlpha *= 0.4
  c.translate(x, y)
  c.scale(size, size)
  drawShape(c, name, opts.color ?? (opts.dim ? DIM : NATURAL[name]), opts.dim === true)
  c.restore()
}

const GAP = 0.55 // 아이콘 크기 대비 아이콘–숫자 사이 간격

// drawIconValue 한 덩어리의 가로 길이. 여러 개를 나란히 늘어놓을 때 쓴다.
// 현재 c.font 기준이므로 글꼴을 잡은 뒤에 부를 것.
export function iconValueWidth(
  c: CanvasRenderingContext2D,
  text: string,
  size: number,
): number {
  return size * (2 + GAP) + c.measureText(text).width
}

// 아이콘과 값을 한 덩어리로 그린다. align은 덩어리 전체 기준이고,
// 글자색·폰트는 부르는 쪽에서 미리 잡아둔 것을 그대로 쓴다.
export function drawIconValue(
  c: CanvasRenderingContext2D,
  name: IconName,
  text: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign = 'center',
  opts: IconOptions = {},
) {
  const total = iconValueWidth(c, text, size)
  const left = align === 'left' ? x : align === 'right' ? x - total : x - total / 2
  drawIcon(c, name, left + size, y, size, opts)
  const prevAlign = c.textAlign
  const prevBaseline = c.textBaseline
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  c.fillText(text, left + size * (2 + GAP), y)
  c.textAlign = prevAlign
  c.textBaseline = prevBaseline
}

// 목숨·별처럼 개수를 늘어놓는 줄. filled개는 켜고 total까지는 꺼서 그린다.
// x는 줄 전체의 가운데.
export function drawIconRow(
  c: CanvasRenderingContext2D,
  name: IconName,
  x: number,
  y: number,
  size: number,
  filled: number,
  total = filled,
  opts: IconOptions = {},
) {
  if (total <= 0) return
  const step = size * 2.5
  const start = x - ((total - 1) * step) / 2
  for (let i = 0; i < total; i++) {
    drawIcon(c, name, start + i * step, y, size, i < filled ? opts : { ...opts, dim: true })
  }
}
