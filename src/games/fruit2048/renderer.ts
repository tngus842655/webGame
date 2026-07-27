import { CanvasStage } from '../stage'
import { LAYOUT, SIZE, cellPos } from './config'
import { drawTile } from './tileArt'
import type { F2State } from './state'
import { font } from '../ui'

export class F2Renderer {
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

  draw(state: F2State) {
    this.drawBackground()
    this.drawHud(state)
    this.drawBoard()

    if (state.slideT > 0) this.drawSlidingTiles(state)
    else this.drawTiles(state)

    if (state.score === 0 && state.phase === 'playing') this.drawSwipeHint(state)
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
  }

  private boardSize() {
    return SIZE * LAYOUT.cell + (SIZE + 1) * LAYOUT.gap
  }

  private drawBoard() {
    const { c } = this
    const size = this.boardSize()

    c.save()
    c.fillStyle = 'rgb(255 255 255 / 0.5)'
    c.beginPath()
    c.roundRect(LAYOUT.boardX, LAYOUT.boardY, size, size, 26)
    c.fill()
    c.strokeStyle = 'rgb(141 110 99 / 0.28)'
    c.lineWidth = 3
    c.stroke()
    c.restore()

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const [px, py] = cellPos(col, row)
        c.fillStyle = 'rgb(93 64 55 / 0.08)'
        c.beginPath()
        c.roundRect(px, py, LAYOUT.cell, LAYOUT.cell, 18)
        c.fill()
      }
    }
  }

  private cellCenter(index: number): [number, number] {
    const [px, py] = cellPos(index % SIZE, Math.floor(index / SIZE))
    return [px + LAYOUT.cell / 2, py + LAYOUT.cell / 2]
  }

  private drawTiles(state: F2State) {
    const { c } = this
    for (let i = 0; i < state.grid.length; i++) {
      const tile = state.grid[i]
      if (!tile) continue
      const [cx, cy] = this.cellCenter(i)
      // 등장은 작게 시작, 합체는 크게 튀었다가 정착
      const scale =
        tile.popType === 'spawn' ? 1 - 0.45 * tile.pop : 1 + 0.22 * Math.sin(tile.pop * Math.PI)
      c.save()
      drawTile(c, cx, cy, LAYOUT.cell * 0.42 * scale, tile.tier)
      c.restore()
    }
  }

  // 슬라이드 중에는 이동 경로상의 타일만 그린다 (새로 생긴 타일은 감춤)
  private drawSlidingTiles(state: F2State) {
    const ease = 1 - state.slideT
    const smooth = ease * ease * (3 - 2 * ease)
    for (const move of state.slide) {
      const [fx, fy] = this.cellCenter(move.from)
      const [tx, ty] = this.cellCenter(move.to)
      drawTile(
        this.c,
        fx + (tx - fx) * smooth,
        fy + (ty - fy) * smooth,
        LAYOUT.cell * 0.42,
        move.tier,
      )
    }
  }

  private drawHud(state: F2State) {
    const { c } = this
    c.textAlign = 'center'
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.75
    c.beginPath()
    c.roundRect(230, 60, 260, 96, 26)
    c.fill()
    c.restore()
    c.fillStyle = '#5D4037'
    c.font = font(58, true)
    c.fillText(state.score.toLocaleString(), 360, 132)
  }

  // 텍스트 없는 조작 안내: 좌우로 스와이프하는 표식
  private drawSwipeHint(state: F2State) {
    const { c } = this
    const k = (state.hintTime % 2.2) / 2.2
    const ease = k < 0.7 ? k / 0.7 : 1
    const fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3
    const boardBottom = LAYOUT.boardY + this.boardSize()
    const x = 240 + 240 * ease
    const y = boardBottom + 90

    c.save()
    c.globalAlpha = 0.45 * fade
    c.strokeStyle = '#8D6E63'
    c.lineWidth = 3
    c.setLineDash([8, 10])
    c.beginPath()
    c.moveTo(240, y)
    c.lineTo(x, y)
    c.stroke()
    c.setLineDash([])

    c.globalAlpha = 0.7 * fade
    c.fillStyle = '#8D6E63'
    c.beginPath()
    c.arc(x, y, 16, 0, Math.PI * 2)
    c.fill()
    c.globalAlpha = 0.35 * fade
    c.beginPath()
    c.arc(x, y, 28, 0, Math.PI * 2)
    c.stroke()
    c.restore()
  }

  destroy() {
    this.stage.destroy()
  }
}
