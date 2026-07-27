import { t, type TranslationKey } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  chooseReward,
  createState,
  endTurn,
  intentDamage,
  playCard,
  resolveEnemyTurn,
  CARD_DEFS,
  type CardId,
} from './state'
import { font } from '../ui'
import { type IconName, drawIconValue, iconValueWidth } from '../icons'

const NAME_KEYS: Record<CardId, TranslationKey> = {
  strike: 'dk.strike',
  defend: 'dk.defend',
  bash: 'dk.bash',
  flurry: 'dk.flurry',
  wall: 'dk.wall',
  drain: 'dk.drain',
  focus: 'dk.focus',
  nova: 'dk.nova',
}

// 카드 효과 요약 — 아이콘과 숫자를 한 줄로 늘어놓는다 (숫자뿐이라 번역 불필요)
function drawCardDesc(
  c: CanvasRenderingContext2D,
  id: CardId,
  cx: number,
  cy: number,
  size: number,
) {
  const def = CARD_DEFS[id]
  const parts: Array<[IconName, string]> = []
  if (def.dmg) parts.push(['sword', `${def.dmg}${def.hits ? `×${def.hits}` : ''}`])
  if (def.block) parts.push(['shield', String(def.block)])
  if (def.heal) parts.push(['heart', `+${def.heal}`])
  if (def.draw) parts.push(['card', `+${def.draw}`])
  if (parts.length === 0) return
  const gap = size * 1.1
  const widths = parts.map(([, text]) => iconValueWidth(c, text, size))
  let x = cx - (widths.reduce((a, b) => a + b, 0) + gap * (parts.length - 1)) / 2
  parts.forEach(([icon, text], i) => {
    drawIconValue(c, icon, text, x, cy, size, 'left')
    x += widths[i] + gap
  })
}

// 화면 배치 (논리 720×1280)
const HAND_Y = 1060
const CARD_W = 128
const CARD_H = 184
const END_BTN = { x: 520, y: 950, w: 180, h: 80 } as const
const REWARD_Y = 480

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    hitFlash = Math.max(0, hitFlash - dt)
    enemyHitFlash = Math.max(0, enemyHitFlash - dt)
    if (state.phase === 'enemy') {
      state.enemyTimer -= dt
      if (state.enemyTimer <= 0) {
        const result = resolveEnemyTurn(state)
        hitFlash = 0.4
        vibrate(30)
        if (result === 'playerDied') playGameOver()
      }
    }
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let hitFlash = 0
  let enemyHitFlash = 0
  let adContinueUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'dk.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adContinueUsed = false
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  // 광고 보상: HP 30으로 부활해 같은 전투를 이어간다 (런당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('deck-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.hp = 30
    state.block = 0
    state.energy = 3
    state.phase = 'player'
    overlay.hide()
  }

  async function gameOver() {
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  const handLayout = () => {
    const n = state.hand.length
    if (n === 0) return { x0: 0, gap: 0 }
    const gap = n === 1 ? 0 : Math.min(CARD_W + 8, (720 - 40 - CARD_W) / (n - 1))
    const width = CARD_W + gap * (n - 1)
    return { x0: (720 - width) / 2, gap }
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      if (state.phase === 'player') {
        if (
          p.x >= END_BTN.x &&
          p.x <= END_BTN.x + END_BTN.w &&
          p.y >= END_BTN.y &&
          p.y <= END_BTN.y + END_BTN.h
        ) {
          endTurn(state)
          playDrop()
          return
        }
        if (p.y >= HAND_Y - 30) {
          // 손패는 겹쳐 있으므로 오른쪽 카드부터 판정
          const { x0, gap } = handLayout()
          for (let i = state.hand.length - 1; i >= 0; i--) {
            const x = x0 + i * gap
            if (p.x >= x && p.x <= x + CARD_W) {
              const result = playCard(state, i)
              if (result === 'none') return
              playMerge(3)
              vibrate(15)
              enemyHitFlash = 0.35
              if (result === 'killed') {
                playMerge(6)
                vibrate([20, 40, 20])
              }
              return
            }
          }
        }
      } else if (state.phase === 'reward') {
        for (let i = 0; i < 3; i++) {
          const x = 60 + i * 212
          if (p.x >= x && p.x <= x + 188 && p.y >= REWARD_Y && p.y <= REWARD_Y + 250) {
            chooseReward(state, i)
            playMerge(4)
            return
          }
        }
        if (p.x >= 260 && p.x <= 460 && p.y >= REWARD_Y + 290 && p.y <= REWARD_Y + 360) {
          chooseReward(state, null)
          playDrop()
        }
      }
    },
    onMove() {},
    onUp() {},
  })

  const drawCard = (
    c: CanvasRenderingContext2D,
    id: CardId,
    x: number,
    y: number,
    w: number,
    h: number,
    playable: boolean,
  ) => {
    const def = CARD_DEFS[id]
    c.save()
    if (!playable) c.globalAlpha = 0.55
    c.fillStyle = '#FFFFFF'
    c.strokeStyle = def.dmg ? '#C62828' : def.block ? '#1565C0' : '#6A1B9A'
    c.lineWidth = 3
    c.beginPath()
    c.roundRect(x, y, w, h, 14)
    c.fill()
    c.stroke()
    // 코스트
    c.fillStyle = '#FF8F00'
    c.beginPath()
    c.arc(x + 24, y + 24, 18, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#FFFFFF'
    c.font = font(22, true)
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(String(def.cost), x + 24, y + 25)
    // 이름·효과
    c.fillStyle = '#37474F'
    c.font = font(Math.round(w * 0.17), true)
    c.fillText(t(NAME_KEYS[id]), x + w / 2, y + h * 0.42)
    c.font = font(Math.round(w * 0.15))
    drawCardDesc(c, id, x + w / 2, y + h * 0.68, Math.round(w * 0.075))
    c.textBaseline = 'alphabetic'
    c.restore()
  }

  const draw = () => {
    const c = stage.begin('#1A1423', '#2A2138')

    // 스테이지·점수
    c.textAlign = 'center'
    c.fillStyle = 'rgb(255 255 255 / 0.6)'
    c.font = font(26, true)
    c.fillText(t('dk.stage', { n: state.stage }), 130, 52)
    c.textAlign = 'right'
    c.fillStyle = '#FFFFFF'
    c.font = font(34, true)
    c.fillText(state.score.toLocaleString(), 690, 56)
    c.textAlign = 'center'

    // 적: 몸체 + 의도 + 체력
    const ex = 360
    const ey = 300
    const size = state.enemy.boss ? 96 : 72
    const shakeX = enemyHitFlash > 0 ? Math.sin(state.playTime * 60) * 6 : 0
    c.save()
    c.translate(shakeX, 0)
    c.fillStyle = state.enemy.boss ? '#7B1FA2' : '#8E5A3C'
    c.beginPath()
    c.arc(ex, ey, size, 0, Math.PI * 2)
    c.fill()
    if (state.enemy.boss) {
      c.fillStyle = '#4A148C'
      c.beginPath()
      c.moveTo(ex - size * 0.6, ey - size * 0.6)
      c.lineTo(ex - size * 0.95, ey - size * 1.25)
      c.lineTo(ex - size * 0.25, ey - size * 0.9)
      c.moveTo(ex + size * 0.6, ey - size * 0.6)
      c.lineTo(ex + size * 0.95, ey - size * 1.25)
      c.lineTo(ex + size * 0.25, ey - size * 0.9)
      c.fill()
    }
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.arc(ex - size * 0.3, ey - size * 0.15, size * 0.16, 0, Math.PI * 2)
    c.arc(ex + size * 0.3, ey - size * 0.15, size * 0.16, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#1A1423'
    c.beginPath()
    c.arc(ex - size * 0.3, ey - size * 0.13, size * 0.07, 0, Math.PI * 2)
    c.arc(ex + size * 0.3, ey - size * 0.13, size * 0.07, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = '#1A1423'
    c.lineWidth = 4
    c.beginPath()
    c.arc(ex, ey + size * 0.35, size * 0.25, 1.15 * Math.PI, 1.85 * Math.PI)
    c.stroke()
    c.restore()

    // 적 체력 바
    c.fillStyle = 'rgb(0 0 0 / 0.4)'
    c.beginPath()
    c.roundRect(210, 420, 300, 22, 11)
    c.fill()
    c.fillStyle = '#EF5350'
    c.beginPath()
    c.roundRect(210, 420, Math.max(10, (300 * state.enemy.hp) / state.enemy.maxHp), 22, 11)
    c.fill()
    c.fillStyle = '#FFFFFF'
    c.font = font(20, true)
    c.textBaseline = 'middle'
    c.fillText(`${state.enemy.hp}/${state.enemy.maxHp}`, 360, 432)
    c.textBaseline = 'alphabetic'
    // 의도
    if (state.phase === 'player' || state.phase === 'enemy') {
      c.font = font(30, true)
      c.fillStyle = intentDamage(state) > 6 + state.stage * 2 ? '#FF8A80' : '#FFCC80'
      drawIconValue(c, 'sword', String(intentDamage(state)), 360, 170, 16)
    }

    // 플레이어 상태
    const flash = hitFlash > 0
    c.fillStyle = flash ? '#B71C1C' : 'rgb(255 255 255 / 0.08)'
    c.beginPath()
    c.roundRect(40, 860, 640, 70, 18)
    c.fill()
    c.font = font(30, true)
    c.textBaseline = 'middle'
    c.textAlign = 'left'
    c.fillStyle = '#EF9A9A'
    drawIconValue(c, 'heart', `${state.hp}/${state.maxHp}`, 70, 896, 16, 'left')
    c.fillStyle = '#90CAF9'
    drawIconValue(c, 'shield', String(state.block), 320, 896, 16, 'left')
    c.fillStyle = '#FFD54F'
    drawIconValue(c, 'bolt', `${state.energy}/3`, 500, 896, 16, 'left')
    c.textAlign = 'center'
    c.textBaseline = 'alphabetic'

    // 턴 종료 버튼
    if (state.phase === 'player') {
      c.fillStyle = '#43A047'
      c.beginPath()
      c.roundRect(END_BTN.x, END_BTN.y, END_BTN.w, END_BTN.h, 20)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = font(28, true)
      c.textBaseline = 'middle'
      c.fillText(t('dk.endTurn'), END_BTN.x + END_BTN.w / 2, END_BTN.y + END_BTN.h / 2 + 1)
      c.textBaseline = 'alphabetic'
    }

    // 손패
    const { x0, gap } = handLayout()
    for (let i = 0; i < state.hand.length; i++) {
      const id = state.hand[i]
      drawCard(
        c,
        id,
        x0 + i * gap,
        HAND_Y,
        CARD_W,
        CARD_H,
        state.phase === 'player' && state.energy >= CARD_DEFS[id].cost,
      )
    }

    // 보상 선택
    if (state.phase === 'reward') {
      c.fillStyle = 'rgb(0 0 0 / 0.6)'
      c.fillRect(0, 0, 720, 1280)
      c.fillStyle = '#FFFFFF'
      c.font = font(38, true)
      c.fillText(t('dk.pick'), 360, 420)
      for (let i = 0; i < 3; i++) {
        drawCard(c, state.rewards[i], 60 + i * 212, REWARD_Y, 188, 250, true)
      }
      c.fillStyle = 'rgb(255 255 255 / 0.25)'
      c.beginPath()
      c.roundRect(260, REWARD_Y + 290, 200, 70, 18)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = font(26, true)
      c.textBaseline = 'middle'
      c.fillText(t('dk.skip'), 360, REWARD_Y + 326)
      c.textBaseline = 'alphabetic'
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
