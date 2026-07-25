import { CanvasStage } from '../stage'
import { LAYOUT, SIZE, TIERS, cellPos } from './config'
import type { F2State } from './state'

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
    const { c } = this
    this.stage.begin('#FFE0B2', '#FFF8E1')

    // HUD
    c.textAlign = 'center'
    c.fillStyle = '#BCAAA4'
    c.font = '22px sans-serif'
    c.fillText('점수', 360, 60)
    c.fillStyle = '#5D4037'
    c.font = 'bold 52px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 118)

    // 보드 배경
    const boardSize = SIZE * LAYOUT.cell + (SIZE + 1) * LAYOUT.gap
    c.fillStyle = 'rgb(141 110 99 / 0.2)'
    c.beginPath()
    c.roundRect(LAYOUT.boardX, LAYOUT.boardY, boardSize, boardSize, 20)
    c.fill()

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const [px, py] = cellPos(col, row)
        const tile = state.grid[row * SIZE + col]
        if (!tile) {
          c.fillStyle = 'rgb(255 255 255 / 0.55)'
          c.beginPath()
          c.roundRect(px, py, LAYOUT.cell, LAYOUT.cell, 14)
          c.fill()
          continue
        }
        const info = TIERS[tile.tier - 1] ?? TIERS[TIERS.length - 1]
        // 등장은 작게 시작, 합체는 크게 튀었다가 정착
        const scale =
          tile.popType === 'spawn' ? 1 - 0.5 * tile.pop : 1 + 0.2 * Math.sin(tile.pop * Math.PI)
        const size = LAYOUT.cell * scale
        const off = (LAYOUT.cell - size) / 2
        c.fillStyle = info.color
        c.beginPath()
        c.roundRect(px + off, py + off, size, size, 14 * scale)
        c.fill()
        c.font = `${Math.round(72 * scale)}px sans-serif`
        c.textAlign = 'center'
        c.fillText(info.emoji, px + LAYOUT.cell / 2, py + LAYOUT.cell / 2 + 26 * scale)
      }
    }

    if (state.score === 0 && state.phase === 'playing') {
      c.textAlign = 'center'
      c.fillStyle = '#8D6E63'
      c.font = '26px sans-serif'
      c.fillText('스와이프로 과일을 밀어보세요', 360, 1050)
      c.fillText('같은 과일이 만나면 진화합니다!', 360, 1090)
    }
  }

  destroy() {
    this.stage.destroy()
  }
}
