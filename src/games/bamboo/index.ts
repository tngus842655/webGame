import { t } from '@/shared/i18n'
import { playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { BAR_MAX, SEG_H, branchAt, climb, createState, reviveBelow, update } from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'

const STALK_W = 152
const STALK_X = 360 - STALK_W / 2
const PLAYER_Y = 860 // 지금 마디가 놓이는 화면 높이
const BAR_Y = 196

// 뒤로 흐르는 대나무 숲. 층마다 흐르는 속도가 달라야 오르고 있다는 게 느껴진다 —
// 예전엔 배경이 붙박이라 카메라만 움직이고 몸은 제자리인 것처럼 보였다.
const FOREST = [
  { speed: 0.14, w: 24, fill: '#17331F', ring: 'rgb(255 255 255 / 0.05)', xs: [26, 128, 236, 452, 566, 668] },
  { speed: 0.32, w: 38, fill: '#1D4126', ring: 'rgb(255 255 255 / 0.07)', xs: [70, 196, 504, 636] },
  { speed: 0.58, w: 56, fill: '#245030', ring: 'rgb(255 255 255 / 0.09)', xs: [-14, 152, 584, 692] },
]

interface Leaf {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
  age: number
  life: number
}

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    update(state, dt)
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    stepEffects(dt)
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('gameover', 'impact', 'whoosh')
  const leaves: Leaf[] = []
  // 붙어 있는 쪽을 부드럽게 옮긴다 (-1 ↔ 1). 순간이동하면 오른 게 아니라 깜빡인 것처럼 보인다.
  let sideAnim = -1
  let reach = 0 // 팔을 뻗어 한 마디 잡는 동작
  let rush = 0 // 오를 때 지나가는 속도선
  let armPhase = 0 // 좌우 팔을 번갈아 쓴다
  let adReviveUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'bm.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adReviveUsed = false
      Object.assign(state, createState())
      leaves.length = 0
      sideAnim = -1
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  async function continueWithAd() {
    if (state.phase !== 'over' || adReviveUsed) return
    const rewarded = await ctx.showRewardAd('bamboo-revive')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adReviveUsed = true
    reviveBelow(state)
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    // 가지에 부딪힌 건 화면에 그대로 보인다 — 시간 초과만 따로 적어 준다
    overlay.show(
      state.score,
      prevBest,
      ctx.isRewardAdReady() && !adReviveUsed,
      state.deathBy === 'time' ? 'over.byTime' : undefined,
    )
  }

  const shedLeaves = (x: number, y: number, count: number) => {
    for (let i = 0; i < count; i++) {
      leaves.push({
        x: x + (Math.random() - 0.5) * 60,
        y: y + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 120,
        vy: 60 + Math.random() * 140,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 5,
        age: 0,
        life: 1.5,
      })
    }
  }

  const stepEffects = (dt: number) => {
    sideAnim += (state.side - sideAnim) * Math.min(1, dt * 18)
    reach = Math.max(0, reach - dt * 4)
    rush = Math.max(0, rush - dt * 3.4)
    for (let i = leaves.length - 1; i >= 0; i--) {
      const l = leaves[i]
      l.age += dt
      if (l.age >= l.life) {
        leaves.splice(i, 1)
        continue
      }
      // 잎은 나풀거리며 떨어진다
      l.x += (l.vx + Math.sin(l.age * 5 + l.rot) * 60) * dt
      l.y += l.vy * dt
      l.vy = Math.min(220, l.vy + 120 * dt)
      l.rot += l.spin * dt
    }
  }

  const segY = (index: number) => PLAYER_Y - (index - state.scroll) * SEG_H

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      const p = stage.toBoard(clientX, clientY)
      const result = climb(state, p.x < 360 ? -1 : 1)
      if (result === 'up') {
        // 한 마디 올라갈수록 음이 조금씩 올라간다
        playSfx('whoosh', { rate: 1 + Math.min(12, state.height) * 0.02 })
        reach = 1
        rush = 1
        armPhase = 1 - armPhase
        shedLeaves(360, segY(state.height) + SEG_H, 2)
      } else if (result === 'hit') {
        // 부딪힌 소리는 둔탁해야 한다 (예전엔 합성 성공음이 울렸다)
        playSfx('impact')
        vibrate(90)
        shedLeaves(360, segY(state.height + 1), 7)
      }
    },
    onMove() {},
    onUp() {},
  })

  const drawForest = (c: CanvasRenderingContext2D, scrollPx: number) => {
    for (const layer of FOREST) {
      const off = ((scrollPx * layer.speed) % 200) - 200
      for (const x of layer.xs) {
        c.fillStyle = layer.fill
        c.fillRect(x, 0, layer.w, 1280)
        c.fillStyle = 'rgb(255 255 255 / 0.06)'
        c.fillRect(x + layer.w * 0.16, 0, layer.w * 0.2, 1280)
        c.fillStyle = layer.ring
        for (let y = off; y < 1280; y += 200) {
          c.fillRect(x - 2, y, layer.w + 4, 6)
        }
      }
    }
  }

  const drawBackdrop = (c: CanvasRenderingContext2D, scrollPx: number) => {
    const air = c.createLinearGradient(0, 0, 0, 1280)
    air.addColorStop(0, '#0B2116')
    air.addColorStop(0.45, '#16351F')
    air.addColorStop(1, '#0D2517')
    c.fillStyle = air
    c.fillRect(0, 0, 720, 1280)

    drawForest(c, scrollPx)

    // 위에서 비스듬히 떨어지는 빛
    c.save()
    for (const [x, w] of [
      [120, 90],
      [430, 130],
    ] as Array<[number, number]>) {
      const beam = c.createLinearGradient(x, 0, x + 260, 1280)
      beam.addColorStop(0, 'rgb(220 255 190 / 0.09)')
      beam.addColorStop(1, 'rgb(220 255 190 / 0)')
      c.fillStyle = beam
      c.beginPath()
      c.moveTo(x, 0)
      c.lineTo(x + w, 0)
      c.lineTo(x + w + 260, 1280)
      c.lineTo(x + 260, 1280)
      c.closePath()
      c.fill()
    }
    c.restore()

    // 바닥으로 깔리는 안개 — 아래가 아득해 보인다
    const haze = c.createLinearGradient(0, 900, 0, 1280)
    haze.addColorStop(0, 'rgb(190 220 180 / 0)')
    haze.addColorStop(1, 'rgb(190 220 180 / 0.12)')
    c.fillStyle = haze
    c.fillRect(0, 900, 720, 380)
  }

  // 대나무 줄기 — 단색 기둥이었던 것을 마디마다 볼록한 대나무로
  const drawStalk = (c: CanvasRenderingContext2D) => {
    const body = c.createLinearGradient(STALK_X, 0, STALK_X + STALK_W, 0)
    body.addColorStop(0, '#5E9430')
    body.addColorStop(0.28, '#8FC94A')
    body.addColorStop(0.62, '#7CB342')
    body.addColorStop(1, '#456B22')
    c.fillStyle = body
    c.fillRect(STALK_X, 0, STALK_W, 1280)
    // 세로 결
    c.fillStyle = 'rgb(255 255 255 / 0.12)'
    c.fillRect(STALK_X + 20, 0, 10, 1280)
    c.fillRect(STALK_X + 44, 0, 5, 1280)
    c.fillStyle = 'rgb(0 0 0 / 0.1)'
    c.fillRect(STALK_X + STALK_W - 34, 0, 18, 1280)

    const from = Math.floor(state.scroll) - 3
    const to = Math.floor(state.scroll) + 10
    for (let i = from; i <= to; i++) {
      if (i < 0) continue
      const y = segY(i) + SEG_H / 2
      // 마디 이음새 — 위아래로 그늘이 지고 가운데가 밝다
      c.fillStyle = 'rgb(0 0 0 / 0.22)'
      c.fillRect(STALK_X, y - 9, STALK_W, 8)
      c.fillStyle = '#5E8A2A'
      c.fillRect(STALK_X - 4, y - 4, STALK_W + 8, 12)
      c.fillStyle = 'rgb(255 255 255 / 0.28)'
      c.fillRect(STALK_X - 4, y - 4, STALK_W + 8, 4)
    }
  }

  const drawBranch = (y: number, side: number) => {
    const c = stage.c
    const rootX = side === -1 ? STALK_X + 8 : STALK_X + STALK_W - 8
    const tipX = rootX + side * 150
    c.save()
    // 가지 그림자
    c.strokeStyle = 'rgb(0 0 0 / 0.25)'
    c.lineWidth = 15
    c.lineCap = 'round'
    c.beginPath()
    c.moveTo(rootX, y + 4)
    c.quadraticCurveTo(rootX + side * 80, y - 22, tipX, y - 2)
    c.stroke()
    c.strokeStyle = '#3E7A1E'
    c.lineWidth = 13
    c.beginPath()
    c.moveTo(rootX, y)
    c.quadraticCurveTo(rootX + side * 80, y - 26, tipX, y - 6)
    c.stroke()
    c.strokeStyle = 'rgb(255 255 255 / 0.22)'
    c.lineWidth = 4
    c.beginPath()
    c.moveTo(rootX, y - 4)
    c.quadraticCurveTo(rootX + side * 80, y - 30, tipX, y - 10)
    c.stroke()

    // 잎 세 장 — 바람에 조금씩 흔들린다
    for (let i = 0; i < 3; i++) {
      const t2 = 0.45 + i * 0.24
      const lx = rootX + side * 150 * t2
      const ly = y - 20 * Math.sin(t2 * Math.PI) - 4
      const sway = Math.sin(state.playTime * 1.6 + i + y * 0.01) * 0.12
      c.save()
      c.translate(lx, ly)
      c.rotate(side * (-0.5 - i * 0.25) + sway)
      const leaf = c.createLinearGradient(-11, 0, 11, 0)
      leaf.addColorStop(0, '#7CB342')
      leaf.addColorStop(1, '#33691E')
      c.fillStyle = leaf
      c.beginPath()
      c.ellipse(0, -16, 11, 30, 0, 0, Math.PI * 2)
      c.fill()
      c.strokeStyle = 'rgb(255 255 255 / 0.3)'
      c.lineWidth = 1.6
      c.beginPath()
      c.moveTo(0, -44)
      c.lineTo(0, 12)
      c.stroke()
      c.restore()
    }
    c.restore()
  }

  // 판다 — 줄기를 붙잡고 오른다. 붙은 쪽이 바뀌면 부드럽게 건너간다.
  const drawClimber = (y: number) => {
    const c = stage.c
    const side = sideAnim
    const x = 360 + side * (STALK_W / 2 + 30)
    c.save()
    c.translate(x, y - reach * 14)
    c.scale(side < 0 ? 1 : -1, 1)
    // 한 마디 잡을 때 몸이 늘어난다
    c.scale(1 - reach * 0.06, 1 + reach * 0.1)

    // 다리와 팔 — 한 마디 오를 때마다 좌우가 번갈아 뻗는다
    c.strokeStyle = '#2E2E2E'
    c.lineCap = 'round'
    for (let i = 0; i < 2; i++) {
      const swing = (armPhase === i ? 1 : -1) * reach * 10
      c.lineWidth = 13
      c.beginPath()
      c.moveTo(10, 20 + i * 6)
      c.lineTo(38, 34 + i * 4 - swing)
      c.stroke()
      c.lineWidth = 15
      c.beginPath()
      c.moveTo(15, -6 + i * 22)
      c.lineTo(44, -18 + i * 42 - swing * 1.4)
      c.stroke()
    }
    // 귀
    c.fillStyle = '#2E2E2E'
    c.beginPath()
    c.arc(-16, -34, 13, 0, Math.PI * 2)
    c.arc(16, -34, 13, 0, Math.PI * 2)
    c.fill()
    // 몸
    const fur = c.createLinearGradient(-30, -30, 30, 34)
    fur.addColorStop(0, '#FFFFFF')
    fur.addColorStop(0.6, '#F0F0F0')
    fur.addColorStop(1, '#CFCFCF')
    c.fillStyle = fur
    c.beginPath()
    c.arc(0, 0, 38, 0, Math.PI * 2)
    c.fill()
    // 눈 무늬와 눈
    c.fillStyle = '#2E2E2E'
    c.beginPath()
    c.ellipse(-13, -8, 9, 11, -0.3, 0, Math.PI * 2)
    c.ellipse(13, -8, 9, 11, 0.3, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#FFFFFF'
    c.beginPath()
    c.arc(-12, -9, 3.6, 0, Math.PI * 2)
    c.arc(14, -9, 3.6, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#2E2E2E'
    c.beginPath()
    c.arc(0, 8, 5, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }

  const draw = () => {
    const c = stage.begin('#08170E', '#0F2417')
    const scrollPx = state.scroll * SEG_H
    drawBackdrop(c, scrollPx)
    drawStalk(c)

    const from = Math.floor(state.scroll) - 3
    const to = Math.floor(state.scroll) + 10
    for (let i = from; i <= to; i++) {
      if (i < 0) continue
      const branch = branchAt(state, i)
      if (branch !== 0) drawBranch(segY(i), branch)
    }

    // 오를 때 지나가는 속도선 — 몸이 위로 갔다는 신호
    if (rush > 0) {
      c.save()
      c.globalAlpha = rush * 0.35
      c.strokeStyle = '#DCEDC8'
      c.lineWidth = 3
      c.lineCap = 'round'
      for (let i = 0; i < 7; i++) {
        const x = 40 + ((i * 97) % 640)
        const y = ((i * 211) % 900) + 200
        c.beginPath()
        c.moveTo(x, y)
        c.lineTo(x, y + 60 + rush * 70)
        c.stroke()
      }
      c.restore()
    }

    drawClimber(segY(state.height))

    // 흩날리는 잎
    for (const l of leaves) {
      const k = l.age / l.life
      c.save()
      c.globalAlpha = 1 - k * k
      c.translate(l.x, l.y)
      c.rotate(l.rot)
      c.fillStyle = '#8BC34A'
      c.beginPath()
      c.ellipse(0, 0, 5, 13, 0, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }

    if (state.hitFlash > 0) {
      c.save()
      c.globalAlpha = state.hitFlash
      c.fillStyle = '#EF5350'
      c.fillRect(0, 0, 720, 1280)
      c.restore()
    }

    // HUD
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: true,
    })
    c.textAlign = 'center'
    c.font = font(20)
    c.fillStyle = 'rgb(255 255 255 / 0.6)'
    c.fillText(t('bm.height', { n: state.height }), SCORE_PANEL.cx, SCORE_PANEL.subY)

    // 시간 막대 — 쉬는 동안 계속 줄어드는 것이 이 게임의 압박이다
    const ratio = state.timeBar / BAR_MAX
    c.fillStyle = 'rgb(0 0 0 / 0.35)'
    c.beginPath()
    c.roundRect(60, BAR_Y, 600, 30, 15)
    c.fill()
    const barColor = ratio < 0.25 ? '#EF5350' : ratio < 0.5 ? '#FFB300' : '#8BC34A'
    c.fillStyle = barColor
    c.beginPath()
    c.roundRect(60, BAR_Y, Math.max(8, 600 * ratio), 30, 15)
    c.fill()
    c.fillStyle = 'rgb(255 255 255 / 0.3)'
    c.beginPath()
    c.roundRect(66, BAR_Y + 5, Math.max(4, 600 * ratio - 12), 8, 4)
    c.fill()
    // 바닥나기 직전에는 막대가 뛴다
    if (ratio < 0.25 && state.phase === 'playing') {
      c.save()
      c.globalAlpha = 0.35 + 0.35 * Math.sin(state.playTime * 12)
      c.strokeStyle = '#EF5350'
      c.lineWidth = 4
      c.beginPath()
      c.roundRect(58, BAR_Y - 2, 604, 34, 17)
      c.stroke()
      c.restore()
    }

    // 글자 없는 조작 안내 — 가지가 없는 쪽에 손끝이 뜬다
    if (state.height < 3 && state.phase === 'playing') {
      const nextBranch = branchAt(state, state.height + 1)
      const safe = nextBranch === 0 ? -sideAnim : -nextBranch
      const k = (state.playTime % 1.2) / 1.2
      const lift = Math.sin(k * Math.PI) * 16
      const gx = 360 + safe * 250
      const gy = segY(state.height + 1) + 30
      c.save()
      c.globalAlpha = 0.72
      c.fillStyle = '#FFF9C4'
      c.beginPath()
      c.arc(gx, gy - lift, 17, 0, Math.PI * 2)
      c.fill()
      c.globalAlpha = 0.28
      c.beginPath()
      c.arc(gx, gy - lift, 28 + lift * 0.6, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
