import { t, type TranslationKey } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, playSfx, preloadSfx, vibrate } from '@/shared/sound'
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
import { drawUnitArt, isRanged } from './unitArt'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'
import { drawIcon, drawIconRow, drawIconValue } from '../icons'

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
const MINE_X = 200
const FOE_X = 520

const slotPos = (i: number) => ({
  x: BOARD_X + (i % 3) * (SLOT + SLOT_GAP),
  y: BOARD_Y + Math.floor(i / 3) * (SLOT + SLOT_GAP),
})

// 전투 대열에서 i번째 말의 발밑 y. 죽은 자리도 비워 둬서 줄이 흔들리지 않는다.
const lineY = (i: number, count: number) => 380 + (i * 420) / Math.max(1, count - 1)

interface Shot {
  x: number
  y: number
  tx: number
  ty: number
  age: number
  life: number
  species: number
}
interface Popup {
  x: number
  y: number
  text: string
  color: string
  age: number
}
interface Puff {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  r: number
  color: string
}
const POPUP_LIFE = 0.7

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    if (state.phase === 'battle') {
      const events = battleTick(state, dt)
      for (const hit of events.hits) {
        const defKey = `${hit.mine ? 'm' : 'f'}${hit.index}`
        const atkKey = `${hit.mine ? 'f' : 'm'}${hit.from}`
        hitFlash.set(defKey, 0.25)
        // 때린 쪽은 상대를 향해 한 발 내디딘다
        lunge.set(atkKey, 1)
        const attackers = hit.mine ? state.foes : state.mine
        const defenders = hit.mine ? state.mine : state.foes
        const ax = hit.mine ? FOE_X : MINE_X
        const dx = hit.mine ? MINE_X : FOE_X
        const ay = lineY(hit.from, attackers.length) - 46
        const dy = lineY(hit.index, defenders.length) - 46
        const species = attackers[hit.from]?.species ?? 0
        if (isRanged(species)) {
          shots.push({ x: ax, y: ay, tx: dx, ty: dy, age: 0, life: 0.22, species })
          playSfx('shoot', { gain: 0.6 })
        } else {
          playSfx('sword', { gain: 0.6 })
        }
        popups.push({ x: dx, y: dy - 30, text: `-${hit.damage}`, color: '#FF8A80', age: 0 })
        if (hit.died) {
          playSfx('explode')
          burstDeath(dx, dy, defenders[hit.index]?.species ?? 0)
          vibrate(20)
        }
      }
      if (events.ended) {
        if (state.won) playSfx('clear')
        else {
          playGameOver()
          vibrate(80)
        }
        bannerPop = 1
      }
    }
    stepEffects(dt)
    if (state.phase === 'result') {
      state.resultTimer -= dt
      if (state.resultTimer <= 0 && nextRound(state)) void gameOver()
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('sword', 'shoot', 'explode', 'select', 'clear', 'merge', 'gameover')
  const hitFlash = new Map<string, number>()
  const lunge = new Map<string, number>()
  const shots: Shot[] = []
  const popups: Popup[] = []
  const puffs: Puff[] = []
  let bannerPop = 0
  let mergeFx: { slot: number; age: number } | null = null
  let drag: { from: number; x: number; y: number } | null = null
  let adContinueUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'ac.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adContinueUsed = false
      Object.assign(state, createState())
      hitFlash.clear()
      lunge.clear()
      shots.length = 0
      popups.length = 0
      puffs.length = 0
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

  const burstDeath = (x: number, y: number, species: number) => {
    const color = ['#E05A50', '#5BA95F', '#4E8FD6', '#9B62C9'][species]
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6
      const v = 110 + Math.random() * 190
      puffs.push({
        x,
        y: y - 40,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        age: 0,
        life: 0.55,
        r: 4 + Math.random() * 6,
        color: i % 3 === 0 ? '#FFFFFF' : color,
      })
    }
  }

  const decay = (map: Map<string, number>, rate: number, dt: number) => {
    for (const [key, value] of map) {
      const next = value - dt * rate
      if (next <= 0) map.delete(key)
      else map.set(key, next)
    }
  }

  const stepEffects = (dt: number) => {
    decay(hitFlash, 1, dt)
    decay(lunge, 4, dt)
    bannerPop = Math.max(0, bannerPop - dt * 3)
    if (mergeFx) {
      mergeFx.age += dt
      if (mergeFx.age > 0.5) mergeFx = null
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      shots[i].age += dt
      if (shots[i].age >= shots[i].life) shots.splice(i, 1)
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].age += dt
      if (popups[i].age >= POPUP_LIFE) popups.splice(i, 1)
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]
      p.age += dt
      if (p.age >= p.life) {
        puffs.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 900 * dt
    }
  }

  const slotAt = (x: number, y: number): number | null => {
    for (let i = 0; i < BOARD_SLOTS; i++) {
      const p = slotPos(i)
      if (x >= p.x && x <= p.x + SLOT && y >= p.y && y <= p.y + SLOT) return i
    }
    return null
  }

  // 지금 합칠 수 있는 짝 — 같은 종족·레벨이 둘 이상이면 그 칸들이 금빛으로 맥동한다.
  // 합성은 이 게임의 중심인데 글자 없이 알릴 방법이 없었다.
  const mergeableSlots = (): Set<number> => {
    const found = new Set<number>()
    for (let i = 0; i < BOARD_SLOTS; i++) {
      const a = state.board[i]
      if (!a || a.level >= 3) continue
      for (let j = i + 1; j < BOARD_SLOTS; j++) {
        const b = state.board[j]
        if (!b || b.species !== a.species || b.level !== a.level) continue
        found.add(i)
        found.add(j)
      }
    }
    return found
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      if (state.phase !== 'prep') return
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
      if (p.y >= SHOP_Y && p.y <= SHOP_Y + SHOP_H) {
        const i = Math.floor((p.x - 40) / (SHOP_W + 20))
        if (i >= 0 && i < 3 && p.x >= 40 + i * (SHOP_W + 20) && p.x <= 40 + i * (SHOP_W + 20) + SHOP_W) {
          if (buy(state, i)) {
            playSfx('select')
            vibrate(10)
          }
        }
        return
      }
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
          mergeFx = { slot: to, age: 0 }
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
    footY: number,
    size: number,
    flash: number,
    showHp: boolean,
    facing = 1,
  ) => {
    c.save()
    if (flash > 0) c.translate(Math.sin(state.playTime * 70) * 5 * flash, 0)
    drawUnitArt(c, unit.species, unit.level, x, footY, size, facing)
    if (flash > 0) {
      // 맞은 순간 하얗게 뜬다
      c.save()
      c.globalAlpha = flash * 0.6
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.ellipse(x, footY - size * 0.85, size * 0.72, size * 1.05, 0, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
    drawIconRow(c, 'star', x, footY - size * 2.2, size * 0.15, unit.level)
    if (showHp) {
      const w = size * 1.3
      c.fillStyle = 'rgb(0 0 0 / 0.5)'
      c.beginPath()
      c.roundRect(x - w / 2, footY + 10, w, 9, 4.5)
      c.fill()
      const ratio = Math.max(0, unit.hp) / unit.maxHp
      c.fillStyle = ratio > 0.5 ? '#66BB6A' : ratio > 0.25 ? '#FFC94D' : '#EF5350'
      c.beginPath()
      c.roundRect(x - w / 2, footY + 10, Math.max(4, w * ratio), 9, 4.5)
      c.fill()
    }
    c.restore()
  }

  const drawBackdrop = (c: CanvasRenderingContext2D) => {
    const sky = c.createLinearGradient(0, 0, 0, 1280)
    sky.addColorStop(0, '#2B3A44')
    sky.addColorStop(0.5, '#3B4E5A')
    sky.addColorStop(1, '#222E36')
    c.fillStyle = sky
    c.fillRect(0, 0, 720, 1280)
    // 전장 바닥 — 격자를 옅게 깔아 말이 어딘가에 서 있는 것으로 보이게
    c.strokeStyle = 'rgb(255 255 255 / 0.05)'
    c.lineWidth = 2
    for (let y = 300; y < 860; y += 70) {
      const spread = (y - 300) / 560
      c.beginPath()
      c.moveTo(80 - spread * 70, y)
      c.lineTo(640 + spread * 70, y)
      c.stroke()
    }
  }

  const draw = () => {
    const c = stage.begin('#1B242B', '#2B3A44')
    drawBackdrop(c)

    drawScorePanel(c, { label: t('hud.score'), value: state.score.toLocaleString(), sub: true })
    c.font = font(20)
    c.textAlign = 'center'
    c.fillStyle = 'rgb(255 255 255 / 0.6)'
    c.fillText(t('ac.round', { n: state.round }), SCORE_PANEL.cx, SCORE_PANEL.subY)
    c.font = font(28, true)
    c.fillStyle = '#EF9A9A'
    drawIconValue(c, 'heart', String(state.hp), 240, 200, 15, 'right')
    c.fillStyle = '#FFD54F'
    drawIconValue(c, 'coin', String(state.gold), 500, 200, 15, 'left')

    if (state.phase === 'prep') {
      const mergeable = mergeableSlots()
      const glow = 0.5 + Math.sin(state.playTime * 4) * 0.5
      for (let i = 0; i < BOARD_SLOTS; i++) {
        const p = slotPos(i)
        c.fillStyle = 'rgb(255 255 255 / 0.07)'
        c.beginPath()
        c.roundRect(p.x, p.y, SLOT, SLOT, 16)
        c.fill()
        c.strokeStyle = 'rgb(255 255 255 / 0.1)'
        c.lineWidth = 2
        c.stroke()
        if (mergeable.has(i) && drag?.from !== i) {
          c.strokeStyle = `rgb(255 213 79 / ${0.35 + glow * 0.55})`
          c.lineWidth = 4
          c.beginPath()
          c.roundRect(p.x + 2, p.y + 2, SLOT - 4, SLOT - 4, 15)
          c.stroke()
        }
        const unit = state.board[i]
        if (!unit || drag?.from === i) continue
        drawUnit(c, unit, p.x + SLOT / 2, p.y + SLOT * 0.78, 30, 0, false)
        // 이 말이 얼마나 센지 — 준비 화면에서 볼 곳이 없었다
        c.font = font(15, true)
        c.fillStyle = 'rgb(255 255 255 / 0.85)'
        drawIconValue(c, 'sword', String(unit.atk), p.x + SLOT * 0.27, p.y + SLOT - 14, 8)
        drawIconValue(c, 'heart', String(unit.maxHp), p.x + SLOT * 0.73, p.y + SLOT - 14, 8)
        if (mergeFx && mergeFx.slot === i) {
          const k = mergeFx.age / 0.5
          c.save()
          c.globalAlpha = 1 - k
          c.strokeStyle = '#FFD54F'
          c.lineWidth = 6 * (1 - k)
          c.beginPath()
          c.arc(p.x + SLOT / 2, p.y + SLOT / 2, 30 + k * 60, 0, Math.PI * 2)
          c.stroke()
          c.restore()
        }
      }

      if (drag) {
        const unit = state.board[drag.from]
        if (unit) {
          c.save()
          c.globalAlpha = 0.9
          drawUnit(c, unit, drag.x, drag.y + 24, 32, 0, false)
          c.restore()
        }
      }

      const canFight = state.board.some((u) => u !== null)
      const btn = c.createLinearGradient(0, FIGHT_BTN.y, 0, FIGHT_BTN.y + FIGHT_BTN.h)
      btn.addColorStop(0, canFight ? '#FF7043' : '#8CA0AC')
      btn.addColorStop(1, canFight ? '#D84315' : '#607D8B')
      c.fillStyle = btn
      c.beginPath()
      c.roundRect(FIGHT_BTN.x, FIGHT_BTN.y, FIGHT_BTN.w, FIGHT_BTN.h, 24)
      c.fill()
      c.fillStyle = 'rgb(255 255 255 / 0.3)'
      c.beginPath()
      c.roundRect(FIGHT_BTN.x + 14, FIGHT_BTN.y + 10, FIGHT_BTN.w - 28, 14, 7)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = font(34, true)
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(t('ac.fight'), 360, FIGHT_BTN.y + FIGHT_BTN.h / 2 + 1)
      c.textBaseline = 'alphabetic'

      c.fillStyle = 'rgb(255 255 255 / 0.5)'
      c.font = font(22)
      c.fillText(t('ac.shop'), 360, SHOP_Y - 20)
      for (let i = 0; i < 3; i++) {
        const x = 40 + i * (SHOP_W + 20)
        const species = state.shop[i]
        const affordable = species >= 0 && state.gold >= UNIT_COST
        c.save()
        if (!affordable) c.globalAlpha = 0.4
        const card = c.createLinearGradient(0, SHOP_Y, 0, SHOP_Y + SHOP_H)
        card.addColorStop(0, '#54707E')
        card.addColorStop(1, '#3B505C')
        c.fillStyle = card
        c.beginPath()
        c.roundRect(x, SHOP_Y, SHOP_W, SHOP_H, 18)
        c.fill()
        c.strokeStyle = 'rgb(255 255 255 / 0.14)'
        c.lineWidth = 2
        c.stroke()
        if (species >= 0) {
          drawUnitArt(c, species, 1, x + SHOP_W / 2, SHOP_Y + 128, 40)
          c.fillStyle = '#FFFFFF'
          c.font = font(23, true)
          c.textAlign = 'center'
          c.fillText(t(NAME_KEYS[species]), x + SHOP_W / 2, SHOP_Y + 160)
          c.fillStyle = state.gold >= UNIT_COST ? '#FFD54F' : '#FF8A80'
          c.font = font(22, true)
          drawIconValue(c, 'coin', String(UNIT_COST), x + SHOP_W / 2, SHOP_Y + 186, 12)
        }
        c.restore()
      }

      // 글자 없는 조작 안내 — 첫 판에서 말이 하나도 없으면 상점을 가리킨다
      if (state.round === 1 && state.board.every((u) => u === null)) {
        const k = (state.playTime % 1.4) / 1.4
        const lift = Math.sin(k * Math.PI) * 22
        c.save()
        c.globalAlpha = 0.75
        c.fillStyle = '#FFECB3'
        c.beginPath()
        c.arc(140, SHOP_Y - 46 - lift, 15, 0, Math.PI * 2)
        c.fill()
        c.globalAlpha = 0.3
        c.beginPath()
        c.arc(140, SHOP_Y - 46 - lift, 26 + lift * 0.5, 0, Math.PI * 2)
        c.fill()
        c.restore()
      }
    } else {
      // 전투 — 양 진영이 마주 본다
      const lineup = (units: Unit[], x: number, mine: boolean) => {
        units.forEach((unit, i) => {
          if (unit.hp <= 0) return
          const key = `${mine ? 'm' : 'f'}${i}`
          const step = (lunge.get(key) ?? 0) * 26 * (mine ? 1 : -1)
          drawUnit(
            c,
            unit,
            x + step,
            lineY(i, units.length),
            34,
            hitFlash.get(key) ?? 0,
            true,
            mine ? 1 : -1,
          )
        })
      }
      lineup(state.mine, MINE_X, true)
      lineup(state.foes, FOE_X, false)

      // 날아가는 탄 (궁수는 화살, 마법사는 빛구슬)
      for (const s of shots) {
        const k = s.age / s.life
        const x = s.x + (s.tx - s.x) * k
        const y = s.y + (s.ty - s.y) * k - Math.sin(k * Math.PI) * 26
        c.save()
        c.translate(x, y)
        c.rotate(Math.atan2(s.ty - s.y, s.tx - s.x))
        if (s.species === 1) {
          c.strokeStyle = '#D7CCC8'
          c.lineWidth = 3
          c.lineCap = 'round'
          c.beginPath()
          c.moveTo(-16, 0)
          c.lineTo(12, 0)
          c.stroke()
          c.fillStyle = '#ECEFF1'
          c.beginPath()
          c.moveTo(18, 0)
          c.lineTo(8, -5)
          c.lineTo(8, 5)
          c.closePath()
          c.fill()
        } else {
          c.shadowColor = '#CE93D8'
          c.shadowBlur = 14
          c.fillStyle = '#E1BEE7'
          c.beginPath()
          c.arc(0, 0, 9, 0, Math.PI * 2)
          c.fill()
        }
        c.restore()
      }

      for (const p of puffs) {
        const k = p.age / p.life
        c.globalAlpha = 1 - k * k
        c.fillStyle = p.color
        c.beginPath()
        c.arc(p.x, p.y, p.r * (1 - k * 0.5), 0, Math.PI * 2)
        c.fill()
      }
      c.globalAlpha = 1

      c.textAlign = 'center'
      c.font = font(26, true)
      for (const p of popups) {
        const k = p.age / POPUP_LIFE
        c.save()
        c.globalAlpha = 1 - k * k
        c.lineJoin = 'round'
        c.lineWidth = 6
        c.strokeStyle = 'rgb(20 28 34 / 0.85)'
        c.strokeText(p.text, p.x, p.y - k * 34)
        c.fillStyle = p.color
        c.fillText(p.text, p.x, p.y - k * 34)
        c.restore()
      }

      if (state.phase === 'result') {
        c.save()
        const pop = 1 + bannerPop * 0.15
        c.fillStyle = 'rgb(0 0 0 / 0.6)'
        c.fillRect(0, 560, 720, 150)
        c.translate(360, 635)
        c.scale(pop, pop)
        c.font = font(52, true)
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        if (state.won) {
          c.fillStyle = '#FFD54F'
          // 실제로 받은 점수와 같은 식이어야 한다 (state의 round * 30)
          c.fillText(t('ac.win', { n: state.round * 30 }), 0, 0)
        } else {
          // 잃은 체력은 하트를 벡터로 그린다 — 문구에 이모지를 넣으면 기기마다
          // 그림이 다르고 글자와 높이가 어긋난다
          const text = t('ac.lose', { n: state.lostLives })
          c.fillStyle = '#EF9A9A'
          c.fillText(text, 18, 0)
          drawIcon(c, 'heart', 18 - c.measureText(text).width / 2 - 26, 0, 18)
        }
        c.restore()
        c.textBaseline = 'alphabetic'
      }
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
