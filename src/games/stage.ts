// 게임 공통 캔버스 스테이지: 논리 해상도 레터박스 스케일링 + DPR 대응 (DESIGN.md 7.1)
export class CanvasStage {
  readonly canvas: HTMLCanvasElement
  readonly c: CanvasRenderingContext2D

  private readonly host: HTMLElement
  private readonly observer: ResizeObserver
  private readonly logicalW: number
  private readonly logicalH: number
  private dpr = 1
  private scale = 1
  private offsetX = 0
  private offsetY = 0
  private cssW = 0
  private cssH = 0

  constructor(host: HTMLElement, logicalW: number, logicalH: number) {
    this.host = host
    this.logicalW = logicalW
    this.logicalH = logicalH
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;user-select:none;-webkit-user-select:none;'
    host.appendChild(this.canvas)

    const c = this.canvas.getContext('2d')
    if (!c) throw new Error('Canvas 2D를 사용할 수 없습니다')
    this.c = c

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(host)
    this.resize()
  }

  private resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.cssW = this.host.clientWidth
    this.cssH = this.host.clientHeight
    this.canvas.width = Math.round(this.cssW * this.dpr)
    this.canvas.height = Math.round(this.cssH * this.dpr)
    this.scale = Math.min(this.cssW / this.logicalW, this.cssH / this.logicalH)
    this.offsetX = (this.cssW - this.logicalW * this.scale) / 2
    this.offsetY = (this.cssH - this.logicalH * this.scale) / 2
  }

  // 프레임 시작: 배경을 칠하고 논리 좌표계 변환을 세팅한다
  begin(outerColor: string, boardColor: string): CanvasRenderingContext2D {
    const { c } = this
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    c.fillStyle = outerColor
    c.fillRect(0, 0, this.cssW, this.cssH)
    const s = this.dpr * this.scale
    c.setTransform(s, 0, 0, s, this.dpr * this.offsetX, this.dpr * this.offsetY)
    c.fillStyle = boardColor
    c.fillRect(0, 0, this.logicalW, this.logicalH)
    return c
  }

  toBoard(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left - this.offsetX) / this.scale,
      y: (clientY - rect.top - this.offsetY) / this.scale,
    }
  }

  destroy() {
    this.observer.disconnect()
    this.canvas.remove()
  }
}
