import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createClearBonus } from '../clearBonus'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  createState,
  dropTower,
  pointAt,
  summon,
  towerRange,
  update,
  SLOTS,
  WAYPOINTS,
  type Enemy,
} from './state'
import { drawScorePanel, font } from '../ui'
import { drawIconValue } from '../icons'

const TIER_COLORS = ['', '#8D6E63', '#43A047', '#1E88E5', '#8E24AA', '#F4511E', '#FDD835', '#E53935']
const ENEMY_COLORS = { normal: '#EF5350', fast: '#FFB300', tank: '#795548', boss: '#7B1FA2' } as const
const SUMMON_BTN = { x: 40, y: 1096, w: 360, h: 140 } as const

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    leakFlash = Math.max(0, leakFlash - dt)
    btnShake = Math.max(0, btnShake - dt)
    const events = update(state, dt)
    if (events.leaked) {
      vibrate(60)
      leakFlash = 0.4
    }
    if (events.waveCleared) {
      playSfx('clear')
      // 웨이브마다 물으면 성가시므로 보스 웨이브(5의 배수)를 넘겼을 때만
      const cleared = state.wave - 1
      if (cleared % 5 === 0) void offerWaveBonus(cleared)
    }
    if (events.died) void gameOver()
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  let state = createState()
  preloadSfx('clear', 'gameover', 'merge', 'select', 'tap')
  let drag: { from: number; x: number; y: number } | null = null
  let leakFlash = 0
  let btnShake = 0
  let adContinueUsed = false
  const bonus = createClearBonus(shell, ctx, 'defense-wave')

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'df.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adContinueUsed = false
      state = createState()
      drag = null
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  // 광고 보상: 생명 5를 받고 현재 웨이브를 다시 막는다 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('defense-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.lives = 5
    state.enemies = []
    state.bullets = []
    state.spawnLeft = 0
    state.waveBreak = 2
    state.phase = 'playing'
    overlay.hide()
  }

  // 웨이브 클리어 점수(wave * 50)를 한 번 더 준다
  async function offerWaveBonus(wave: number) {
    const points = wave * 50
    if (!(await bonus.offer(points)) || shell.isDestroyed()) return
    state.score = Math.min(1_000_000, state.score + points)
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  const slotAt = (x: number, y: number): number | null => {
    for (let i = 0; i < SLOTS.length; i++) {
      const [sx, sy] = SLOTS[i]
      if (Math.abs(x - sx) <= 55 && Math.abs(y - sy) <= 55) return i
    }
    return null
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      // 소환 버튼
      if (
        p.x >= SUMMON_BTN.x &&
        p.x <= SUMMON_BTN.x + SUMMON_BTN.w &&
        p.y >= SUMMON_BTN.y &&
        p.y <= SUMMON_BTN.y + SUMMON_BTN.h
      ) {
        if (summon(state) !== null) {
          playSfx('select')
          vibrate(15)
        } else {
          btnShake = 0.3
        }
        return
      }
      const i = slotAt(p.x, p.y)
      if (i !== null && state.slots[i]) drag = { from: i, x: p.x, y: p.y }
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
      if (to !== null && state.phase === 'playing') {
        const result = dropTower(state, drag.from, to)
        if (result === 'merged') {
          playMerge(state.slots[to]?.tier ?? 2)
          vibrate(25)
        } else if (result !== 'none') {
          playDrop()
        }
      }
      drag = null
    },
  })

  // 사거리 안에서 가장 앞선 적 — 포신이 그쪽을 향한다.
  // 어느 타워가 무엇을 맡고 있는지 눈으로 보이게 하려는 것이다.
  const aimAngle = (x: number, y: number, tier: number): number | null => {
    const range = towerRange(tier)
    let best: number | null = null
    let bestDist = -1
    for (const enemy of state.enemies) {
      const p = pointAt(enemy.dist)
      if (Math.hypot(p.x - x, p.y - y) > range) continue
      if (enemy.dist > bestDist) {
        bestDist = enemy.dist
        best = Math.atan2(p.y - y, p.x - x)
      }
    }
    return best
  }

  // 등급이 색과 숫자로만 갈리던 것을 포탑 모양으로 바꾼다 — 포신 길이·받침 크기가
  // 등급을 따라가고, 등급 표시는 받침에 박힌 원판으로 읽는다.
  const drawTower = (c: CanvasRenderingContext2D, x: number, y: number, tier: number) => {
    const color = TIER_COLORS[tier]
    const angle = aimAngle(x, y, tier) ?? -Math.PI / 2

    // 받침대
    c.fillStyle = 'rgb(62 39 35 / 0.25)'
    c.beginPath()
    c.ellipse(x, y + 26, 34, 11, 0, 0, Math.PI * 2)
    c.fill()
    const base = c.createLinearGradient(x, y - 30, x, y + 26)
    base.addColorStop(0, '#8D6E63')
    base.addColorStop(1, '#5D4037')
    c.fillStyle = base
    c.beginPath()
    c.roundRect(x - 32, y - 18, 64, 44, 12)
    c.fill()
    c.fillStyle = 'rgb(255 255 255 / 0.16)'
    c.beginPath()
    c.roundRect(x - 32, y - 18, 64, 12, [12, 12, 0, 0])
    c.fill()

    // 포신 — 등급이 오를수록 길고 굵어진다
    c.save()
    c.translate(x, y - 6)
    c.rotate(angle)
    c.fillStyle = '#455A64'
    c.beginPath()
    c.roundRect(4, -(4 + tier * 0.7), 24 + tier * 4, 8 + tier * 1.4, 4)
    c.fill()
    c.fillStyle = 'rgb(255 255 255 / 0.2)'
    c.beginPath()
    c.roundRect(4, -(4 + tier * 0.7), 24 + tier * 4, 3, 2)
    c.fill()
    c.restore()

    // 포탑 머리
    const dome = c.createRadialGradient(x - 7, y - 14, 3, x, y - 6, 22)
    dome.addColorStop(0, 'rgb(255 255 255 / 0.65)')
    dome.addColorStop(0.45, color)
    dome.addColorStop(1, 'rgb(0 0 0 / 0.25)')
    c.fillStyle = color
    c.beginPath()
    c.arc(x, y - 6, 20, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = dome
    c.beginPath()
    c.arc(x, y - 6, 20, 0, Math.PI * 2)
    c.fill()

    // 등급 원판
    c.fillStyle = '#FFF8E1'
    c.beginPath()
    c.arc(x, y + 14, 13, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = color
    c.font = font(18, true)
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(String(tier), x, y + 15)
    c.textBaseline = 'alphabetic'
  }

  const drawEnemy = (c: CanvasRenderingContext2D, enemy: Enemy) => {
    const p = pointAt(enemy.dist)
    const r = enemy.radius
    c.fillStyle = ENEMY_COLORS[enemy.kind]
    c.beginPath()
    c.arc(p.x, p.y, r, 0, Math.PI * 2)
    c.fill()
    if (enemy.kind === 'boss') {
      // 뿔 두 개
      c.fillStyle = '#4A148C'
      c.beginPath()
      c.moveTo(p.x - r * 0.7, p.y - r * 0.5)
      c.lineTo(p.x - r * 1.1, p.y - r * 1.2)
      c.lineTo(p.x - r * 0.3, p.y - r * 0.85)
      c.moveTo(p.x + r * 0.7, p.y - r * 0.5)
      c.lineTo(p.x + r * 1.1, p.y - r * 1.2)
      c.lineTo(p.x + r * 0.3, p.y - r * 0.85)
      c.fill()
    }
    // 눈
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.arc(p.x - r * 0.32, p.y - r * 0.15, r * 0.2, 0, Math.PI * 2)
    c.arc(p.x + r * 0.32, p.y - r * 0.15, r * 0.2, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#263238'
    c.beginPath()
    c.arc(p.x - r * 0.32, p.y - r * 0.15, r * 0.09, 0, Math.PI * 2)
    c.arc(p.x + r * 0.32, p.y - r * 0.15, r * 0.09, 0, Math.PI * 2)
    c.fill()
    // 체력 바
    const w = r * 2
    c.fillStyle = 'rgb(38 50 56 / 0.6)'
    c.fillRect(p.x - r, p.y - r - 14, w, 7)
    c.fillStyle = '#66BB6A'
    c.fillRect(p.x - r, p.y - r - 14, (w * enemy.hp) / enemy.maxHp, 7)
  }

  const draw = () => {
    const c = stage.begin('#33691E', '#9CCC65')

    // 경로
    c.strokeStyle = '#BCAAA4'
    c.lineWidth = 90
    c.lineJoin = 'round'
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(WAYPOINTS[0][0], WAYPOINTS[0][1])
    for (const [x, y] of WAYPOINTS.slice(1)) c.lineTo(x, y)
    c.stroke()
    c.strokeStyle = '#A1887F'
    c.lineWidth = 4
    c.setLineDash([18, 22])
    c.beginPath()
    c.moveTo(WAYPOINTS[0][0], WAYPOINTS[0][1])
    for (const [x, y] of WAYPOINTS.slice(1)) c.lineTo(x, y)
    c.stroke()
    c.setLineDash([])

    // 슬롯
    for (let i = 0; i < SLOTS.length; i++) {
      const [x, y] = SLOTS[i]
      c.fillStyle = '#7CB342'
      c.strokeStyle = '#558B2F'
      c.lineWidth = 3
      c.beginPath()
      c.roundRect(x - 48, y - 48, 96, 96, 14)
      c.fill()
      c.stroke()
    }

    // 드래그 중인 타워의 사거리 표시
    if (drag) {
      const tower = state.slots[drag.from]
      if (tower) {
        const [sx, sy] = SLOTS[drag.from]
        c.save()
        c.fillStyle = 'rgb(255 255 255 / 0.15)'
        c.strokeStyle = 'rgb(255 255 255 / 0.5)'
        c.lineWidth = 2
        c.beginPath()
        c.arc(sx, sy, towerRange(tower.tier), 0, Math.PI * 2)
        c.fill()
        c.stroke()
        c.restore()
      }
    }

    // 타워
    for (let i = 0; i < SLOTS.length; i++) {
      const tower = state.slots[i]
      if (!tower) continue
      const [x, y] = SLOTS[i]
      c.save()
      if (drag?.from === i) c.globalAlpha = 0.35
      drawTower(c, x, y, tower.tier)
      c.restore()
    }

    // 적·탄환
    for (const enemy of state.enemies) drawEnemy(c, enemy)
    for (const b of state.bullets) {
      c.fillStyle = TIER_COLORS[b.tier]
      c.beginPath()
      c.arc(b.x, b.y, 8, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.arc(b.x, b.y, 3.5, 0, Math.PI * 2)
      c.fill()
    }

    // 드래그 고스트
    if (drag) {
      const tower = state.slots[drag.from]
      if (tower) {
        c.save()
        c.globalAlpha = 0.85
        c.fillStyle = TIER_COLORS[tower.tier]
        c.beginPath()
        c.arc(drag.x, drag.y - 30, 26, 0, Math.PI * 2)
        c.fill()
        c.restore()
      }
    }

    // HUD: 점수 카드 + 웨이브 + 생명
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      panelColor: 'rgb(255 255 255 / 0.94)',
      labelColor: '#AED581',
      valueColor: '#33691E',
    })
    c.font = font(30, true)
    c.fillStyle = '#FFFFFF'
    c.textAlign = 'left'
    c.fillText(t('df.wave', { n: state.wave }), 36, 190)
    c.fillStyle = leakFlash > 0 ? '#FF5252' : '#FFFFFF'
    drawIconValue(c, 'heart', String(state.lives), 684, 180, 16, 'right')
    c.textAlign = 'center'

    // 하단 바: 소환 버튼 + 골드
    const affordable = state.gold >= state.summonCost && state.slots.some((s) => s === null)
    c.save()
    if (btnShake > 0) c.translate(Math.sin(state.playTime * 60) * 6 * (btnShake / 0.3), 0)
    c.fillStyle = affordable ? '#FF7043' : '#90A4AE'
    c.beginPath()
    c.roundRect(SUMMON_BTN.x, SUMMON_BTN.y, SUMMON_BTN.w, SUMMON_BTN.h, 28)
    c.fill()
    c.fillStyle = '#FFFFFF'
    c.font = font(38, true)
    drawIconValue(
      c,
      'dice',
      t('df.summon', { n: state.summonCost }),
      SUMMON_BTN.x + SUMMON_BTN.w / 2,
      SUMMON_BTN.y + SUMMON_BTN.h / 2 + 2,
      20,
    )
    c.restore()
    c.fillStyle = '#FFF59D'
    c.font = font(40, true)
    drawIconValue(
      c,
      'coin',
      state.gold.toLocaleString(),
      684,
      SUMMON_BTN.y + SUMMON_BTN.h / 2 + 2,
      20,
      'right',
    )
    c.textAlign = 'center'
    c.textBaseline = 'alphabetic'

    // 웨이브 사이 안내
    if (state.waveBreak > 0 && state.phase === 'playing') {
      c.save()
      c.globalAlpha = Math.min(1, state.waveBreak)
      c.font = font(72, true)
      c.lineWidth = 10
      c.strokeStyle = '#FFFFFF'
      c.fillStyle = '#33691E'
      c.strokeText(t('df.wave', { n: state.wave }), 360, 640)
      c.fillText(t('df.wave', { n: state.wave }), 360, 640)
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
