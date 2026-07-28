import { t } from '@/shared/i18n'
import { CanvasStage } from '../stage'
import { BOARD, TIERS } from './config'
import { drawFruit } from '../fruitArt'
import { POP_DURATION, POPUP_DURATION, SPARK_DURATION, type SuikaState } from './state'
import type { SuikaWorld } from './world'
import { drawScorePanel, font } from '../ui'

const JAR_RADIUS = 62
const DANGER_BAND = 120 // 위험 경고 그라데이션 높이
const CHART_Y = 1200 // 하단 진화 도표 중심 y

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
    this.drawBackground()
    this.drawJarBack()

    const fruits = world.fruitBodies()
    for (const { body, tier } of fruits) {
      drawFruit(this.c, body.position.x, body.position.y, body.angle, tier)
    }

    this.drawDangerZone(state, fruits.length > 0)
    this.drawJarFront()
    this.drawDropGuide(state)
    this.drawEffects(state)
    this.drawHud(state)
    this.drawEvolutionChart(state)

    if (state.phase === 'playing' && fruits.length === 0 && state.score === 0) {
      this.drawTouchHint(state)
    }
  }

  private drawBackground() {
    const { c } = this
    this.stage.begin('#F2D9AE', '#FFF8E1')
    // 위쪽에서 내려오는 은은한 빛
    const sky = c.createLinearGradient(0, 0, 0, BOARD.height)
    sky.addColorStop(0, '#FFF3D6')
    sky.addColorStop(0.45, '#FFF8E1')
    sky.addColorStop(1, '#F7E3BE')
    c.fillStyle = sky
    c.fillRect(0, 0, BOARD.width, BOARD.height)

    // 배경 장식: 흐릿한 원 몇 개
    c.save()
    c.globalAlpha = 0.35
    c.fillStyle = '#FFE7B8'
    for (const [bx, by, br] of [
      [130, 210, 90],
      [610, 300, 60],
      [90, 900, 70],
      [640, 1010, 100],
    ] as Array<[number, number, number]>) {
      c.beginPath()
      c.arc(bx, by, br, 0, Math.PI * 2)
      c.fill()
    }
    c.restore()
  }

  // 통 내부(과일 뒤에 깔리는 면)
  private drawJarBack() {
    const { c } = this
    const left = BOARD.wallLeft
    const right = BOARD.wallRight
    const top = BOARD.jarTopY
    const bottom = BOARD.floorY

    c.save()
    this.jarPath(left, top, right, bottom)
    const inner = c.createLinearGradient(0, top, 0, bottom)
    inner.addColorStop(0, 'rgb(255 255 255 / 0.55)')
    inner.addColorStop(1, 'rgb(255 244 214 / 0.85)')
    c.fillStyle = inner
    c.fill()

    // 바닥 그림자
    c.save()
    c.clip()
    const floorShadow = c.createLinearGradient(0, bottom - 120, 0, bottom)
    floorShadow.addColorStop(0, 'rgb(141 110 99 / 0)')
    floorShadow.addColorStop(1, 'rgb(141 110 99 / 0.18)')
    c.fillStyle = floorShadow
    c.fillRect(left, bottom - 120, right - left, 120)
    c.restore()
    c.restore()
  }

  // 통 유리면·테두리(과일 위에 겹쳐 유리 느낌)
  private drawJarFront() {
    const { c } = this
    const left = BOARD.wallLeft
    const right = BOARD.wallRight
    const top = BOARD.jarTopY
    const bottom = BOARD.floorY

    // 유리 반사 (통 안쪽으로 클리핑)
    c.save()
    this.jarPath(left, top, right, bottom)
    c.clip()
    c.globalAlpha = 0.45
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.moveTo(left + 24, top + 50)
    c.lineTo(left + 50, top + 50)
    c.lineTo(left + 38, bottom - 70)
    c.lineTo(left + 20, bottom - 70)
    c.closePath()
    c.fill()
    c.restore()

    // 테두리 (클리핑에서 경로가 바뀌므로 다시 그린다)
    c.save()
    this.jarPath(left, top, right, bottom)
    c.lineCap = 'round'
    c.strokeStyle = '#B98A5E'
    c.lineWidth = 14
    c.stroke()
    c.strokeStyle = 'rgb(255 255 255 / 0.45)'
    c.lineWidth = 5
    c.stroke()
    c.restore()

    // 상단 입구 (통 테두리 마감)
    c.save()
    c.strokeStyle = '#A97549'
    c.lineWidth = 14
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(left - 12, top)
    c.lineTo(left + 34, top)
    c.moveTo(right - 34, top)
    c.lineTo(right + 12, top)
    c.stroke()
    c.restore()
  }

  private jarPath(left: number, top: number, right: number, bottom: number) {
    const { c } = this
    c.beginPath()
    c.moveTo(left, top)
    c.lineTo(left, bottom - JAR_RADIUS)
    c.quadraticCurveTo(left, bottom, left + JAR_RADIUS, bottom)
    c.lineTo(right - JAR_RADIUS, bottom)
    c.quadraticCurveTo(right, bottom, right, bottom - JAR_RADIUS)
    c.lineTo(right, top)
  }

  // 문구 없이 색과 빛으로만 알리는 경고 (평소엔 거의 안 보임)
  private drawDangerZone(state: SuikaState, hasFruit: boolean) {
    const { c } = this
    const y = BOARD.dangerY
    const left = BOARD.wallLeft
    const right = BOARD.wallRight

    // 기준선: 과일이 있을 때만 아주 옅게
    if (hasFruit && state.dangerTime <= 0) {
      c.save()
      c.globalAlpha = 0.18
      c.strokeStyle = '#E53935'
      c.lineWidth = 3
      c.setLineDash([14, 16])
      c.beginPath()
      c.moveTo(left + 8, y)
      c.lineTo(right - 8, y)
      c.stroke()
      c.restore()
    }

    if (state.dangerTime <= 0) return

    // 위험 상태: 상단이 붉게 물들며 맥동
    const pulse = 0.45 + 0.55 * Math.abs(Math.sin(state.dangerTime * 7))
    c.save()
    c.globalAlpha = Math.min(0.55, state.dangerTime * 0.5) * pulse
    const band = c.createLinearGradient(0, y - 30, 0, y + DANGER_BAND)
    band.addColorStop(0, 'rgb(229 57 53 / 0.85)')
    band.addColorStop(1, 'rgb(229 57 53 / 0)')
    c.fillStyle = band
    c.fillRect(left, y - 30, right - left, DANGER_BAND + 30)

    c.globalAlpha = pulse * 0.9
    c.strokeStyle = '#E53935'
    c.lineWidth = 5
    c.setLineDash([22, 14])
    c.lineDashOffset = -state.dangerTime * 60
    c.beginPath()
    c.moveTo(left + 8, y)
    c.lineTo(right - 8, y)
    c.stroke()
    c.restore()
  }

  private drawDropGuide(state: SuikaState) {
    const { c } = this
    if (state.phase !== 'playing' || state.cooldown > 0) return

    c.save()
    c.strokeStyle = 'rgb(255 167 38 / 0.7)'
    c.lineWidth = 4
    c.setLineDash([6, 14])
    c.lineDashOffset = -state.playTime * 40
    c.beginPath()
    c.moveTo(state.aimX, BOARD.dropY + TIERS[state.currentTier].radius)
    c.lineTo(state.aimX, BOARD.floorY - 10)
    c.stroke()
    c.restore()

    // 낙하 지점 표시
    c.save()
    c.globalAlpha = 0.35
    c.fillStyle = '#FF8F00'
    c.beginPath()
    c.ellipse(state.aimX, BOARD.floorY - 16, TIERS[state.currentTier].radius * 0.7, 10, 0, 0, Math.PI * 2)
    c.fill()
    c.restore()

    drawFruit(c, state.aimX, BOARD.dropY, 0, state.currentTier)
  }

  private drawEffects(state: SuikaState) {
    const { c } = this
    for (const s of state.sparks) {
      const k = s.age / SPARK_DURATION
      c.globalAlpha = 1 - k
      c.fillStyle = s.color
      c.beginPath()
      c.arc(s.x, s.y, 9 * (1 - k) + 3, 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1

    for (const p of state.pops) {
      const k = p.age / POP_DURATION
      // 하얀 섬광 + 확산 링
      c.globalAlpha = (1 - k) * 0.5
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.arc(p.x, p.y, p.r * (0.7 + 0.5 * k), 0, Math.PI * 2)
      c.fill()
      c.globalAlpha = 1 - k
      c.strokeStyle = '#FFF176'
      c.lineWidth = 7 * (1 - k) + 1
      c.beginPath()
      c.arc(p.x, p.y, p.r * (1 + 0.9 * k), 0, Math.PI * 2)
      c.stroke()
    }
    c.globalAlpha = 1

    c.textAlign = 'center'
    c.font = font(38, true)
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

  private drawHud(state: SuikaState) {
    const { c } = this

    // 점수 (숫자만 크게)
    c.textAlign = 'center'
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      compact: true,
      panelColor: 'rgb(255 255 255 / 0.78)',
      labelColor: '#BCAAA4',
      valueColor: '#5D4037',
    })

    // 다음 과일 (라벨 대신 작은 점 3개로 표현)
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.75
    c.beginPath()
    c.roundRect(566, 34, 124, 124, 26)
    c.fill()
    c.restore()
    c.save()
    c.globalAlpha = 0.45
    c.fillStyle = '#BCAAA4'
    for (let i = 0; i < 3; i++) {
      c.beginPath()
      c.arc(612 + i * 16, 56, 3.5, 0, Math.PI * 2)
      c.fill()
    }
    c.restore()
    drawFruit(c, 628, 108, 0, state.nextTier, Math.min(TIERS[state.nextTier].radius, 34))
  }

  // 하단 진화 순서 — 달성한 티어는 컬러, 미달성은 흐리게
  private drawEvolutionChart(state: SuikaState) {
    const { c } = this
    const count = TIERS.length
    const gap = 62
    const startX = 360 - ((count - 1) * gap) / 2

    for (let i = 0; i < count; i++) {
      const x = startX + i * gap
      const reached = i <= state.maxTier
      c.save()
      if (!reached) c.globalAlpha = 0.22
      drawFruit(c, x, CHART_Y, 0, i, 22)
      c.restore()
      if (i < count - 1) {
        c.save()
        c.globalAlpha = 0.3
        c.fillStyle = '#8D6E63'
        c.beginPath()
        c.arc(x + gap / 2, CHART_Y, 2.5, 0, Math.PI * 2)
        c.fill()
        c.restore()
      }
    }
  }

  // 텍스트 없는 조작 안내: 좌우로 움직이는 터치 표식
  private drawTouchHint(state: SuikaState) {
    const { c } = this
    const t = state.playTime
    const x = 360 + Math.sin(t * 1.6) * 150
    const y = BOARD.dropY + 190
    const pulse = 0.6 + 0.4 * Math.sin(t * 4)

    c.save()
    c.globalAlpha = 0.5
    c.strokeStyle = '#8D6E63'
    c.lineWidth = 3
    c.beginPath()
    c.arc(x, y, 26 + pulse * 8, 0, Math.PI * 2)
    c.stroke()

    c.globalAlpha = 0.75
    c.fillStyle = '#8D6E63'
    c.beginPath()
    c.arc(x, y, 15, 0, Math.PI * 2)
    c.fill()

    // 좌우 화살표
    c.globalAlpha = 0.45
    for (const dir of [-1, 1]) {
      const ax = x + dir * 62
      c.beginPath()
      c.moveTo(ax + dir * 14, y)
      c.lineTo(ax - dir * 6, y - 13)
      c.lineTo(ax - dir * 6, y + 13)
      c.closePath()
      c.fill()
    }
    c.restore()
  }

  destroy() {
    this.stage.destroy()
  }
}
