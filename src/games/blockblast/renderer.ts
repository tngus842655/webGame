import { t } from '@/shared/i18n'
import { CanvasStage } from '../stage'
import { drawBlock, drawEmptyCell } from './blockArt'
import { GRID, LAYOUT } from './config'
import {
  CLEAR_FX_DURATION,
  POPUP_DURATION,
  dragTarget,
  fits,
  pieceSize,
  previewClears,
  type BBState,
  type Piece,
} from './state'
import { drawScorePanel, font } from '../ui'
import { isDarkTheme } from '@/shared/theme'

export interface DragState {
  trayIndex: number
  x: number
  y: number
}

// 세션이 들고 있는 HUD 부가 정보 (모드·스트릭·목표)
export interface HudInfo {
  daily: boolean
  streak: number
  done: boolean // 오늘 목표를 이미 달성했다
  goal: number
}

const BOARD_PAD = 14

// 판의 바탕만 테마를 탄다. 블록 색(config.ts의 COLORS)은 이 게임의 정체라
// 두 테마에서 같은 값을 쓴다.
const SCENE = {
  light: {
    outer: '#D9C3A0',
    board: '#FFF8E1',
    skyTop: '#FFF4DA',
    skyMid: '#FFF8E1',
    skyLow: '#F6E2BD',
    blob: '#FFE7B8',
    boardPanel: 'rgb(255 255 255 / 0.5)',
    boardEdge: 'rgb(141 110 99 / 0.28)',
    traySlot: 'rgb(255 255 255 / 0.42)',
    trayEdge: 'rgb(141 110 99 / 0.18)',
    panel: 'rgb(255 255 255 / 0.78)',
    label: '#BCAAA4',
    value: '#5D4037',
    hint: '#8D6E63',
  },
  dark: {
    outer: '#171310',
    board: '#221B16',
    skyTop: '#2A2119',
    skyMid: '#221B16',
    skyLow: '#171310',
    blob: '#382B1C',
    boardPanel: 'rgb(255 255 255 / 0.05)',
    boardEdge: 'rgb(255 255 255 / 0.12)',
    traySlot: 'rgb(255 255 255 / 0.045)',
    trayEdge: 'rgb(255 255 255 / 0.09)',
    panel: 'rgb(24 19 16 / 0.8)',
    label: '#8F7D74',
    value: '#E5D8D0',
    hint: '#B9A69C',
  },
} as const

function scene() {
  return isDarkTheme() ? SCENE.dark : SCENE.light
}


export class BBRenderer {
  private readonly stage: CanvasStage
  private readonly c: CanvasRenderingContext2D

  constructor(host: HTMLElement) {
    this.stage = new CanvasStage(host, LAYOUT.width, LAYOUT.height)
    this.c = this.stage.c
  }

  get canvas() {
    return this.stage.canvas
  }

  toBoard(clientX: number, clientY: number): { x: number; y: number } {
    return this.stage.toBoard(clientX, clientY)
  }

  draw(state: BBState, drag: DragState | null, hud: HudInfo) {
    this.drawBackground()
    this.drawHud(state, hud)
    this.drawBoard(state)

    const dragPiece = drag ? state.tray[drag.trayIndex] : null
    if (drag && dragPiece) this.drawGhost(state, dragPiece, drag)

    this.drawClearFx(state)
    this.drawTray(state, drag)
    if (drag && dragPiece) {
      this.drawPiece(dragPiece, drag.x, drag.y - LAYOUT.dragLift, LAYOUT.cell)
    }
    this.drawPopups(state)

    if (!state.placedOnce && state.phase === 'playing') this.drawDragHint(state, drag !== null)
  }

  private drawBackground() {
    const { c } = this
    const s = scene()
    this.stage.begin(s.outer, s.board)
    const sky = c.createLinearGradient(0, 0, 0, LAYOUT.height)
    sky.addColorStop(0, s.skyTop)
    sky.addColorStop(0.5, s.skyMid)
    sky.addColorStop(1, s.skyLow)
    c.fillStyle = sky
    c.fillRect(0, 0, LAYOUT.width, LAYOUT.height)

    c.save()
    c.globalAlpha = 0.3
    c.fillStyle = s.blob
    for (const [bx, by, br] of [
      [120, 170, 80],
      [630, 210, 55],
      [660, 1150, 90],
    ] as Array<[number, number, number]>) {
      c.beginPath()
      c.arc(bx, by, br, 0, Math.PI * 2)
      c.fill()
    }
    c.restore()
  }

  private cellPos(col: number, row: number): [number, number] {
    return [LAYOUT.boardX + col * LAYOUT.cell, LAYOUT.boardY + row * LAYOUT.cell]
  }

  private drawBoard(state: BBState) {
    const { c } = this
    const size = GRID * LAYOUT.cell

    // 보드 판
    c.save()
    c.fillStyle = scene().boardPanel
    c.beginPath()
    c.roundRect(
      LAYOUT.boardX - BOARD_PAD,
      LAYOUT.boardY - BOARD_PAD,
      size + BOARD_PAD * 2,
      size + BOARD_PAD * 2,
      24,
    )
    c.fill()
    c.strokeStyle = scene().boardEdge
    c.lineWidth = 3
    c.stroke()
    c.restore()

    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const v = state.grid[row * GRID + col]
        const [px, py] = this.cellPos(col, row)
        if (v === 0) drawEmptyCell(c, px, py, LAYOUT.cell)
        else drawBlock(c, px, py, LAYOUT.cell, v - 1)
      }
    }
  }

  private drawGhost(state: BBState, piece: Piece, drag: DragState) {
    const { col, row } = dragTarget(piece, drag.x, drag.y)
    const { c } = this
    const placeable = fits(state.grid, piece, col, row)

    if (!placeable) return

    // 놓일 자리 반투명 미리보기
    c.save()
    c.globalAlpha = 0.4
    for (const [dx, dy] of piece.shape.cells) {
      const [px, py] = this.cellPos(col + dx, row + dy)
      drawBlock(c, px, py, LAYOUT.cell, piece.color)
    }
    c.restore()

    // 완성될 줄 강조 — 노란 블록 대신 빛나는 띠
    const { rows, cols } = previewClears(state.grid, piece, col, row)
    if (rows.length === 0 && cols.length === 0) return
    c.save()
    const pulse = 0.5 + 0.5 * Math.sin(state.hintTime * 8)
    c.globalAlpha = 0.35 + pulse * 0.35
    c.fillStyle = '#FFF176'
    for (const r of rows) {
      const [, py] = this.cellPos(0, r)
      c.beginPath()
      c.roundRect(LAYOUT.boardX, py + 4, GRID * LAYOUT.cell, LAYOUT.cell - 8, 10)
      c.fill()
    }
    for (const cl of cols) {
      const [px] = this.cellPos(cl, 0)
      c.beginPath()
      c.roundRect(px + 4, LAYOUT.boardY, LAYOUT.cell - 8, GRID * LAYOUT.cell, 10)
      c.fill()
    }
    c.restore()
  }

  private drawClearFx(state: BBState) {
    const { c } = this
    for (const fx of state.clearFx) {
      const k = fx.age / CLEAR_FX_DURATION
      const [px, py] = this.cellPos(fx.col, fx.row)
      const shrink = LAYOUT.cell * (1 - k * 0.55)
      const offset = (LAYOUT.cell - shrink) / 2
      c.save()
      c.globalAlpha = 1 - k
      drawBlock(c, px + offset, py + offset, shrink, fx.color)
      // 하얀 섬광
      c.globalAlpha = (1 - k) * 0.75
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.arc(px + LAYOUT.cell / 2, py + LAYOUT.cell / 2, LAYOUT.cell * (0.25 + k * 0.5), 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
  }

  private drawTray(state: BBState, drag: DragState | null) {
    const { c } = this
    for (let i = 0; i < state.tray.length; i++) {
      const sx = LAYOUT.traySlots[i]
      // 슬롯 홈
      c.save()
      c.fillStyle = scene().traySlot
      c.beginPath()
      c.roundRect(sx - 95, LAYOUT.trayY - 95, 190, 190, 22)
      c.fill()
      c.strokeStyle = scene().trayEdge
      c.lineWidth = 2
      c.stroke()
      c.restore()

      const piece = state.tray[i]
      if (piece && drag?.trayIndex !== i) {
        if (state.phase === 'over') {
          // 게임오버 = 남은 조각 전부 놓을 곳이 없다는 뜻. 흐리게 + 붉은 ×로 이유를 보여준다
          c.save()
          c.globalAlpha = 0.45
          this.drawPiece(piece, sx, LAYOUT.trayY, LAYOUT.cell * LAYOUT.trayScale)
          c.restore()
          c.save()
          c.strokeStyle = '#EF4E4E'
          c.lineWidth = 9
          c.lineCap = 'round'
          c.beginPath()
          c.moveTo(sx - 26, LAYOUT.trayY - 26)
          c.lineTo(sx + 26, LAYOUT.trayY + 26)
          c.moveTo(sx + 26, LAYOUT.trayY - 26)
          c.lineTo(sx - 26, LAYOUT.trayY + 26)
          c.stroke()
          c.restore()
        } else {
          this.drawPiece(piece, sx, LAYOUT.trayY, LAYOUT.cell * LAYOUT.trayScale)
        }
      }
    }
  }

  private drawPiece(piece: Piece, centerX: number, centerY: number, cellSize: number) {
    const { w, h } = pieceSize(piece)
    const originX = centerX - (w * cellSize) / 2
    const originY = centerY - (h * cellSize) / 2
    for (const [dx, dy] of piece.shape.cells) {
      drawBlock(this.c, originX + dx * cellSize, originY + dy * cellSize, cellSize, piece.color)
    }
  }

  private drawPopups(state: BBState) {
    const { c } = this
    c.textAlign = 'center'
    c.font = font(40, true)
    for (const p of state.popups) {
      const k = p.age / POPUP_DURATION
      c.globalAlpha = 1 - k * k
      c.lineWidth = 7
      c.strokeStyle = '#FFFFFF'
      c.strokeText(p.text, p.x, p.y)
      c.fillStyle = '#FF7043'
      c.fillText(p.text, p.x, p.y)
    }
    c.globalAlpha = 1
  }

  private drawHud(state: BBState, hud: HudInfo) {
    const { c } = this
    const s = scene()
    c.textAlign = 'center'

    drawScorePanel(c, {
      value: state.score.toLocaleString(),
      compact: true,
      panelColor: s.panel,
      labelColor: s.label,
      valueColor: s.value,
    })

    // 데일리↔자유 전환 칩 (점수판 왼쪽)
    const chip = LAYOUT.modeChip
    c.save()
    c.fillStyle = hud.daily ? '#FF7043' : s.panel
    c.beginPath()
    c.roundRect(chip.x, chip.y, chip.w, chip.h, 36)
    c.fill()
    if (!hud.daily) {
      c.strokeStyle = s.trayEdge
      c.lineWidth = 2
      c.stroke()
    }
    c.fillStyle = hud.daily ? '#FFFFFF' : s.hint
    c.font = font(22, true)
    c.fillText(
      t(hud.daily ? 'daily.label' : 'daily.free'),
      chip.x + chip.w / 2,
      chip.y + chip.h / 2 + 8,
    )
    c.restore()

    // 스트릭·목표 안내줄 (최고 기록은 점수판이 머리줄에 그린다 — 여기 두면 같은 값이 두 번 나온다)
    if (hud.daily) {
      const parts = [
        t('daily.streak', { n: hud.streak }),
        hud.done ? t('daily.goalDone') : t('daily.goal', { n: hud.goal.toLocaleString() }),
      ]
      c.fillStyle = s.hint
      c.font = font(26)
      c.fillText(parts.join('  ·  '), LAYOUT.width / 2, LAYOUT.infoY)
    }

    // 연속 클리어 배지 (숫자만 — 언어 무관)
    if (state.streak >= 2) {
      const pop = Math.min(1, state.streakAge / 0.25)
      c.save()
      c.translate(LAYOUT.streakBadge.x, LAYOUT.streakBadge.y)
      c.scale(1.25 - pop * 0.25, 1.25 - pop * 0.25)
      c.fillStyle = '#FF7043'
      c.beginPath()
      c.roundRect(-46, -30, 92, 60, 30)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = font(38, true)
      c.fillText(`×${state.streak}`, 0, 14)
      c.restore()
    }
  }

  // 텍스트 없는 조작 안내: 트레이에서 보드로 끌어가는 손 표식
  private drawDragHint(state: BBState, dragging: boolean) {
    if (dragging) return
    const { c } = this
    const k = (state.hintTime % 2.4) / 2.4
    const ease = k < 0.75 ? k / 0.75 : 1
    const sx = LAYOUT.traySlots[0]
    const sy = LAYOUT.trayY
    const ex = LAYOUT.boardX + LAYOUT.cell * 1.5
    const ey = LAYOUT.boardY + LAYOUT.cell * 5.5
    const x = sx + (ex - sx) * ease
    const y = sy + (ey - sy) * ease
    const fade = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25

    c.save()
    c.globalAlpha = 0.5 * fade
    c.strokeStyle = scene().hint
    c.lineWidth = 3
    c.setLineDash([8, 10])
    c.beginPath()
    c.moveTo(sx, sy)
    c.lineTo(x, y)
    c.stroke()
    c.setLineDash([])

    c.globalAlpha = 0.7 * fade
    c.fillStyle = scene().hint
    c.beginPath()
    c.arc(x, y, 16, 0, Math.PI * 2)
    c.fill()
    c.globalAlpha = 0.4 * fade
    c.beginPath()
    c.arc(x, y, 28, 0, Math.PI * 2)
    c.stroke()
    c.restore()
  }

  destroy() {
    this.stage.destroy()
  }
}
