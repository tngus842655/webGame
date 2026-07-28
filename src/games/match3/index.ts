import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  BOARD_X,
  BOARD_Y,
  CELL,
  COLS,
  CONTINUE_MOVES,
  FALL_SPEED,
  GEMS,
  ROWS,
  SWAP_DURATION,
  type GemShape,
} from './config'
import {
  POPUP_DURATION,
  SPARK_DURATION,
  addScore,
  applyGravity,
  createState,
  findMatches,
  gridTypes,
  hasPossibleMove,
  idx,
  shuffleGrid,
  swapCells,
  updateEffects,
  type Pos,
} from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'

// 보석 도형 패스 (중심 기준, stroke lineJoin=round로 모서리를 둥글린다)
function traceGem(c: CanvasRenderingContext2D, shape: GemShape) {
  c.beginPath()
  if (shape === 'circle') {
    c.arc(0, 0, 28, 0, Math.PI * 2)
  } else if (shape === 'diamond') {
    c.moveTo(0, -30)
    c.lineTo(26, 0)
    c.lineTo(0, 30)
    c.lineTo(-26, 0)
    c.closePath()
  } else if (shape === 'square') {
    c.roundRect(-24, -24, 48, 48, 10)
  } else if (shape === 'triangle') {
    c.moveTo(0, -26)
    c.lineTo(26, 20)
    c.lineTo(-26, 20)
    c.closePath()
  } else if (shape === 'hexagon') {
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3
      const x = Math.cos(a) * 28
      const y = Math.sin(a) * 28
      if (i === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.closePath()
  } else {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 28 : 12
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      if (i === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.closePath()
  }
}

function drawGem(c: CanvasRenderingContext2D, x: number, y: number, type: number, scale = 1) {
  const g = GEMS[type]
  c.save()
  c.translate(x, y)
  c.scale(scale, scale)
  // 바닥 그림자
  c.fillStyle = 'rgb(0 0 0 / 0.22)'
  c.beginPath()
  c.ellipse(0, 27, 23, 7, 0, 0, Math.PI * 2)
  c.fill()
  const grad = c.createRadialGradient(-10, -12, 4, 0, 0, 36)
  grad.addColorStop(0, g.light)
  grad.addColorStop(0.55, g.base)
  grad.addColorStop(1, g.dark)
  c.fillStyle = grad
  c.strokeStyle = grad
  c.lineWidth = 8
  c.lineJoin = 'round'
  traceGem(c, g.shape)
  c.fill()
  c.stroke()
  // 유리 하이라이트
  c.fillStyle = 'rgb(255 255 255 / 0.45)'
  c.beginPath()
  c.ellipse(-9, -13, 9, 5, -0.6, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

const cellX = (col: number) => BOARD_X + col * CELL + CELL / 2
const cellY = (row: number) => BOARD_Y + row * CELL + CELL / 2

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    step(dt)
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('gameover', 'pop', 'tap')
  let adContinueUsed = false
  let showHint = true // 첫 스왑 전까지 제스처 힌트 표시
  let dragFrom: { pos: Pos; x: number; y: number; done: boolean } | null = null

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'm3.ad',
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

  // 광고 보상: 이동 +5 하고 이어하기 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('match3-continue')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.moves += CONTINUE_MOVES
    if (!hasPossibleMove(gridTypes(state.grid))) shuffleGrid(state.grid)
    state.phase = 'idle'
    overlay.hide()
  }

  async function gameOver() {
    state.phase = 'over'
    state.selected = null
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  // 매치 제거: 점수·파티클·점수 팝업 → 낙하/보충 준비
  const clearMatches = (matches: Set<number>) => {
    const gained = matches.size * 10 * state.chain
    let cx = 0
    let cy = 0
    for (const i of matches) {
      const x = cellX(i % COLS)
      const y = cellY(Math.floor(i / COLS))
      cx += x
      cy += y
      const color = GEMS[state.grid[i].type].base
      for (let k = 0; k < 4; k++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 120 + Math.random() * 180
        state.sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 120,
          age: 0,
          color,
        })
      }
      state.grid[i].type = -1
    }
    state.popups.push({ x: cx / matches.size, y: cy / matches.size - 20, text: `+${gained}`, age: 0 })
    addScore(state, gained)
    applyGravity(state.grid)
    playSfx('pop', { rate: Math.min(1.7, 1 + Math.max(0, state.chain - 1) * 0.1) })
    vibrate(20)
  }

  // 연쇄 종료: 이동 소진이면 게임오버, 가능한 수 없으면 자동 셔플
  const endCascade = () => {
    state.chain = 0
    if (state.moves <= 0) {
      void gameOver()
      return
    }
    if (!hasPossibleMove(gridTypes(state.grid))) shuffleGrid(state.grid)
    state.phase = 'idle'
  }

  const step = (dt: number) => {
    updateEffects(state, dt)
    if ((state.phase === 'swap' || state.phase === 'revert') && state.swap) {
      const swap = state.swap
      swap.t += dt / SWAP_DURATION
      if (swap.t >= 1) {
        if (state.phase === 'swap') {
          swapCells(state.grid, swap.a, swap.b)
          const matches = findMatches(gridTypes(state.grid))
          if (matches.size > 0) {
            state.moves -= 1
            state.chain = 1
            state.swap = null
            clearMatches(matches)
            state.phase = 'fall'
          } else {
            // 매치 실패: 커밋 취소 후 되돌아오는 애니메이션 (이동 미차감)
            swapCells(state.grid, swap.a, swap.b)
            swap.t = 0
            state.phase = 'revert'
          }
        } else {
          state.swap = null
          state.phase = 'idle'
        }
      }
    } else if (state.phase === 'fall') {
      let settled = true
      for (const cell of state.grid) {
        if (cell.offsetY < 0) {
          cell.offsetY = Math.min(0, cell.offsetY + FALL_SPEED * dt)
          if (cell.offsetY < 0) settled = false
        }
      }
      if (settled) {
        const matches = findMatches(gridTypes(state.grid))
        if (matches.size > 0) {
          state.chain += 1
          clearMatches(matches)
        } else {
          endCascade()
        }
      }
    }
  }

  const cellAt = (x: number, y: number): Pos | null => {
    const col = Math.floor((x - BOARD_X) / CELL)
    const row = Math.floor((y - BOARD_Y) / CELL)
    return col >= 0 && col < COLS && row >= 0 && row < ROWS ? { col, row } : null
  }

  const trySwap = (a: Pos, b: Pos) => {
    if (state.phase !== 'idle') return
    showHint = false
    state.selected = null
    state.swap = { a, b, t: 0 }
    state.phase = 'swap'
    playDrop()
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'idle') return
      const p = stage.toBoard(clientX, clientY)
      const pos = cellAt(p.x, p.y)
      if (pos) dragFrom = { pos, x: p.x, y: p.y, done: false }
    },
    onMove(clientX, clientY) {
      if (!dragFrom || dragFrom.done) return
      const p = stage.toBoard(clientX, clientY)
      const dx = p.x - dragFrom.x
      const dy = p.y - dragFrom.y
      if (Math.max(Math.abs(dx), Math.abs(dy)) < CELL / 2) return
      // 반 셀 이상 드래그: 이동량이 큰 축의 이웃과 스왑
      dragFrom.done = true
      const horizontal = Math.abs(dx) > Math.abs(dy)
      const target = {
        col: dragFrom.pos.col + (horizontal ? Math.sign(dx) : 0),
        row: dragFrom.pos.row + (horizontal ? 0 : Math.sign(dy)),
      }
      if (target.col >= 0 && target.col < COLS && target.row >= 0 && target.row < ROWS) {
        trySwap(dragFrom.pos, target)
      }
    },
    onUp() {
      const from = dragFrom
      dragFrom = null
      if (!from || from.done || state.phase !== 'idle') return
      // 탭: 인접 보석이 선택돼 있으면 스왑, 아니면 선택 토글
      const sel = state.selected
      if (sel && Math.abs(sel.col - from.pos.col) + Math.abs(sel.row - from.pos.row) === 1) {
        trySwap(sel, from.pos)
      } else if (sel && sel.col === from.pos.col && sel.row === from.pos.row) {
        state.selected = null
      } else {
        state.selected = from.pos
      }
    },
  })

  const draw = () => {
    const c = stage.begin('#241C3B', '#2A2144')
    const bg = c.createLinearGradient(0, 0, 0, 1280)
    bg.addColorStop(0, '#3D3161')
    bg.addColorStop(1, '#2A2144')
    c.fillStyle = bg
    c.fillRect(0, 0, 720, 1280)

    // HUD 카드
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: true,
      panelColor: 'rgb(255 255 255 / 0.92)',
      labelColor: '#A99BD0',
      valueColor: '#4A3580',
    })
    c.fillStyle = state.moves <= 5 ? '#C62838' : '#8A7BB5'
    c.font = font(21)
    const info = `${t('m3.level', { n: state.level })} · ${t('m3.goal', { n: state.goal.toLocaleString() })} · ${t('m3.moves', { n: state.moves })}`
    c.fillText(info, SCORE_PANEL.cx, SCORE_PANEL.subY)
    // 목표 진행 바 (카드 바로 아래)
    const progress = Math.min(1, (state.score - state.goalBase) / (state.goal - state.goalBase))
    c.fillStyle = 'rgb(255 255 255 / 0.16)'
    c.beginPath()
    c.roundRect(150, 186, 420, 16, 8)
    c.fill()
    if (progress > 0) {
      const barGrad = c.createLinearGradient(150, 0, 570, 0)
      barGrad.addColorStop(0, '#9350E8')
      barGrad.addColorStop(1, '#5E8BF0')
      c.fillStyle = barGrad
      c.beginPath()
      c.roundRect(150, 186, Math.max(16, 420 * progress), 16, 8)
      c.fill()
    }

    // 보드 패널 + 체크무늬
    c.fillStyle = 'rgb(0 0 0 / 0.28)'
    c.beginPath()
    c.roundRect(BOARD_X - 14, BOARD_Y - 14, COLS * CELL + 28, ROWS * CELL + 28, 24)
    c.fill()
    c.fillStyle = 'rgb(255 255 255 / 0.05)'
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if ((col + row) % 2 === 0) c.fillRect(BOARD_X + col * CELL, BOARD_Y + row * CELL, CELL, CELL)
      }
    }

    // 보석 (패널 밖에서 떨어지는 새 보석은 클립으로 가린다)
    c.save()
    c.beginPath()
    c.roundRect(BOARD_X - 14, BOARD_Y - 14, COLS * CELL + 28, ROWS * CELL + 28, 24)
    c.clip()
    const sel = state.selected
    if (sel && state.phase === 'idle') {
      const pulse = 0.6 + 0.4 * Math.sin(state.playTime * 6)
      c.save()
      c.globalAlpha = pulse
      c.strokeStyle = '#FFFFFF'
      c.lineWidth = 5
      c.beginPath()
      c.roundRect(BOARD_X + sel.col * CELL + 5, BOARD_Y + sel.row * CELL + 5, CELL - 10, CELL - 10, 14)
      c.stroke()
      c.restore()
    }
    const ia = state.swap ? idx(state.swap.a.col, state.swap.a.row) : -1
    const ib = state.swap ? idx(state.swap.b.col, state.swap.b.row) : -1
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const i = idx(col, row)
        if (i === ia || i === ib) continue
        const cell = state.grid[i]
        if (cell.type < 0) continue
        const selected = sel !== null && sel.col === col && sel.row === row
        const scale = selected ? 1.06 + 0.04 * Math.sin(state.playTime * 6) : 1
        drawGem(c, cellX(col), cellY(row) + cell.offsetY, cell.type, scale)
      }
    }
    // 스왑 중인 두 보석은 자리를 서로 향해 보간
    if (state.swap) {
      const { a, b } = state.swap
      const p = Math.min(1, state.swap.t)
      const k = state.phase === 'revert' ? 1 - p : p
      const e = k * k * (3 - 2 * k)
      const ax = cellX(a.col)
      const ay = cellY(a.row)
      const bx = cellX(b.col)
      const by = cellY(b.row)
      const ta = state.grid[ia].type
      const tb = state.grid[ib].type
      if (tb >= 0) drawGem(c, bx + (ax - bx) * e, by + (ay - by) * e, tb)
      if (ta >= 0) drawGem(c, ax + (bx - ax) * e, ay + (by - ay) * e, ta, 1.05)
    }
    c.restore()

    // 제거 파티클
    for (const s of state.sparks) {
      const life = 1 - s.age / SPARK_DURATION
      c.globalAlpha = life
      c.fillStyle = s.color
      c.beginPath()
      c.arc(s.x, s.y, 2 + 5 * life, 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1

    // 점수 팝업
    for (const p of state.popups) {
      c.globalAlpha = 1 - p.age / POPUP_DURATION
      c.font = font(42, true)
      c.lineWidth = 7
      c.strokeStyle = 'rgb(42 33 68 / 0.8)'
      c.fillStyle = '#FFD54F'
      c.strokeText(p.text, p.x, p.y)
      c.fillText(p.text, p.x, p.y)
    }
    c.globalAlpha = 1

    // 레벨업 배너
    if (state.levelFx < 1.1) {
      const k = state.levelFx / 1.1
      const alpha = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1
      c.save()
      c.globalAlpha = alpha
      c.fillStyle = 'rgb(74 53 128 / 0.85)'
      c.fillRect(0, 570, 720, 104)
      c.fillStyle = '#FFE082'
      c.font = font(56, true)
      c.fillText(t('m3.level', { n: state.level }), 360, 642)
      c.restore()
    }

    // 텍스트 없는 조작 안내: 손가락이 옆 칸으로 미는 모션
    if (showHint && state.phase === 'idle') {
      const k = (state.playTime % 1.8) / 1.8
      const move = Math.min(1, k / 0.55)
      const e = move * move * (3 - 2 * move)
      const fade = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2
      const hy = cellY(3)
      const hx = cellX(3) + CELL * e
      c.save()
      c.globalAlpha = 0.55 * fade
      c.strokeStyle = '#FFFFFF'
      c.lineWidth = 6
      c.lineCap = 'round'
      c.setLineDash([2, 14])
      c.beginPath()
      c.moveTo(cellX(3), hy)
      c.lineTo(hx, hy)
      c.stroke()
      c.setLineDash([])
      c.globalAlpha = 0.8 * fade
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.arc(hx, hy, 18, 0, Math.PI * 2)
      c.fill()
      c.lineWidth = 3
      c.beginPath()
      c.arc(hx, hy, 28, 0, Math.PI * 2)
      c.stroke()
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
