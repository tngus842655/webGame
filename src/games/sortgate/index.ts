import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  BOTTOM_Y,
  BOX_X,
  BOX_Y,
  COLORS,
  RADIUS,
  SHAPES,
  SPAWN_Y,
  createState,
  reviveWithLife,
  sort,
  update,
  type Criterion,
  type ShapeKind,
  type Side,
} from './state'

const TAP_SLOP = 40 // 이보다 적게 움직이면 스와이프가 아니라 좌우 절반 탭으로 본다

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    const events = update(state, dt)
    if (events.missed) {
      playDrop()
      vibrate(80)
    }
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let adReviveUsed = false
  let down: { x: number; y: number } | null = null

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'sg.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adReviveUsed = false
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  async function continueWithAd() {
    if (state.phase !== 'over' || adReviveUsed) return
    const rewarded = await ctx.showRewardAd('sortgate-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adReviveUsed = true
    reviveWithLife(state)
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adReviveUsed)
  }

  const push = (side: Side) => {
    const correct = sort(state, side)
    if (correct === null) return
    if (correct) {
      playMerge(Math.min(6, 2 + Math.floor(state.streak / 3)))
      vibrate(12)
    } else {
      playDrop()
      vibrate(90)
    }
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      down = stage.toBoard(clientX, clientY)
    },
    onMove() {},
    onUp(clientX, clientY) {
      if (!down) return
      const p = stage.toBoard(clientX, clientY)
      const dx = p.x - down.x
      // 스와이프 방향 우선, 거의 움직이지 않았으면 누른 쪽 절반
      push(Math.abs(dx) >= TAP_SLOP ? (dx > 0 ? 1 : -1) : down.x < 360 ? -1 : 1)
      down = null
    },
  })

  const shapePath = (kind: ShapeKind, cx: number, cy: number, r: number) => {
    const c = stage.c
    c.beginPath()
    if (kind === 'circle') {
      c.arc(cx, cy, r, 0, Math.PI * 2)
    } else if (kind === 'triangle') {
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 3
        const x = cx + Math.cos(a) * r * 1.14
        const y = cy + Math.sin(a) * r * 1.14
        if (i === 0) c.moveTo(x, y)
        else c.lineTo(x, y)
      }
      c.closePath()
    } else {
      const s = r * 1.72
      c.roundRect(cx - s / 2, cy - s / 2, s, s, r * 0.24)
    }
  }

  const fillShape = (kind: ShapeKind, cx: number, cy: number, r: number, color: string) => {
    const c = stage.c
    shapePath(kind, cx, cy, r)
    c.fillStyle = color
    c.fill()
    c.strokeStyle = 'rgb(0 0 0 / 0.16)'
    c.lineWidth = 3
    c.stroke()
  }

  // 상자 기준: 그 상자에 들어갈 수 있는 예시 셋을 나란히 그린다.
  // 기준과 무관한 속성은 셋 안에서 흩어지므로 '무엇이 같은지'가 곧 기준이 된다.
  const drawCriterion = (crit: Criterion, side: 'left' | 'right', scale: number) => {
    const value = side === 'left' ? crit.left : crit.right
    const cx = BOX_X[side]
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * 62 * scale
      if (crit.axis === 'color') fillShape(SHAPES[i], x, BOX_Y, 20 * scale, COLORS[value])
      else if (crit.axis === 'shape') fillShape(SHAPES[value], x, BOX_Y, 20 * scale, COLORS[i])
      else fillShape(SHAPES[i], x, BOX_Y, (value === 0 ? 13 : 26) * scale, '#CFD8DC')
    }
  }

  const drawBox = (side: 'left' | 'right') => {
    const c = stage.c
    const cx = BOX_X[side]
    const announcing = state.announce > 0
    const hinted = state.hintTimer > 0 && state.hintSide === (side === 'left' ? -1 : 1)
    c.beginPath()
    c.roundRect(cx - 132, BOX_Y - 78, 264, 156, 22)
    c.fillStyle = 'rgb(255 255 255 / 0.06)'
    c.fill()
    c.lineWidth = hinted || announcing ? 6 : 3
    c.strokeStyle = hinted
      ? '#66BB6A'
      : announcing
        ? `rgb(255 213 79 / ${0.5 + 0.5 * Math.sin(state.announce * 12)})`
        : 'rgb(255 255 255 / 0.16)'
    c.stroke()
    // 예고 중에는 기준을 크게 — 광고로 이어할 때도 같은 연출을 3초간 쓴다
    drawCriterion(state.crit, side, announcing ? 1.22 : 1)

    // 어느 쪽으로 밀어야 하는지 알려주는 꼬리표
    c.strokeStyle = 'rgb(255 255 255 / 0.35)'
    c.lineWidth = 5
    c.lineCap = 'round'
    const ax = side === 'left' ? cx - 158 : cx + 158
    const dir = side === 'left' ? -1 : 1
    c.beginPath()
    c.moveTo(ax - dir * 9, BOX_Y - 13)
    c.lineTo(ax + dir * 9, BOX_Y)
    c.lineTo(ax - dir * 9, BOX_Y + 13)
    c.stroke()
    c.lineCap = 'butt'
  }

  const draw = () => {
    const c = stage.begin('#16232B', '#1E3038')

    drawBox('left')
    drawBox('right')

    // 낙하 레인
    c.save()
    c.strokeStyle = 'rgb(255 255 255 / 0.06)'
    c.lineWidth = 2
    c.setLineDash([10, 14])
    c.beginPath()
    c.moveTo(360, SPAWN_Y - 60)
    c.lineTo(360, BOTTOM_Y)
    c.stroke()
    c.restore()

    // 바닥선 — 여기까지 내려오면 놓친 것
    c.fillStyle = state.wrongFlash > 0 ? '#EF5350' : '#37474F'
    c.fillRect(0, BOTTOM_Y, 720, 12)
    c.fillStyle = 'rgb(255 255 255 / 0.12)'
    for (let x = 0; x < 720; x += 48) c.fillRect(x, BOTTOM_Y, 24, 12)

    // 기준 예고: 남은 시간이 줄어드는 고리
    if (state.announce > 0) {
      const ratio = state.announce / state.announceSpan
      c.save()
      c.translate(360, 412)
      c.strokeStyle = 'rgb(255 255 255 / 0.12)'
      c.lineWidth = 7
      c.beginPath()
      c.arc(0, 0, 24, 0, Math.PI * 2)
      c.stroke()
      c.strokeStyle = '#FFD54F'
      c.beginPath()
      c.arc(0, 0, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio)
      c.stroke()
      c.restore()
    }

    const piece = state.piece
    if (piece) {
      const r = RADIUS[piece.size]
      let x = 360
      let y = piece.y
      let alpha = 1
      let scale = 1
      if (piece.side !== 0) {
        // 상자로 빨려 들어가는 연출 — 어디로 갔는지 눈으로 확인시킨다
        const e = 1 - (1 - piece.fly) * (1 - piece.fly)
        const target = BOX_X[piece.side === -1 ? 'left' : 'right']
        x = 360 + (target - 360) * e
        y = piece.y + (BOX_Y - piece.y) * e
        alpha = 1 - e * 0.75
        scale = 1 - e * 0.45
      }
      c.save()
      c.globalAlpha = alpha
      fillShape(piece.kind, x, y, r * scale, COLORS[piece.color])
      c.restore()

      // 처음 몇 개까지만 좌우로 밀라는 표시를 도형 옆에 띄운다
      if (piece.side === 0 && state.resolved < 3) {
        c.save()
        c.globalAlpha = 0.3
        c.strokeStyle = '#FFFFFF'
        c.lineWidth = 6
        c.lineCap = 'round'
        for (const dir of [-1, 1]) {
          const ax = 360 + dir * (r + 68)
          c.beginPath()
          c.moveTo(ax - dir * 12, y - 16)
          c.lineTo(ax + dir * 12, y)
          c.lineTo(ax - dir * 12, y + 16)
          c.stroke()
        }
        c.restore()
      }
    }

    if (state.wrongFlash > 0) {
      c.save()
      c.globalAlpha = state.wrongFlash * 0.5
      c.fillStyle = '#EF5350'
      c.fillRect(0, 0, 720, 1280)
      c.restore()
    }

    // HUD: 점수 + 목숨
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.1
    c.beginPath()
    c.roundRect(160, 24, 400, 130, 24)
    c.fill()
    c.restore()
    c.textAlign = 'center'
    c.fillStyle = 'rgb(255 255 255 / 0.5)'
    c.font = '18px sans-serif'
    c.fillText(t('hud.score'), 360, 56)
    c.fillStyle = '#FFFFFF'
    c.font = 'bold 48px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 112)
    c.font = 'bold 26px sans-serif'
    c.fillText('❤'.repeat(state.lives), 360, 144)
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
