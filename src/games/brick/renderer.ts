import { t } from '@/shared/i18n'
import { CanvasStage } from '../stage'
import {
  BALL,
  BUTTON_RECTS,
  LAYOUT,
  UPGRADES,
  brickRect,
} from './config'
import {
  FLASH_DURATION,
  POPUP_DURATION,
  upgradeCost,
  upgradeLevel,
  type BrickState,
} from './state'

export class BrickRenderer {
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

  draw(state: BrickState) {
    const { c } = this
    this.stage.begin('#FFE0B2', '#FFF8E1')

    this.drawHud(state)
    this.drawField()
    this.drawBricks(state)
    this.drawFlashes(state)
    this.drawBalls(state)
    this.drawAim(state)
    this.drawButtons(state)
    this.drawPopups(state)

    if (state.wave === 1 && state.phase === 'aiming' && state.score === 0) {
      c.textAlign = 'center'
      c.fillStyle = '#8D6E63'
      c.font = '26px sans-serif'
      c.fillText(t('brick.hint1'), 360, 700)
      c.fillText(t('brick.hint2'), 360, 740)
    }
  }

  private drawHud(state: BrickState) {
    const { c } = this
    c.textAlign = 'center'
    c.fillStyle = '#BCAAA4'
    c.font = '20px sans-serif'
    c.fillText(t('brick.wave', { n: state.wave }), 360, 52)
    c.fillStyle = '#5D4037'
    c.font = 'bold 48px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 108)
    c.textAlign = 'right'
    c.fillStyle = '#FF8F00'
    c.font = 'bold 26px sans-serif'
    c.fillText(`${state.save.gold.toLocaleString()} G`, 688, 108)
  }

  private drawField() {
    const { c } = this
    c.strokeStyle = '#8D6E63'
    c.lineWidth = 6
    c.beginPath()
    c.moveTo(LAYOUT.fieldLeft - 8, LAYOUT.launchY)
    c.lineTo(LAYOUT.fieldLeft - 8, LAYOUT.fieldTop - 8)
    c.lineTo(LAYOUT.fieldRight + 8, LAYOUT.fieldTop - 8)
    c.lineTo(LAYOUT.fieldRight + 8, LAYOUT.launchY)
    c.stroke()
    // 발사선
    c.strokeStyle = 'rgb(141 110 99 / 0.5)'
    c.lineWidth = 3
    c.setLineDash([12, 10])
    c.beginPath()
    c.moveTo(LAYOUT.fieldLeft - 8, LAYOUT.launchY)
    c.lineTo(LAYOUT.fieldRight + 8, LAYOUT.launchY)
    c.stroke()
    c.setLineDash([])
  }

  private drawBricks(state: BrickState) {
    const { c } = this
    for (const brick of state.bricks) {
      const r = brickRect(brick.col, brick.row)
      c.fillStyle = `hsl(${(brick.hp * 24) % 360} 65% 55%)`
      c.beginPath()
      c.roundRect(r.x, r.y, r.w, r.h, 10)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.textAlign = 'center'
      c.font = 'bold 30px sans-serif'
      c.fillText(String(brick.hp), r.x + r.w / 2, r.y + r.h / 2 + 11)
    }
  }

  private drawFlashes(state: BrickState) {
    const { c } = this
    for (const f of state.flashes) {
      const k = f.age / FLASH_DURATION
      c.globalAlpha = (1 - k) * 0.8
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.roundRect(f.x, f.y, f.w, f.h, 10)
      c.fill()
    }
    c.globalAlpha = 1
  }

  private drawBalls(state: BrickState) {
    const { c } = this
    c.fillStyle = '#FF7043'
    for (const ball of state.balls) {
      if (!ball.active) continue
      c.beginPath()
      c.arc(ball.x, ball.y, BALL.radius, 0, Math.PI * 2)
      c.fill()
    }
    // 발사대
    c.fillStyle = '#5D4037'
    c.beginPath()
    c.arc(state.launchX, LAYOUT.launchY, 13, 0, Math.PI * 2)
    c.fill()
    if (state.phase === 'aiming') {
      c.textAlign = 'center'
      c.fillStyle = '#8D6E63'
      c.font = 'bold 22px sans-serif'
      c.fillText(`×${state.save.ballLevel}`, state.launchX, LAYOUT.launchY + 34)
    }
  }

  private drawAim(state: BrickState) {
    if (state.phase !== 'aiming' || !state.aim) return
    const { c } = this
    c.fillStyle = '#FFB74D'
    for (let t = 70; t <= 520; t += 45) {
      const x = state.launchX + state.aim.dx * t
      const y = LAYOUT.launchY + state.aim.dy * t
      if (y < LAYOUT.fieldTop || x < LAYOUT.fieldLeft || x > LAYOUT.fieldRight) break
      c.beginPath()
      c.arc(x, y, 5, 0, Math.PI * 2)
      c.fill()
    }
  }

  private drawButtons(state: BrickState) {
    const { c } = this
    for (let i = 0; i < UPGRADES.length; i++) {
      const def = UPGRADES[i]
      const rect = BUTTON_RECTS[i]
      const level = upgradeLevel(state.save, def.key)
      const cost = upgradeCost(def, level)
      const affordable = state.save.gold >= cost && state.phase === 'aiming'

      c.globalAlpha = state.phase === 'flying' ? 0.5 : 1
      c.fillStyle = 'rgb(255 255 255 / 0.85)'
      c.beginPath()
      c.roundRect(rect.x, rect.y, rect.w, rect.h, 16)
      c.fill()
      c.textAlign = 'center'
      c.fillStyle = '#5D4037'
      c.font = 'bold 26px sans-serif'
      c.fillText(`${t(def.label)} Lv.${level}`, rect.x + rect.w / 2, rect.y + 52)
      c.fillStyle = affordable ? '#43A047' : '#BCAAA4'
      c.font = 'bold 24px sans-serif'
      c.fillText(`${cost.toLocaleString()} G`, rect.x + rect.w / 2, rect.y + 95)
      c.globalAlpha = 1
    }
  }

  private drawPopups(state: BrickState) {
    const { c } = this
    c.textAlign = 'center'
    c.font = 'bold 32px sans-serif'
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

  destroy() {
    this.stage.destroy()
  }
}
