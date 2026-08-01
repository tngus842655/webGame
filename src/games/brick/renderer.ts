import { t } from '@/shared/i18n'
import { CanvasStage } from '../stage'
import { drawBall, drawBrick, drawLauncher } from './brickArt'
import { BALL, BUTTON_RECTS, LAYOUT, MAX_ROWS, UPGRADES, brickRect } from './config'
import {
  FLASH_DURATION,
  POPUP_DURATION,
  upgradeCost,
  upgradeLevel,
  type BrickState,
} from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'
import { ground } from '../scene'

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
    this.drawBackground()
    this.drawField()
    this.drawBricks(state)
    this.drawFlashes(state)
    this.drawAim(state)
    this.drawBalls(state)
    this.drawHud(state)
    this.drawButtons(state)
    this.drawPopups(state)

    if (state.wave === 1 && state.phase === 'aiming' && state.score === 0 && !state.aim) {
      this.drawAimHint(state)
    }
  }

  private drawBackground() {
    const { c } = this
    this.stage.begin(ground('#D6C0A2', '#171310'), ground('#FFF8E1', '#221B16'))
    const sky = c.createLinearGradient(0, 0, 0, LAYOUT.height)
    sky.addColorStop(0, ground('#FFF3D6', '#2A2119'))
    sky.addColorStop(0.5, ground('#FFF8E1', '#221B16'))
    sky.addColorStop(1, ground('#F4DFB9', '#171310'))
    c.fillStyle = sky
    c.fillRect(0, 0, LAYOUT.width, LAYOUT.height)
  }

  private drawField() {
    const { c } = this
    const x = LAYOUT.fieldLeft - 10
    const y = LAYOUT.fieldTop - 12
    const w = LAYOUT.fieldRight - LAYOUT.fieldLeft + 20
    const h = LAYOUT.launchY - LAYOUT.fieldTop + 12

    c.save()
    c.fillStyle = ground('rgb(255 255 255 / 0.42)', 'rgb(255 255 255 / 0.08)')
    c.beginPath()
    c.roundRect(x, y, w, h, 18)
    c.fill()
    c.strokeStyle = ground('rgb(141 110 99 / 0.3)', 'rgb(255 255 255 / 0.15)')
    c.lineWidth = 4
    c.stroke()
    c.restore()

    // 위험선 — 벽돌이 이 줄까지 내려오면 끝이다. 몇 줄 남았는지 보이지 않으면
    // 갑자기 게임이 끝난 것처럼 느껴진다.
    const dangerY = LAYOUT.fieldTop + (MAX_ROWS - 1) * LAYOUT.rowH
    c.save()
    c.fillStyle = 'rgb(229 57 53 / 0.07)'
    c.fillRect(LAYOUT.fieldLeft, dangerY, LAYOUT.fieldRight - LAYOUT.fieldLeft, LAYOUT.rowH)
    c.strokeStyle = 'rgb(229 57 53 / 0.45)'
    c.lineWidth = 3
    c.setLineDash([10, 8])
    c.beginPath()
    c.moveTo(LAYOUT.fieldLeft, dangerY)
    c.lineTo(LAYOUT.fieldRight, dangerY)
    c.stroke()
    c.restore()

    // 발사선
    c.save()
    c.strokeStyle = ground('rgb(141 110 99 / 0.35)', 'rgb(255 255 255 / 0.16)')
    c.lineWidth = 3
    c.setLineDash([14, 12])
    c.beginPath()
    c.moveTo(LAYOUT.fieldLeft, LAYOUT.launchY)
    c.lineTo(LAYOUT.fieldRight, LAYOUT.launchY)
    c.stroke()
    c.restore()
  }

  private drawBricks(state: BrickState) {
    const { c } = this
    for (const brick of state.bricks) {
      const r = brickRect(brick.col, brick.row)
      // 다음 턴에 바닥에 닿는 벽돌은 테두리로 알린다
      if (brick.row >= MAX_ROWS - 1) {
        c.save()
        c.strokeStyle = '#E53935'
        c.lineWidth = 4
        c.beginPath()
        c.roundRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 10)
        c.stroke()
        c.restore()
      }
      drawBrick(c, r.x, r.y, r.w, r.h, brick.hp, brick.maxHp)
    }
  }

  private drawFlashes(state: BrickState) {
    const { c } = this
    for (const f of state.flashes) {
      const k = f.age / FLASH_DURATION
      c.save()
      c.globalAlpha = (1 - k) * 0.85
      c.fillStyle = '#FFFFFF'
      const grow = k * 12
      c.beginPath()
      c.roundRect(f.x - grow, f.y - grow, f.w + grow * 2, f.h + grow * 2, 12)
      c.fill()
      c.restore()
    }
  }

  private drawBalls(state: BrickState) {
    for (const ball of state.balls) {
      if (ball.active) drawBall(this.c, ball.x, ball.y, BALL.radius)
    }
    drawLauncher(this.c, state.launchX, LAYOUT.launchY, state.run.ballLevel)
  }

  // 벽 반사까지 반영한 예측 경로
  private drawAim(state: BrickState) {
    if (state.phase !== 'aiming' || !state.aim) return
    const { c } = this

    let x = state.launchX
    let y = LAYOUT.launchY
    let dx = state.aim.dx
    let dy = state.aim.dy
    const step = 12
    const maxDist = 1100
    let drawn = 0
    let bounces = 0

    c.save()
    c.fillStyle = '#FFB74D'
    for (let dist = 0; dist < maxDist; dist += step) {
      x += dx * step
      y += dy * step

      if (x < LAYOUT.fieldLeft + BALL.radius) {
        x = LAYOUT.fieldLeft + BALL.radius
        dx = -dx
        bounces += 1
      } else if (x > LAYOUT.fieldRight - BALL.radius) {
        x = LAYOUT.fieldRight - BALL.radius
        dx = -dx
        bounces += 1
      }
      if (y < LAYOUT.fieldTop + BALL.radius || bounces > 2) break

      // 벽돌에 닿으면 종료
      let hit = false
      for (const brick of state.bricks) {
        const r = brickRect(brick.col, brick.row)
        if (x > r.x - BALL.radius && x < r.x + r.w + BALL.radius && y > r.y - BALL.radius && y < r.y + r.h + BALL.radius) {
          hit = true
          break
        }
      }
      if (hit) break

      drawn += 1
      if (drawn % 3 !== 0) continue
      c.globalAlpha = Math.max(0.15, 0.85 - dist / maxDist)
      c.beginPath()
      c.arc(x, y, 5, 0, Math.PI * 2)
      c.fill()
    }
    c.restore()
  }

  private drawHud(state: BrickState) {
    const { c } = this
    c.textAlign = 'center'

    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: true,
      compact: true,
      panelColor: ground('rgb(255 255 255 / 0.78)', 'rgb(255 255 255 / 0.08)'),
      labelColor: ground('#BCAAA4', '#8F7D74'),
      valueColor: ground('#5D4037', '#E5D8D0'),
    })

    // 웨이브
    c.fillStyle = ground('#A1887F', '#8F7D74')
    c.font = font(20)
    c.fillText(t('brick.wave', { n: state.wave }), SCORE_PANEL.cx, SCORE_PANEL.subY)

    // 골드
    c.save()
    c.fillStyle = ground('#FFFFFF', '#2C231C')
    c.globalAlpha = 0.75
    c.beginPath()
    c.roundRect(486, 34, 202, 60, 30)
    c.fill()
    c.restore()
    c.fillStyle = '#FFC107'
    c.beginPath()
    c.arc(520, 64, 17, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#B8860B'
    c.font = font(20, true)
    c.fillText('G', 520, 71)
    c.textAlign = 'right'
    c.fillStyle = ground('#5D4037', '#E5D8D0')
    c.font = font(26, true)
    c.fillText(state.run.gold.toLocaleString(), 672, 73)
  }

  private drawButtons(state: BrickState) {
    const { c } = this
    for (let i = 0; i < UPGRADES.length; i++) {
      const def = UPGRADES[i]
      const rect = BUTTON_RECTS[i]
      const level = upgradeLevel(state.run, def.key)
      const cost = upgradeCost(def, level)
      const affordable = state.run.gold >= cost && state.phase === 'aiming'

      c.save()
      if (state.phase === 'flying') c.globalAlpha = 0.45

      // 버튼 바탕
      c.fillStyle = affordable ? '#4CAF50' : ground('#FFFFFF', '#2C231C')
      if (!affordable) c.globalAlpha *= 0.8
      c.beginPath()
      c.roundRect(rect.x, rect.y + 5, rect.w, rect.h, 18)
      c.fill()
      c.fillStyle = affordable ? '#66BB6A' : ground('#FFFFFF', '#2C231C')
      c.beginPath()
      c.roundRect(rect.x, rect.y, rect.w, rect.h, 18)
      c.fill()
      c.strokeStyle = affordable ? '#2E7D32' : ground('rgb(141 110 99 / 0.25)', 'rgb(255 255 255 / 0.125)')
      c.lineWidth = 3
      c.stroke()

      c.textAlign = 'center'
      c.fillStyle = affordable ? ground('#FFFFFF', '#2C231C') : ground('#8D6E63', '#B9A69C')
      c.font = font(26, true)
      c.fillText(`${t(def.label)} Lv.${level}`, rect.x + rect.w / 2, rect.y + 50)

      // 비용
      c.fillStyle = affordable ? ground('#FFFFFF', '#2C231C') : ground('#BCAAA4', '#8F7D74')
      c.beginPath()
      c.arc(rect.x + rect.w / 2 - 44, rect.y + 88, 13, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = affordable ? '#2E7D32' : ground('#E0D6CF', '#4A403B')
      c.font = font(15, true)
      c.fillText('G', rect.x + rect.w / 2 - 44, rect.y + 93)
      c.fillStyle = affordable ? ground('#FFFFFF', '#2C231C') : ground('#BCAAA4', '#8F7D74')
      c.font = font(24, true)
      c.fillText(cost.toLocaleString(), rect.x + rect.w / 2 + 22, rect.y + 96)
      c.restore()
    }
  }

  private drawPopups(state: BrickState) {
    const { c } = this
    c.textAlign = 'center'
    c.font = font(34, true)
    for (const p of state.popups) {
      const k = p.age / POPUP_DURATION
      c.globalAlpha = 1 - k * k
      c.lineWidth = 7
      c.strokeStyle = '#FFFFFF'
      c.strokeText(p.text, p.x, p.y)
      c.fillStyle = '#FF6F00'
      c.fillText(p.text, p.x, p.y)
    }
    c.globalAlpha = 1
  }

  // 텍스트 없는 조작 안내: 발사대에서 위로 당기는 표식
  private drawAimHint(state: BrickState) {
    const { c } = this
    const k = (state.hintTime % 2) / 2
    const ease = k < 0.7 ? k / 0.7 : 1
    const fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3
    const x = state.launchX + 90 * ease
    const y = LAYOUT.launchY - 150 * ease

    c.save()
    c.globalAlpha = 0.45 * fade
    c.strokeStyle = ground('#8D6E63', '#B9A69C')
    c.lineWidth = 3
    c.setLineDash([8, 10])
    c.beginPath()
    c.moveTo(state.launchX, LAYOUT.launchY)
    c.lineTo(x, y)
    c.stroke()
    c.setLineDash([])

    c.globalAlpha = 0.7 * fade
    c.fillStyle = ground('#8D6E63', '#B9A69C')
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
