import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext, GameModule } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { CanvasStage } from '../stage'
import {
  COLS,
  GEN_COOLDOWN,
  ITEMS,
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

interface Session {
  destroy(): void
}

function createSession(host: HTMLElement, ctx: GameContext): Session {
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:absolute;inset:0;overflow:hidden;'
  host.appendChild(wrapper)

  const stage = new CanvasStage(wrapper, LAYOUT.width, LAYOUT.height)
  const state = createState()
  let destroyed = false
  let adClearUsed = false
  let drag: { from: number; x: number; y: number } | null = null

  const overlay = createGameOverOverlay(wrapper, {
    adButtonLabel: '▶ 광고 보고 하위 아이템 정리',
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
    if (destroyed || !rewarded || state.phase !== 'over') return
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
    if (destroyed || state.phase !== 'over') return
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
    const c = stage.begin('#FFE0B2', '#FFF8E1')

    // HUD
    c.textAlign = 'center'
    c.fillStyle = '#BCAAA4'
    c.font = '20px sans-serif'
    c.fillText(`점수 · 최고 발견: ${ITEMS[state.discovered - 1]}`, 360, 52)
    c.fillStyle = '#5D4037'
    c.font = 'bold 48px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 108)

    // 보드
    c.fillStyle = 'rgb(141 110 99 / 0.15)'
    c.beginPath()
    c.roundRect(
      LAYOUT.boardX - 8,
      LAYOUT.boardY - 8,
      COLS * LAYOUT.cell + 16,
      ROWS * LAYOUT.cell + 16,
      18,
    )
    c.fill()

    const cellSize = LAYOUT.cell - LAYOUT.gap * 2
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = row * COLS + col
        const [px, py] = cellPos(col, row)
        c.fillStyle = 'rgb(255 255 255 / 0.65)'
        c.beginPath()
        c.roundRect(px, py, cellSize, cellSize, 12)
        c.fill()
        const item = state.grid[idx]
        if (!item || drag?.from === idx) continue
        const scale = 1 + 0.2 * Math.sin(item.pop * Math.PI)
        c.font = `${Math.round(72 * scale)}px sans-serif`
        c.textAlign = 'center'
        c.fillText(ITEMS[item.level - 1], px + cellSize / 2, py + cellSize / 2 + 26 * scale)
        c.fillStyle = '#8D6E63'
        c.font = 'bold 18px sans-serif'
        c.fillText(`Lv.${item.level}`, px + cellSize / 2, py + cellSize - 8)
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
            c.strokeStyle = '#43A047'
            c.lineWidth = 5
            c.beginPath()
            c.roundRect(px, py, cellSize, cellSize, 12)
            c.stroke()
          }
        }
        c.font = '80px sans-serif'
        c.textAlign = 'center'
        c.fillText(ITEMS[item.level - 1], drag.x, drag.y - 60)
      }
    }

    // 생성 버튼
    const ready = state.genCooldown <= 0
    c.fillStyle = ready ? '#43A047' : '#A5D6A7'
    c.beginPath()
    c.roundRect(genButton.x, genButton.y, genButton.w, genButton.h, 20)
    c.fill()
    if (!ready) {
      c.fillStyle = 'rgb(0 0 0 / 0.12)'
      c.beginPath()
      c.roundRect(
        genButton.x,
        genButton.y,
        genButton.w * (state.genCooldown / GEN_COOLDOWN),
        genButton.h,
        20,
      )
      c.fill()
    }
    c.fillStyle = '#FFFFFF'
    c.font = 'bold 34px sans-serif'
    c.textAlign = 'center'
    c.fillText('🌱 생성', genButton.x + genButton.w / 2, genButton.y + genButton.h / 2 + 12)

    if (state.score === 0 && state.phase === 'playing') {
      c.fillStyle = '#8D6E63'
      c.font = '24px sans-serif'
      c.fillText('생성 버튼으로 아이템을 만들고,', 360, 1200)
      c.fillText('같은 아이템끼리 드래그해 합치세요!', 360, 1232)
    }
  }

  let rafId = 0
  let last = performance.now()
  const frame = (now: number) => {
    rafId = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    updateEffects(state, dt)
    draw()
  }

  const onVisibility = () => {
    if (destroyed) return
    if (document.hidden) {
      cancelAnimationFrame(rafId)
    } else {
      last = performance.now()
      rafId = requestAnimationFrame(frame)
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  rafId = requestAnimationFrame(frame)

  return {
    destroy() {
      destroyed = true
      cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', onVisibility)
      detachInput()
      stage.destroy()
      wrapper.remove()
    },
  }
}

let session: Session | null = null

const mergeGame: GameModule = {
  mount(host, ctx) {
    session = createSession(host, ctx)
  },
  unmount() {
    session?.destroy()
    session = null
  },
}

export default mergeGame
