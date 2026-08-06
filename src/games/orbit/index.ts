import { playGameOver, playMerge, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createResumeGate } from '../resumeGate'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { createState, fire, update, CENTER_X, CENTER_Y, CORE_R, SPAWN_R } from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'
import { drawIconRow } from '../icons'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  r: number
  rot: number
  spin: number
  shard: boolean // true = 회전하는 파편, false = 둥근 불티
  color: string
}

const POPUP_LIFE = 0.75

// 별 — 판마다 같은 하늘을 쓰려고 모듈을 읽을 때 한 번만 만든다
const STARS = Array.from({ length: 78 }, () => ({
  x: Math.random() * 720,
  y: Math.random() * 1280,
  r: 0.7 + Math.random() * 1.9,
  a: 0.16 + Math.random() * 0.44,
  phase: Math.random() * Math.PI * 2,
}))

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    const events = update(state, dt)
    if (events.kills.length > 0) {
      playMerge(Math.min(6, 2 + Math.floor(state.streak / 5)))
      vibrate(15)
      playSfx('explode')
      for (const k of events.kills) {
        burstKill(k.x, k.y)
        popups.push({ x: k.x, y: k.y, gain: k.gain, age: 0 })
      }
    }
    if (events.leaked) {
      playSfx('hurt')
      vibrate(80)
      leakFlash = 1
      shake = 1
    }
    // 빗나가서 연속 명중이 끊긴 순간 — 왜 끊겼는지 보이지 않으면 억울하다.
    // lastStreak은 아직 이번 프레임 전 값이라 "잃을 게 있었는지"를 여기서 안다.
    if (events.missed && lastStreak >= 3) streakBreak = 1
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    stepEffects(dt)
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('explode', 'gameover', 'hurt', 'merge', 'shoot')
  const particles: Particle[] = []
  const popups: Array<{ x: number; y: number; gain: number; age: number }> = []
  let leakFlash = 0
  let shake = 0
  let recoil = 0 // 발사 반동 (포신이 뒤로 밀렸다 돌아온다)
  let streakPop = 0
  let streakBreak = 0
  let adContinueUsed = false
  let lastStreak = 0
  let hasFired = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'ob.ad',
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

  // 광고 보상: 생명 2를 받고 화면을 비운 채 이어하기 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('orbit-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.lives = 2
    state.enemies = []
    state.bullets = []
    state.phase = 'playing'
    overlay.hide()
    await gate.wait()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adContinueUsed, 'over.byLives')
  }

  const push = (p: Partial<Particle> & { x: number; y: number; color: string }) => {
    particles.push({
      vx: 0,
      vy: 0,
      age: 0,
      life: 0.5,
      r: 5,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 14,
      shard: false,
      ...p,
    })
  }

  // 격추 — 부서진 조각이 흩어지고 중심에서 불티가 튄다
  const burstKill = (x: number, y: number) => {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5
      const v = 150 + Math.random() * 190
      push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.55,
        r: 5 + Math.random() * 5,
        shard: true,
        color: i % 3 === 0 ? '#FFCC80' : '#FF7043',
      })
    }
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 60 + Math.random() * 210
      push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.36,
        r: 3 + Math.random() * 3,
        color: '#FFF3E0',
      })
    }
  }

  const stepEffects = (dt: number) => {
    leakFlash = Math.max(0, leakFlash - dt * 2.2)
    shake = Math.max(0, shake - dt * 3)
    recoil = Math.max(0, recoil - dt * 7)
    streakPop = Math.max(0, streakPop - dt * 4)
    streakBreak = Math.max(0, streakBreak - dt * 1.8)
    if (state.streak > lastStreak) streakPop = 1
    lastStreak = state.streak
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.age += dt
      if (p.age >= p.life) {
        particles.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 1 - dt * 1.6
      p.vy *= 1 - dt * 1.6
      p.rot += p.spin * dt
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].age += dt
      if (popups[i].age >= POPUP_LIFE) popups.splice(i, 1)
    }
  }

  const detachInput = attachInput(stage.canvas, {
    onDown() {
      if (!fire(state)) return
      playSfx('shoot')
      recoil = 1
      hasFired = true
    },
    onMove() {},
    onUp() {},
  })

  // 돌진체 — 코어를 향해 날아드는 쐐기. 어디로 가는지가 실루엣에 드러난다.
  const drawRusher = (c: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number) => {
    c.save()
    c.translate(x, y)
    c.rotate(dir)
    // 뒤로 끌리는 추진 불꽃 — 접근 속도가 눈에 보인다
    c.fillStyle = 'rgb(255 138 60 / 0.45)'
    c.beginPath()
    c.moveTo(-s * 0.5, -s * 0.3)
    c.lineTo(-s * 1.7, 0)
    c.lineTo(-s * 0.5, s * 0.3)
    c.closePath()
    c.fill()

    const body = c.createLinearGradient(-s, -s, s, s)
    body.addColorStop(0, '#FFAB91')
    body.addColorStop(0.5, '#FF7043')
    body.addColorStop(1, '#BF360C')
    c.fillStyle = body
    c.beginPath()
    c.moveTo(s * 1.05, 0)
    c.lineTo(-s * 0.5, -s * 0.78)
    c.lineTo(-s * 0.18, 0)
    c.lineTo(-s * 0.5, s * 0.78)
    c.closePath()
    c.fill()
    // 위쪽 날에 빛 (광원 왼쪽 위)
    c.fillStyle = 'rgb(255 255 255 / 0.32)'
    c.beginPath()
    c.moveTo(s * 1.05, 0)
    c.lineTo(-s * 0.5, -s * 0.78)
    c.lineTo(-s * 0.35, -s * 0.34)
    c.closePath()
    c.fill()
    // 외눈 — 코어 쪽을 본다
    c.fillStyle = '#FFF8E1'
    c.beginPath()
    c.ellipse(s * 0.18, 0, s * 0.3, s * 0.24, 0, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#3E1F0D'
    c.beginPath()
    c.ellipse(s * 0.28, 0, s * 0.13, s * 0.16, 0, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }

  // 장갑체 — 앞에 방패를 댄 육중한 육각형. 방패가 깨져 있으면 한 대 남았다는 뜻이다.
  const drawBrute = (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    s: number,
    dir: number,
    shielded: boolean,
  ) => {
    c.save()
    c.translate(x, y)
    c.rotate(dir)
    const body = c.createLinearGradient(-s, -s, s, s)
    body.addColorStop(0, '#D8A6E4')
    body.addColorStop(0.5, '#AB47BC')
    body.addColorStop(1, '#5E2A6B')
    c.fillStyle = body
    c.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const px = Math.cos(a) * s * 0.92
      const py = Math.sin(a) * s * 0.92
      if (i === 0) c.moveTo(px, py)
      else c.lineTo(px, py)
    }
    c.closePath()
    c.fill()
    c.fillStyle = 'rgb(255 255 255 / 0.22)'
    c.beginPath()
    c.moveTo(-s * 0.46, -s * 0.8)
    c.lineTo(s * 0.46, -s * 0.8)
    c.lineTo(s * 0.92, 0)
    c.lineTo(-s * 0.92, 0)
    c.closePath()
    c.fill()

    if (shielded) {
      // 성한 방패
      c.fillStyle = '#EDE0F5'
      c.beginPath()
      c.moveTo(s * 0.55, -s * 0.86)
      c.lineTo(s * 1.16, -s * 0.34)
      c.lineTo(s * 1.16, s * 0.34)
      c.lineTo(s * 0.55, s * 0.86)
      c.closePath()
      c.fill()
      c.fillStyle = 'rgb(120 60 140 / 0.45)'
      c.beginPath()
      c.roundRect(s * 0.72, -s * 0.42, s * 0.22, s * 0.84, s * 0.1)
      c.fill()
    } else {
      // 깨진 방패 — 조각만 남는다
      c.fillStyle = '#C9B3D6'
      c.beginPath()
      c.moveTo(s * 0.55, -s * 0.86)
      c.lineTo(s * 1.06, -s * 0.42)
      c.lineTo(s * 0.66, -s * 0.22)
      c.closePath()
      c.moveTo(s * 0.6, s * 0.34)
      c.lineTo(s * 1.02, s * 0.5)
      c.lineTo(s * 0.55, s * 0.86)
      c.closePath()
      c.fill()
    }
    // 눈 — 방패 뒤에서 코어를 노려본다
    c.fillStyle = '#FFF8E1'
    c.beginPath()
    c.ellipse(0, -s * 0.16, s * 0.22, s * 0.18, 0, 0, Math.PI * 2)
    c.ellipse(0, s * 0.24, s * 0.22, s * 0.18, 0, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#2B1233'
    c.beginPath()
    c.ellipse(s * 0.08, -s * 0.16, s * 0.1, s * 0.12, 0, 0, Math.PI * 2)
    c.ellipse(s * 0.08, s * 0.24, s * 0.1, s * 0.12, 0, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }

  // 포탑 — 받침·회전 포신·중심 코어를 나눠 그린다. 쏘면 포신이 뒤로 밀린다.
  const drawTurret = (c: CanvasRenderingContext2D) => {
    const pulse = 1 + Math.sin(state.playTime * 3) * 0.04

    c.save()
    c.translate(CENTER_X, CENTER_Y)
    // 받침 — 팔각 플랫폼
    c.fillStyle = '#161C3C'
    c.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      const px = Math.cos(a) * 50
      const py = Math.sin(a) * 50
      if (i === 0) c.moveTo(px, py)
      else c.lineTo(px, py)
    }
    c.closePath()
    c.fill()
    c.strokeStyle = '#5C6BC0'
    c.lineWidth = 3
    c.stroke()
    // 받침 볼트
    c.fillStyle = 'rgb(197 202 233 / 0.55)'
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      c.beginPath()
      c.arc(Math.cos(a) * 40, Math.sin(a) * 40, 2.6, 0, Math.PI * 2)
      c.fill()
    }

    // 포신 — 두 갈래
    c.save()
    c.rotate(state.angle)
    const back = -recoil * 9
    c.fillStyle = '#3C4785'
    c.beginPath()
    c.roundRect(10 + back, -18, 34, 36, 10)
    c.fill()
    for (const off of [-9, 9]) {
      c.fillStyle = '#7986CB'
      c.beginPath()
      c.roundRect(20 + back, off - 6, 54, 12, 6)
      c.fill()
      c.fillStyle = 'rgb(255 255 255 / 0.35)'
      c.beginPath()
      c.roundRect(22 + back, off - 5, 48, 4, 2)
      c.fill()
    }
    // 총구 섬광
    if (recoil > 0.25) {
      c.save()
      c.globalAlpha = (recoil - 0.25) / 0.75
      c.fillStyle = '#B3E5FC'
      c.beginPath()
      c.ellipse(80 + back, 0, 22, 15, 0, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.ellipse(76 + back, 0, 11, 8, 0, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
    c.restore()

    // 중심 코어 — 지켜야 하는 것. 살아 있는 것처럼 맥이 뛴다.
    const glow = c.createRadialGradient(0, 0, 0, 0, 0, 26 * pulse)
    glow.addColorStop(0, '#FFFFFF')
    glow.addColorStop(0.45, '#9FA8DA')
    glow.addColorStop(1, 'rgb(92 107 192 / 0.15)')
    c.fillStyle = glow
    c.beginPath()
    c.arc(0, 0, 26 * pulse, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }

  const drawBackdrop = (c: CanvasRenderingContext2D) => {
    const sky = c.createRadialGradient(CENTER_X, CENTER_Y, 60, CENTER_X, CENTER_Y, 760)
    sky.addColorStop(0, '#1B2352')
    sky.addColorStop(0.55, '#131A3E')
    sky.addColorStop(1, '#080C22')
    c.fillStyle = sky
    c.fillRect(0, 0, 720, 1280)

    for (const s of STARS) {
      c.globalAlpha = s.a * (0.65 + 0.35 * Math.sin(state.playTime * 1.6 + s.phase))
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1
  }

  // 궤도 링 — 아주 느리게 도는 눈금을 얹어 정지 화면처럼 보이지 않게 한다
  const drawOrbits = (c: CanvasRenderingContext2D) => {
    c.strokeStyle = 'rgb(255 255 255 / 0.07)'
    c.lineWidth = 2
    for (const r of [160, 270, 380]) {
      c.beginPath()
      c.arc(CENTER_X, CENTER_Y, r, 0, Math.PI * 2)
      c.stroke()
    }
    c.save()
    c.translate(CENTER_X, CENTER_Y)
    c.rotate(state.playTime * 0.06)
    c.strokeStyle = 'rgb(140 160 255 / 0.16)'
    c.lineWidth = 2
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      const long = i % 6 === 0
      c.beginPath()
      c.moveTo(Math.cos(a) * 380, Math.sin(a) * 380)
      c.lineTo(Math.cos(a) * (long ? 356 : 368), Math.sin(a) * (long ? 356 : 368))
      c.stroke()
    }
    c.restore()

    c.strokeStyle = 'rgb(255 255 255 / 0.05)'
    c.setLineDash([6, 10])
    c.beginPath()
    c.arc(CENTER_X, CENTER_Y, SPAWN_R, 0, Math.PI * 2)
    c.stroke()
    c.setLineDash([])
  }

  // 코어 방어선 — 여기 닿으면 생명이 준다. 적이 가까워진 쪽이 붉게 달아오른다.
  const drawCoreLine = (c: CanvasRenderingContext2D) => {
    c.save()
    c.fillStyle = leakFlash > 0 ? `rgb(255 82 82 / ${0.06 + leakFlash * 0.24})` : 'rgb(255 255 255 / 0.04)'
    c.beginPath()
    c.arc(CENTER_X, CENTER_Y, CORE_R, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = 'rgb(159 168 218 / 0.35)'
    c.lineWidth = 2
    c.setLineDash([4, 8])
    c.beginPath()
    c.arc(CENTER_X, CENTER_Y, CORE_R, 0, Math.PI * 2)
    c.stroke()
    c.setLineDash([])

    for (const enemy of state.enemies) {
      const near = 1 - Math.min(1, (enemy.r - CORE_R) / 120)
      if (near <= 0) continue
      c.strokeStyle = `rgb(255 82 82 / ${near * 0.8})`
      c.lineWidth = 4 + near * 4
      c.beginPath()
      c.arc(CENTER_X, CENTER_Y, CORE_R, enemy.angle - 0.35, enemy.angle + 0.35)
      c.stroke()
    }

    // 뚫렸을 때 퍼지는 파동
    if (leakFlash > 0) {
      const k = 1 - leakFlash
      c.strokeStyle = `rgb(255 82 82 / ${leakFlash * 0.8})`
      c.lineWidth = 8 * leakFlash
      c.beginPath()
      c.arc(CENTER_X, CENTER_Y, CORE_R + k * 260, 0, Math.PI * 2)
      c.stroke()
    }
    c.restore()
  }

  const drawBullets = (c: CanvasRenderingContext2D) => {
    for (const b of state.bullets) {
      const dir = Math.atan2(b.vy, b.vx)
      c.save()
      c.translate(b.x, b.y)
      c.rotate(dir)
      // 꼬리
      const tail = c.createLinearGradient(0, 0, -46, 0)
      tail.addColorStop(0, 'rgb(128 216 255 / 0.75)')
      tail.addColorStop(1, 'rgb(128 216 255 / 0)')
      c.fillStyle = tail
      c.beginPath()
      c.moveTo(0, -5)
      c.lineTo(-46, 0)
      c.lineTo(0, 5)
      c.closePath()
      c.fill()
      c.shadowColor = '#80D8FF'
      c.shadowBlur = 14
      c.fillStyle = '#E1F5FE'
      c.beginPath()
      c.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
  }

  const drawParticles = (c: CanvasRenderingContext2D) => {
    for (const p of particles) {
      const k = p.age / p.life
      c.save()
      c.globalAlpha = 1 - k * k
      c.fillStyle = p.color
      if (p.shard) {
        c.translate(p.x, p.y)
        c.rotate(p.rot)
        const s = p.r * (1 - k * 0.4)
        c.beginPath()
        c.moveTo(s, 0)
        c.lineTo(-s * 0.7, s * 0.8)
        c.lineTo(-s * 0.4, -s * 0.9)
        c.closePath()
        c.fill()
      } else {
        c.beginPath()
        c.arc(p.x, p.y, p.r * (1 - k * 0.6), 0, Math.PI * 2)
        c.fill()
      }
      c.restore()
    }
  }

  const draw = () => {
    const c = stage.begin('#060918', '#0B0F2A')
    drawBackdrop(c)

    // 코어가 뚫릴 때만 화면이 흔들린다 — 조준은 포신 각도로 하므로 흔들려도 오조준이 없다
    c.save()
    if (shake > 0) c.translate((Math.random() - 0.5) * 22 * shake, (Math.random() - 0.5) * 22 * shake)

    drawOrbits(c)
    drawCoreLine(c)

    for (const enemy of state.enemies) {
      const x = CENTER_X + Math.cos(enemy.angle) * enemy.r
      const y = CENTER_Y + Math.sin(enemy.angle) * enemy.r
      // 적은 코어를 향해 날아온다 — 몸통도 그쪽을 본다
      const dir = enemy.angle + Math.PI
      if (enemy.size > 26) drawBrute(c, x, y, enemy.size, dir, enemy.hp >= 2)
      else drawRusher(c, x, y, enemy.size, dir)
    }

    drawBullets(c)
    drawParticles(c)
    drawTurret(c)

    // 조준선 — 포신이 지금 어디를 겨누는지
    c.save()
    c.strokeStyle = 'rgb(128 216 255 / 0.22)'
    c.lineWidth = 3
    c.setLineDash([10, 14])
    c.beginPath()
    c.moveTo(CENTER_X + Math.cos(state.angle) * 82, CENTER_Y + Math.sin(state.angle) * 82)
    c.lineTo(CENTER_X + Math.cos(state.angle) * SPAWN_R, CENTER_Y + Math.sin(state.angle) * SPAWN_R)
    c.stroke()
    c.restore()

    // 격추 점수
    c.textAlign = 'center'
    c.textBaseline = 'alphabetic'
    c.font = font(28, true)
    for (const p of popups) {
      const k = p.age / POPUP_LIFE
      c.save()
      c.globalAlpha = 1 - k * k
      c.lineJoin = 'round'
      c.lineWidth = 6
      c.strokeStyle = 'rgb(10 14 35 / 0.8)'
      c.strokeText(`+${p.gain}`, p.x, p.y - 18 - k * 40)
      c.fillStyle = '#FFD54F'
      c.fillText(`+${p.gain}`, p.x, p.y - 18 - k * 40)
      c.restore()
    }

    // 연속 명중 — 오를 때 튀고, 빗나가 끊기면 붉게 흩어진다
    if (state.streak >= 3) {
      c.save()
      c.translate(CENTER_X, CENTER_Y - 116)
      c.scale(1 + streakPop * 0.25, 1 + streakPop * 0.25)
      c.font = font(34, true)
      c.fillStyle = '#FFD54F'
      c.shadowColor = 'rgb(0 0 0 / 0.5)'
      c.shadowBlur = 10
      c.fillText(`x${state.streak}`, 0, 0)
      c.restore()
    } else if (streakBreak > 0) {
      c.save()
      c.globalAlpha = streakBreak
      c.translate(CENTER_X, CENTER_Y - 116 - (1 - streakBreak) * 26)
      c.font = font(34, true)
      c.fillStyle = '#FF7043'
      c.fillText('x0', 0, 0)
      c.restore()
    }
    c.restore()

    // 붉은 테두리 — 코어가 뚫렸다
    if (leakFlash > 0) {
      const vignette = c.createRadialGradient(360, 640, 240, 360, 640, 800)
      vignette.addColorStop(0, 'rgb(255 40 60 / 0)')
      vignette.addColorStop(1, `rgb(255 40 60 / ${0.45 * leakFlash})`)
      c.fillStyle = vignette
      c.fillRect(0, 0, 720, 1280)
    }

    // HUD — 적이 사방에서 오므로 판을 좁게 잡아 시야를 덜 가린다
    drawScorePanel(c, {
      value: state.score.toLocaleString(),
      sub: true,
      compact: true,
    })
    const lives = Math.max(0, state.lives)
    drawIconRow(c, 'heart', SCORE_PANEL.cx, SCORE_PANEL.subY - 6, 13, lives, Math.max(3, lives))

    // 글자 없는 조작 안내 — 아무 데나 눌러 쏜다. 처음 한 번 쏘면 사라진다.
    if (state.phase === 'playing' && !hasFired) {
      const k = (state.playTime % 1.3) / 1.3
      c.save()
      c.globalAlpha = 0.5 * (1 - k)
      c.strokeStyle = '#80D8FF'
      c.lineWidth = 4
      c.beginPath()
      c.arc(CENTER_X, 1010, 26 + k * 44, 0, Math.PI * 2)
      c.stroke()
      c.globalAlpha = 0.7
      c.fillStyle = '#B3E5FC'
      c.beginPath()
      c.arc(CENTER_X, 1010, 22, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
