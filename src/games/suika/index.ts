import type { GameModule } from '../types'

// M1 더미 모듈: 허브 ↔ 게임 수명주기(mount/unmount) 계약 검증용.
// M2에서 실제 수박게임(matter.js)으로 교체한다.

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  hue: number
}

interface Session {
  stop(): void
}

const GRAVITY = 2200
const BOUNCE = 0.72
const MAX_DT = 0.032
const MAX_BALLS = 40

function start(host: HTMLElement): Session {
  const canvas = document.createElement('canvas')
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  canvas.style.touchAction = 'none'
  host.appendChild(canvas)

  const ctx2d = canvas.getContext('2d')
  if (!ctx2d) {
    canvas.remove()
    return { stop() {} }
  }

  const balls: Ball[] = []
  let width = 0
  let height = 0

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    width = host.clientWidth
    height = host.clientHeight
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  const spawn = (x: number, y: number) => {
    balls.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 200,
      vy: 0,
      r: 18 + Math.random() * 26,
      hue: Math.floor(Math.random() * 360),
    })
    if (balls.length > MAX_BALLS) balls.shift()
  }
  spawn(width / 2, 80)

  const onPointerDown = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect()
    spawn(e.clientX - rect.left, e.clientY - rect.top)
  }
  canvas.addEventListener('pointerdown', onPointerDown)

  const draw = () => {
    ctx2d.fillStyle = '#FFF8E1'
    ctx2d.fillRect(0, 0, width, height)

    for (const b of balls) {
      ctx2d.fillStyle = `hsl(${b.hue} 70% 60%)`
      ctx2d.beginPath()
      ctx2d.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      ctx2d.fill()

      const eye = Math.max(b.r * 0.1, 2)
      ctx2d.fillStyle = '#3E2723'
      ctx2d.beginPath()
      ctx2d.arc(b.x - b.r * 0.3, b.y - b.r * 0.2, eye, 0, Math.PI * 2)
      ctx2d.arc(b.x + b.r * 0.3, b.y - b.r * 0.2, eye, 0, Math.PI * 2)
      ctx2d.fill()
      ctx2d.strokeStyle = '#3E2723'
      ctx2d.lineWidth = Math.max(b.r * 0.06, 1.5)
      ctx2d.beginPath()
      ctx2d.arc(b.x, b.y + b.r * 0.15, b.r * 0.3, 0.2 * Math.PI, 0.8 * Math.PI)
      ctx2d.stroke()
    }

    ctx2d.fillStyle = '#8D6E63'
    ctx2d.font = '14px sans-serif'
    ctx2d.textAlign = 'center'
    ctx2d.fillText('탭해서 공 생성 — M1 더미 게임 (M2에서 교체)', width / 2, 60)
  }

  let rafId = 0
  let last = performance.now()
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, MAX_DT)
    last = now

    for (const b of balls) {
      b.vy += GRAVITY * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      if (b.x < b.r) {
        b.x = b.r
        b.vx = -b.vx * BOUNCE
      } else if (b.x > width - b.r) {
        b.x = width - b.r
        b.vx = -b.vx * BOUNCE
      }
      if (b.y > height - b.r) {
        b.y = height - b.r
        b.vy = -b.vy * BOUNCE
        b.vx *= 0.98
      }
    }

    draw()
    rafId = requestAnimationFrame(frame)
  }
  rafId = requestAnimationFrame(frame)

  return {
    stop() {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.remove()
    },
  }
}

let session: Session | null = null

const suikaGame: GameModule = {
  mount(host) {
    session = start(host)
  },
  unmount() {
    session?.stop()
    session = null
  },
}

export default suikaGame
