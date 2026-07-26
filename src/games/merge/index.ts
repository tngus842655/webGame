import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { drawPlant } from './plantArt'
import {
  COLS,
  GEN_COOLDOWN,
  LAYOUT,
  ROWS,
  cellPos,
  clearLowestItems,
  createState,
  dropItem,
  generate,
  indexAt,
  updateEffects,
} from './state'

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    updateEffects(state, dt)
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, LAYOUT.width, LAYOUT.height)
  const state = createState()
  let adClearUsed = false
  let drag: { from: number; x: number; y: number } | null = null

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'merge.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adClearUsed = false
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void clearWithAd()
    },
  })

  async function clearWithAd() {
    if (state.phase !== 'over' || adClearUsed) return
    const rewarded = await ctx.showRewardAd('merge_clear')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adClearUsed = true
    clearLowestItems(state)
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adClearUsed)
  }

  const genButton = LAYOUT.genButton
  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      if (
        p.x >= genButton.x &&
        p.x <= genButton.x + genButton.w &&
        p.y >= genButton.y &&
        p.y <= genButton.y + genButton.h
      ) {
        const result = generate(state)
        if (result.ok) {
          playDrop()
          if (result.gameOver) void gameOver()
        }
        return
      }
      const idx = indexAt(p.x, p.y)
      if (idx >= 0 && state.grid[idx]) drag = { from: idx, x: p.x, y: p.y }
    },
    onMove(clientX, clientY) {
      if (!drag) return
      const p = stage.toBoard(clientX, clientY)
      drag.x = p.x
      drag.y = p.y
    },
    onUp(clientX, clientY) {
      if (!drag) return
      const current = drag
      drag = null
      const p = stage.toBoard(clientX, clientY)
      const to = indexAt(p.x, p.y)
      if (to < 0) return
      const result = dropItem(state, current.from, to)
      if (result.merged) {
        playMerge(result.newLevel)
        vibrate(12)
        if (result.gameOver) void gameOver()
      }
    },
  })

  const draw = () => {
    const c = stage.begin('#D9C3A0', '#FFF8E1')
    const sky = c.createLinearGradient(0, 0, 0, LAYOUT.height)
    sky.addColorStop(0, '#FFF4DA')
    sky.addColorStop(0.5, '#FFF8E1')
    sky.addColorStop(1, '#EFE0C0')
    c.fillStyle = sky
    c.fillRect(0, 0, LAYOUT.width, LAYOUT.height)

    // HUD: 점수 + 최고 발견 아이템
    c.textAlign = 'center'
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.75
    c.beginPath()
    c.roundRect(200, 30, 240, 88, 24)
    c.fill()
    c.restore()
    c.fillStyle = '#5D4037'
    c.font = 'bold 50px sans-serif'
    c.fillText(state.score.toLocaleString(), 320, 92)

    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.75
    c.beginPath()
    c.roundRect(470, 30, 110, 88, 24)
    c.fill()
    c.restore()
    drawPlant(c, 525, 78, 34, state.discovered)

    // 보드
    const boardW = COLS * LAYOUT.cell
    const boardH = ROWS * LAYOUT.cell
    c.save()
    c.fillStyle = 'rgb(255 255 255 / 0.45)'
    c.beginPath()
    c.roundRect(LAYOUT.boardX - 10, LAYOUT.boardY - 10, boardW + 20, boardH + 20, 22)
    c.fill()
    c.strokeStyle = 'rgb(141 110 99 / 0.28)'
    c.lineWidth = 3
    c.stroke()
    c.restore()

    const cellSize = LAYOUT.cell - LAYOUT.gap * 2
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = row * COLS + col
        const [px, py] = cellPos(col, row)
        c.fillStyle = 'rgb(93 64 55 / 0.07)'
        c.beginPath()
        c.roundRect(px, py, cellSize, cellSize, 14)
        c.fill()
        const item = state.grid[idx]
        if (!item || drag?.from === idx) continue
        const scale = 1 + 0.2 * Math.sin(item.pop * Math.PI)
        drawPlant(c, px + cellSize / 2, py + cellSize / 2, cellSize * 0.4 * scale, item.level)
      }
    }

    // 드래그 중 아이템
    if (drag) {
      const item = state.grid[drag.from]
      if (item) {
        const to = indexAt(drag.x, drag.y)
        if (to >= 0 && to !== drag.from) {
          const target = state.grid[to]
          if (target === null || target.level === item.level) {
            const [px, py] = cellPos(to % COLS, Math.floor(to / COLS))
            c.save()
            c.strokeStyle = target && target.level === item.level ? '#43A047' : '#BCAAA4'
            c.lineWidth = 5
            c.setLineDash(target ? [] : [10, 8])
            c.beginPath()
            c.roundRect(px, py, cellSize, cellSize, 14)
            c.stroke()
            c.restore()
          }
        }
        drawPlant(c, drag.x, drag.y - 70, cellSize * 0.46, item.level)
      }
    }

    // 생성 버튼
    const ready = state.genCooldown <= 0
    const gb = LAYOUT.genButton
    c.save()
    c.fillStyle = ready ? '#2E7D32' : '#9E9E9E'
    c.beginPath()
    c.roundRect(gb.x, gb.y + 6, gb.w, gb.h, 24)
    c.fill()
    c.fillStyle = ready ? '#43A047' : '#BDBDBD'
    c.beginPath()
    c.roundRect(gb.x, gb.y, gb.w, gb.h, 24)
    c.fill()
    if (!ready) {
      c.save()
      c.beginPath()
      c.roundRect(gb.x, gb.y, gb.w, gb.h, 24)
      c.clip()
      c.fillStyle = 'rgb(255 255 255 / 0.3)'
      c.fillRect(gb.x, gb.y, gb.w * (1 - state.genCooldown / GEN_COOLDOWN), gb.h)
      c.restore()
    }
    c.restore()
    drawPlant(c, gb.x + 62, gb.y + gb.h / 2 + 4, 30, 1)
    c.textAlign = 'center'
    c.fillStyle = '#FFFFFF'
    c.font = 'bold 34px sans-serif'
    c.fillText(t('merge.gen'), gb.x + gb.w / 2 + 30, gb.y + gb.h / 2 + 12)

    // 텍스트 없는 조작 안내: 생성 버튼 → 보드로 끌어가는 표식
    if (!state.hintDone && state.phase === 'playing' && !drag) {
      const k = (state.hintTime % 2.4) / 2.4
      const ease = k < 0.75 ? k / 0.75 : 1
      const fade = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25
      const sx = gb.x + gb.w / 2
      const sy = gb.y - 30
      const ex = LAYOUT.boardX + LAYOUT.cell * 2.5
      const ey = LAYOUT.boardY + LAYOUT.cell * 5.5
      const hx = sx + (ex - sx) * ease
      const hy = sy + (ey - sy) * ease
      c.save()
      c.globalAlpha = 0.45 * fade
      c.strokeStyle = '#8D6E63'
      c.lineWidth = 3
      c.setLineDash([8, 10])
      c.beginPath()
      c.moveTo(sx, sy)
      c.lineTo(hx, hy)
      c.stroke()
      c.setLineDash([])
      c.globalAlpha = 0.7 * fade
      c.fillStyle = '#8D6E63'
      c.beginPath()
      c.arc(hx, hy, 16, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
