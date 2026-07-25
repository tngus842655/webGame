import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  ARENA,
  PLAYER_R,
  createState,
  applyUpgrade,
  scoreOf,
  update,
} from './state'

const CARD_RECTS = [
  { x: 60, y: 420, w: 600, h: 130 },
  { x: 60, y: 580, w: 600, h: 130 },
  { x: 60, y: 740, w: 600, h: 130 },
]

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    if (state.phase === 'playing') {
      const result = update(state, dt)
      if (result.killed > 0) playMerge(2)
      if (result.hurt) {
        playDrop()
        vibrate(40)
      }
      if (result.leveledUp) vibrate(20)
      if (result.died) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let adReviveUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adButtonLabel: '▶ 광고 보고 부활하기',
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
    await ctx.submitScore(score)
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
            playMerge(4)
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
    const c = stage.begin('#FFE0B2', '#FFF3E0')

    // 아레나 경계
    c.strokeStyle = '#8D6E63'
    c.lineWidth = 6
    c.strokeRect(ARENA.left, ARENA.top, ARENA.right - ARENA.left, ARENA.bottom - ARENA.top)

    // 경험치 오브
    c.fillStyle = '#66BB6A'
    for (const orb of state.orbs) {
      c.beginPath()
      c.arc(orb.x, orb.y, 9, 0, Math.PI * 2)
      c.fill()
    }

    // 총알
    c.fillStyle = '#5D4037'
    for (const bullet of state.bullets) {
      c.beginPath()
      c.arc(bullet.x, bullet.y, 7, 0, Math.PI * 2)
      c.fill()
    }

    // 적
    for (const enemy of state.enemies) {
      c.fillStyle = '#EF5350'
      c.beginPath()
      c.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#4A0E0E'
      c.beginPath()
      c.arc(enemy.x - 7, enemy.y - 4, 4, 0, Math.PI * 2)
      c.arc(enemy.x + 7, enemy.y - 4, 4, 0, Math.PI * 2)
      c.fill()
    }

    // 플레이어
    const p = state.player
    const blink = p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0
    c.globalAlpha = blink ? 0.35 : 1
    c.fillStyle = '#42A5F5'
    c.beginPath()
    c.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#0D2C45'
    c.beginPath()
    c.arc(p.x - 8, p.y - 5, 4, 0, Math.PI * 2)
    c.arc(p.x + 8, p.y - 5, 4, 0, Math.PI * 2)
    c.fill()
    c.globalAlpha = 1

    // HUD: 시간·킬·체력·경험치
    c.textAlign = 'center'
    c.fillStyle = '#5D4037'
    c.font = 'bold 40px sans-serif'
    c.fillText(`${Math.floor(state.time)}초`, 360, 66)
    c.font = '22px sans-serif'
    c.fillStyle = '#BCAAA4'
    c.fillText(`처치 ${state.kills} · Lv.${state.level}`, 360, 100)
    c.textAlign = 'right'
    c.fillStyle = '#E53935'
    c.font = 'bold 26px sans-serif'
    c.fillText('❤'.repeat(Math.max(0, p.hp)), 690, 70)
    // 경험치 바
    c.fillStyle = 'rgb(141 110 99 / 0.25)'
    c.fillRect(ARENA.left, 118, ARENA.right - ARENA.left, 12)
    c.fillStyle = '#66BB6A'
    c.fillRect(ARENA.left, 118, (ARENA.right - ARENA.left) * Math.min(1, state.xp / state.xpNeed), 12)

    // 조이스틱
    if (state.joystick) {
      c.strokeStyle = 'rgb(93 64 55 / 0.35)'
      c.lineWidth = 4
      c.beginPath()
      c.arc(state.joystick.baseX, state.joystick.baseY, 70, 0, Math.PI * 2)
      c.stroke()
      c.fillStyle = 'rgb(93 64 55 / 0.35)'
      c.beginPath()
      c.arc(
        state.joystick.baseX + state.joystick.dx * 70,
        state.joystick.baseY + state.joystick.dy * 70,
        26,
        0,
        Math.PI * 2,
      )
      c.fill()
    }

    // 레벨업 카드
    if (state.phase === 'levelup') {
      c.fillStyle = 'rgb(62 39 35 / 0.55)'
      c.fillRect(0, 0, 720, 1280)
      c.textAlign = 'center'
      c.fillStyle = '#FFFFFF'
      c.font = 'bold 40px sans-serif'
      c.fillText('레벨 업! 강화를 선택하세요', 360, 360)
      for (let i = 0; i < CARD_RECTS.length && i < state.choices.length; i++) {
        const r = CARD_RECTS[i]
        const choice = state.choices[i]
        c.fillStyle = '#FFF8E1'
        c.beginPath()
        c.roundRect(r.x, r.y, r.w, r.h, 18)
        c.fill()
        c.fillStyle = '#5D4037'
        c.font = 'bold 32px sans-serif'
        c.fillText(choice.label, r.x + r.w / 2, r.y + 56)
        c.fillStyle = '#8D6E63'
        c.font = '22px sans-serif'
        c.fillText(choice.desc, r.x + r.w / 2, r.y + 96)
      }
    }

    if (state.time < 3 && state.phase === 'playing') {
      c.textAlign = 'center'
      c.fillStyle = '#8D6E63'
      c.font = '26px sans-serif'
      c.fillText('드래그 = 이동, 공격은 자동!', 360, 1180)
      c.fillText('초록 구슬을 모아 레벨업 하세요', 360, 1220)
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return shell
}

export default defineGame(createSession)
