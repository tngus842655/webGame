import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { drawCardBack, drawCardFace } from './cardArt'
import {
  CARD_H,
  CARD_W,
  STOCK_POS,
  WASTE_POS,
  canPlay,
  cardX,
  cardY,
  createState,
  flipUncovered,
  hasMoves,
  loadStage,
  type PlayingCard,
  type TableCard,
} from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'

const FLIGHT_TIME = 0.18 // 웨이스트로 날아가는 애니메이션 시간(초)
const MAX_SCORE = 1_000_000 // DB check 제약

// 웨이스트로 이동 중인 카드 (표시용 — 로직상 웨이스트에는 이미 반영됨)
interface Flight extends PlayingCard {
  fromX: number
  fromY: number
  t: number
}

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    for (const flight of flights) flight.t += dt / FLIGHT_TIME
    while (flights.length > 0 && flights[0].t >= 1) flights.shift()
    if (state.clearTimer > 0) {
      state.clearTimer -= dt
      if (state.clearTimer <= 0) {
        state.stage += 1
        flights = []
        loadStage(state)
      }
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let flights: Flight[] = []
  let adContinueUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'tp.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adContinueUsed = false
      flights = []
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  // 광고 보상: 스톡에 카드 3장 추가 후 재개 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('tripeaks-stock')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    for (let i = 0; i < 3; i++) {
      state.stock.push({
        rank: Math.floor(Math.random() * 13),
        suit: Math.floor(Math.random() * 4),
      })
    }
    state.phase = 'playing'
    overlay.hide()
  }

  const addScore = (points: number) => {
    state.score = Math.min(MAX_SCORE, state.score + points)
  }

  const wasteTop = () => state.waste[state.waste.length - 1]

  function tapCard(card: TableCard) {
    if (!canPlay(card.rank, wasteTop().rank)) return
    state.moveCount += 1
    card.removed = true
    flights.push({
      rank: card.rank,
      suit: card.suit,
      fromX: cardX(card.col),
      fromY: cardY(card.row),
      t: 0,
    })
    state.waste.push({ rank: card.rank, suit: card.suit })
    state.streak += 1
    addScore(20 * state.streak)
    playMerge(Math.min(state.streak, 8))
    if (card.row === 0) {
      // 봉우리 하나 완전 제거
      addScore(200)
      vibrate(30)
    }
    flipUncovered(state.table)
    if (state.table.every((other) => other.removed)) {
      // 보드 클리어 → 잠시 후 다음 스테이지
      addScore(400 + state.stock.length * 40)
      state.clearTimer = 0.9
    } else if (state.stock.length === 0 && !hasMoves(state.table, wasteTop().rank)) {
      void gameOver()
    }
  }

  function drawFromStock() {
    const card = state.stock.pop()
    if (!card) return
    state.moveCount += 1
    state.streak = 0 // 스트릭 리셋
    state.waste.push(card)
    flights.push({ ...card, fromX: STOCK_POS.x, fromY: STOCK_POS.y, t: 0 })
    playDrop()
    if (state.stock.length === 0 && !hasMoves(state.table, wasteTop().rank)) void gameOver()
  }

  async function gameOver() {
    state.phase = 'over'
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing' || state.clearTimer > 0) return
      const p = stage.toBoard(clientX, clientY)
      // 스톡 더미 (터치 영역은 카드보다 여유 있게)
      if (Math.abs(p.x - STOCK_POS.x) < 70 && Math.abs(p.y - STOCK_POS.y) < 90) {
        drawFromStock()
        return
      }
      // 테이블 카드: 앞면끼리는 가로로만 겹치므로 x가 가장 가까운 카드 선택
      let best: TableCard | null = null
      let bestDx = Infinity
      for (const card of state.table) {
        if (card.removed || !card.faceUp) continue
        const dx = Math.abs(p.x - cardX(card.col))
        if (dx > CARD_W / 2 || Math.abs(p.y - cardY(card.row)) > CARD_H / 2) continue
        if (dx < bestDx) {
          bestDx = dx
          best = card
        }
      }
      if (best) tapCard(best)
    },
    onMove() {},
    onUp() {},
  })

  const draw = () => {
    const c = stage.begin('#14382A', '#1E5A3C')
    const topCard = wasteTop()

    // 테이블 카드: 윗행부터 그려 아랫행이 위에 겹치게 (LAYOUT 순서가 곧 그리기 순서)
    for (const card of state.table) {
      if (card.removed) continue
      const x = cardX(card.col)
      const y = cardY(card.row)
      if (card.faceUp) {
        drawCardFace(c, x, y, card.rank, card.suit, state.phase === 'playing' && canPlay(card.rank, topCard.rank))
      } else {
        drawCardBack(c, x, y)
      }
    }

    // 스톡 더미 (뒷면 스택 + 남은 장수 뱃지)
    if (state.stock.length > 0) {
      const layers = Math.min(3, state.stock.length)
      for (let i = layers - 1; i >= 0; i--) drawCardBack(c, STOCK_POS.x - i * 4, STOCK_POS.y + i * 3)
      c.save()
      c.fillStyle = '#FFF8E1'
      c.beginPath()
      c.arc(STOCK_POS.x + CARD_W / 2 - 4, STOCK_POS.y - CARD_H / 2 + 4, 19, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#4E342E'
      c.font = font(20, true)
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(String(state.stock.length), STOCK_POS.x + CARD_W / 2 - 4, STOCK_POS.y - CARD_H / 2 + 5)
      c.restore()
    } else {
      c.save()
      c.strokeStyle = 'rgb(255 255 255 / 0.3)'
      c.lineWidth = 3
      c.setLineDash([8, 8])
      c.beginPath()
      c.roundRect(STOCK_POS.x - CARD_W / 2, STOCK_POS.y - CARD_H / 2, CARD_W, CARD_H, 10)
      c.stroke()
      c.restore()
    }

    // 웨이스트 더미: 착지 완료된 카드 위 2장 (이동 중인 카드는 아직 아래 카드가 보인다)
    const landedTop = state.waste.length - 1 - flights.length
    for (let i = Math.max(0, landedTop - 1); i <= landedTop; i++) {
      const card = state.waste[i]
      drawCardFace(c, WASTE_POS.x + (i - landedTop) * 6, WASTE_POS.y, card.rank, card.suit, false)
    }

    // 이동 중 카드
    for (const flight of flights) {
      const k = 1 - Math.pow(1 - Math.min(flight.t, 1), 3)
      const x = flight.fromX + (WASTE_POS.x - flight.fromX) * k
      const y = flight.fromY + (WASTE_POS.y - flight.fromY) * k
      drawCardFace(c, x, y, flight.rank, flight.suit, false)
    }

    // HUD (골프식 흰 카드)
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: true,
      panelColor: 'rgb(255 255 255 / 0.85)',
      labelColor: '#8CA08E',
      valueColor: '#1B5E20',
    })
    c.fillStyle = '#7C8F7E'
    c.font = font(18)
    c.fillText(t('tp.stage', { n: state.stage }), SCORE_PANEL.cx, SCORE_PANEL.subY)

    // 스트릭 (2 이상일 때만 강조)
    if (state.streak >= 2) {
      const text = t('tp.streak', { n: state.streak })
      c.font = font(30, true)
      c.lineWidth = 6
      c.strokeStyle = '#FFFFFF'
      c.strokeText(text, SCORE_PANEL.cx, 204)
      c.fillStyle = '#FF6F00'
      c.fillText(text, SCORE_PANEL.cx, 204)
    }

    // 텍스트 없는 첫 판 힌트: 낼 수 있는 카드 위 통통 튀는 화살표
    if (state.stage === 1 && state.moveCount === 0 && state.phase === 'playing') {
      const target = state.table.find(
        (card) => !card.removed && card.faceUp && canPlay(card.rank, topCard.rank),
      )
      if (target) {
        const bounce = Math.abs(Math.sin(state.playTime * 5)) * 12
        const ax = cardX(target.col)
        const ay = cardY(target.row) - CARD_H / 2 - 30 - bounce
        c.save()
        c.fillStyle = '#FFD54F'
        c.shadowColor = 'rgb(0 0 0 / 0.3)'
        c.shadowBlur = 6
        c.beginPath()
        c.moveTo(ax, ay + 20)
        c.lineTo(ax - 15, ay)
        c.lineTo(ax - 6, ay)
        c.lineTo(ax - 6, ay - 16)
        c.lineTo(ax + 6, ay - 16)
        c.lineTo(ax + 6, ay)
        c.lineTo(ax + 15, ay)
        c.closePath()
        c.fill()
        c.restore()
      }
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
