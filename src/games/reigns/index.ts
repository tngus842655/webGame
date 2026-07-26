import { t, type TranslationKey } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { choose, createState, update, CARDS, STAT_COUNT } from './state'

const STAT_ICONS = ['👥', '💰', '⚔️', '🕊️']
const STAT_KEYS: TranslationKey[] = ['rg.s1', 'rg.s2', 'rg.s3', 'rg.s4']

// 화면 배치 (논리 720×1280)
const CARD_RECT = { x: 80, y: 330, w: 560, h: 480 } as const
const BTN = { y: 850, h: 170, w: 272, xl: 80, xr: 368 } as const

// 캔버스용 줄바꿈 (공백 기준, 넘치면 글자 단위)
function wrapText(c: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const tryLine = line ? `${line} ${word}` : word
    if (c.measureText(tryLine).width <= maxWidth) {
      line = tryLine
    } else {
      if (line) lines.push(line)
      line = word
      while (c.measureText(line).width > maxWidth && line.length > 1) {
        let cut = line.length - 1
        while (cut > 1 && c.measureText(line.slice(0, cut)).width > maxWidth) cut--
        lines.push(line.slice(0, cut))
        line = line.slice(cut)
      }
    }
  }
  if (line) lines.push(line)
  return lines
}

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    const wasDying = state.phase === 'dying'
    update(state, dt)
    if (wasDying && state.phase === 'over') void gameOver()
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let adContinueUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'rg.ad',
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

  // 광고 보상: 모든 지표를 50으로 되돌리고 재위를 이어간다 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('reigns-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.stats = [50, 50, 50, 50]
    state.deadStat = -1
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.years)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.years, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      if (p.y < BTN.y || p.y > BTN.y + BTN.h) return
      let result = null
      if (p.x >= BTN.xl && p.x <= BTN.xl + BTN.w) {
        result = choose(state, false)
      } else if (p.x >= BTN.xr && p.x <= BTN.xr + BTN.w) {
        result = choose(state, true)
      }
      if (result === null || result === 'none') return
      playDrop()
      vibrate(10)
      if (result === 'died') playMerge(1)
    },
    onMove() {},
    onUp() {},
  })

  const drawChoiceButton = (
    c: CanvasRenderingContext2D,
    x: number,
    labelKey: TranslationKey,
    effects: readonly number[],
  ) => {
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.roundRect(x, BTN.y, BTN.w, BTN.h, 22)
    c.fill()
    c.fillStyle = '#4E342E'
    c.font = 'bold 27px sans-serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    const lines = wrapText(c, t(labelKey), BTN.w - 36)
    lines.forEach((line, i) => {
      c.fillText(line, x + BTN.w / 2, BTN.y + 52 + i * 34)
    })
    // 영향을 받는 지표 아이콘 (크기는 비공개 — 방향만 힌트)
    let hintX = x + BTN.w / 2 - (effects.filter((e) => e !== 0).length * 40 - 8) / 2
    c.font = '26px sans-serif'
    for (let i = 0; i < STAT_COUNT; i++) {
      if (effects[i] === 0) continue
      c.fillText(STAT_ICONS[i], hintX + 12, BTN.y + BTN.h - 34)
      hintX += 40
    }
    c.textBaseline = 'alphabetic'
  }

  const draw = () => {
    const c = stage.begin('#3E2723', '#5D4037')

    // HUD: 재위 년수
    c.textBaseline = 'alphabetic'
    c.textAlign = 'center'
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.95
    c.beginPath()
    c.roundRect(180, 20, 360, 116, 22)
    c.fill()
    c.restore()
    c.fillStyle = '#BCAAA4'
    c.font = '18px sans-serif'
    c.fillText(t('rg.reign'), 360, 50)
    c.fillStyle = '#3E2723'
    c.font = 'bold 44px sans-serif'
    c.fillText(t('rg.year', { n: state.years }), 360, 102)

    // 지표 바 4개
    const barW = 120
    for (let i = 0; i < STAT_COUNT; i++) {
      const x = 60 + i * 156
      const value = state.stats[i]
      const danger = value <= 15 || value >= 85
      c.font = '34px sans-serif'
      c.fillText(STAT_ICONS[i], x + barW / 2, 196)
      c.fillStyle = 'rgb(0 0 0 / 0.3)'
      c.beginPath()
      c.roundRect(x, 212, barW, 18, 9)
      c.fill()
      c.fillStyle = danger
        ? Math.sin(state.playTime * 8) > 0
          ? '#FF5252'
          : '#FFCDD2'
        : '#AED581'
      c.beginPath()
      c.roundRect(x, 212, Math.max(8, (barW * value) / 100), 18, 9)
      c.fill()
      c.fillStyle = '#D7CCC8'
      c.font = '18px sans-serif'
      c.fillText(t(STAT_KEYS[i]), x + barW / 2, 258)
    }

    // 카드
    const card = CARDS[state.card]
    const slideX = state.slide * state.slide * 720
    c.save()
    c.translate(slideX, 0)
    c.fillStyle = '#EFEBE9'
    c.beginPath()
    c.roundRect(CARD_RECT.x, CARD_RECT.y, CARD_RECT.w, CARD_RECT.h, 26)
    c.fill()
    c.font = '96px sans-serif'
    c.fillText(card.icon, 360, CARD_RECT.y + 140)
    c.fillStyle = '#3E2723'
    c.font = '30px sans-serif'
    const lines = wrapText(c, t(`rg.c${card.n}` as TranslationKey), CARD_RECT.w - 80)
    lines.forEach((line, i) => {
      c.fillText(line, 360, CARD_RECT.y + 220 + i * 44)
    })
    c.restore()

    // 선택 버튼
    if (state.phase === 'playing') {
      drawChoiceButton(c, BTN.xl, `rg.c${card.n}l` as TranslationKey, card.l)
      drawChoiceButton(c, BTN.xr, `rg.c${card.n}r` as TranslationKey, card.r)
    }

    // 퇴위 사유 배너
    if (state.phase === 'dying') {
      c.save()
      c.fillStyle = 'rgb(0 0 0 / 0.55)'
      c.fillRect(0, 560, 720, 160)
      c.fillStyle = '#FFCDD2'
      c.font = 'bold 44px sans-serif'
      c.textBaseline = 'middle'
      const name = `${STAT_ICONS[state.deadStat]} ${t(STAT_KEYS[state.deadStat])}`
      c.fillText(t(state.deadHigh ? 'rg.high' : 'rg.low', { name }), 360, 640)
      c.restore()
      c.textBaseline = 'alphabetic'
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.years }
}

export default defineGame(createSession)
