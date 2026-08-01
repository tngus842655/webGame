import { t } from '@/shared/i18n'
import { playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createResumeGate } from '../resumeGate'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  AIR_BAR_BOTTOM,
  GROUND_Y,
  JUMP_V,
  PLAYER_W,
  PLAYER_X,
  START_SPAWN_DELAY,
  createState,
  scoreOf,
  update,
} from './state'
import { drawScorePanel, font } from '../ui'
import { ground } from '../scene'

// 먼지·반짝임 한 알
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  r: number
  color: string
}

const SPARK_LIFE = 0.5
const DUST_LIFE = 0.42
const POPUP_LIFE = 0.8

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    if (state.phase === 'playing') {
      const result = update(state, dt)
      if (result.landed) {
        playSfx('impact', { gain: 0.5 })
        landFx = 1
        puffDust(6, 0.7)
      }
      for (const spot of result.coinSpots) {
        burstCoin(spot.x, spot.y)
        popups.push({ x: spot.x, y: spot.y, age: 0 })
      }
      if (result.coinsTaken > 0) playSfx('coin')
      if (result.died) void gameOver()
    }
    stepEffects(dt)
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('coin', 'gameover', 'impact', 'whoosh')
  let adContinueUsed = false

  // 착지 눌림(1 → 0으로 잦아든다)과 도약 늘어남
  let landFx = 0
  let jumpFx = 0
  const particles: Particle[] = []
  const popups: Array<{ x: number; y: number; age: number }> = []

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'run.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adContinueUsed = false
      Object.assign(state, createState())
      particles.length = 0
      popups.length = 0
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })
  // 오버레이보다 뒤에 붙어야 그 위를 덮는다
  const gate = createResumeGate(shell)

  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('runner_continue')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.obstacles = []
    state.playerY = GROUND_Y
    state.vy = 0
    // 장애물을 비워도 스폰 타이머가 그대로면 죽기 직전 값(거의 0)이라 곧바로 다음
    // 장애물이 날아온다. 광고를 보고 돌아온 사람에게 준비할 틈이 없어, 시작할 때와
    // 같은 여유를 준다 — 다른 게임들이 무적 시간이나 조준 대기로 주는 것과 같은 몫이다.
    state.spawnTimer = START_SPAWN_DELAY
    state.phase = 'playing'
    overlay.hide()
    await gate.wait()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const score = scoreOf(state)
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  // 발밑에서 뒤로 흩어지는 흙먼지
  const puffDust = (count: number, power: number) => {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: PLAYER_X + (Math.random() - 0.5) * 24,
        y: GROUND_Y - 2,
        vx: -110 - Math.random() * 190 * power,
        vy: -40 - Math.random() * 130 * power,
        age: 0,
        life: DUST_LIFE,
        r: 5 + Math.random() * 7,
        color: '#C7A98B',
      })
    }
  }

  const burstCoin = (x: number, y: number) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.4
      const speed = 150 + Math.random() * 160
      particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 60,
        age: 0,
        life: SPARK_LIFE,
        r: 3 + Math.random() * 3,
        color: i % 2 === 0 ? '#FFE082' : '#FFB300',
      })
    }
  }

  const stepEffects = (dt: number) => {
    landFx = Math.max(0, landFx - dt * 5)
    jumpFx = Math.max(0, jumpFx - dt * 5)
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.age += dt
      if (p.age >= p.life) {
        particles.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 900 * dt
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].age += dt
      if (popups[i].age >= POPUP_LIFE) popups.splice(i, 1)
    }
  }

  const detachInput = attachInput(stage.canvas, {
    onDown() {
      if (state.phase !== 'playing' || state.jumpsLeft <= 0) return
      // 땅에서 차고 나갈 때만 먼지가 인다 (2단 점프는 공중이라 밟을 게 없다)
      if (state.playerY >= GROUND_Y - 1) puffDust(5, 1)
      state.vy = JUMP_V
      state.jumpsLeft -= 1
      jumpFx = 1
      playSfx('whoosh')
    },
    onMove() {},
    onUp() {},
  })

  // 먼 산 — 가장 느리게 흐르는 배경 층
  const drawFarRange = (c: CanvasRenderingContext2D, scroll: number) => {
    c.save()
    c.fillStyle = ground('#BFE0C4', '#1E3A2A')
    for (let i = -1; i < 5; i++) {
      const hx = ((i * 260 - scroll * 0.08) % 1560 + 1560) % 1560 - 260
      c.beginPath()
      c.moveTo(hx - 190, GROUND_Y)
      c.lineTo(hx - 40, GROUND_Y - 300)
      c.lineTo(hx + 20, GROUND_Y - 218)
      c.lineTo(hx + 90, GROUND_Y - 336)
      c.lineTo(hx + 240, GROUND_Y)
      c.closePath()
      c.fill()
    }
    // 능선의 잔설처럼 보이는 밝은 면
    c.fillStyle = 'rgb(255 255 255 / 0.5)'
    for (let i = -1; i < 5; i++) {
      const hx = ((i * 260 - scroll * 0.08) % 1560 + 1560) % 1560 - 260
      c.beginPath()
      c.moveTo(hx + 90, GROUND_Y - 336)
      c.lineTo(hx + 132, GROUND_Y - 270)
      c.lineTo(hx + 96, GROUND_Y - 258)
      c.lineTo(hx + 68, GROUND_Y - 288)
      c.closePath()
      c.fill()
    }
    c.restore()
  }

  // 바위 — 사각형이 아니라 깎인 면이 있는 돌덩이
  const drawRock = (c: CanvasRenderingContext2D, x: number, w: number, h: number) => {
    const bottom = GROUND_Y
    const top = GROUND_Y - h
    c.save()
    // 바닥 그림자
    c.fillStyle = 'rgb(62 39 35 / 0.18)'
    c.beginPath()
    c.ellipse(x + w / 2, bottom + 4, w * 0.62, 9, 0, 0, Math.PI * 2)
    c.fill()

    const face = c.createLinearGradient(x, top, x, bottom)
    face.addColorStop(0, '#8D9AA3')
    face.addColorStop(1, '#5C6B75')
    c.fillStyle = face
    c.beginPath()
    c.moveTo(x, bottom)
    c.lineTo(x + w * 0.1, top + h * 0.28)
    c.lineTo(x + w * 0.42, top)
    c.lineTo(x + w * 0.78, top + h * 0.12)
    c.lineTo(x + w, bottom)
    c.closePath()
    c.fill()

    // 빛 받는 왼쪽 면
    c.fillStyle = 'rgb(255 255 255 / 0.22)'
    c.beginPath()
    c.moveTo(x + w * 0.1, top + h * 0.28)
    c.lineTo(x + w * 0.42, top)
    c.lineTo(x + w * 0.46, bottom)
    c.lineTo(x + w * 0.2, bottom)
    c.closePath()
    c.fill()

    // 갈라진 금
    c.strokeStyle = 'rgb(38 50 56 / 0.35)'
    c.lineWidth = Math.max(2, w * 0.05)
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(x + w * 0.58, top + h * 0.2)
    c.lineTo(x + w * 0.68, top + h * 0.55)
    c.lineTo(x + w * 0.6, bottom - h * 0.1)
    c.stroke()
    c.restore()
  }

  // 달리는 사람 — 머리·몸통·팔다리를 따로 움직이고 목도리로 속도감을 준다
  const drawPlayer = (c: CanvasRenderingContext2D, scroll: number) => {
    const airborne = state.playerY < GROUND_Y - 1
    const cycle = scroll * 0.055
    const swing = Math.sin(cycle)
    // 착지 순간 납작해졌다가 튀어오르며 늘어난다
    const squashY = 1 - landFx * 0.16 + jumpFx * 0.1
    const squashX = 1 + landFx * 0.18 - jumpFx * 0.08

    c.save()
    // 그림자는 높이 뛸수록 작고 옅어진다 (지금 얼마나 떠 있는지 알려준다)
    const airGap = Math.min(1, (GROUND_Y - state.playerY) / 260)
    c.globalAlpha = 0.2 * (1 - airGap * 0.75)
    c.fillStyle = '#3E2723'
    c.beginPath()
    c.ellipse(PLAYER_X, GROUND_Y + 6, PLAYER_W * 0.46 * (1 - airGap * 0.35), 8, 0, 0, Math.PI * 2)
    c.fill()
    c.restore()

    c.save()
    c.translate(PLAYER_X, state.playerY)
    c.scale(squashX, squashY)
    // 달릴 때 앞으로 살짝 기운다
    c.rotate(airborne ? -0.06 : 0.05)

    // 목도리 — 뒤로 나부낀다
    c.save()
    c.strokeStyle = '#26A69A'
    c.lineWidth = 9
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(-4, -42)
    c.quadraticCurveTo(-26, -46 + swing * 5, -46, -34 + swing * 10)
    c.stroke()
    c.lineWidth = 6
    c.beginPath()
    c.moveTo(-6, -38)
    c.quadraticCurveTo(-24, -32 - swing * 6, -40, -22 - swing * 8)
    c.stroke()
    c.restore()

    // 뒤쪽 다리 → 몸통 → 앞쪽 다리 순으로 겹친다
    c.strokeStyle = '#37474F'
    c.lineWidth = 8
    c.lineCap = 'round'
    const leg = (dir: number, phase: number) => {
      c.beginPath()
      c.moveTo(dir * 5, -16)
      if (airborne) {
        // 공중에서는 앞뒤로 벌린 자세
        c.quadraticCurveTo(dir * 14, -8, dir * 20 * (dir > 0 ? 1 : 1.2), dir > 0 ? -4 : -10)
      } else {
        c.quadraticCurveTo(dir * 6 + phase * 10, -8, dir * 4 + phase * 20, phase > 0 ? -2 : 0)
      }
      c.stroke()
    }
    leg(-1, -swing)
    leg(1, swing)

    // 몸통
    const body = c.createLinearGradient(0, -46, 0, -14)
    body.addColorStop(0, '#FF8A65')
    body.addColorStop(1, '#E64A19')
    c.fillStyle = body
    c.beginPath()
    c.roundRect(-15, -46, 30, 32, 12)
    c.fill()

    // 팔 — 다리와 반대 위상
    c.strokeStyle = '#E64A19'
    c.lineWidth = 7
    c.beginPath()
    c.moveTo(0, -40)
    if (airborne) c.quadraticCurveTo(16, -50, 22, -58)
    else c.quadraticCurveTo(10 - swing * 12, -34, 6 - swing * 22, -26)
    c.stroke()

    // 머리
    c.fillStyle = '#FFCCBC'
    c.beginPath()
    c.arc(2, -60, 14, 0, Math.PI * 2)
    c.fill()
    // 앞으로 쏠린 머리칼
    c.fillStyle = '#4E342E'
    c.beginPath()
    c.moveTo(-12, -64)
    c.quadraticCurveTo(-2, -78, 15, -68)
    c.quadraticCurveTo(4, -70, -12, -64)
    c.closePath()
    c.fill()
    // 눈·입 (달리는 쪽을 본다)
    c.fillStyle = '#3E2723'
    c.beginPath()
    c.ellipse(9, -60, 2.6, 3.4, 0, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = '#3E2723'
    c.lineWidth = 2
    c.lineCap = 'round'
    c.beginPath()
    c.arc(8, -54, 4.5, -0.1 * Math.PI, 0.5 * Math.PI)
    c.stroke()
    c.restore()
  }

  const draw = () => {
    const c = stage.begin(ground('#9FD3E8', '#0E1E2A'), ground('#E1F5FE', '#152A38'))
    const scroll = state.distance

    // 하늘
    const sky = c.createLinearGradient(0, 0, 0, GROUND_Y)
    sky.addColorStop(0, ground('#63BFEA', '#101F30'))
    sky.addColorStop(0.55, ground('#A9DEF4', '#183245'))
    sky.addColorStop(1, ground('#DDF3FB', '#22465A'))
    c.fillStyle = sky
    c.fillRect(0, 0, 720, GROUND_Y)

    // 해
    c.save()
    c.fillStyle = ground('rgb(255 245 200 / 0.85)', 'rgb(226 238 255 / 0.7)')
    c.beginPath()
    c.arc(596, 150, 52, 0, Math.PI * 2)
    c.fill()
    c.globalAlpha = 0.25
    c.beginPath()
    c.arc(596, 150, 78, 0, Math.PI * 2)
    c.fill()
    c.restore()

    // 구름 (가장 느린 시차)
    c.save()
    c.fillStyle = 'rgb(255 255 255 / 0.88)'
    for (const [ox, oy, os] of [[0, 200, 1], [300, 320, 0.8], [560, 150, 0.9]] as Array<
      [number, number, number]
    >) {
      const cx = (((ox - scroll * 0.05) % 1000) + 1000) % 1000 - 140
      c.beginPath()
      c.arc(cx, oy, 34 * os, 0, Math.PI * 2)
      c.arc(cx + 38 * os, oy - 12 * os, 44 * os, 0, Math.PI * 2)
      c.arc(cx + 82 * os, oy, 32 * os, 0, Math.PI * 2)
      c.fill()
    }
    c.restore()

    drawFarRange(c, scroll)

    // 앞산
    c.save()
    c.fillStyle = '#8CC98F'
    for (let i = -1; i < 4; i++) {
      const hx = (((i * 320 - scroll * 0.25) % 1280) + 1280) % 1280 - 320
      c.beginPath()
      c.moveTo(hx - 160, GROUND_Y)
      c.quadraticCurveTo(hx, GROUND_Y - 220, hx + 160, GROUND_Y)
      c.closePath()
      c.fill()
    }
    c.restore()

    // 땅: 흙 그라데이션 + 잔디 + 흐르는 자갈
    const dirt = c.createLinearGradient(0, GROUND_Y, 0, 1280)
    dirt.addColorStop(0, ground('#A1785F', '#3B2A20'))
    dirt.addColorStop(1, ground('#6D4C41', '#281C16'))
    c.fillStyle = dirt
    c.fillRect(0, GROUND_Y, 720, 1280 - GROUND_Y)
    c.fillStyle = '#7CB342'
    c.fillRect(0, GROUND_Y, 720, 16)
    c.fillStyle = '#9CCC65'
    c.fillRect(0, GROUND_Y, 720, 6)

    // 잔디 술 — 흐르는 속도가 눈에 보이게 한다
    c.save()
    c.strokeStyle = '#689F38'
    c.lineWidth = 3
    c.lineCap = 'round'
    for (let i = 0; i < 16; i++) {
      const gx = (((i * 52 - scroll) % 832) + 832) % 832 - 56
      c.beginPath()
      c.moveTo(gx, GROUND_Y + 2)
      c.lineTo(gx + 5, GROUND_Y - 11)
      c.moveTo(gx + 9, GROUND_Y + 2)
      c.lineTo(gx + 12, GROUND_Y - 8)
      c.stroke()
    }
    c.fillStyle = 'rgb(62 39 35 / 0.16)'
    for (let i = 0; i < 10; i++) {
      const gx = (((i * 90 - scroll) % 900) + 900) % 900 - 90
      c.beginPath()
      c.ellipse(gx, GROUND_Y + 58, 22, 7, 0, 0, Math.PI * 2)
      c.ellipse(gx + 46, GROUND_Y + 128, 30, 9, 0, 0, Math.PI * 2)
      c.fill()
    }
    c.restore()

    // 장애물
    for (const o of state.obstacles) {
      if (o.air) {
        // 천장에서 내려온 벽 — 아래 틈으로만 지나갈 수 있다는 게 한눈에 보여야 한다
        const h = AIR_BAR_BOTTOM
        c.save()
        const grad = c.createLinearGradient(o.x, 0, o.x, h)
        grad.addColorStop(0, '#F57C00')
        grad.addColorStop(1, '#FFB74D')
        c.fillStyle = grad
        c.beginPath()
        c.roundRect(o.x, -20, o.w, h + 20, [0, 0, 12, 12])
        c.fill()
        // 아래끝 경고 줄무늬 (지나갈 틈의 높이를 눈으로 재게 해준다)
        c.save()
        c.beginPath()
        c.rect(o.x, h - 70, o.w, 70)
        c.clip()
        c.strokeStyle = 'rgb(62 39 35 / 0.35)'
        c.lineWidth = 9
        for (let sx = -70; sx < o.w + 70; sx += 26) {
          c.beginPath()
          c.moveTo(o.x + sx, h)
          c.lineTo(o.x + sx + 70, h - 70)
          c.stroke()
        }
        c.restore()
        c.fillStyle = '#E65100'
        c.fillRect(o.x, h - 8, o.w, 8)
        c.restore()
      } else {
        drawRock(c, o.x, o.w, o.h)
      }
    }

    // 코인 (회전 + 테두리 + 반짝임)
    for (const coin of state.coins) {
      const spin = Math.abs(Math.cos(scroll * 0.02 + coin.x * 0.02))
      const bob = Math.sin(state.time * 4 + coin.x * 0.03) * 4
      c.save()
      c.translate(coin.x, coin.y + bob)
      c.fillStyle = '#C88A16'
      c.beginPath()
      c.ellipse(0, 0, 18 * spin + 3, 18, 0, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#FFC93C'
      c.beginPath()
      c.ellipse(0, 0, 15 * spin + 2.4, 15, 0, 0, Math.PI * 2)
      c.fill()
      if (spin > 0.35) {
        c.fillStyle = 'rgb(255 255 255 / 0.7)'
        c.beginPath()
        c.ellipse(-5 * spin, -6, 3.5 * spin, 5, -0.4, 0, Math.PI * 2)
        c.fill()
      }
      c.restore()
    }

    drawPlayer(c, scroll)

    // 먼지·반짝임
    for (const p of particles) {
      const k = p.age / p.life
      c.globalAlpha = 1 - k * k
      c.fillStyle = p.color
      c.beginPath()
      c.arc(p.x, p.y, p.r * (1 - k * 0.5), 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1

    // 코인 점수 팝업
    c.textAlign = 'center'
    c.font = font(30, true)
    for (const p of popups) {
      const k = p.age / POPUP_LIFE
      c.globalAlpha = 1 - k * k
      c.lineWidth = 6
      c.strokeStyle = 'rgb(255 255 255 / 0.9)'
      c.strokeText('+3', p.x, p.y - k * 46)
      c.fillStyle = '#F57F17'
      c.fillText('+3', p.x, p.y - k * 46)
    }
    c.globalAlpha = 1

    drawScorePanel(c, {
      label: t('hud.score'),
      value: scoreOf(state).toLocaleString(),
      panelColor: ground('rgb(255 255 255 / 0.85)', 'rgb(10 20 30 / 0.86)'),
      labelColor: ground('#90CAF9', '#7FA6C9'),
      valueColor: ground('#0D47A1', '#D7E9FF'),
    })

    // 텍스트 없는 조작 안내: 위로 튀는 탭 표식
    if (state.time < 4 && state.phase === 'playing') {
      const k = (state.time % 1.2) / 1.2
      const lift = Math.sin(k * Math.PI) * 40
      c.save()
      c.globalAlpha = 0.55
      c.fillStyle = '#0D47A1'
      c.beginPath()
      c.arc(360, 620 - lift, 18, 0, Math.PI * 2)
      c.fill()
      c.globalAlpha = 0.3
      c.beginPath()
      c.arc(360, 620 - lift, 30 + lift * 0.3, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => scoreOf(state) }
}

export default defineGame(createSession)
