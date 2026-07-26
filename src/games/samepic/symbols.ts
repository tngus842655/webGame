// 같은 그림 찾기 심볼 20종 — 실루엣이 서로 겹치지 않게 고르고 벡터 패스로 직접 그린다.
// 색은 대부분 두 종씩 겹쳐 쓴다: 20종이 전부 다른 색이면 색만 맞춰 보고 끝나 그림을 볼 이유가 없다.
// 크림색 원판 위에 얹으므로 흰색에 가까운 색은 쓰지 않는다.

const TAU = Math.PI * 2

// 원을 여러 개 이어 붙일 때 선이 이어지지 않도록 moveTo로 끊는다
function circle(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.moveTo(x + r, y)
  c.arc(x, y, r, 0, TAU)
}

export interface Symbol {
  color: string
  // (0,0) 중심, r = 반지름 크기로 그린다
  draw(c: CanvasRenderingContext2D, r: number): void
}

const fill = (c: CanvasRenderingContext2D, color: string) => {
  c.fillStyle = color
  c.fill()
}

export const SYMBOLS: Symbol[] = [
  // 별
  {
    color: '#FFCA28',
    draw(c, r) {
      c.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const rad = i % 2 === 0 ? r : r * 0.44
        const x = Math.cos(a) * rad
        const y = Math.sin(a) * rad
        if (i === 0) c.moveTo(x, y)
        else c.lineTo(x, y)
      }
      c.closePath()
      fill(c, this.color)
    },
  },
  // 하트
  {
    color: '#EC407A',
    draw(c, r) {
      c.beginPath()
      c.moveTo(0, r * 0.88)
      c.bezierCurveTo(-r * 1.35, -r * 0.15, -r * 0.55, -r * 1.08, 0, -r * 0.36)
      c.bezierCurveTo(r * 0.55, -r * 1.08, r * 1.35, -r * 0.15, 0, r * 0.88)
      fill(c, this.color)
    },
  },
  // 초승달
  {
    color: '#FFCA28',
    draw(c, r) {
      c.beginPath()
      c.arc(0, 0, r, Math.PI * 0.28, Math.PI * 1.72, false)
      c.arc(-r * 0.42, 0, r * 0.86, Math.PI * 1.66, Math.PI * 0.34, true)
      c.closePath()
      fill(c, this.color)
    },
  },
  // 구름
  {
    color: '#78909C',
    draw(c, r) {
      c.beginPath()
      circle(c, -r * 0.5, r * 0.16, r * 0.44)
      circle(c, 0, -r * 0.2, r * 0.58)
      circle(c, r * 0.52, r * 0.14, r * 0.42)
      c.moveTo(-r * 0.94, r * 0.14)
      c.rect(-r * 0.94, r * 0.14, r * 1.88, r * 0.46)
      fill(c, this.color)
    },
  },
  // 물방울
  {
    color: '#42A5F5',
    draw(c, r) {
      c.beginPath()
      c.moveTo(0, -r)
      c.bezierCurveTo(r * 0.78, -r * 0.2, r * 0.85, r * 0.6, 0, r)
      c.bezierCurveTo(-r * 0.85, r * 0.6, -r * 0.78, -r * 0.2, 0, -r)
      fill(c, this.color)
    },
  },
  // 잎
  {
    color: '#66BB6A',
    draw(c, r) {
      c.beginPath()
      c.moveTo(-r * 0.75, r * 0.75)
      c.quadraticCurveTo(-r * 0.95, -r * 0.65, r * 0.75, -r * 0.8)
      c.quadraticCurveTo(r * 0.6, r * 0.5, -r * 0.75, r * 0.75)
      fill(c, this.color)
      c.strokeStyle = 'rgb(0 0 0 / 0.25)'
      c.lineWidth = Math.max(2, r * 0.1)
      c.beginPath()
      c.moveTo(-r * 0.62, r * 0.62)
      c.lineTo(r * 0.55, -r * 0.6)
      c.stroke()
    },
  },
  // 꽃
  {
    color: '#EC407A',
    draw(c, r) {
      c.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 5
        circle(c, Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58, r * 0.42)
      }
      fill(c, this.color)
      c.beginPath()
      circle(c, 0, 0, r * 0.32)
      fill(c, '#FFCA28')
    },
  },
  // 해
  {
    color: '#FF9800',
    draw(c, r) {
      c.strokeStyle = this.color
      c.lineWidth = Math.max(3, r * 0.16)
      c.lineCap = 'round'
      c.beginPath()
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8
        c.moveTo(Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66)
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      c.stroke()
      c.lineCap = 'butt'
      c.beginPath()
      circle(c, 0, 0, r * 0.52)
      fill(c, this.color)
    },
  },
  // 번개
  {
    color: '#FFCA28',
    draw(c, r) {
      c.beginPath()
      c.moveTo(r * 0.16, -r)
      c.lineTo(-r * 0.6, r * 0.15)
      c.lineTo(-r * 0.05, r * 0.15)
      c.lineTo(-r * 0.3, r)
      c.lineTo(r * 0.62, -r * 0.22)
      c.lineTo(r * 0.04, -r * 0.22)
      c.closePath()
      fill(c, this.color)
    },
  },
  // 산
  {
    color: '#8D6E63',
    draw(c, r) {
      c.beginPath()
      c.moveTo(0, -r)
      c.lineTo(r, r * 0.72)
      c.lineTo(-r, r * 0.72)
      c.closePath()
      fill(c, this.color)
      c.beginPath()
      c.moveTo(0, -r)
      c.lineTo(r * 0.38, -r * 0.28)
      c.lineTo(r * 0.16, -r * 0.36)
      c.lineTo(0, -r * 0.2)
      c.lineTo(-r * 0.18, -r * 0.34)
      c.lineTo(-r * 0.38, -r * 0.28)
      c.closePath()
      fill(c, '#ECEFF1')
    },
  },
  // 보석
  {
    color: '#26C6DA',
    draw(c, r) {
      c.beginPath()
      c.moveTo(0, -r)
      c.lineTo(r * 0.82, -r * 0.2)
      c.lineTo(0, r)
      c.lineTo(-r * 0.82, -r * 0.2)
      c.closePath()
      fill(c, this.color)
      c.beginPath()
      c.moveTo(-r * 0.82, -r * 0.2)
      c.lineTo(r * 0.82, -r * 0.2)
      c.lineTo(0, r * 0.1)
      c.closePath()
      fill(c, 'rgb(255 255 255 / 0.35)')
    },
  },
  // 고리
  {
    color: '#AB47BC',
    draw(c, r) {
      c.strokeStyle = this.color
      c.lineWidth = r * 0.34
      c.beginPath()
      c.arc(0, 0, r * 0.74, 0, TAU)
      c.stroke()
    },
  },
  // 세잎클로버
  {
    color: '#66BB6A',
    draw(c, r) {
      c.beginPath()
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 3
        circle(c, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5 - r * 0.12, r * 0.44)
      }
      fill(c, this.color)
      c.strokeStyle = this.color
      c.lineWidth = Math.max(2, r * 0.12)
      c.beginPath()
      c.moveTo(0, r * 0.3)
      c.quadraticCurveTo(r * 0.18, r * 0.7, 0, r)
      c.stroke()
    },
  },
  // 물고기
  {
    color: '#26C6DA',
    draw(c, r) {
      c.beginPath()
      c.ellipse(r * 0.12, 0, r * 0.72, r * 0.5, 0, 0, TAU)
      fill(c, this.color)
      c.beginPath()
      c.moveTo(-r * 0.5, 0)
      c.lineTo(-r, -r * 0.52)
      c.lineTo(-r, r * 0.52)
      c.closePath()
      fill(c, this.color)
      c.beginPath()
      circle(c, r * 0.45, -r * 0.12, r * 0.11)
      fill(c, '#0D3B44')
    },
  },
  // 나비
  {
    color: '#AB47BC',
    draw(c, r) {
      c.beginPath()
      c.ellipse(-r * 0.5, -r * 0.34, r * 0.46, r * 0.36, -0.5, 0, TAU)
      fill(c, this.color)
      c.beginPath()
      c.ellipse(r * 0.5, -r * 0.34, r * 0.46, r * 0.36, 0.5, 0, TAU)
      fill(c, this.color)
      c.beginPath()
      c.ellipse(-r * 0.42, r * 0.42, r * 0.36, r * 0.28, 0.4, 0, TAU)
      fill(c, this.color)
      c.beginPath()
      c.ellipse(r * 0.42, r * 0.42, r * 0.36, r * 0.28, -0.4, 0, TAU)
      fill(c, this.color)
      c.beginPath()
      c.ellipse(0, 0, r * 0.12, r * 0.62, 0, 0, TAU)
      fill(c, '#4A148C')
    },
  },
  // 우산
  {
    color: '#42A5F5',
    draw(c, r) {
      c.beginPath()
      c.arc(0, r * 0.1, r * 0.92, Math.PI, 0)
      c.closePath()
      fill(c, this.color)
      c.strokeStyle = '#795548'
      c.lineWidth = Math.max(3, r * 0.13)
      c.beginPath()
      c.moveTo(0, r * 0.1)
      c.lineTo(0, r * 0.78)
      c.quadraticCurveTo(0, r, -r * 0.28, r * 0.94)
      c.stroke()
    },
  },
  // 사과
  {
    color: '#EF5350',
    draw(c, r) {
      c.beginPath()
      circle(c, -r * 0.3, r * 0.12, r * 0.6)
      circle(c, r * 0.3, r * 0.12, r * 0.6)
      c.moveTo(0, r * 0.86)
      c.rect(-r * 0.6, -r * 0.2, r * 1.2, r * 0.7)
      fill(c, this.color)
      c.strokeStyle = '#6D4C41'
      c.lineWidth = Math.max(3, r * 0.12)
      c.beginPath()
      c.moveTo(0, -r * 0.5)
      c.quadraticCurveTo(r * 0.08, -r * 0.82, r * 0.34, -r * 0.92)
      c.stroke()
      c.beginPath()
      c.ellipse(-r * 0.3, -r * 0.72, r * 0.28, r * 0.15, -0.4, 0, TAU)
      fill(c, '#66BB6A')
    },
  },
  // 버섯
  {
    color: '#EF5350',
    draw(c, r) {
      c.beginPath()
      c.arc(0, r * 0.06, r * 0.92, Math.PI, 0)
      c.closePath()
      fill(c, this.color)
      c.beginPath()
      circle(c, -r * 0.4, -r * 0.3, r * 0.16)
      circle(c, r * 0.34, -r * 0.36, r * 0.13)
      circle(c, r * 0.04, -r * 0.62, r * 0.12)
      fill(c, '#FFF3E0')
      c.beginPath()
      c.roundRect(-r * 0.28, r * 0.06, r * 0.56, r * 0.8, r * 0.16)
      fill(c, '#D7CCC8')
    },
  },
  // 왕관
  {
    color: '#FF9800',
    draw(c, r) {
      c.beginPath()
      c.moveTo(-r, -r * 0.5)
      c.lineTo(-r * 0.42, r * 0.06)
      c.lineTo(0, -r * 0.62)
      c.lineTo(r * 0.42, r * 0.06)
      c.lineTo(r, -r * 0.5)
      c.lineTo(r * 0.82, r * 0.66)
      c.lineTo(-r * 0.82, r * 0.66)
      c.closePath()
      fill(c, this.color)
      c.beginPath()
      circle(c, 0, -r * 0.72, r * 0.16)
      fill(c, '#FFCA28')
    },
  },
  // 음표
  {
    color: '#5C6BC0',
    draw(c, r) {
      c.beginPath()
      c.ellipse(-r * 0.3, r * 0.6, r * 0.44, r * 0.34, -0.35, 0, TAU)
      fill(c, this.color)
      c.beginPath()
      c.rect(r * 0.04, -r * 0.9, r * 0.16, r * 1.5)
      fill(c, this.color)
      c.beginPath()
      c.moveTo(r * 0.2, -r * 0.9)
      c.quadraticCurveTo(r * 0.86, -r * 0.7, r * 0.66, -r * 0.16)
      c.quadraticCurveTo(r * 0.66, -r * 0.5, r * 0.2, -r * 0.56)
      c.closePath()
      fill(c, this.color)
    },
  },
]
