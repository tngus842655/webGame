import { CanvasStage } from '../stage'
import { COLORS, GRID, LAYOUT } from './config'
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
    const { c } = this
    this.stage.begin('#FFE0B2', '#FFF8E1')

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

    if (!state.placedOnce && state.phase === 'playing') {
      c.textAlign = 'center'
      c.fillStyle = '#8D6E63'
      c.font = '26px sans-serif'
      c.fillText('블록을 끌어서 보드에 놓으세요', 360, 500)
      c.fillText('가로·세로 한 줄을 채우면 사라져요!', 360, 540)
    }
  }

  private cellPos(col: number, row: number): [number, number] {
    return [LAYOUT.boardX + col * LAYOUT.cell, LAYOUT.boardY + row * LAYOUT.cell]
  }

  private drawCell(px: number, py: number, size: number, fill: string) {
    const { c } = this
    const gap = size * 0.05
    c.fillStyle = fill
    c.beginPath()
    c.roundRect(px + gap, py + gap, size - gap * 2, size - gap * 2, size * 0.14)
    c.fill()
  }

  private drawBoard(state: BBState) {
    const { c } = this
    c.fillStyle = 'rgb(141 110 99 / 0.15)'
    c.beginPath()
    c.roundRect(
      LAYOUT.boardX - 10,
      LAYOUT.boardY - 10,
      GRID * LAYOUT.cell + 20,
      GRID * LAYOUT.cell + 20,
      18,
    )
    c.fill()
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const v = state.grid[row * GRID + col]
        const [px, py] = this.cellPos(col, row)
        this.drawCell(px, py, LAYOUT.cell, v === 0 ? 'rgb(255 255 255 / 0.7)' : COLORS[v - 1])
      }
    }
  }

  private drawGhost(state: BBState, piece: Piece, drag: DragState) {
    const { col, row } = dragTarget(piece, drag.x, drag.y)
    if (!fits(state.grid, piece, col, row)) return
    const { c } = this
    c.globalAlpha = 0.35
    for (const [dx, dy] of piece.shape.cells) {
      const [px, py] = this.cellPos(col + dx, row + dy)
      this.drawCell(px, py, LAYOUT.cell, COLORS[piece.color])
    }
    // 완성될 줄 미리 강조
    const { rows, cols } = previewClears(state.grid, piece, col, row)
    c.globalAlpha = 0.4
    for (const r of rows) {
      for (let x = 0; x < GRID; x++) {
        const [px, py] = this.cellPos(x, r)
        this.drawCell(px, py, LAYOUT.cell, '#FFEB3B')
      }
    }
    for (const cl of cols) {
      for (let y = 0; y < GRID; y++) {
        const [px, py] = this.cellPos(cl, y)
        this.drawCell(px, py, LAYOUT.cell, '#FFEB3B')
      }
    }
    c.globalAlpha = 1
  }

  private drawClearFx(state: BBState) {
    const { c } = this
    for (const fx of state.clearFx) {
      const k = fx.age / CLEAR_FX_DURATION
      const [px, py] = this.cellPos(fx.col, fx.row)
      c.globalAlpha = 1 - k
      this.drawCell(px, py, LAYOUT.cell, COLORS[fx.color] ?? '#FFFFFF')
      c.globalAlpha = (1 - k) * 0.8
      this.drawCell(px, py, LAYOUT.cell, '#FFFFFF')
    }
    c.globalAlpha = 1
  }

  private drawTray(state: BBState, drag: DragState | null) {
    const { c } = this
    for (let i = 0; i < state.tray.length; i++) {
      const sx = LAYOUT.traySlots[i]
      c.fillStyle = 'rgb(255 255 255 / 0.6)'
      c.beginPath()
      c.roundRect(sx - 95, LAYOUT.trayY - 95, 190, 190, 16)
      c.fill()
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
      this.drawCell(originX + dx * cellSize, originY + dy * cellSize, cellSize, COLORS[piece.color])
    }
  }

  private drawPopups(state: BBState) {
    const { c } = this
    c.textAlign = 'center'
    c.font = 'bold 36px sans-serif'
    for (const p of state.popups) {
      const k = p.age / POPUP_DURATION
      c.globalAlpha = 1 - k * k
      c.lineWidth = 6
      c.strokeStyle = '#FFFFFF'
      c.strokeText(p.text, p.x, p.y)
      c.fillStyle = '#FF6F00'
      c.fillText(p.text, p.x, p.y)
    }
    c.globalAlpha = 1
  }

  private drawHud(state: BBState) {
    const { c } = this
    c.textAlign = 'center'
    c.fillStyle = '#BCAAA4'
    c.font = '22px sans-serif'
    c.fillText('점수', 360, 60)
    c.fillStyle = '#5D4037'
    c.font = 'bold 52px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 118)
  }

  destroy() {
    this.stage.destroy()
  }
}
