import { t } from '@/shared/i18n'
import { playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createResumeGate } from '../resumeGate'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { DISCS, DISC_R, GAUGE_MAX, createState, reviveWithTime, tapAt, update } from './state'
import { SYMBOLS } from './symbols'
import { drawScorePanel, font } from '../ui'

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    update(state, dt)
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    shake = Math.max(0, shake - dt * 3.4)
    for (let i = pops.length - 1; i >= 0; i--) {
      pops[i].age += dt
      if (pops[i].age > 0.8) pops.splice(i, 1)
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('fail', 'gameover', 'pop')
  const pops: Array<{ x: number; y: number; gain: number; age: number }> = []
  let shake = 0
  let adReviveUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'sp.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adReviveUsed = false
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  // 오버레이보다 뒤에 붙어야 그 위를 덮는다
  const gate = createResumeGate(shell)

  async function continueWithAd() {
    if (state.phase !== 'over' || adReviveUsed) return
    const rewarded = await ctx.showRewardAd('samepic-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adReviveUsed = true
    reviveWithTime(state)
    overlay.hide()
    await gate.wait()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adReviveUsed, 'over.byTime')
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      const before = state.score
      const result = tapAt(state, p.x, p.y)
      if (result === 'correct') {
        playSfx('pop', { rate: Math.min(1.6, 1 + Math.floor(state.combo / 3) * 0.08) })
        vibrate(12)
        // 연속 보너스가 붙는데 이번에 얼마를 받았는지 볼 곳이 없었다
        pops.push({ x: p.x, y: p.y, gain: state.score - before, age: 0 })
      } else if (result === 'wrong') {
        playSfx('fail')
        vibrate(90)
        shake = 1
      }
    },
    onMove() {},
    onUp() {},
  })

  const draw = () => {
    const c = stage.begin('#1A1330', '#241A42')

    c.save()
    if (shake > 0) c.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 10 * shake)

    // 첫 판에서 한참 못 찾으면 정답 두 개가 은은하게 맥동한다 —
    // '두 원판에 함께 있는 하나'라는 규칙을 그림으로 알려 준다
    const teaching = state.round === 1 && state.phase === 'playing' && state.playTime > 5

    for (let d = 0; d < DISCS.length; d++) {
      const disc = DISCS[d]
      // 원판에 두께를 준다 — 종잇장이 아니라 얹혀 있는 판으로 보이게
      c.fillStyle = 'rgb(0 0 0 / 0.3)'
      c.beginPath()
      c.arc(disc.x, disc.y + 7, DISC_R, 0, Math.PI * 2)
      c.fill()
      const face = c.createRadialGradient(
        disc.x - DISC_R * 0.3,
        disc.y - DISC_R * 0.34,
        10,
        disc.x,
        disc.y,
        DISC_R,
      )
      face.addColorStop(0, '#FFFDF2')
      face.addColorStop(1, '#F0E0BC')
      c.fillStyle = face
      c.beginPath()
      c.arc(disc.x, disc.y, DISC_R, 0, Math.PI * 2)
      c.fill()
      c.lineWidth = 5
      c.strokeStyle = 'rgb(60 40 20 / 0.35)'
      c.stroke()

      for (const p of state.discs[d]) {
        const isAnswer = p.sym === state.answer
        c.save()
        c.translate(disc.x + p.x, disc.y + p.y)
        c.rotate(p.rot)
        // 맞힌 직후에는 정답 그림이 커진다
        if (state.phase === 'resolve' && isAnswer) {
          const k = 1 - state.resolveTimer / 0.42
          c.scale(1 + Math.sin(k * Math.PI) * 0.22, 1 + Math.sin(k * Math.PI) * 0.22)
        }
        SYMBOLS[p.sym].draw(c, p.r)
        c.restore()
        // 정답을 맞힌 직후 양쪽 원판의 같은 그림에 표를 남긴다
        if (state.phase === 'resolve' && isAnswer) {
          c.strokeStyle = '#43A047'
          c.lineWidth = 5
          c.beginPath()
          c.arc(disc.x + p.x, disc.y + p.y, p.r + 12, 0, Math.PI * 2)
          c.stroke()
        }
        if (teaching && isAnswer) {
          c.save()
          c.globalAlpha = 0.2 + 0.3 * Math.sin(state.playTime * 3)
          c.strokeStyle = '#7E57C2'
          c.lineWidth = 5
          c.beginPath()
          c.arc(disc.x + p.x, disc.y + p.y, p.r + 14, 0, Math.PI * 2)
          c.stroke()
          c.restore()
        }
      }
    }

    // 두 그림을 잇는 실 — 고리만 두 개 켜지면 '두 개가 빛난다'로만 읽힌다.
    // 선이 있어야 '이 둘이 같은 그림'이라는 말이 된다.
    if (teaching) {
      const ends = DISCS.map((disc, d) => {
        const p = state.discs[d].find((s) => s.sym === state.answer)
        return p ? { x: disc.x + p.x, y: disc.y + p.y } : null
      })
      if (ends[0] && ends[1]) {
        c.save()
        c.globalAlpha = 0.2 + 0.16 * Math.sin(state.playTime * 3)
        c.strokeStyle = '#7E57C2'
        c.lineWidth = 4
        c.setLineDash([10, 12])
        c.lineDashOffset = -state.playTime * 30
        c.beginPath()
        c.moveTo(ends[0].x, ends[0].y)
        c.lineTo(ends[1].x, ends[1].y)
        c.stroke()
        c.restore()
      }
    }

    if (state.wrongFlash > 0 && state.wrongAt) {
      c.save()
      c.globalAlpha = state.wrongFlash / 0.4
      c.strokeStyle = '#E53935'
      c.lineWidth = 6
      c.beginPath()
      c.arc(state.wrongAt.x, state.wrongAt.y, 46 + (0.4 - state.wrongFlash) * 60, 0, Math.PI * 2)
      c.stroke()
      c.restore()
    }

    // 맞히고 받은 점수
    c.textAlign = 'center'
    c.font = font(30, true)
    for (const p of pops) {
      const k = p.age / 0.8
      c.save()
      c.globalAlpha = 1 - k * k
      c.lineJoin = 'round'
      c.lineWidth = 7
      c.strokeStyle = 'rgb(26 19 48 / 0.85)'
      c.strokeText(`+${p.gain}`, p.x, p.y - 30 - k * 40)
      c.fillStyle = '#FFD54F'
      c.fillText(`+${p.gain}`, p.x, p.y - 30 - k * 40)
      c.restore()
    }
    c.restore()

    // HUD: 공통 점수판 + 시간 게이지
    drawScorePanel(c, { label: t('hud.score'), value: state.score.toLocaleString() })
    if (state.combo >= 2) {
      c.fillStyle = '#FFD54F'
      c.font = font(28, true)
      c.textAlign = 'center'
      c.fillText(`x${state.combo}`, 646, 112)
    }

    const gw = 600
    c.fillStyle = 'rgb(255 255 255 / 0.12)'
    c.beginPath()
    c.roundRect(60, 148, gw, 20, 10)
    c.fill()
    const ratio = state.gauge / GAUGE_MAX
    c.fillStyle = state.gauge < 5 ? '#EF5350' : state.gauge < 10 ? '#FFB300' : '#66BB6A'
    c.beginPath()
    c.roundRect(60, 148, Math.max(6, gw * ratio), 20, 10)
    c.fill()
    // 시간이 얼마 안 남으면 게이지가 뛴다
    if (state.gauge < 5) {
      c.save()
      c.globalAlpha = 0.3 + 0.4 * Math.sin(state.playTime * 12)
      c.strokeStyle = '#EF5350'
      c.lineWidth = 4
      c.beginPath()
      c.roundRect(58, 146, gw + 4, 24, 12)
      c.stroke()
      c.restore()
    }

  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
