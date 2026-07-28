import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { drawIcon } from '../icons'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { LANES, SONG_LENGTH, createState, tapLane, update, type Judge } from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'

// 화면 배치 (논리 720×1280)
const LANE_X = 40
const LANE_W = 160
const FIELD_W = LANE_W * LANES
// 노트가 나오는 곳은 점수판(y 22~172) 아래다. 예전엔 노트가 점수판 뒤로 지나가
// 처음 보이는 순간을 판이 가렸다.
const FIELD_TOP = 236
const HIT_Y = 1000
const BTN_Y = 1052
const BTN_H = 190
// 노트가 눈에 들어와 판정선에 닿기까지의 시간 — 이게 곧 반응 시간이라 난이도다.
// 필드 위끝을 내린 만큼 속도를 낮춰 예전 값(1.43초)을 그대로 지킨다.
const APPROACH_TIME = 1.43
const NOTE_SPEED = (HIT_Y - FIELD_TOP) / APPROACH_TIME
const NOTE_H = 40
// 낙하 속도는 사람마다 편한 값이 다르다. 느리면 읽기 쉽고 빠르면 겹친 노트가
// 벌어져 오히려 치기 쉽다 — 고른 값은 다음 판에도 남는다.
const SPEED_KEY = 'webgame:rhythm-speed'
const SPEED_STEPS = [0.8, 1, 1.3, 1.6]
const SPEED_CHIP = { x: 572, y: 172, w: 124, h: 44 } as const
const PRESS_TIME = 0.15
const JUDGE_LIFE = 0.55
const RING_LIFE = 0.45

// 레인 색 — 노트 몸통의 명암(light/dark)과 번지는 빛(glow)까지 손으로 잡아둔다.
// 프로그램으로 밝기만 올리면 노랑은 뜨고 파랑은 죽어서 네 줄의 무게가 달라진다.
const LANE_ART = [
  { light: '#FFB3CB', base: '#FF5A8C', dark: '#A82150', glow: '#FF87AE' },
  { light: '#FFE9A8', base: '#FFC94D', dark: '#B67E10', glow: '#FFD97A' },
  { light: '#B6EFC6', base: '#4DD679', dark: '#1E7B43', glow: '#7FE79F' },
  { light: '#B8E2FF', base: '#55B9FF', dark: '#1A62A2', glow: '#8AD1FF' },
]

const JUDGE_STYLE: Record<Judge, { text: string; color: string }> = {
  perfect: { text: 'PERFECT', color: '#FFD54F' },
  great: { text: 'GREAT', color: '#4DD679' },
  good: { text: 'GOOD', color: '#55B9FF' },
  miss: { text: 'MISS', color: '#FF5252' },
}
// 결과 팝업은 밝은 종이 위라 무대용 색을 그대로 쓰면 노랑·하늘색이 날아간다
const JUDGE_TALLY_COLOR: Record<Judge, string> = {
  perfect: '#E08A00',
  great: '#2E9E52',
  good: '#1E7FC4',
  miss: '#D93A3A',
}
// 정확할수록 높고 맑게 — 같은 타격음의 음높이만 올린다
const JUDGE_RATE: Record<Judge, number> = { perfect: 1.14, great: 1, good: 0.88, miss: 1 }

function loadSpeedIndex(): number {
  try {
    const raw = Number(localStorage.getItem(SPEED_KEY))
    if (Number.isInteger(raw) && raw >= 0 && raw < SPEED_STEPS.length) return raw
  } catch {
    // 저장이 막힌 브라우저 — 기본 속도로 논다
  }
  return 1
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  r: number
  color: string
}

const laneCx = (lane: number) => LANE_X + lane * LANE_W + LANE_W / 2

// 레인마다 다른 표식. 색만으로 가르면 작게 그렸을 때 뭉개지고, 색이 비슷하게
// 보이는 사람에게는 네 줄이 한 줄이 된다. 노트와 아래 버튼에 같은 표식을 새겨
// "이 노트는 이 버튼"이 눈으로 이어지게 한다.
function drawLaneMark(
  c: CanvasRenderingContext2D,
  lane: number,
  x: number,
  y: number,
  s: number,
  color: string,
) {
  c.beginPath()
  switch (lane) {
    case 0:
      c.moveTo(x, y - s)
      c.lineTo(x + s * 0.92, y + s * 0.7)
      c.lineTo(x - s * 0.92, y + s * 0.7)
      c.closePath()
      break
    case 1:
      c.arc(x, y, s * 0.86, 0, Math.PI * 2)
      break
    case 2:
      c.roundRect(x - s * 0.78, y - s * 0.78, s * 1.56, s * 1.56, s * 0.26)
      break
    default:
      c.moveTo(x, y - s)
      c.lineTo(x + s, y)
      c.lineTo(x, y + s)
      c.lineTo(x - s, y)
      c.closePath()
  }
  c.fillStyle = color
  c.fill()
}

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    const missed = update(state, dt)
    if (missed.length > 0) {
      playSfx('rhythm-miss')
      vibrate(40)
      judgeFx = { judge: 'miss', age: 0 }
      damage = 1
      for (const lane of missed) {
        laneMiss[lane] = 1
        burstMiss(lane)
      }
    }
    // 체력이 다했든 곡을 완주했든 여기를 반드시 지난다. 예전엔 미스가 난 프레임에만
    // 끝을 예약해서, 마지막 노트까지 다 맞히고 완주하면 팝업이 영영 안 떴다.
    if (state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) {
        state.overTimer = -1
        void finishRun()
      }
    }
    stepEffects(dt)
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('clear', 'gameover', 'rhythm-hit', 'rhythm-miss', 'tap')
  let adContinueUsed = false
  let speedIndex = loadSpeedIndex()
  const noteSpeed = () => NOTE_SPEED * SPEED_STEPS[speedIndex]

  const particles: Particle[] = []
  const rings: Array<{ lane: number; judge: Judge; age: number }> = []
  const press = new Array<number>(LANES).fill(0)
  const laneMiss = new Array<number>(LANES).fill(0)
  // 가운데 판정 문구는 한 자리만 쓴다 — 여러 개가 겹쳐 찍히면 뭐가 최신인지 모른다
  let judgeFx: { judge: Judge; age: number } | null = null
  let comboPop = 0 // 콤보가 오를 때 튀는 정도
  let lineFlash = 0 // 판정선 번쩍임
  let pulse = 0 // 배경 박동
  let damage = 0 // 미스했을 때 붉은 테두리·체력 게이지 흔들림

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'rt.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adContinueUsed = false
      Object.assign(state, createState())
      particles.length = 0
      rings.length = 0
      press.fill(0)
      laneMiss.fill(0)
      judgeFx = null
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  // 광고 보상: 체력을 회복하고 같은 곡을 이어서 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('rhythm-health')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.health = 60
    state.phase = 'playing'
    overlay.hide()
  }

  async function finishRun() {
    // 체력이 남은 채 끝났다 = 곡을 완주했다. 실패와 같은 소리로 끝내면 억울하다.
    const cleared = state.health > 0
    if (cleared) {
      playSfx('clear')
      vibrate([30, 60, 30])
    } else {
      playGameOver()
      vibrate(120)
    }
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    // 완주한 판에서 체력을 채워봐야 남은 노트가 없다 — 이어하기를 걸지 않는다
    // 어디서 흘렸는지는 판정 수를 봐야 안다 — 다음 판에 무엇을 고칠지가 여기서 나온다
    overlay.show(
      state.score,
      prevBest,
      ctx.isRewardAdReady() && !adContinueUsed && !cleared,
      cleared ? 'over.byClear' : 'over.byHp',
      (['perfect', 'great', 'good', 'miss'] as Judge[]).map((judge) => ({
        label: JUDGE_STYLE[judge].text,
        value: String(state.counts[judge]),
        color: JUDGE_TALLY_COLOR[judge],
      })),
    )
  }

  // 판정선에서 튀는 불꽃 — 정확할수록 많고 밝다
  const burstHit = (lane: number, judge: Judge) => {
    const art = LANE_ART[lane]
    const count = judge === 'perfect' ? 12 : judge === 'great' ? 8 : 5
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.3
      const speed = 180 + Math.random() * 300
      particles.push({
        x: laneCx(lane) + (Math.random() - 0.5) * (LANE_W - 40),
        y: HIT_Y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        age: 0,
        life: 0.42,
        r: 3 + Math.random() * 4,
        color: judge === 'perfect' && i % 3 === 0 ? '#FFFFFF' : art.glow,
      })
    }
  }

  // 놓친 노트는 판정선 아래로 부서져 떨어진다 — 지나가 버렸다는 게 눈에 남는다
  const burstMiss = (lane: number) => {
    for (let i = 0; i < 7; i++) {
      particles.push({
        x: laneCx(lane) + (Math.random() - 0.5) * (LANE_W - 50),
        y: HIT_Y + 6,
        vx: (Math.random() - 0.5) * 160,
        vy: 60 + Math.random() * 140,
        age: 0,
        life: 0.5,
        r: 4 + Math.random() * 5,
        color: i % 2 === 0 ? '#FF5252' : '#7A2233',
      })
    }
  }

  const stepEffects = (dt: number) => {
    lineFlash = Math.max(0, lineFlash - dt * 6)
    comboPop = Math.max(0, comboPop - dt * 5)
    pulse = Math.max(0, pulse - dt * 3.2)
    damage = Math.max(0, damage - dt * 2.2)
    for (let i = 0; i < LANES; i++) {
      press[i] = Math.max(0, press[i] - dt)
      laneMiss[i] = Math.max(0, laneMiss[i] - dt * 2.4)
    }
    if (judgeFx) {
      judgeFx.age += dt
      if (judgeFx.age > JUDGE_LIFE) judgeFx = null
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i].age += dt
      if (rings[i].age > RING_LIFE) rings.splice(i, 1)
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.age += dt
      if (p.age >= p.life) {
        particles.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 1500 * dt
    }
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      if (
        p.x >= SPEED_CHIP.x &&
        p.x <= SPEED_CHIP.x + SPEED_CHIP.w &&
        p.y >= SPEED_CHIP.y &&
        p.y <= SPEED_CHIP.y + SPEED_CHIP.h
      ) {
        speedIndex = (speedIndex + 1) % SPEED_STEPS.length
        localStorage.setItem(SPEED_KEY, String(speedIndex))
        playDrop()
        return
      }
      if (p.y < HIT_Y - 200) return
      const lane = Math.floor((p.x - LANE_X) / LANE_W)
      if (lane < 0 || lane >= LANES) return
      press[lane] = PRESS_TIME
      const judge = tapLane(state, lane)
      if (!judge) {
        playDrop()
        return
      }
      playSfx('rhythm-hit', { rate: JUDGE_RATE[judge] })
      rings.push({ lane, judge, age: 0 })
      judgeFx = { judge, age: 0 }
      comboPop = 1
      lineFlash = 1
      pulse = 1
      burstHit(lane, judge)
    },
    onMove() {},
    onUp() {},
  })

  // 무대 바탕 — 판정선 뒤에서 번지는 빛이 노트를 맞힐 때마다 부푼다
  const drawBackdrop = (c: CanvasRenderingContext2D) => {
    const bg = c.createLinearGradient(0, 0, 0, 1280)
    bg.addColorStop(0, '#150E2C')
    bg.addColorStop(0.62, '#221645')
    bg.addColorStop(1, '#0F0A20')
    c.fillStyle = bg
    c.fillRect(0, 0, 720, 1280)

    const glow = c.createRadialGradient(360, HIT_Y, 0, 360, HIT_Y, 430 + pulse * 130)
    glow.addColorStop(0, `rgb(150 110 255 / ${0.14 + pulse * 0.2})`)
    glow.addColorStop(1, 'rgb(150 110 255 / 0)')
    c.fillStyle = glow
    c.fillRect(0, FIELD_TOP - 80, 720, 1280 - FIELD_TOP + 80)
  }

  // 레인 바탕 + 흐르는 가로줄. 가로줄이 노트와 같은 속도로 내려와 지금 얼마나
  // 빠른 곡인지 노트가 없는 순간에도 알 수 있다.
  const drawField = (c: CanvasRenderingContext2D) => {
    const fieldH = HIT_Y + 40 - FIELD_TOP
    for (let i = 0; i < LANES; i++) {
      const x = LANE_X + i * LANE_W
      c.fillStyle = i % 2 === 0 ? 'rgb(255 255 255 / 0.04)' : 'rgb(255 255 255 / 0.075)'
      c.fillRect(x, FIELD_TOP, LANE_W, fieldH)
    }

    c.save()
    c.beginPath()
    c.rect(LANE_X, FIELD_TOP, FIELD_W, fieldH)
    c.clip()

    const period = 220
    const offset = ((state.time * noteSpeed()) % period) - period
    c.strokeStyle = 'rgb(255 255 255 / 0.055)'
    c.lineWidth = 2
    for (let y = FIELD_TOP + offset; y < HIT_Y; y += period) {
      c.beginPath()
      c.moveTo(LANE_X, y)
      c.lineTo(LANE_X + FIELD_W, y)
      c.stroke()
    }

    // 눌린 레인은 판정선 쪽에서 빛이 차오른다
    for (let i = 0; i < LANES; i++) {
      const lit = Math.max(press[i] / PRESS_TIME, laneMiss[i])
      if (lit <= 0) continue
      const miss = laneMiss[i] > press[i] / PRESS_TIME
      const color = miss ? '255 82 82' : hexToRgb(LANE_ART[i].base)
      const g = c.createLinearGradient(0, HIT_Y, 0, HIT_Y - 420)
      g.addColorStop(0, `rgb(${color} / ${0.3 * lit})`)
      g.addColorStop(1, `rgb(${color} / 0)`)
      c.fillStyle = g
      c.fillRect(LANE_X + i * LANE_W, FIELD_TOP, LANE_W, fieldH)
    }
    c.restore()

    // 레인 칸막이와 바깥 테두리
    c.strokeStyle = 'rgb(255 255 255 / 0.09)'
    c.lineWidth = 2
    for (let i = 0; i <= LANES; i++) {
      const x = LANE_X + i * LANE_W
      c.beginPath()
      c.moveTo(x, FIELD_TOP)
      c.lineTo(x, HIT_Y + 40)
      c.stroke()
    }
  }

  // 노트 — 판정 순간이 흔들리지 않게 실루엣(높이)은 네 줄 모두 같게 두고,
  // 명암·표식으로만 가른다. 줄마다 모양이 다르면 닿는 순간이 다르게 보인다.
  const drawNote = (c: CanvasRenderingContext2D, lane: number, y: number) => {
    const art = LANE_ART[lane]
    const x = LANE_X + lane * LANE_W + 15
    const w = LANE_W - 30
    const top = y - NOTE_H / 2
    // 판정선에 가까울수록 밝아진다 — 언제 쳐야 하는지 눈으로 재게 해준다
    const near = Math.max(0, 1 - Math.abs(HIT_Y - y) / 300)

    c.save()
    // 선을 지나친 노트는 흐려지며 빠져나간다 (판정 창이 아직 남아 있는 동안이다)
    if (y > HIT_Y) c.globalAlpha = Math.max(0, 1 - (y - HIT_Y) / 90)
    c.fillStyle = 'rgb(0 0 0 / 0.32)'
    c.beginPath()
    c.roundRect(x + 3, top + 7, w, NOTE_H, 13)
    c.fill()

    if (near > 0) {
      c.shadowColor = art.glow
      c.shadowBlur = 28 * near
    }
    const body = c.createLinearGradient(0, top, 0, top + NOTE_H)
    body.addColorStop(0, art.light)
    body.addColorStop(0.52, art.base)
    body.addColorStop(1, art.dark)
    c.fillStyle = body
    c.beginPath()
    c.roundRect(x, top, w, NOTE_H, 13)
    c.fill()
    c.shadowBlur = 0

    // 광원은 왼쪽 위 — 윗면은 밝게, 아랫날은 어둡게 깔아 두께를 만든다
    c.fillStyle = 'rgb(255 255 255 / 0.5)'
    c.beginPath()
    c.roundRect(x + 6, top + 4, w - 12, 10, 5)
    c.fill()
    c.fillStyle = 'rgb(0 0 0 / 0.25)'
    c.beginPath()
    c.roundRect(x + 6, top + NOTE_H - 9, w - 12, 5, 3)
    c.fill()

    drawLaneMark(c, lane, x + w / 2, top + NOTE_H * 0.58, 8, 'rgb(0 0 0 / 0.28)')
    drawLaneMark(c, lane, x + w / 2, top + NOTE_H * 0.55, 8, 'rgb(255 255 255 / 0.8)')
    c.restore()
  }

  const drawNotes = (c: CanvasRenderingContext2D) => {
    c.save()
    c.beginPath()
    c.rect(LANE_X, FIELD_TOP, FIELD_W, HIT_Y + 90 - FIELD_TOP)
    c.clip()
    for (const note of state.notes) {
      if (note.hit) continue
      const y = HIT_Y - (note.time - state.time) * noteSpeed()
      if (y < FIELD_TOP - NOTE_H || y > HIT_Y + 90) continue
      drawNote(c, note.lane, y)
    }
    // 노트가 어둠에서 걸어 나오게 위끝을 덮는다 (색은 바탕 그라데이션의 그 자리 값)
    const fade = c.createLinearGradient(0, FIELD_TOP, 0, FIELD_TOP + 78)
    fade.addColorStop(0, '#191033')
    fade.addColorStop(1, 'rgb(25 16 51 / 0)')
    c.fillStyle = fade
    c.fillRect(LANE_X, FIELD_TOP, FIELD_W, 78)
    c.restore()
  }

  // 판정선 위의 받침 — 노트가 여기 겹치는 순간이 정타다
  const drawReceptors = (c: CanvasRenderingContext2D) => {
    for (let i = 0; i < LANES; i++) {
      const art = LANE_ART[i]
      const lit = Math.max(press[i] / PRESS_TIME, laneMiss[i] * 0.8)
      const x = LANE_X + i * LANE_W
      c.save()
      c.strokeStyle = art.base
      c.globalAlpha = 0.28 + lit * 0.72
      c.lineWidth = 3 + lit * 2
      c.beginPath()
      c.roundRect(x + 15, HIT_Y - NOTE_H / 2 - 5, LANE_W - 30, NOTE_H + 10, 15)
      c.stroke()
      c.restore()
    }

    const flash = lineFlash
    c.save()
    c.shadowColor = '#CBB2FF'
    c.shadowBlur = 18 + flash * 34
    c.strokeStyle = `rgb(235 226 255 / ${0.5 + flash * 0.5})`
    c.lineWidth = 5 + flash * 5
    c.beginPath()
    c.moveTo(LANE_X, HIT_Y)
    c.lineTo(LANE_X + FIELD_W, HIT_Y)
    c.stroke()
    c.restore()
  }

  const drawRings = (c: CanvasRenderingContext2D) => {
    for (const fx of rings) {
      const k = fx.age / RING_LIFE
      const cx = laneCx(fx.lane)
      c.save()
      c.globalAlpha = (1 - k) * 0.9
      c.strokeStyle = JUDGE_STYLE[fx.judge].color
      c.lineWidth = 6 * (1 - k)
      c.beginPath()
      c.ellipse(cx, HIT_Y, 36 + k * 76, 18 + k * 34, 0, 0, Math.PI * 2)
      c.stroke()
      // 맞은 순간의 하얀 심지
      if (k < 0.35) {
        c.globalAlpha = (1 - k / 0.35) * 0.8
        c.fillStyle = '#FFFFFF'
        c.beginPath()
        c.ellipse(cx, HIT_Y, 44 * (1 - k), 12 * (1 - k), 0, 0, Math.PI * 2)
        c.fill()
      }
      c.restore()
    }
  }

  const drawParticles = (c: CanvasRenderingContext2D) => {
    for (const p of particles) {
      const k = p.age / p.life
      c.globalAlpha = 1 - k * k
      c.fillStyle = p.color
      c.beginPath()
      c.arc(p.x, p.y, p.r * (1 - k * 0.55), 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1
  }

  const drawCombo = (c: CanvasRenderingContext2D) => {
    if (state.combo < 5) return
    c.save()
    c.translate(360, 596)
    const pop = 1 + comboPop * 0.2
    c.scale(pop, pop)
    c.textAlign = 'center'
    c.textBaseline = 'alphabetic'
    c.font = font(84, true)
    // 콤보가 쌓일수록 뜨거워진다
    c.fillStyle =
      state.combo >= 50 ? '#FFD54F' : state.combo >= 20 ? '#FFECB3' : 'rgb(255 255 255 / 0.82)'
    c.shadowColor = 'rgb(0 0 0 / 0.45)'
    c.shadowBlur = 14
    c.fillText(`x${state.combo}`, 0, 0)
    c.restore()
  }

  const drawJudge = (c: CanvasRenderingContext2D) => {
    if (!judgeFx) return
    const k = judgeFx.age / JUDGE_LIFE
    const style = JUDGE_STYLE[judgeFx.judge]
    // 크게 튀어나왔다가 제 크기로 내려앉고, 끝에서만 사라진다
    const pop = k < 0.16 ? 1.34 - (k / 0.16) * 0.34 : 1
    c.save()
    c.globalAlpha = k > 0.72 ? (1 - k) / 0.28 : 1
    c.translate(360, 706)
    c.scale(pop, pop)
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.font = font(46, true)
    c.lineJoin = 'round'
    c.lineWidth = 9
    c.strokeStyle = 'rgb(14 10 30 / 0.75)'
    c.strokeText(style.text, 0, 0)
    c.fillStyle = style.color
    c.fillText(style.text, 0, 0)
    c.restore()
  }

  const drawPads = (c: CanvasRenderingContext2D) => {
    for (let i = 0; i < LANES; i++) {
      const art = LANE_ART[i]
      const x = LANE_X + i * LANE_W + 10
      const w = LANE_W - 20
      const down = press[i] / PRESS_TIME
      const drop = down * 8

      c.save()
      // 아래 받침 — 누르면 윗면이 내려앉아 이 면이 드러난다
      c.fillStyle = art.dark
      c.beginPath()
      c.roundRect(x, BTN_Y, w, BTN_H, 24)
      c.fill()

      const face = c.createLinearGradient(0, BTN_Y + drop, 0, BTN_Y + BTN_H - 14)
      face.addColorStop(0, art.light)
      face.addColorStop(0.45, art.base)
      face.addColorStop(1, art.dark)
      c.fillStyle = face
      c.beginPath()
      c.roundRect(x, BTN_Y + drop, w, BTN_H - 14, 24)
      c.fill()

      c.fillStyle = 'rgb(255 255 255 / 0.38)'
      c.beginPath()
      c.roundRect(x + 10, BTN_Y + drop + 7, w - 20, 9, 5)
      c.fill()

      drawLaneMark(c, i, x + w / 2, BTN_Y + drop + 80, 21, 'rgb(0 0 0 / 0.22)')
      drawLaneMark(c, i, x + w / 2, BTN_Y + drop + 76, 21, 'rgb(255 255 255 / 0.85)')

      if (down > 0) {
        c.globalAlpha = down * 0.28
        c.fillStyle = '#FFFFFF'
        c.beginPath()
        c.roundRect(x, BTN_Y + drop, w, BTN_H - 14, 24)
        c.fill()
      }
      c.restore()
    }
  }

  // 글자 없는 조작 안내 — 다음 노트가 오는 버튼 위에서 고리가 오므라들고,
  // 노트가 판정선에 닿는 순간 손끝 크기가 된다. 처음 몇 번 맞히면 사라진다.
  const drawGuide = (c: CanvasRenderingContext2D) => {
    if (state.phase !== 'playing') return
    const hits = state.counts.perfect + state.counts.great + state.counts.good
    if (hits >= 3 || state.time > 14) return
    let next = null
    for (let i = state.nextIndex; i < state.notes.length; i++) {
      if (!state.notes[i].hit) {
        next = state.notes[i]
        break
      }
    }
    if (!next) return
    const lead = next.time - state.time
    if (lead > 1.5 || lead < -0.2) return
    const k = Math.max(0, 1 - Math.max(0, lead) / 1.5)
    const cx = laneCx(next.lane)
    const cy = BTN_Y + 76

    c.save()
    // 손끝은 반투명이라 버튼의 표식이 비쳐 보인다 — 표식과 노트가 짝이라는 걸 가리지 않는다
    c.fillStyle = 'rgb(255 255 255 / 0.55)'
    c.beginPath()
    c.arc(cx, cy, 17, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = `rgb(255 255 255 / ${0.15 + k * 0.6})`
    c.lineWidth = 4
    c.beginPath()
    c.arc(cx, cy, 17 + (1 - k) * 52, 0, Math.PI * 2)
    c.stroke()
    c.restore()
  }

  const drawHud = (c: CanvasRenderingContext2D) => {
    drawScorePanel(c, {
      label: t('hud.score'),
      value: state.score.toLocaleString(),
      sub: true,
    })
    c.textAlign = 'center'
    c.textBaseline = 'alphabetic'
    c.font = font(20)
    c.fillStyle = 'rgb(255 255 255 / 0.6)'
    c.fillText(`MAX x${state.maxCombo}`, SCORE_PANEL.cx, SCORE_PANEL.subY)

    // 체력 — 미스가 나면 게이지가 흔들려서 무엇 때문에 지는지 눈이 따라간다
    const hp = state.health / 100
    const shake = Math.sin(damage * 42) * 7 * damage
    const barX = SCORE_PANEL.left + 22
    const barW = SCORE_PANEL.right - barX
    const barY = 186
    // 위험할 때 심장이 뛴다
    const beat = hp <= 0.3 ? 1 + Math.sin(state.time * 9) * 0.1 : 1
    drawIcon(c, 'heart', SCORE_PANEL.left + shake, barY + 9, 15 * beat)
    c.fillStyle = 'rgb(255 255 255 / 0.14)'
    c.beginPath()
    c.roundRect(barX + shake, barY, barW, 18, 9)
    c.fill()
    c.fillStyle = hp > 0.5 ? '#4DD679' : hp > 0.25 ? '#FFC94D' : '#FF5252'
    c.beginPath()
    c.roundRect(barX + shake, barY, Math.max(18, barW * hp), 18, 9)
    c.fill()
    if (damage > 0) {
      c.save()
      c.globalAlpha = damage * 0.7
      c.fillStyle = '#FFFFFF'
      c.beginPath()
      c.roundRect(barX + shake, barY, Math.max(18, barW * hp), 18, 9)
      c.fill()
      c.restore()
    }

    // 노트 속도 — 눌러서 바꾼다
    c.fillStyle = 'rgb(255 255 255 / 0.08)'
    c.beginPath()
    c.roundRect(SPEED_CHIP.x, SPEED_CHIP.y, SPEED_CHIP.w, SPEED_CHIP.h, 14)
    c.fill()
    c.strokeStyle = 'rgb(179 157 219 / 0.45)'
    c.lineWidth = 2
    c.stroke()
    const chipCx = SPEED_CHIP.x + SPEED_CHIP.w / 2
    c.textAlign = 'center'
    c.fillStyle = 'rgb(255 255 255 / 0.42)'
    c.font = font(13)
    c.fillText(t('rt.speed'), chipCx, SPEED_CHIP.y + 17)
    c.fillStyle = '#B39DDB'
    c.font = font(22, true)
    c.fillText(`×${SPEED_STEPS[speedIndex].toFixed(1)}`, chipCx, SPEED_CHIP.y + 38)

    // 곡이 얼마나 남았는지 — 끝이 있는 판이라 남은 길이가 보여야 한다
    const progress = Math.min(1, state.time / SONG_LENGTH)
    const py = FIELD_TOP - 14
    c.fillStyle = 'rgb(255 255 255 / 0.12)'
    c.beginPath()
    c.roundRect(LANE_X, py, FIELD_W, 5, 3)
    c.fill()
    c.fillStyle = '#B39DDB'
    c.beginPath()
    c.roundRect(LANE_X, py, Math.max(5, FIELD_W * progress), 5, 3)
    c.fill()
    c.beginPath()
    c.arc(LANE_X + FIELD_W * progress, py + 2.5, 5, 0, Math.PI * 2)
    c.fill()
  }

  const draw = () => {
    const c = stage.begin('#0B0718', '#150E2C')
    drawBackdrop(c)
    drawField(c)
    // 받침과 판정선은 노트 아래에 깐다 — 노트가 선을 덮는 순간이 곧 정타다
    drawReceptors(c)
    drawNotes(c)
    drawParticles(c)
    drawRings(c)
    drawCombo(c)
    drawJudge(c)
    drawPads(c)
    drawGuide(c)

    // 미스했을 때 붉은 테두리. 노트를 흔들면 타이밍을 읽을 수 없어 화면 흔들림
    // 대신 테두리와 체력 게이지로 알린다.
    if (damage > 0) {
      const vignette = c.createRadialGradient(360, 640, 250, 360, 640, 780)
      vignette.addColorStop(0, 'rgb(255 40 60 / 0)')
      vignette.addColorStop(1, `rgb(255 40 60 / ${0.4 * damage})`)
      c.fillStyle = vignette
      c.fillRect(0, 0, 720, 1280)
    }

    drawHud(c)
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

// 레인 빛 그라데이션에 알파를 섞어 쓰려고 색을 성분으로 되돌린다
function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

export default defineGame(createSession)
