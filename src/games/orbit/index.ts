import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { createState, fire, update, CENTER_X, CENTER_Y, CORE_R, SPAWN_R } from './state'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  color: string
}

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    leakFlash = Math.max(0, leakFlash - dt)
    const events = update(state, dt)
    if (events.kills.length > 0) {
      playMerge(Math.min(6, 2 + Math.floor(state.streak / 5)))
      vibrate(15)
      for (const k of events.kills) spawnBurst(k.x, k.y, '#FFB74D')
    }
    if (events.leaked) {
      vibrate(80)
      leakFlash = 0.45
    }
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.age += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.age > 0.5) particles.splice(i, 1)
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  const particles: Particle[] = []
  let leakFlash = 0
  let adContinueUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'ob.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adContinueUsed = false
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

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
  }

  async function gameOver() {
    playGameOver()
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown() {
      if (fire(state)) playDrop()
    },
    onMove() {},
    onUp() {},
  })

  const spawnBurst = (x: number, y: number, color: string) => {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      const v = 160 + Math.random() * 120
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, color })
    }
  }

  const draw = () => {
    const c = stage.begin('#0B0F2A', '#101638')

    // 궤도 링
    c.strokeStyle = 'rgb(255 255 255 / 0.08)'
    c.lineWidth = 2
    for (const r of [160, 270, 380]) {
      c.beginPath()
      c.arc(CENTER_X, CENTER_Y, r, 0, Math.PI * 2)
      c.stroke()
    }
    // 스폰 경계
    c.strokeStyle = 'rgb(255 255 255 / 0.05)'
    c.setLineDash([6, 10])
    c.beginPath()
    c.arc(CENTER_X, CENTER_Y, SPAWN_R, 0, Math.PI * 2)
    c.stroke()
    c.setLineDash([])

    // 코어 경고 영역
    c.save()
    c.fillStyle = leakFlash > 0 ? 'rgb(255 82 82 / 0.25)' : 'rgb(255 255 255 / 0.04)'
    c.beginPath()
    c.arc(CENTER_X, CENTER_Y, CORE_R, 0, Math.PI * 2)
    c.fill()
    c.restore()

    // 적
    for (const enemy of state.enemies) {
      const x = CENTER_X + Math.cos(enemy.angle) * enemy.r
      const y = CENTER_Y + Math.sin(enemy.angle) * enemy.r
      const armored = enemy.hp >= 2 || enemy.size > 26
      c.fillStyle = armored ? '#AB47BC' : '#FF7043'
      c.beginPath()
      c.arc(x, y, enemy.size, 0, Math.PI * 2)
      c.fill()
      if (armored && enemy.hp >= 2) {
        c.strokeStyle = '#E1BEE7'
        c.lineWidth = 4
        c.beginPath()
        c.arc(x, y, enemy.size - 5, 0, Math.PI * 2)
        c.stroke()
      }
      // 눈: 코어를 노려본다
      const toCore = Math.atan2(CENTER_Y - y, CENTER_X - x)
      const ex = Math.cos(toCore) * enemy.size * 0.35
      const ey = Math.sin(toCore) * enemy.size * 0.35
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.arc(x + ex - 7, y + ey, 6, 0, Math.PI * 2)
      c.arc(x + ex + 7, y + ey, 6, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#1A1A2E'
      c.beginPath()
      c.arc(x + ex - 7, y + ey, 2.8, 0, Math.PI * 2)
      c.arc(x + ex + 7, y + ey, 2.8, 0, Math.PI * 2)
      c.fill()
    }

    // 탄환
    for (const b of state.bullets) {
      c.save()
      c.shadowColor = '#80D8FF'
      c.shadowBlur = 12
      c.fillStyle = '#80D8FF'
      c.beginPath()
      c.arc(b.x, b.y, 9, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }

    // 파편
    for (const p of particles) {
      c.save()
      c.globalAlpha = 1 - p.age / 0.5
      c.fillStyle = p.color
      c.fillRect(p.x - 3, p.y - 3, 6, 6)
      c.restore()
    }

    // 포탑: 몸체 + 회전 포신
    c.fillStyle = '#1E2749'
    c.beginPath()
    c.arc(CENTER_X, CENTER_Y, 46, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = '#5C6BC0'
    c.lineWidth = 4
    c.beginPath()
    c.arc(CENTER_X, CENTER_Y, 46, 0, Math.PI * 2)
    c.stroke()
    c.save()
    c.translate(CENTER_X, CENTER_Y)
    c.rotate(state.angle)
    c.fillStyle = '#7986CB'
    c.beginPath()
    c.roundRect(20, -10, 52, 20, 8)
    c.fill()
    c.restore()
    c.fillStyle = '#C5CAE9'
    c.beginPath()
    c.arc(CENTER_X, CENTER_Y, 16, 0, Math.PI * 2)
    c.fill()

    // 조준선 (포신 방향 안내)
    c.save()
    c.strokeStyle = 'rgb(128 216 255 / 0.25)'
    c.lineWidth = 3
    c.setLineDash([10, 14])
    c.beginPath()
    c.moveTo(CENTER_X + Math.cos(state.angle) * 76, CENTER_Y + Math.sin(state.angle) * 76)
    c.lineTo(CENTER_X + Math.cos(state.angle) * SPAWN_R, CENTER_Y + Math.sin(state.angle) * SPAWN_R)
    c.stroke()
    c.restore()

    // 스트릭
    if (state.streak >= 3) {
      c.font = 'bold 34px sans-serif'
      c.textAlign = 'center'
      c.fillStyle = '#FFD54F'
      c.fillText(`x${state.streak}`, CENTER_X, CENTER_Y - 110)
    }

    // HUD: 점수 카드 + 생명
    c.textBaseline = 'alphabetic'
    c.textAlign = 'center'
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.1
    c.beginPath()
    c.roundRect(160, 24, 400, 130, 24)
    c.fill()
    c.restore()
    c.fillStyle = 'rgb(255 255 255 / 0.5)'
    c.font = '18px sans-serif'
    c.fillText(t('hud.score'), 360, 56)
    c.fillStyle = '#FFFFFF'
    c.font = 'bold 48px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 112)
    c.font = 'bold 28px sans-serif'
    c.fillText('❤'.repeat(Math.max(0, state.lives)) || '', 360, 146)
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return shell
}

export default defineGame(createSession)
