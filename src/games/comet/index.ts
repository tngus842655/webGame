import { t } from '@/shared/i18n'
import { playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  MAX_MISS,
  createState,
  endStroke,
  extendStroke,
  resetMisses,
  startStroke,
  update,
  type Comet,
  type Point,
} from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'
import { drawIconRow } from '../icons'

// 별밤 — 판마다 같은 하늘을 쓰려고 모듈을 읽을 때 한 번만 만든다.
// 멀고 흐린 별과 가깝고 밝은 별을 나눠 하늘에 깊이를 준다.
const STARS = Array.from({ length: 120 }, (_, i) => {
  const near = i % 5 === 0
  return {
    x: ((i * 149) % 71) * 10.4 + 6,
    y: ((i * 71) % 121) * 10.6 + 8,
    r: near ? 1.6 + (i % 3) * 0.5 : 0.7 + (i % 3) * 0.3,
    a: near ? 0.5 + (i % 3) * 0.14 : 0.14 + (i % 4) * 0.05,
    phase: (i % 7) * 0.9,
  }
})

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  r: number
  color: string
}

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    const events = update(state, dt)
    if (events.missed) {
      playSfx('fail')
      vibrate(70)
      missFlash = 1
      missMark = events.missedAt
    }
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    stepEffects(dt)
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('fail', 'gameover', 'pop', 'whoosh')
  const sparks: Spark[] = []
  // 이번 획에서 터뜨린 자리 — 이것들을 순서대로 이어야 '이었다'는 느낌이 난다
  let chain: Point[] = []
  let chainFade = 0
  let flash = 0
  let missFlash = 0
  let missMark: Point | null = null
  let adResetUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'cm.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adResetUsed = false
      Object.assign(state, createState())
      sparks.length = 0
      chain = []
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  async function continueWithAd() {
    if (state.phase !== 'over' || adResetUsed) return
    const rewarded = await ctx.showRewardAd('comet-reset-miss')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adResetUsed = true
    resetMisses(state)
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adResetUsed, 'over.byLives')
  }

  const burst = (x: number, y: number) => {
    for (let i = 0; i < 11; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 120 + Math.random() * 280
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        age: 0,
        life: 0.5,
        r: 2.5 + Math.random() * 4,
        color: i % 3 === 0 ? '#FFFFFF' : i % 3 === 1 ? '#FFD54F' : '#FF8A65',
      })
    }
  }

  const stepEffects = (dt: number) => {
    flash = Math.max(0, flash - dt * 3.4)
    missFlash = Math.max(0, missFlash - dt * 1.6)
    if (chainFade > 0) {
      chainFade = Math.max(0, chainFade - dt * 1.5)
      if (chainFade === 0) chain = []
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]
      s.age += dt
      if (s.age >= s.life) {
        sparks.splice(i, 1)
        continue
      }
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vy += 620 * dt
      s.vx *= 1 - dt * 1.2
    }
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      startStroke(state, p.x, p.y)
      playSfx('whoosh', { gain: 0.5 })
      chain = []
      chainFade = 0
    },
    onMove(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      const before = state.bursts.length
      const cut = extendStroke(state, p.x, p.y)
      if (cut === 0) return
      // 방금 터진 자리를 체인에 잇는다 (state.bursts 뒤쪽에 새로 붙는다)
      for (let i = before; i < state.bursts.length; i++) {
        const b = state.bursts[i]
        chain.push({ x: b.x, y: b.y })
        burst(b.x, b.y)
      }
      const n = state.stroke?.cuts ?? 1
      // 이을수록 음이 올라간다 — 몇 개째인지 소리로 센다
      playSfx('pop', { rate: Math.min(1.7, 1 + (n - 1) * 0.09) })
      vibrate(12)
      flash = Math.min(1, 0.25 + n * 0.18)
    },
    onUp() {
      const chained = endStroke(state)
      if (chained >= 3) vibrate([15, 35, 25])
      if (chain.length > 0) chainFade = 1
    },
  })

  // 별똥별 — 진행 방향 뒤로 꼬리가 식으며 흐르고, 머리에서 빛이 뻗는다
  const drawComet = (comet: Comet) => {
    const c = stage.c
    // 곧 화면 밖으로 떨어질 별똥별은 붉게 알려준다
    const falling = comet.vy > 0 && comet.y > 1020
    const warn = falling ? Math.min(1, (comet.y - 1020) / 200) : 0

    for (let i = 1; i < comet.trail.length; i++) {
      const k = i / comet.trail.length
      c.save()
      c.globalAlpha = k * k * 0.75
      c.strokeStyle = k < 0.4 ? '#E64A19' : k < 0.75 ? '#FFB74D' : '#FFE082'
      c.lineWidth = comet.r * k * 1.05
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(comet.trail[i - 1].x, comet.trail[i - 1].y)
      c.lineTo(comet.trail[i].x, comet.trail[i].y)
      c.stroke()
      c.restore()
    }

    c.save()
    c.translate(comet.x, comet.y)
    // 머리에서 십자로 뻗는 빛
    c.globalAlpha = 0.5
    c.fillStyle = '#FFF3E0'
    for (const rot of [0, Math.PI / 2]) {
      c.save()
      c.rotate(rot + state.playTime * 0.6)
      c.beginPath()
      c.moveTo(0, -comet.r * 2.5)
      c.lineTo(comet.r * 0.34, 0)
      c.lineTo(0, comet.r * 2.5)
      c.lineTo(-comet.r * 0.34, 0)
      c.closePath()
      c.fill()
      c.restore()
    }
    c.globalAlpha = 1
    c.shadowColor = warn > 0 ? '#FF5252' : '#FFD54F'
    c.shadowBlur = 24
    const core = c.createRadialGradient(-comet.r * 0.3, -comet.r * 0.3, 0, 0, 0, comet.r)
    core.addColorStop(0, '#FFFFFF')
    core.addColorStop(0.5, '#FFE082')
    core.addColorStop(1, warn > 0 ? '#FF7043' : '#FFA726')
    c.fillStyle = core
    c.beginPath()
    c.arc(0, 0, comet.r, 0, Math.PI * 2)
    c.fill()
    c.restore()

    if (warn > 0) {
      c.save()
      c.globalAlpha = warn * (0.4 + 0.6 * Math.sin(state.playTime * 16))
      c.strokeStyle = '#FF5252'
      c.lineWidth = 4
      c.beginPath()
      c.arc(comet.x, comet.y, comet.r + 12, 0, Math.PI * 2)
      c.stroke()
      c.restore()
    }
  }

  const drawSky = (c: CanvasRenderingContext2D) => {
    const sky = c.createLinearGradient(0, 0, 0, 1280)
    sky.addColorStop(0, '#050A1E')
    sky.addColorStop(0.55, '#131A44')
    sky.addColorStop(1, '#241436')
    c.fillStyle = sky
    c.fillRect(0, 0, 720, 1280)

    // 은하수 — 하늘을 가로지르는 옅은 띠
    c.save()
    c.translate(360, 560)
    c.rotate(-0.42)
    const milky = c.createLinearGradient(0, -150, 0, 150)
    milky.addColorStop(0, 'rgb(150 170 255 / 0)')
    milky.addColorStop(0.5, 'rgb(170 180 255 / 0.09)')
    milky.addColorStop(1, 'rgb(150 170 255 / 0)')
    c.fillStyle = milky
    c.fillRect(-620, -150, 1240, 300)
    c.restore()

    for (const s of STARS) {
      c.globalAlpha = s.a * (0.65 + 0.35 * Math.sin(state.playTime * 1.3 + s.phase))
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1

    // 아래쪽 언덕 — 별똥별이 솟아오르는 곳. 자를 수 있는 자리를 가리지 않게 낮게 둔다.
    c.fillStyle = '#150C24'
    c.beginPath()
    c.moveTo(0, 1280)
    c.lineTo(0, 1252)
    c.quadraticCurveTo(180, 1214, 380, 1246)
    c.quadraticCurveTo(560, 1272, 720, 1238)
    c.lineTo(720, 1280)
    c.closePath()
    c.fill()
  }

  const draw = () => {
    const c = stage.begin('#03060F', '#050A1E')
    drawSky(c)

    // 여러 개를 이어 터뜨릴수록 하늘이 밝아진다
    if (flash > 0) {
      c.fillStyle = `rgb(255 235 190 / ${flash * 0.14})`
      c.fillRect(0, 0, 720, 1280)
    }

    for (const comet of state.comets) drawComet(comet)

    // 이번 획으로 이은 자리들 — 별자리처럼 선으로 묶인다
    if (chain.length >= 2) {
      const alpha = chainFade > 0 ? chainFade : 1
      c.save()
      c.globalAlpha = alpha
      c.shadowColor = '#FFECB3'
      c.shadowBlur = 18
      c.strokeStyle = '#FFF59D'
      c.lineWidth = 3
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(chain[0].x, chain[0].y)
      for (const p of chain) c.lineTo(p.x, p.y)
      c.stroke()
      c.fillStyle = '#FFFDE7'
      for (const p of chain) {
        c.beginPath()
        c.arc(p.x, p.y, 5, 0, Math.PI * 2)
        c.fill()
      }
      c.restore()
    }

    // 터진 자리
    for (const b of state.bursts) {
      const p = b.age / 0.5
      c.save()
      c.globalAlpha = 1 - p
      c.strokeStyle = '#FFECB3'
      c.lineWidth = 5 * (1 - p) + 1
      c.beginPath()
      c.arc(b.x, b.y, 20 + p * 58, 0, Math.PI * 2)
      c.stroke()
      c.restore()
    }

    for (const s of sparks) {
      const k = s.age / s.life
      c.globalAlpha = 1 - k * k
      c.fillStyle = s.color
      c.beginPath()
      c.arc(s.x, s.y, s.r * (1 - k * 0.55), 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1

    // 그은 궤적
    const stroke = state.stroke
    if (stroke && stroke.points.length > 1) {
      c.save()
      c.globalAlpha = stroke.active ? 1 : 1 - stroke.age / 0.35
      c.shadowColor = '#4DD0E1'
      c.shadowBlur = 18
      c.strokeStyle = '#B2EBF2'
      c.lineWidth = 7
      c.lineCap = 'round'
      c.lineJoin = 'round'
      c.beginPath()
      c.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (const p of stroke.points) c.lineTo(p.x, p.y)
      c.stroke()
      // 획 끝에 붙어 있는 빛 — 지금 손끝이 어디인지
      if (stroke.active) {
        const tip = stroke.points[stroke.points.length - 1]
        c.fillStyle = '#E0F7FA'
        c.beginPath()
        c.arc(tip.x, tip.y, 9, 0, Math.PI * 2)
        c.fill()
      }
      c.restore()
    }

    for (const pop of state.pops) {
      const k = pop.age / 1.1
      c.save()
      c.globalAlpha = Math.max(0, 1 - k)
      c.font = font(34, true)
      c.textAlign = 'center'
      c.lineJoin = 'round'
      c.lineWidth = 7
      c.strokeStyle = 'rgb(5 10 30 / 0.8)'
      c.strokeText(pop.text, pop.x, pop.y - 40 - pop.age * 40)
      c.fillStyle = '#FFF59D'
      c.fillText(pop.text, pop.x, pop.y - 40 - pop.age * 40)
      c.restore()
    }

    // 놓친 자리 — 화면 아래로 흘러나간 곳에 붉은 자국이 남는다
    if (missFlash > 0) {
      const x = missMark?.x ?? 360
      c.save()
      c.globalAlpha = missFlash
      const streak = c.createLinearGradient(0, 1280, 0, 1130)
      streak.addColorStop(0, 'rgb(255 82 82 / 0.5)')
      streak.addColorStop(1, 'rgb(255 82 82 / 0)')
      c.fillStyle = streak
      c.fillRect(x - 70, 1130, 140, 150)
      c.restore()
    }

    // 글자 없는 조작 안내 — 첫 별똥별 위로 손끝이 지나가 보인다
    if (state.score === 0 && !state.stroke && state.comets.length > 0) {
      const target = state.comets.reduce((a, b) => (a.y < b.y ? a : b))
      const k = (state.playTime % 1.9) / 1.9
      const run = Math.min(1, k / 0.68)
      const x0 = target.x - 140
      const x1 = target.x + 140
      const tipX = x0 + (x1 - x0) * run
      c.save()
      c.globalAlpha = k > 0.86 ? (1 - k) / 0.14 : 0.7
      c.strokeStyle = '#B2EBF2'
      c.lineWidth = 6
      c.lineCap = 'round'
      c.beginPath()
      c.moveTo(x0, target.y)
      c.lineTo(tipX, target.y)
      c.stroke()
      c.fillStyle = 'rgb(224 247 250 / 0.85)'
      c.beginPath()
      c.arc(tipX, target.y, 14, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }

    // HUD: 점수 + 최다 연결 + 남은 기회
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: state.bestChain >= 2,
    })
    if (state.bestChain >= 2) {
      c.font = font(20)
      c.textAlign = 'center'
      c.fillStyle = 'rgb(255 255 255 / 0.6)'
      c.fillText(t('cm.chain', { n: state.bestChain }), SCORE_PANEL.cx, SCORE_PANEL.subY)
    }
    // 놓칠 때마다 표가 흔들려 눈이 그쪽으로 간다
    const jitter = missFlash > 0 ? Math.sin(missFlash * 40) * 6 * missFlash : 0
    drawIconRow(c, 'cross', 638 + jitter, 58, 12, state.misses, MAX_MISS)
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
