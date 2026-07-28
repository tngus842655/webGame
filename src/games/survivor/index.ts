import { t } from '@/shared/i18n'
import { playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { drawBullet, drawEnemy, drawHero, drawOrb } from './sprites'
import { CanvasStage } from '../stage'
import {
  ARENA,
  PLAYER_R,
  UPGRADE_POOL,
  createState,
  applyUpgrade,
  scoreOf,
  update,
} from './state'
import { drawScorePanel, font } from '../ui'

function drawHeart(c: CanvasRenderingContext2D, x: number, y: number, r: number, filled: boolean) {
  c.save()
  c.translate(x, y)
  c.beginPath()
  c.moveTo(0, r * 0.75)
  c.bezierCurveTo(-r * 1.4, -r * 0.3, -r * 0.5, -r * 1.2, 0, -r * 0.4)
  c.bezierCurveTo(r * 0.5, -r * 1.2, r * 1.4, -r * 0.3, 0, r * 0.75)
  c.closePath()
  if (filled) {
    c.fillStyle = '#E53935'
    c.fill()
    c.strokeStyle = '#9B1B18'
  } else {
    c.fillStyle = 'rgb(141 110 99 / 0.18)'
    c.fill()
    c.strokeStyle = 'rgb(141 110 99 / 0.35)'
  }
  c.lineWidth = 2
  c.stroke()
  c.restore()
}

// 강화 카드 아이콘 (이모지 대신 벡터)
function drawUpgradeIcon(
  c: CanvasRenderingContext2D,
  key: 'damage' | 'firerate' | 'speed' | 'maxhp',
  x: number,
  y: number,
) {
  c.save()
  c.translate(x, y)
  c.lineCap = 'round'
  c.lineJoin = 'round'
  switch (key) {
    case 'damage': // 검
      c.strokeStyle = '#607D8B'
      c.lineWidth = 8
      c.beginPath()
      c.moveTo(-16, 18)
      c.lineTo(16, -18)
      c.stroke()
      c.strokeStyle = '#8D6E63'
      c.lineWidth = 7
      c.beginPath()
      c.moveTo(-22, 12)
      c.lineTo(-10, 24)
      c.stroke()
      break
    case 'firerate': // 번개
      c.fillStyle = '#FFB300'
      c.beginPath()
      c.moveTo(4, -22)
      c.lineTo(-14, 4)
      c.lineTo(-1, 4)
      c.lineTo(-5, 22)
      c.lineTo(14, -4)
      c.lineTo(1, -4)
      c.closePath()
      c.fill()
      break
    case 'speed': // 속도선
      c.strokeStyle = '#29B6F6'
      c.lineWidth = 6
      for (const [dy, len] of [[-12, 24], [0, 32], [12, 20]] as Array<[number, number]>) {
        c.beginPath()
        c.moveTo(-len / 2, dy)
        c.lineTo(len / 2, dy)
        c.stroke()
      }
      break
    case 'maxhp': // 하트
      drawHeart(c, 0, 0, 18, true)
      break
  }
  c.restore()
}

const CARD_RECTS = [
  { x: 60, y: 420, w: 600, h: 130 },
  { x: 60, y: 580, w: 600, h: 130 },
  { x: 60, y: 740, w: 600, h: 130 },
]

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    if (state.phase === 'playing') {
      const result = update(state, dt)
      if (result.killed > 0) playSfx('pop', { gain: 0.7 })
      if (result.hurt) {
        playSfx('hurt')
        vibrate(40)
      }
      if (result.leveledUp) vibrate(20)
      if (result.died) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('gameover', 'hurt', 'pop', 'unlock')
  let adReviveUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'sv.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adReviveUsed = false
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void reviveWithAd()
    },
  })

  async function reviveWithAd() {
    if (state.phase !== 'over' || adReviveUsed) return
    const rewarded = await ctx.showRewardAd('survivor_revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adReviveUsed = true
    state.player.hp = state.player.maxHp
    state.player.invuln = 2
    state.enemies = state.enemies.filter(
      (e) => Math.hypot(e.x - state.player.x, e.y - state.player.y) > 320,
    )
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const score = scoreOf(state)
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(score, prevBest, ctx.isRewardAdReady() && !adReviveUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      if (state.phase === 'levelup') {
        for (let i = 0; i < CARD_RECTS.length && i < state.choices.length; i++) {
          const r = CARD_RECTS[i]
          if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
            applyUpgrade(state, state.choices[i])
            state.choices = []
            state.phase = 'playing'
            playSfx('unlock')
            return
          }
        }
        return
      }
      if (state.phase !== 'playing') return
      state.joystick = { baseX: p.x, baseY: p.y, dx: 0, dy: 0 }
    },
    onMove(clientX, clientY) {
      if (!state.joystick || state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      const dx = p.x - state.joystick.baseX
      const dy = p.y - state.joystick.baseY
      const len = Math.hypot(dx, dy)
      if (len < 12) {
        state.joystick.dx = 0
        state.joystick.dy = 0
        return
      }
      const k = Math.min(1, len / 70)
      state.joystick.dx = (dx / len) * k
      state.joystick.dy = (dy / len) * k
    },
    onUp() {
      state.joystick = null
    },
  })

  const draw = () => {
    const c = stage.begin('#D8C4A6', '#FFF8E1')

    // 아레나 바닥
    const floor = c.createLinearGradient(0, ARENA.top, 0, ARENA.bottom)
    floor.addColorStop(0, '#FFF3D6')
    floor.addColorStop(1, '#F3E0BC')
    c.fillStyle = floor
    c.beginPath()
    c.roundRect(ARENA.left, ARENA.top, ARENA.right - ARENA.left, ARENA.bottom - ARENA.top, 22)
    c.fill()
    // 바닥 격자
    c.save()
    c.beginPath()
    c.roundRect(ARENA.left, ARENA.top, ARENA.right - ARENA.left, ARENA.bottom - ARENA.top, 22)
    c.clip()
    c.strokeStyle = 'rgb(141 110 99 / 0.09)'
    c.lineWidth = 2
    for (let gx = ARENA.left; gx <= ARENA.right; gx += 80) {
      c.beginPath(); c.moveTo(gx, ARENA.top); c.lineTo(gx, ARENA.bottom); c.stroke()
    }
    for (let gy = ARENA.top; gy <= ARENA.bottom; gy += 80) {
      c.beginPath(); c.moveTo(ARENA.left, gy); c.lineTo(ARENA.right, gy); c.stroke()
    }
    c.restore()
    c.strokeStyle = 'rgb(141 110 99 / 0.35)'
    c.lineWidth = 5
    c.beginPath()
    c.roundRect(ARENA.left, ARENA.top, ARENA.right - ARENA.left, ARENA.bottom - ARENA.top, 22)
    c.stroke()

    for (const orb of state.orbs) drawOrb(c, orb.x, orb.y, state.time * 4)
    for (const bullet of state.bullets) drawBullet(c, bullet.x, bullet.y)
    for (const enemy of state.enemies) drawEnemy(c, enemy.x, enemy.y, enemy.r, enemy.hp)

    const p = state.player
    const blink = p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0
    c.save()
    if (blink) c.globalAlpha = 0.35
    drawHero(c, p.x, p.y, PLAYER_R, state.joystick?.dx ?? 0)
    c.restore()

    // HUD — 판(ARENA.top=150) 위에 얹혀야 해서 좁고 짧은 판을 쓴다.
    // 이 게임의 성적은 버틴 시간이라 큰 숫자 자리에 시간이 온다.
    drawScorePanel(c, {
      label: t('sv.kills', { k: state.kills, lv: state.level }),
      value: t('sv.time', { n: Math.floor(state.time) }),
      compact: true,
      panelColor: 'rgb(255 255 255 / 0.72)',
      labelColor: '#BCAAA4',
      valueColor: '#5D4037',
    })

    // 체력 하트
    for (let i = 0; i < p.maxHp; i++) {
      drawHeart(c, ARENA.right - 26 - i * 40, 56, 15, i < p.hp)
    }

    // 경험치 바
    c.save()
    c.fillStyle = 'rgb(141 110 99 / 0.2)'
    c.beginPath()
    c.roundRect(ARENA.left, 132, ARENA.right - ARENA.left, 12, 6)
    c.fill()
    const xpRatio = Math.min(1, state.xp / state.xpNeed)
    if (xpRatio > 0) {
      c.fillStyle = '#66BB6A'
      c.beginPath()
      c.roundRect(ARENA.left, 132, (ARENA.right - ARENA.left) * xpRatio, 12, 6)
      c.fill()
    }
    c.restore()

    // 조이스틱
    if (state.joystick) {
      c.save()
      c.globalAlpha = 0.28
      c.fillStyle = '#5D4037'
      c.beginPath()
      c.arc(state.joystick.baseX, state.joystick.baseY, 72, 0, Math.PI * 2)
      c.fill()
      c.globalAlpha = 0.55
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.arc(
        state.joystick.baseX + state.joystick.dx * 72,
        state.joystick.baseY + state.joystick.dy * 72,
        28,
        0,
        Math.PI * 2,
      )
      c.fill()
      c.restore()
    }

    // 레벨업 카드
    if (state.phase === 'levelup') {
      c.fillStyle = 'rgb(62 39 35 / 0.6)'
      c.fillRect(0, 0, 720, 1280)
      c.textAlign = 'center'
      c.fillStyle = '#FFFFFF'
      c.font = font(40, true)
      c.fillText(t('sv.levelup'), 360, 352)

      // 지금까지 쌓은 것 — 다음 하나를 무엇으로 채울지는 이걸 봐야 정할 수 있다
      c.fillStyle = 'rgb(255 248 225 / 0.7)'
      c.font = font(20)
      c.fillText(t('sv.taken'), 360, 216)
      for (let i = 0; i < UPGRADE_POOL.length; i++) {
        const key = UPGRADE_POOL[i].key
        const n = state.taken[key]
        const ux = 360 + (i - (UPGRADE_POOL.length - 1) / 2) * 128
        c.save()
        c.globalAlpha = n > 0 ? 1 : 0.24
        c.translate(ux, 262)
        c.scale(0.62, 0.62)
        drawUpgradeIcon(c, key, 0, 0)
        c.restore()
        c.save()
        c.globalAlpha = n > 0 ? 1 : 0.24
        c.fillStyle = '#FFF8E1'
        c.font = font(22, true)
        c.fillText(`×${n}`, ux, 306)
        c.restore()
      }
      for (let i = 0; i < CARD_RECTS.length && i < state.choices.length; i++) {
        const r = CARD_RECTS[i]
        const choice = state.choices[i]
        c.save()
        c.fillStyle = '#C8A97E'
        c.beginPath()
        c.roundRect(r.x, r.y + 6, r.w, r.h, 20)
        c.fill()
        c.fillStyle = '#FFF8E1'
        c.beginPath()
        c.roundRect(r.x, r.y, r.w, r.h, 20)
        c.fill()
        c.strokeStyle = '#8D6E63'
        c.lineWidth = 3
        c.stroke()
        c.restore()
        drawUpgradeIcon(c, choice.key, r.x + 62, r.y + r.h / 2)
        c.textAlign = 'left'
        c.fillStyle = '#5D4037'
        c.font = font(32, true)
        c.fillText(t(choice.label), r.x + 116, r.y + 56)
        c.fillStyle = '#8D6E63'
        c.font = font(21)
        c.fillText(t(choice.desc), r.x + 116, r.y + 94)
        c.textAlign = 'center'
      }
    }

    // 텍스트 없는 조작 안내: 원을 도는 조이스틱 표식
    if (state.time < 4 && state.phase === 'playing' && !state.joystick) {
      const a = state.time * 2
      const bx = 360
      const by = 1130
      c.save()
      c.globalAlpha = 0.3
      c.fillStyle = '#5D4037'
      c.beginPath()
      c.arc(bx, by, 60, 0, Math.PI * 2)
      c.fill()
      c.globalAlpha = 0.6
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.arc(bx + Math.cos(a) * 42, by + Math.sin(a) * 42, 24, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => scoreOf(state) }
}

export default defineGame(createSession)
