import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createClearBonus } from '../clearBonus'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { drawPlant } from './plantArt'
import {
  COLS,
  LAYOUT,
  MAX_LEVEL,
  ROWS,
  cellPos,
  clearLowestItems,
  createState,
  dropItem,
  generate,
  hasEmptyCell,
  indexAt,
  reviveWithTime,
  stageGoal,
  stageSeconds,
  update,
} from './state'

const REVIVE_SECONDS = 60

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    const events = update(state, dt)
    if (events.timeUp) void gameOver()
    if (events.nextStage) playMerge(4)
    genShake = Math.max(0, genShake - dt)
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].age += dt
      if (popups[i].age > 1.1) popups.splice(i, 1)
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, LAYOUT.width, LAYOUT.height)
  const state = createState()
  const popups: Array<{ x: number; y: number; text: string; age: number }> = []
  let adReviveUsed = false
  const bonus = createClearBonus(shell, ctx, 'merge-clear')
  let drag: { from: number; x: number; y: number } | null = null
  let genShake = 0 // 자리가 없을 때 생성 버튼 흔들림

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'merge.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adReviveUsed = false
      Object.assign(state, createState())
      popups.length = 0
      overlay.hide()
    },
    onContinue() {
      void reviveWithAd()
    },
  })

  // 광고 보상: 시간을 되살리고 자리도 비워 같은 스테이지를 이어간다 (판당 1회)
  async function reviveWithAd() {
    if (state.phase !== 'over' || adReviveUsed) return
    const rewarded = await ctx.showRewardAd('merge-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adReviveUsed = true
    clearLowestItems(state)
    reviveWithTime(state, REVIVE_SECONDS)
    overlay.hide()
  }

  // 스테이지 클리어로 받은 남은 시간 보너스를 한 번 더 준다
  async function offerStageBonus(points: number) {
    if (!(await bonus.offer(points)) || shell.isDestroyed()) return
    state.score = Math.min(1_000_000, state.score + points)
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adReviveUsed)
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
          // 상위 식물이 터지면 확실히 느끼도록 강조
          if (result.level >= 8) {
            playMerge(result.level)
            vibrate([15, 30, 15])
          }
        } else {
          // 자리가 없어 생성이 막힌 경우 — 왜 안 되는지 바로 알 수 있게 반응을 준다
          genShake = 0.35
          vibrate(40)
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
      if (!result.merged) return
      playMerge(result.newLevel)
      vibrate(12)
      if (result.harvested) {
        const col = to % COLS
        const row = Math.floor(to / COLS)
        const [px, py] = cellPos(col, row)
        const cellSize = LAYOUT.cell - LAYOUT.gap * 2
        popups.push({ x: px + cellSize / 2, y: py, text: '🏆', age: 0 })
        vibrate([25, 40, 25])
      }
      if (result.stageClear) void offerStageBonus(state.lastBonus)
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

    const card = (x: number, y: number, w: number, h: number) => {
      c.save()
      c.fillStyle = '#FFFFFF'
      c.globalAlpha = 0.75
      c.beginPath()
      c.roundRect(x, y, w, h, 20)
      c.fill()
      c.restore()
    }

    // HUD: 스테이지 · 점수 · 황금 화분 진행
    c.textAlign = 'center'
    card(30, 24, 150, 80)
    c.fillStyle = '#A1887F'
    c.font = '18px sans-serif'
    c.fillText(t('merge.stageLabel'), 105, 50)
    c.fillStyle = '#5D4037'
    c.font = 'bold 34px sans-serif'
    c.fillText(String(state.stage), 105, 88)

    card(196, 24, 244, 80)
    c.fillStyle = '#5D4037'
    c.font = 'bold 42px sans-serif'
    c.fillText(state.score.toLocaleString(), 318, 80)

    const goal = stageGoal(state.stage)
    card(456, 24, 234, 80)
    drawPlant(c, 496, 66, 26, MAX_LEVEL)
    c.fillStyle = '#5D4037'
    c.font = 'bold 34px sans-serif'
    c.fillText(`${state.goldMade} / ${goal}`, 600, 78)

    // 남은 시간 바
    const total = stageSeconds(state.stage)
    const ratio = Math.max(0, Math.min(1, state.timeLeft / total))
    const barX = 45
    const barW = 630
    const barY = 122
    const barH = 30
    c.save()
    c.fillStyle = 'rgb(93 64 55 / 0.15)'
    c.beginPath()
    c.roundRect(barX, barY, barW, barH, 15)
    c.fill()
    c.restore()
    const urgent = state.timeLeft <= 30 && state.phase === 'playing'
    if (ratio > 0) {
      c.fillStyle = ratio > 0.5 ? '#66BB6A' : ratio > 0.25 ? '#FFA726' : '#EF5350'
      c.save()
      if (urgent) c.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(state.hintTime * 6))
      c.beginPath()
      c.roundRect(barX, barY, Math.max(barH, barW * ratio), barH, 15)
      c.fill()
      c.restore()
    }
    const mm = Math.floor(state.timeLeft / 60)
    const ss = String(Math.floor(state.timeLeft % 60)).padStart(2, '0')
    c.fillStyle = '#FFFFFF'
    c.font = 'bold 21px sans-serif'
    c.textBaseline = 'middle'
    c.fillText(`${mm}:${ss}`, barX + barW / 2, barY + barH / 2 + 1)
    c.textBaseline = 'alphabetic'

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

    // 드래그 중인 아이템 + 놓을 자리 표시
    if (drag) {
      const item = state.grid[drag.from]
      if (item) {
        const to = indexAt(drag.x, drag.y)
        if (to >= 0 && to !== drag.from) {
          const target = state.grid[to]
          const mergeable = target !== null && target.level === item.level && item.level < MAX_LEVEL
          const [tx, ty] = cellPos(to % COLS, Math.floor(to / COLS))
          c.save()
          c.strokeStyle = mergeable || target === null ? '#43A047' : '#BCAAA4'
          c.lineWidth = 5
          c.setLineDash(mergeable || target === null ? [] : [10, 8])
          c.beginPath()
          c.roundRect(tx, ty, cellSize, cellSize, 14)
          c.stroke()
          c.restore()
        }
        drawPlant(c, drag.x, drag.y - 70, cellSize * 0.46, item.level)
      }
    }

    // 수확 연출
    for (const popup of popups) {
      c.save()
      c.globalAlpha = 1 - popup.age / 1.1
      c.font = 'bold 58px sans-serif'
      c.textAlign = 'center'
      c.fillText(popup.text, popup.x, popup.y - popup.age * 70)
      c.restore()
    }

    // 자리가 없으면 무엇을 해야 하는지 알린다
    const roomLeft = hasEmptyCell(state)
    if (!roomLeft && state.phase === 'playing') {
      c.textAlign = 'center'
      c.fillStyle = '#8D6E63'
      c.font = 'bold 26px sans-serif'
      c.fillText(t('merge.full'), 360, 176)
    }

    // 생성 버튼 (쿨다운 없음 — 자리가 없을 때만 비활성)
    const gb = LAYOUT.genButton
    c.save()
    if (genShake > 0) c.translate(Math.sin(state.hintTime * 60) * 8 * (genShake / 0.35), 0)
    c.fillStyle = roomLeft ? '#2E7D32' : '#9E9E9E'
    c.beginPath()
    c.roundRect(gb.x, gb.y + 6, gb.w, gb.h, 24)
    c.fill()
    c.fillStyle = roomLeft ? '#43A047' : '#BDBDBD'
    c.beginPath()
    c.roundRect(gb.x, gb.y, gb.w, gb.h, 24)
    c.fill()
    drawPlant(c, gb.x + 62, gb.y + gb.h / 2 + 4, 30, 1)
    c.textAlign = 'center'
    c.fillStyle = '#FFFFFF'
    c.font = 'bold 34px sans-serif'
    c.fillText(t('merge.gen'), gb.x + gb.w / 2 + 30, gb.y + gb.h / 2 + 12)
    c.restore()

    // 텍스트 없는 조작 안내: 생성 버튼을 누르라는 표식
    if (!state.hintDone && state.phase === 'playing' && !drag) {
      const k = (state.hintTime % 1.6) / 1.6
      c.save()
      c.globalAlpha = 0.5 * (1 - k)
      c.strokeStyle = '#2E7D32'
      c.lineWidth = 5
      c.beginPath()
      c.roundRect(gb.x - k * 24, gb.y - k * 20, gb.w + k * 48, gb.h + k * 40, 24 + k * 20)
      c.stroke()
      c.restore()
    }

    // 스테이지 완료 연출
    if (state.phase === 'stageClear') {
      c.save()
      c.fillStyle = 'rgb(62 39 35 / 0.55)'
      c.fillRect(0, 0, LAYOUT.width, LAYOUT.height)
      c.textAlign = 'center'
      c.fillStyle = '#FFFFFF'
      c.font = 'bold 48px sans-serif'
      c.fillText(t('merge.clear', { n: state.stage }), 360, 560)
      c.fillStyle = '#FFD54F'
      c.font = 'bold 62px sans-serif'
      c.fillText(`+${state.lastBonus.toLocaleString()}`, 360, 650)
      c.fillStyle = 'rgb(255 255 255 / 0.85)'
      c.font = '28px sans-serif'
      c.fillText(t('merge.nextStage', { n: state.stage + 1, g: stageGoal(state.stage + 1) }), 360, 720)
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
