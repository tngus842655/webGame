import { t } from '@/shared/i18n'
import { CanvasStage } from '../stage'
import { BOARD, TIERS } from './config'
import { POP_DURATION, POPUP_DURATION, SPARK_DURATION, type SuikaState } from './state'
import type { SuikaWorld } from './world'

// 논리 좌표 720×1280 스테이지 위에 게임을 그린다 (DESIGN.md 7.1, 7.6)
export class SuikaRenderer {
  private readonly stage: CanvasStage
  private readonly c: CanvasRenderingContext2D

  constructor(host: HTMLElement) {
    this.stage = new CanvasStage(host, BOARD.width, BOARD.height)
    this.c = this.stage.c
  }

  get canvas() {
    return this.stage.canvas
  }

  toBoard(clientX: number, clientY: number): { x: number; y: number } {
    return this.stage.toBoard(clientX, clientY)
  }

  draw(state: SuikaState, world: SuikaWorld) {
    const { c } = this
    this.stage.begin('#FFE0B2', '#FFF8E1')

    this.drawJar()
    this.drawDangerLine(state)

    if (state.phase === 'playing' && state.cooldown <= 0) {
      c.strokeStyle = '#FFB74D'
      c.lineWidth = 4
      c.setLineDash([4, 14])
      c.beginPath()
      c.moveTo(state.aimX, BOARD.dropY)
      c.lineTo(state.aimX, BOARD.floorY)
      c.stroke()
      c.setLineDash([])
      this.drawFruit(state.aimX, BOARD.dropY, 0, state.currentTier)
    }

    const fruits = world.fruitBodies()
    for (const { body, tier } of fruits) {
      this.drawFruit(body.position.x, body.position.y, body.angle, tier)
    }

    this.drawEffects(state)
    this.drawHud(state)

    // 첫 플레이 힌트: 아직 아무것도 안 떨어뜨렸을 때만
    if (state.phase === 'playing' && state.score === 0 && fruits.length === 0) {
      c.textAlign = 'center'
      c.fillStyle = '#8D6E63'
      c.font = '26px sans-serif'
      c.fillText(t('suika.hint1'), 360, 560)
      c.fillText(t('suika.hint2'), 360, 600)
    }
  }

  private drawJar() {
    const { c } = this
    c.strokeStyle = '#8D6E63'
    c.lineWidth = 14
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(BOARD.wallLeft, BOARD.jarTopY)
    c.lineTo(BOARD.wallLeft, BOARD.floorY - 62)
    c.quadraticCurveTo(BOARD.wallLeft, BOARD.floorY, BOARD.wallLeft + 62, BOARD.floorY)
    c.lineTo(BOARD.wallRight - 62, BOARD.floorY)
    c.quadraticCurveTo(BOARD.wallRight, BOARD.floorY, BOARD.wallRight, BOARD.floorY - 62)
    c.lineTo(BOARD.wallRight, BOARD.jarTopY)
    c.stroke()
  }

  private drawDangerLine(state: SuikaState) {
    const { c } = this
    // 위험 상태일수록 빠르게 깜빡인다
    c.globalAlpha = state.dangerTime > 0 ? 0.4 + 0.6 * Math.abs(Math.sin(state.dangerTime * 8)) : 0.8
    c.strokeStyle = '#E53935'
    c.lineWidth = 4
    c.setLineDash([16, 12])
    c.beginPath()
    c.moveTo(BOARD.wallLeft + 7, BOARD.dangerY)
    c.lineTo(BOARD.wallRight - 7, BOARD.dangerY)
    c.stroke()
    c.setLineDash([])
    c.font = '22px sans-serif'
    c.textAlign = 'left'
    c.fillStyle = '#E53935'
    c.fillText(t('suika.danger'), BOARD.wallLeft + 25, BOARD.dangerY - 12)
    c.globalAlpha = 1
  }

  private drawFruit(x: number, y: number, angle: number, tier: number, radius = TIERS[tier].radius) {
    const t = TIERS[tier]
    const { c } = this
    c.save()
    c.translate(x, y)
    c.rotate(angle)

    c.fillStyle = t.color
    c.beginPath()
    c.arc(0, 0, radius, 0, Math.PI * 2)
    c.fill()

    if (tier === TIERS.length - 1) {
      c.save()
      c.clip()
      c.strokeStyle = 'rgb(27 46 27 / 0.55)'
      c.lineWidth = radius * 0.16
      for (const dx of [-0.55, 0, 0.55]) {
        c.beginPath()
        c.ellipse(dx * radius, 0, radius * 0.08, radius * 1.05, 0, 0, Math.PI * 2)
        c.stroke()
      }
      c.restore()
    }

    const eye = Math.max(radius * 0.1, 2.5)
    const eyeX = radius * 0.3
    const eyeY = -radius * 0.18
    c.fillStyle = t.faceColor
    c.beginPath()
    c.moveTo(-eyeX + eye, eyeY)
    c.arc(-eyeX, eyeY, eye, 0, Math.PI * 2)
    c.moveTo(eyeX + eye, eyeY)
    c.arc(eyeX, eyeY, eye, 0, Math.PI * 2)
    c.fill()

    c.strokeStyle = t.faceColor
    c.lineWidth = Math.max(radius * 0.07, 2)
    c.lineCap = 'round'
    c.beginPath()
    c.arc(0, radius * 0.12, radius * 0.32, 0.15 * Math.PI, 0.85 * Math.PI)
    c.stroke()

    c.restore()
  }

  private drawEffects(state: SuikaState) {
    const { c } = this
    for (const s of state.sparks) {
      const k = s.age / SPARK_DURATION
      c.globalAlpha = 1 - k
      c.fillStyle = s.color
      c.beginPath()
      c.arc(s.x, s.y, 8 * (1 - k) + 3, 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1
    for (const p of state.pops) {
      const k = p.age / POP_DURATION
      c.globalAlpha = 1 - k
      c.strokeStyle = '#FFEB3B'
      c.lineWidth = 6
      c.beginPath()
      c.arc(p.x, p.y, p.r * (1 + 0.8 * k), 0, Math.PI * 2)
      c.stroke()
    }
    c.globalAlpha = 1
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

  private drawHud(state: SuikaState) {
    const { c } = this
    c.textAlign = 'center'
    c.fillStyle = '#BCAAA4'
    c.font = '22px sans-serif'
    c.fillText(t('hud.score'), 360, 60)
    c.fillStyle = '#5D4037'
    c.font = 'bold 52px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 118)

    c.fillStyle = 'rgb(255 255 255 / 0.85)'
    c.beginPath()
    c.roundRect(600, 40, 96, 122, 16)
    c.fill()
    c.fillStyle = '#BCAAA4'
    c.font = '20px sans-serif'
    c.fillText(t('hud.next'), 648, 70)
    this.drawFruit(648, 118, 0, state.nextTier, Math.min(TIERS[state.nextTier].radius, 30))
  }

  destroy() {
    this.stage.destroy()
  }
}
