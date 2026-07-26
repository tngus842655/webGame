import { t, type TranslationKey } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  battleTick,
  buy,
  createState,
  dropUnit,
  nextRound,
  startBattle,
  BOARD_SLOTS,
  UNIT_COST,
  type Unit,
} from './state'

const ICONS = ['🗡️', '🏹', '🛡️', '🔮']
const COLORS = ['#E57373', '#81C784', '#64B5F6', '#BA68C8']
const NAME_KEYS: TranslationKey[] = ['ac.s1', 'ac.s2', 'ac.s3', 'ac.s4']

// 화면 배치 (논리 720×1280)
const SLOT = 112
const SLOT_GAP = 10
const BOARD_X = (720 - (SLOT * 3 + SLOT_GAP * 2)) / 2
const BOARD_Y = 430
const FIGHT_BTN = { x: 210, y: 730, w: 300, h: 92 } as const
const SHOP_Y = 960
const SHOP_W = 200
const SHOP_H = 210

const slotPos = (i: number) => ({
  x: BOARD_X + (i % 3) * (SLOT + SLOT_GAP),
  y: BOARD_Y + Math.floor(i / 3) * (SLOT + SLOT_GAP),
})

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    if (state.phase === 'battle') {
      const events = battleTick(state, dt)
      for (const hit of events.hits) {
        const key = `${hit.mine ? 'm' : 'f'}${hit.index}`
        hitFlash.set(key, 0.25)
      }
      if (events.ended) {
        if (state.won) playMerge(6)
        else {
          playGameOver()
          vibrate(80)
        }
      }
    }
    for (const [key, value] of hitFlash) {
      const next = value - dt
      if (next <= 0) hitFlash.delete(key)
      else hitFlash.set(key, next)
    }
    if (state.phase === 'result') {
      state.resultTimer -= dt
      if (state.resultTimer <= 0 && nextRound(state)) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  const hitFlash = new Map<string, number>()
  let drag: { from: number; x: number; y: number } | null = null
  let adContinueUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'ac.ad',
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

  // 광고 보상: 체력 5로 부활해 이어서 (런당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('autochess-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.hp = 5
    state.round += 1
    state.gold += 5
    state.shop = state.shop.map(() => Math.floor(Math.random() * 4))
    state.phase = 'prep'
    overlay.hide()
  }

  async function gameOver() {
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  const slotAt = (x: number, y: number): number | null => {
    for (let i = 0; i < BOARD_SLOTS; i++) {
      const p = slotPos(i)
      if (x >= p.x && x <= p.x + SLOT && y >= p.y && y <= p.y + SLOT) return i
    }
    return null
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      if (state.phase !== 'prep') return
      // 전투 시작
      if (
        p.x >= FIGHT_BTN.x &&
        p.x <= FIGHT_BTN.x + FIGHT_BTN.w &&
        p.y >= FIGHT_BTN.y &&
        p.y <= FIGHT_BTN.y + FIGHT_BTN.h
      ) {
        if (startBattle(state)) {
          playDrop()
          vibrate(15)
        }
        return
      }
      // 상점 구매
      if (p.y >= SHOP_Y && p.y <= SHOP_Y + SHOP_H) {
        const i = Math.floor((p.x - 40) / (SHOP_W + 20))
        if (i >= 0 && i < 3 && p.x >= 40 + i * (SHOP_W + 20) && p.x <= 40 + i * (SHOP_W + 20) + SHOP_W) {
          if (buy(state, i)) {
            playDrop()
            vibrate(10)
          }
        }
        return
      }
      // 보드 드래그 시작
      const i = slotAt(p.x, p.y)
      if (i !== null && state.board[i]) drag = { from: i, x: p.x, y: p.y }
    },
    onMove(clientX, clientY) {
      if (!drag) return
      const p = stage.toBoard(clientX, clientY)
      drag.x = p.x
      drag.y = p.y
    },
    onUp(clientX, clientY) {
      if (!drag) return
      const p = stage.toBoard(clientX, clientY)
      const to = slotAt(p.x, p.y)
      if (to !== null && state.phase === 'prep') {
        const result = dropUnit(state, drag.from, to)
        if (result === 'merged') {
          playMerge(state.board[to]?.level ?? 2)
          vibrate(25)
        } else if (result !== 'none') {
          playDrop()
        }
      }
      drag = null
    },
  })

  const drawUnit = (
    c: CanvasRenderingContext2D,
    unit: Unit,
    x: number,
    y: number,
    r: number,
    flash: boolean,
    showHp: boolean,
  ) => {
    c.save()
    if (flash) c.translate(Math.sin(state.playTime * 70) * 4, 0)
    c.fillStyle = flash ? '#FFCDD2' : COLORS[unit.species]
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.fill()
    c.font = `${Math.round(r * 1.05)}px sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(ICONS[unit.species], x, y + 2)
    // 레벨 별
    c.font = `${Math.round(r * 0.42)}px sans-serif`
    c.fillText('⭐'.repeat(unit.level), x, y - r - 12)
    if (showHp) {
      c.fillStyle = 'rgb(0 0 0 / 0.45)'
      c.fillRect(x - r, y + r + 6, r * 2, 8)
      c.fillStyle = '#66BB6A'
      c.fillRect(x - r, y + r + 6, (r * 2 * Math.max(0, unit.hp)) / unit.maxHp, 8)
    }
    c.textBaseline = 'alphabetic'
    c.restore()
  }

  const draw = () => {
    const c = stage.begin('#263238', '#37474F')

    // HUD: 점수 + 라운드 + 체력 + 골드
    c.textAlign = 'center'
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.1
    c.beginPath()
    c.roundRect(160, 20, 400, 118, 22)
    c.fill()
    c.restore()
    c.fillStyle = 'rgb(255 255 255 / 0.5)'
    c.font = '17px sans-serif'
    c.fillText(t('hud.score'), 360, 48)
    c.fillStyle = '#FFFFFF'
    c.font = 'bold 44px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 100)
    c.font = 'bold 28px sans-serif'
    c.textAlign = 'left'
    c.fillText(t('ac.round', { n: state.round }), 36, 190)
    c.textAlign = 'right'
    c.fillStyle = '#EF9A9A'
    c.fillText(`❤ ${state.hp}`, 560, 190)
    c.fillStyle = '#FFD54F'
    c.fillText(`💰 ${state.gold}`, 690, 190)
    c.textAlign = 'center'

    if (state.phase === 'prep') {
      // 보드 슬롯
      for (let i = 0; i < BOARD_SLOTS; i++) {
        const p = slotPos(i)
        c.fillStyle = 'rgb(255 255 255 / 0.08)'
        c.beginPath()
        c.roundRect(p.x, p.y, SLOT, SLOT, 16)
        c.fill()
        const unit = state.board[i]
        if (unit && drag?.from !== i) {
          drawUnit(c, unit, p.x + SLOT / 2, p.y + SLOT / 2 + 6, 38, false, false)
        }
      }
      // 드래그 고스트
      if (drag) {
        const unit = state.board[drag.from]
        if (unit) {
          c.save()
          c.globalAlpha = 0.85
          drawUnit(c, unit, drag.x, drag.y - 30, 40, false, false)
          c.restore()
        }
      }
      // 전투 시작 버튼
      const canFight = state.board.some((u) => u !== null)
      c.fillStyle = canFight ? '#E64A19' : '#78909C'
      c.beginPath()
      c.roundRect(FIGHT_BTN.x, FIGHT_BTN.y, FIGHT_BTN.w, FIGHT_BTN.h, 24)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = 'bold 34px sans-serif'
      c.textBaseline = 'middle'
      c.fillText(t('ac.fight'), 360, FIGHT_BTN.y + FIGHT_BTN.h / 2 + 1)
      c.textBaseline = 'alphabetic'

      // 상점
      c.fillStyle = 'rgb(255 255 255 / 0.5)'
      c.font = '22px sans-serif'
      c.fillText(t('ac.shop'), 360, SHOP_Y - 20)
      for (let i = 0; i < 3; i++) {
        const x = 40 + i * (SHOP_W + 20)
        const species = state.shop[i]
        c.save()
        if (species < 0 || state.gold < UNIT_COST) c.globalAlpha = 0.4
        c.fillStyle = '#455A64'
        c.beginPath()
        c.roundRect(x, SHOP_Y, SHOP_W, SHOP_H, 18)
        c.fill()
        if (species >= 0) {
          c.fillStyle = COLORS[species]
          c.beginPath()
          c.arc(x + SHOP_W / 2, SHOP_Y + 78, 44, 0, Math.PI * 2)
          c.fill()
          c.font = '46px sans-serif'
          c.fillText(ICONS[species], x + SHOP_W / 2, SHOP_Y + 94)
          c.fillStyle = '#FFFFFF'
          c.font = 'bold 24px sans-serif'
          c.fillText(t(NAME_KEYS[species]), x + SHOP_W / 2, SHOP_Y + 156)
          c.fillStyle = '#FFD54F'
          c.font = 'bold 22px sans-serif'
          c.fillText(`💰 ${UNIT_COST}`, x + SHOP_W / 2, SHOP_Y + 190)
        }
        c.restore()
      }
    } else {
      // 전투/결과: 양 진영 대치
      const lineup = (units: Unit[], x: number, mine: boolean) => {
        const alive = units.length
        units.forEach((unit, i) => {
          if (unit.hp <= 0) return
          const y = 340 + (i * 440) / Math.max(1, alive - 1 || 1)
          drawUnit(c, unit, x, y, 36, hitFlash.has(`${mine ? 'm' : 'f'}${i}`), true)
        })
      }
      lineup(state.mine, 200, true)
      lineup(state.foes, 520, false)
      c.fillStyle = 'rgb(255 255 255 / 0.25)'
      c.font = 'bold 60px sans-serif'
      c.fillText('⚔', 360, 560)

      if (state.phase === 'result') {
        c.save()
        c.fillStyle = 'rgb(0 0 0 / 0.55)'
        c.fillRect(0, 560, 720, 150)
        c.font = 'bold 52px sans-serif'
        c.textBaseline = 'middle'
        if (state.won) {
          c.fillStyle = '#FFD54F'
          c.fillText(t('ac.win', { n: state.round * 100 }), 360, 635)
        } else {
          c.fillStyle = '#EF9A9A'
          c.fillText(t('ac.lose', { n: state.lostLives }), 360, 635)
        }
        c.restore()
        c.textBaseline = 'alphabetic'
      }
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return shell
}

export default defineGame(createSession)
