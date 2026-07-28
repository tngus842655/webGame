import { t } from '@/shared/i18n'
import { playGameOver, playMerge, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  BASE_Y,
  BLOCK_H,
  createState,
  movingY,
  place,
  reviveWithHalfWidth,
  update,
  worldTopY,
} from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'

// 층마다 색을 조금씩 돌려 위로 갈수록 색이 변하는 탑이 된다
const hueOf = (level: number) => (level * 11) % 360

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    update(state, dt)
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('gameover', 'impact', 'merge')
  let adReviveUsed = false

  // 밤하늘 별 — 카메라보다 천천히 흘러 높이감을 만든다
  const stars = Array.from({ length: 44 }, (_, i) => ({
    x: ((i * 137) % 71) * 10 + 8,
    y: ((i * 89) % 128) * 10,
    r: 1 + (i % 3) * 0.7,
  }))

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'st.ad',
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

  // 광고 보상: 폭을 처음의 절반까지 되돌려 무너진 자리에서 이어한다 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adReviveUsed) return
    const rewarded = await ctx.showRewardAd('stack-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adReviveUsed = true
    reviveWithHalfWidth(state)
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adReviveUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown() {
      const result = place(state)
      if (!result) return
      if (result.over) {
        vibrate(60)
      } else if (result.perfect) {
        playMerge(Math.min(6, 2 + state.combo))
        vibrate(12)
      } else {
        playSfx('impact')
      }
    },
    onMove() {},
    onUp() {},
  })

  // 납작한 색 띠였던 것을 윗면·앞면·그늘이 있는 덩어리로 그린다.
  // 쌓는 게임이라 화면의 거의 전부가 이 블록이다.
  const drawBlock = (x: number, screenY: number, w: number, level: number) => {
    const c = stage.c
    const hue = hueOf(level)
    const left = x - w / 2
    const lip = 9 // 윗면 두께

    // 앞면 — 위에서 아래로 어두워진다
    const face = c.createLinearGradient(0, screenY, 0, screenY + BLOCK_H)
    face.addColorStop(0, `hsl(${hue} 58% 58%)`)
    face.addColorStop(1, `hsl(${hue} 52% 41%)`)
    c.fillStyle = face
    c.beginPath()
    c.roundRect(left, screenY, w, BLOCK_H, 5)
    c.fill()

    // 윗면 — 빛을 받는 면
    const top = c.createLinearGradient(left, 0, left + w, 0)
    top.addColorStop(0, `hsl(${hue} 66% 78%)`)
    top.addColorStop(1, `hsl(${hue} 60% 66%)`)
    c.fillStyle = top
    c.beginPath()
    c.roundRect(left, screenY, w, lip, [5, 5, 0, 0])
    c.fill()

    // 왼쪽에서 들어오는 빛 / 오른쪽 그늘
    c.fillStyle = 'rgb(255 255 255 / 0.14)'
    c.fillRect(left, screenY + lip, Math.min(10, w * 0.12), BLOCK_H - lip)
    c.fillStyle = 'rgb(0 0 0 / 0.16)'
    c.fillRect(left + w - Math.min(10, w * 0.12), screenY + lip, Math.min(10, w * 0.12), BLOCK_H - lip)

    // 아래 그늘 — 층이 겹쳐 보이게 한다
    c.fillStyle = 'rgb(0 0 0 / 0.22)'
    c.beginPath()
    c.roundRect(left, screenY + BLOCK_H - 5, w, 5, [0, 0, 5, 5])
    c.fill()
  }

  const draw = () => {
    const c = stage.begin('#0A0E24', '#111838')
    const { camY } = state

    c.fillStyle = 'rgb(255 255 255 / 0.5)'
    for (const s of stars) {
      // 별은 카메라의 15%만 따라와 아주 천천히 내려온다
      const y = ((s.y + camY * 0.15) % 1360) - 40
      c.globalAlpha = 0.25 + (s.r - 1) * 0.25
      c.beginPath()
      c.arc(s.x, y, s.r, 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1

    // 지면
    const groundY = BASE_Y + camY
    if (groundY < 1280) {
      c.fillStyle = '#0C1230'
      c.fillRect(0, groundY, 720, 1280 - groundY)
      c.fillStyle = '#1B2450'
      c.fillRect(0, groundY, 720, 6)
    }

    // 탑
    for (let i = 0; i < state.blocks.length; i++) {
      const screenY = BASE_Y - (i + 1) * BLOCK_H + camY
      if (screenY > 1300 || screenY < -BLOCK_H) continue
      drawBlock(state.blocks[i].x, screenY, state.blocks[i].w, i)
    }

    // 떨어져 나간 조각
    for (const chip of state.chips) {
      c.save()
      c.globalAlpha = Math.max(0, 1 - chip.age / 1.1)
      c.translate(chip.x, chip.y + camY + BLOCK_H / 2)
      c.rotate(chip.spin * chip.age)
      const chipGrad = c.createLinearGradient(0, -BLOCK_H / 2, 0, BLOCK_H / 2)
      chipGrad.addColorStop(0, `hsl(${chip.hue % 360} 62% 66%)`)
      chipGrad.addColorStop(1, `hsl(${chip.hue % 360} 52% 44%)`)
      c.fillStyle = chipGrad
      c.beginPath()
      c.roundRect(-chip.w / 2, -BLOCK_H / 2, chip.w, BLOCK_H, 4)
      c.fill()
      c.restore()
    }

    const top = state.blocks[state.blocks.length - 1]
    const topScreenY = worldTopY(state) + camY

    if (state.phase === 'playing') {
      // 꼭대기 양 끝을 위로 연장한 안내선 — 눈으로 폭을 재기 쉽도록
      c.save()
      c.strokeStyle = 'rgb(255 255 255 / 0.14)'
      c.lineWidth = 2
      c.setLineDash([7, 11])
      for (const edge of [top.x - top.w / 2, top.x + top.w / 2]) {
        c.beginPath()
        c.moveTo(edge, topScreenY)
        c.lineTo(edge, movingY(state) + camY)
        c.stroke()
      }
      c.restore()
      drawBlock(state.moving.x, movingY(state) + camY, state.moving.w, state.blocks.length)
    }

    if (state.perfectFlash > 0) {
      c.save()
      c.globalAlpha = state.perfectFlash / 0.5
      c.strokeStyle = '#FFECB3'
      c.lineWidth = 4
      c.strokeRect(top.x - top.w / 2 - 4, topScreenY - 4, top.w + 8, BLOCK_H + 8)
      c.fillStyle = '#FFECB3'
      c.font = font(30, true)
      c.textAlign = 'center'
      c.fillText(
        state.combo >= 2 ? `${t('st.perfect')} x${state.combo}` : t('st.perfect'),
        top.x,
        topScreenY - 26,
      )
      c.restore()
    }

    // HUD: 점수 + 층수
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: true,
    })
    c.fillStyle = 'rgb(255 255 255 / 0.65)'
    c.font = font(20)
    c.fillText(t('st.floor', { n: state.blocks.length }), SCORE_PANEL.cx, SCORE_PANEL.subY)
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
