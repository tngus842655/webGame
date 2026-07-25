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

export interface DragState {
  trayIndex: number
  x: number
  y: number
}

const BOARD_PAD = 14

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

  draw(state: BBState, drag: DragState | null) {
    this.drawBackground()
    this.drawHud(state)
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
    this.stage.begin('#D9C3A0', '#FFF8E1')
    const sky = c.createLinearGradient(0, 0, 0, LAYOUT.height)
    sky.addColorStop(0, '#FFF4DA')
    sky.addColorStop(0.5, '#FFF8E1')
    sky.addColorStop(1, '#F6E2BD')
    c.fillStyle = sky
    c.fillRect(0, 0, LAYOUT.width, LAYOUT.height)

    c.save()
    c.globalAlpha = 0.3
    c.fillStyle = '#FFE7B8'
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
    c.fillStyle = 'rgb(255 255 255 / 0.5)'
    c.beginPath()
    c.roundRect(
      LAYOUT.boardX - BOARD_PAD,
      LAYOUT.boardY - BOARD_PAD,
      size + BOARD_PAD * 2,
      size + BOARD_PAD * 2,
      24,
    )
    c.fill()
    c.strokeStyle = 'rgb(141 110 99 / 0.28)'
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
      c.fillStyle = 'rgb(255 255 255 / 0.42)'
      c.beginPath()
      c.roundRect(sx - 95, LAYOUT.trayY - 95, 190, 190, 22)
      c.fill()
      c.strokeStyle = 'rgb(141 110 99 / 0.18)'
      c.lineWidth = 2
      c.stroke()
      c.restore()

      const piece = state.tray[i]
      if (piece && drag?.trayIndex !== i) {
        this.drawPiece(piece, sx, LAYOUT.trayY, LAYOUT.cell * LAYOUT.trayScale)
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
    c.font = 'bold 40px sans-serif'
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

  private drawHud(state: BBState) {
    const { c } = this
    c.textAlign = 'center'

    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.75
    c.beginPath()
    c.roundRect(230, 40, 260, 96, 26)
    c.fill()
    c.restore()
    c.fillStyle = '#5D4037'
    c.font = 'bold 58px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 112)

    // 연속 클리어 배지 (숫자만 — 언어 무관)
    if (state.streak >= 2) {
      const pop = Math.min(1, state.streakAge / 0.25)
      c.save()
      c.translate(560, 88)
      c.scale(1.25 - pop * 0.25, 1.25 - pop * 0.25)
      c.fillStyle = '#FF7043'
      c.beginPath()
      c.roundRect(-46, -30, 92, 60, 30)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = 'bold 38px sans-serif'
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
    c.strokeStyle = '#8D6E63'
    c.lineWidth = 3
    c.setLineDash([8, 10])
    c.beginPath()
    c.moveTo(sx, sy)
    c.lineTo(x, y)
    c.stroke()
    c.setLineDash([])

    c.globalAlpha = 0.7 * fade
    c.fillStyle = '#8D6E63'
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
