import { t, type TranslationKey } from '@/shared/i18n'
import { playDrop, playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
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
import { drawCardArt } from './cardArt'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'
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

// 카드 종류별 색 — 공격은 붉게, 방어는 푸르게, 나머지는 보라
function cardTone(id: CardId): { edge: string; band: string } {
  const def = CARD_DEFS[id]
  if (def.dmg) return { edge: '#B3261E', band: '#E5534B' }
  if (def.block) return { edge: '#12508F', band: '#3A85D6' }
  return { edge: '#5B2E92', band: '#8E5BD0' }
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
const ENEMY_X = 360
const ENEMY_Y = 356
const HP_BAR_Y = 486

// 스테이지가 넘어갈수록 적의 살결이 바뀐다 — 얼마나 왔는지 눈으로 안다
const ENEMY_SKIN = [
  { body: '#6E8A4E', dark: '#3F5230', light: '#9DBE74' },
  { body: '#8E5A3C', dark: '#553120', light: '#C08A63' },
  { body: '#4E7A8A', dark: '#2B4855', light: '#7FB4C4' },
  { body: '#7A5A8A', dark: '#452F52', light: '#B08AC4' },
]
const BOSS_SKIN = { body: '#7B1FA2', dark: '#3E1050', light: '#C97FE0' }

interface Popup {
  x: number
  y: number
  text: string
  color: string
  age: number
}
const POPUP_LIFE = 0.9

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    if (state.phase === 'enemy') {
      state.enemyTimer -= dt
      if (state.enemyTimer <= 0) {
        const result = resolveEnemyTurn(state)
        lunge = 1
        shake = 1
        vibrate(30)
        if (result.blocked > 0) {
          popups.push({ x: 250, y: 830, text: `-${result.blocked}`, color: '#90CAF9', age: 0 })
          blockBreak = 1
        }
        if (result.damage > 0) {
          playSfx('hurt')
          hitFlash = 1
          popups.push({ x: 130, y: 830, text: `-${result.damage}`, color: '#FF8A80', age: 0 })
        }
        if (result.died) playGameOver()
      }
    }
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    stepEffects(dt)
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('clear', 'gameover', 'hurt', 'select', 'sword', 'tap', 'unlock')
  const popups: Popup[] = []
  let hitFlash = 0
  let enemyHit = 0 // 적이 맞아 흔들리는 정도
  let slash = 0 // 적 위를 스치는 칼자국
  let lunge = 0 // 적이 덮치는 동작
  let shake = 0
  let blockBreak = 0
  let hasPlayed = false
  let adContinueUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'dk.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adContinueUsed = false
      Object.assign(state, createState())
      popups.length = 0
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
    void ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adContinueUsed, 'over.byHp')
  }

  const stepEffects = (dt: number) => {
    hitFlash = Math.max(0, hitFlash - dt * 2.2)
    enemyHit = Math.max(0, enemyHit - dt * 3.2)
    slash = Math.max(0, slash - dt * 3.4)
    lunge = Math.max(0, lunge - dt * 2.6)
    shake = Math.max(0, shake - dt * 3.4)
    blockBreak = Math.max(0, blockBreak - dt * 1.8)
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].age += dt
      if (popups[i].age >= POPUP_LIFE) popups.splice(i, 1)
    }
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
          playSfx('select')
          return
        }
        if (p.y >= HAND_Y - 30) {
          // 손패는 겹쳐 있으므로 오른쪽 카드부터 판정
          const { x0, gap } = handLayout()
          for (let i = state.hand.length - 1; i >= 0; i--) {
            const x = x0 + i * gap
            if (p.x < x || p.x > x + CARD_W) continue
            const id = state.hand[i]
            const hpBefore = state.hp
            const enemyHpBefore = state.enemy.hp
            const result = playCard(state, i)
            if (result === 'none') return
            hasPlayed = true
            playSfx(CARD_DEFS[id].dmg ? 'sword' : 'select')
            vibrate(15)
            // 무엇이 얼마나 일어났는지 숫자로 띄운다 — 카드 효과가 숫자로만 적혀 있어
            // 실제로 몇이 들어갔는지 볼 곳이 없었다
            const dealt = enemyHpBefore - Math.max(0, state.enemy.hp)
            if (dealt > 0) {
              enemyHit = 1
              slash = 1
              popups.push({ x: ENEMY_X, y: ENEMY_Y - 30, text: `-${dealt}`, color: '#FF8A80', age: 0 })
            }
            const def = CARD_DEFS[id]
            if (def.block) {
              popups.push({ x: 320, y: 830, text: `+${def.block}`, color: '#90CAF9', age: 0 })
            }
            const healed = state.hp - hpBefore
            if (healed > 0) {
              popups.push({ x: 110, y: 830, text: `+${healed}`, color: '#A5D6A7', age: 0 })
            }
            if (result === 'killed') {
              playSfx('clear')
              vibrate([20, 40, 20])
            }
            return
          }
        }
      } else if (state.phase === 'reward') {
        for (let i = 0; i < 3; i++) {
          const x = 60 + i * 212
          if (p.x >= x && p.x <= x + 188 && p.y >= REWARD_Y && p.y <= REWARD_Y + 250) {
            chooseReward(state, i)
            playSfx('unlock')
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

  // 카드 — 흰 사각형에 글자만 얹던 것을 종이·테두리·그림이 있는 물건으로.
  // 그림이 먼저 읽히고 이름과 숫자가 뒤를 받친다.
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
    const tone = cardTone(id)
    c.save()
    if (!playable) c.globalAlpha = 0.5

    c.fillStyle = 'rgb(0 0 0 / 0.35)'
    c.beginPath()
    c.roundRect(x + 3, y + 5, w, h, 15)
    c.fill()

    const paper = c.createLinearGradient(x, y, x, y + h)
    paper.addColorStop(0, '#FFFDF7')
    paper.addColorStop(1, '#EADFC8')
    c.fillStyle = paper
    c.beginPath()
    c.roundRect(x, y, w, h, 15)
    c.fill()
    c.strokeStyle = tone.edge
    c.lineWidth = 3
    c.stroke()

    // 종류 띠 — 손패가 겹쳐 있어도 위쪽만 보고 공격인지 방어인지 안다
    c.save()
    c.beginPath()
    c.roundRect(x, y, w, h, 15)
    c.clip()
    c.fillStyle = tone.band
    c.fillRect(x, y, w, h * 0.055)
    c.restore()

    // 안쪽 테두리
    c.strokeStyle = 'rgb(120 100 70 / 0.28)'
    c.lineWidth = 1.5
    c.beginPath()
    c.roundRect(x + 7, y + 7, w - 14, h - 14, 10)
    c.stroke()

    drawCardArt(c, id, x + w / 2, y + h * 0.4, w * 0.26)

    c.fillStyle = '#4A3B2E'
    c.font = font(Math.round(w * 0.145), true)
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(t(NAME_KEYS[id]), x + w / 2, y + h * 0.72)
    c.font = font(Math.round(w * 0.14))
    c.fillStyle = '#5D4A38'
    drawCardDesc(c, id, x + w / 2, y + h * 0.87, Math.round(w * 0.078))

    // 코스트 보석 — 낼 수 없으면 붉어져서 왜 못 내는지 알려준다
    const cx = x + w * 0.16
    const cy = y + h * 0.1
    const r = w * 0.145
    c.fillStyle = playable ? '#B26500' : '#8E2C2C'
    c.beginPath()
    c.arc(cx, cy, r, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = playable ? '#FFA726' : '#D45B5B'
    c.beginPath()
    c.arc(cx, cy - r * 0.09, r * 0.85, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = 'rgb(255 255 255 / 0.6)'
    c.beginPath()
    c.ellipse(cx - r * 0.3, cy - r * 0.38, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#FFFFFF'
    c.font = font(Math.round(r * 1.25), true)
    c.fillText(String(def.cost), cx, cy + 1)

    c.textBaseline = 'alphabetic'
    c.restore()
  }

  // 적 — 원 + 눈이던 것을 어깨와 팔이 있는 덩치로. 보스는 뿔과 어깨 갑주로 갈린다.
  const drawEnemy = (c: CanvasRenderingContext2D, s: number, boss: boolean) => {
    const skin = boss ? BOSS_SKIN : ENEMY_SKIN[(state.stage - 1) % ENEMY_SKIN.length]
    const breathe = Math.sin(state.playTime * 1.8) * s * 0.02

    // 바닥 그림자
    c.fillStyle = 'rgb(0 0 0 / 0.3)'
    c.beginPath()
    c.ellipse(0, s * 1.02, s * 0.9, s * 0.2, 0, 0, Math.PI * 2)
    c.fill()

    c.save()
    c.translate(0, breathe)
    // 팔
    c.strokeStyle = skin.dark
    c.lineWidth = s * 0.24
    c.lineCap = 'round'
    for (const dir of [-1, 1]) {
      c.beginPath()
      c.moveTo(dir * s * 0.62, -s * 0.1)
      c.quadraticCurveTo(dir * s * 1.02, s * 0.3, dir * s * 0.78, s * 0.76)
      c.stroke()
    }
    // 몸통 — 어깨가 넓고 아래로 좁아지는 덩어리
    const body = c.createLinearGradient(-s * 0.7, -s, s * 0.7, s)
    body.addColorStop(0, skin.light)
    body.addColorStop(0.5, skin.body)
    body.addColorStop(1, skin.dark)
    c.fillStyle = body
    c.beginPath()
    c.moveTo(-s * 0.86, -s * 0.34)
    c.quadraticCurveTo(-s * 0.7, -s * 1.02, 0, -s * 1.02)
    c.quadraticCurveTo(s * 0.7, -s * 1.02, s * 0.86, -s * 0.34)
    c.quadraticCurveTo(s * 0.94, s * 0.72, 0, s * 0.9)
    c.quadraticCurveTo(-s * 0.94, s * 0.72, -s * 0.86, -s * 0.34)
    c.closePath()
    c.fill()

    if (boss) {
      // 뿔
      c.fillStyle = '#EDE0F5'
      for (const dir of [-1, 1]) {
        c.beginPath()
        c.moveTo(dir * s * 0.56, -s * 0.82)
        c.quadraticCurveTo(dir * s * 1.06, -s * 1.34, dir * s * 0.88, -s * 1.6)
        c.quadraticCurveTo(dir * s * 0.74, -s * 1.18, dir * s * 0.34, -s * 0.9)
        c.closePath()
        c.fill()
      }
      // 어깨 갑주
      c.fillStyle = skin.dark
      for (const dir of [-1, 1]) {
        c.beginPath()
        c.ellipse(dir * s * 0.72, -s * 0.28, s * 0.3, s * 0.2, dir * 0.4, 0, Math.PI * 2)
        c.fill()
      }
    }

    // 눈 — 보스는 붉게 노려본다
    c.fillStyle = '#FFF8E1'
    c.beginPath()
    c.ellipse(-s * 0.3, -s * 0.4, s * 0.19, s * 0.15, 0, 0, Math.PI * 2)
    c.ellipse(s * 0.3, -s * 0.4, s * 0.19, s * 0.15, 0, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = boss ? '#D32F2F' : '#1A1423'
    c.beginPath()
    c.arc(-s * 0.28, -s * 0.38, s * 0.085, 0, Math.PI * 2)
    c.arc(s * 0.32, -s * 0.38, s * 0.085, 0, Math.PI * 2)
    c.fill()
    // 찡그린 눈썹 — 이쪽을 노리고 있다는 표정
    c.strokeStyle = skin.dark
    c.lineWidth = s * 0.07
    c.beginPath()
    c.moveTo(-s * 0.52, -s * 0.62)
    c.lineTo(-s * 0.12, -s * 0.5)
    c.moveTo(s * 0.52, -s * 0.62)
    c.lineTo(s * 0.12, -s * 0.5)
    c.stroke()
    // 입
    c.strokeStyle = '#1A1423'
    c.lineWidth = s * 0.06
    c.beginPath()
    c.arc(0, s * 0.32, s * 0.24, 1.15 * Math.PI, 1.85 * Math.PI)
    c.stroke()
    c.restore()
  }

  const drawBackdrop = (c: CanvasRenderingContext2D) => {
    const wall = c.createLinearGradient(0, 0, 0, 1280)
    wall.addColorStop(0, '#1A1423')
    wall.addColorStop(0.45, '#2E2440')
    wall.addColorStop(1, '#171120')
    c.fillStyle = wall
    c.fillRect(0, 0, 720, 1280)

    // 적 뒤에서 번지는 빛 — 보스는 붉다
    const halo = c.createRadialGradient(ENEMY_X, ENEMY_Y, 20, ENEMY_X, ENEMY_Y, 330)
    const boss = state.enemy.boss
    halo.addColorStop(0, boss ? 'rgb(180 40 70 / 0.34)' : 'rgb(120 100 190 / 0.24)')
    halo.addColorStop(1, 'rgb(0 0 0 / 0)')
    c.fillStyle = halo
    c.fillRect(0, 120, 720, 560)

    // 석벽 이음새
    c.strokeStyle = 'rgb(255 255 255 / 0.035)'
    c.lineWidth = 2
    for (let y = 200; y < 620; y += 84) {
      c.beginPath()
      c.moveTo(0, y)
      c.lineTo(720, y)
      c.stroke()
    }
    // 바닥 — 적이 서 있는 무대
    c.fillStyle = 'rgb(0 0 0 / 0.22)'
    c.beginPath()
    c.ellipse(ENEMY_X, ENEMY_Y + 120, 250, 46, 0, 0, Math.PI * 2)
    c.fill()
    // 손패가 놓이는 판
    c.fillStyle = 'rgb(0 0 0 / 0.3)'
    c.fillRect(0, 1020, 720, 260)
  }

  const draw = () => {
    const c = stage.begin('#120D1B', '#1A1423')
    drawBackdrop(c)

    c.save()
    if (shake > 0) c.translate((Math.random() - 0.5) * 18 * shake, (Math.random() - 0.5) * 12 * shake)

    // 적 — 맞으면 흔들리고 하얗게 뜬다. 덮칠 때는 앞으로 나온다.
    const size = state.enemy.boss ? 96 : 72
    const wobble = enemyHit > 0 ? Math.sin(state.playTime * 70) * 9 * enemyHit : 0
    // enemyTimer 0.9 → 0: 앞의 절반은 뒤로 물러나 힘을 모으고, 뒤의 절반은 덮친다
    const wind = state.phase === 'enemy' ? Math.max(0, (state.enemyTimer - 0.45) / 0.45) : 0
    c.save()
    c.translate(ENEMY_X + wobble, ENEMY_Y + wind * 22 - lunge * 46)
    drawEnemy(c, size, state.enemy.boss)
    if (enemyHit > 0) {
      c.save()
      c.globalAlpha = enemyHit * 0.65
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.ellipse(0, 0, size * 0.95, size * 1.02, 0, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
    // 칼자국
    if (slash > 0) {
      c.save()
      c.globalAlpha = slash
      c.strokeStyle = '#FFF3E0'
      c.lineCap = 'round'
      for (let i = 0; i < 3; i++) {
        c.lineWidth = 7 - i * 2
        const off = (i - 1) * size * 0.34
        c.beginPath()
        c.moveTo(-size * 0.9 + off, -size * 0.8 + (1 - slash) * 22)
        c.lineTo(size * 0.8 + off, size * 0.75 + (1 - slash) * 22)
        c.stroke()
      }
      c.restore()
    }
    c.restore()

    // 적 의도 — 적 머리 위에. 다음 턴에 몇이 들어오는지가 가장 중요한 숫자다.
    if (state.phase === 'player' || state.phase === 'enemy') {
      const intent = intentDamage(state)
      const heavy = intent > 6 + state.stage * 2
      const iy = ENEMY_Y - size - 52
      c.save()
      c.fillStyle = 'rgb(0 0 0 / 0.42)'
      c.beginPath()
      c.roundRect(ENEMY_X - 62, iy - 26, 124, 52, 26)
      c.fill()
      c.font = font(30, true)
      c.fillStyle = heavy ? '#FF8A80' : '#FFCC80'
      // 강공은 조금 크게 뛴다 — 이번 턴이 아픈 턴인지 한눈에
      const beat = heavy ? 1 + Math.sin(state.playTime * 5) * 0.06 : 1
      c.translate(ENEMY_X, iy)
      c.scale(beat, beat)
      drawIconValue(c, 'sword', String(intent), 0, 0, 16)
      c.restore()
    }

    // 적 체력 바
    c.fillStyle = 'rgb(0 0 0 / 0.45)'
    c.beginPath()
    c.roundRect(210, HP_BAR_Y, 300, 24, 12)
    c.fill()
    const hpRatio = Math.max(0, state.enemy.hp) / state.enemy.maxHp
    const hpGrad = c.createLinearGradient(210, HP_BAR_Y, 210, HP_BAR_Y + 24)
    hpGrad.addColorStop(0, '#FF8A80')
    hpGrad.addColorStop(1, '#C62828')
    c.fillStyle = hpGrad
    c.beginPath()
    c.roundRect(210, HP_BAR_Y, Math.max(12, 300 * hpRatio), 24, 12)
    c.fill()
    c.fillStyle = '#FFFFFF'
    c.font = font(19, true)
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(`${Math.max(0, state.enemy.hp)}/${state.enemy.maxHp}`, 360, HP_BAR_Y + 13)
    c.textBaseline = 'alphabetic'
    c.restore()

    // 플레이어 상태 — 맞은 순간 붉어진다
    c.fillStyle = hitFlash > 0 ? `rgb(183 28 28 / ${0.3 + hitFlash * 0.6})` : 'rgb(255 255 255 / 0.08)'
    c.beginPath()
    c.roundRect(40, 860, 640, 70, 18)
    c.fill()
    c.font = font(30, true)
    c.textBaseline = 'middle'
    c.textAlign = 'left'
    c.fillStyle = '#EF9A9A'
    drawIconValue(c, 'heart', `${state.hp}/${state.maxHp}`, 70, 896, 16, 'left')
    // 방어는 0이면 흐리게 — 지금 막을 게 있는지 없는지가 보인다
    c.fillStyle = state.block > 0 ? '#90CAF9' : 'rgb(144 202 249 / 0.4)'
    drawIconValue(c, 'shield', String(state.block), 320, 896, 16, 'left', {
      dim: state.block === 0,
    })
    c.fillStyle = '#FFD54F'
    drawIconValue(c, 'bolt', `${state.energy}/3`, 500, 896, 16, 'left')
    c.textAlign = 'center'
    c.textBaseline = 'alphabetic'
    // 막아낸 순간 방패가 부딪혀 튄다
    if (blockBreak > 0) {
      c.save()
      c.globalAlpha = blockBreak
      c.strokeStyle = '#90CAF9'
      c.lineWidth = 4
      c.beginPath()
      c.arc(336, 896, 22 + (1 - blockBreak) * 30, 0, Math.PI * 2)
      c.stroke()
      c.restore()
    }

    // 턴 종료 버튼
    if (state.phase === 'player') {
      const grad = c.createLinearGradient(END_BTN.x, END_BTN.y, END_BTN.x, END_BTN.y + END_BTN.h)
      grad.addColorStop(0, '#5CB860')
      grad.addColorStop(1, '#2E7D32')
      c.fillStyle = grad
      c.beginPath()
      c.roundRect(END_BTN.x, END_BTN.y, END_BTN.w, END_BTN.h, 20)
      c.fill()
      c.fillStyle = 'rgb(255 255 255 / 0.28)'
      c.beginPath()
      c.roundRect(END_BTN.x + 10, END_BTN.y + 8, END_BTN.w - 20, 12, 6)
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

    // 남은 덱·버린 더미 — 언제 다시 섞이는지 알 수 있다
    c.font = font(20, true)
    c.textAlign = 'left'
    c.textBaseline = 'middle'
    c.fillStyle = 'rgb(255 255 255 / 0.55)'
    drawIconValue(c, 'card', String(state.draw.length), 30, 1006, 12, 'left')
    c.textAlign = 'right'
    drawIconValue(c, 'dice', String(state.discard.length), 690, 1006, 12, 'right')
    c.textAlign = 'center'
    c.textBaseline = 'alphabetic'

    // 숫자 팝업
    c.font = font(32, true)
    for (const p of popups) {
      const k = p.age / POPUP_LIFE
      c.save()
      c.globalAlpha = 1 - k * k
      c.lineJoin = 'round'
      c.lineWidth = 7
      c.strokeStyle = 'rgb(18 13 27 / 0.85)'
      c.strokeText(p.text, p.x, p.y - k * 44)
      c.fillStyle = p.color
      c.fillText(p.text, p.x, p.y - k * 44)
      c.restore()
    }

    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: true,
    })
    c.font = font(20)
    c.fillStyle = 'rgb(255 255 255 / 0.6)'
    c.fillText(t('dk.stage', { n: state.stage }), SCORE_PANEL.cx, SCORE_PANEL.subY)

    // 글자 없는 조작 안내 — 첫 카드를 낼 때까지 손패 위에서 손끝이 오르내린다
    if (state.phase === 'player' && !hasPlayed && state.hand.length > 0) {
      const k = (state.playTime % 1.4) / 1.4
      const lift = Math.sin(k * Math.PI) * 26
      const fx = x0 + gap * Math.floor(state.hand.length / 2) + CARD_W / 2
      c.save()
      c.globalAlpha = 0.75
      c.fillStyle = '#FFECB3'
      c.beginPath()
      c.arc(fx, HAND_Y - 26 - lift, 15, 0, Math.PI * 2)
      c.fill()
      c.globalAlpha = 0.3
      c.beginPath()
      c.arc(fx, HAND_Y - 26 - lift, 26 + lift * 0.4, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }

    // 보상 선택
    if (state.phase === 'reward') {
      c.fillStyle = 'rgb(0 0 0 / 0.66)'
      c.fillRect(0, 0, 720, 1280)
      c.fillStyle = '#FFFFFF'
      c.font = font(38, true)
      c.textAlign = 'center'
      c.fillText(t('dk.pick'), 360, 420)
      for (let i = 0; i < 3; i++) {
        drawCard(c, state.rewards[i], 60 + i * 212, REWARD_Y, 188, 250, true)
      }
      c.fillStyle = 'rgb(255 255 255 / 0.22)'
      c.beginPath()
      c.roundRect(260, REWARD_Y + 290, 200, 70, 18)
      c.fill()
      c.strokeStyle = 'rgb(255 255 255 / 0.3)'
      c.lineWidth = 2
      c.stroke()
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
