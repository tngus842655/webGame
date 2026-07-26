import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playMerge, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createClearBonus } from '../clearBonus'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  HALF_H,
  HALF_W,
  LIFT,
  TILE_H,
  TILE_W,
  createState,
  hasMoves,
  isFree,
  loadStage,
  reshuffleRemaining,
} from './state'
import { drawTile } from './tileArt'

// 타일을 배치할 세로 영역 (위는 HUD 카드)
const AREA_TOP = 156
const AREA_BOTTOM = 1250

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    if (state.phase === 'playing' && state.clearTimer > 0) {
      state.clearTimer -= dt
      if (state.clearTimer <= 0) loadStage(state, state.stage + 1)
    } else if (state.phase === 'noMoves') {
      state.noMovesTimer -= dt
      if (state.noMovesTimer <= 0) void gameOver()
    }
    for (const tile of state.tiles) tile.shake = Math.max(0, tile.shake - dt)
    for (const p of pops) p.age += dt
    pops = pops.filter((p) => p.age < 0.35)
    for (const p of popups) p.age += dt
    popups = popups.filter((p) => p.age < 0.9)
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let origin = { ox: 0, oy: 0 }
  let pops: { x: number; y: number; age: number }[] = []
  let popups: { x: number; y: number; text: string; age: number }[] = []
  let adContinueUsed = false
  const bonus = createClearBonus(shell, ctx, 'mahjong-clear')

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'mj.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adContinueUsed = false
      pops = []
      popups = []
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  // 광고 보상: 남은 타일을 같은 자리에서 재배정하고 이어하기 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('mahjong-shuffle')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    reshuffleRemaining(state)
    state.phase = 'playing'
    state.selected = -1
    state.combo = 0
    state.lastMatchAt = -10
    // 재배정조차 불가능한 배치(예: 마지막 짝이 수직으로 포개짐)면 다시 막힘 처리
    if (!hasMoves(state.tiles)) {
      state.phase = 'noMoves'
      state.noMovesTimer = 1.6
    }
    overlay.hide()
  }

  // 보너스를 묻는 동안 셸이 멈추므로 다음 스테이지로 넘어가지 않는다
  async function onStageClear() {
    let points = 1000
    if (await bonus.offer(points)) points *= 2
    if (shell.isDestroyed()) return
    state.score = Math.min(1_000_000, state.score + points)
    popups.push({ x: 360, y: 620, text: `+${points}`, age: 0 })
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

  // 현재 스테이지 레이아웃을 화면 중앙에 놓기 위한 원점 (제거 여부와 무관하게 전체 기준)
  const layoutOrigin = () => {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const tile of state.tiles) {
      minX = Math.min(minX, tile.x)
      maxX = Math.max(maxX, tile.x)
      minY = Math.min(minY, tile.y)
      maxY = Math.max(maxY, tile.y)
    }
    return {
      ox: (720 - (maxX - minX + 2) * HALF_W) / 2 - minX * HALF_W,
      oy: AREA_TOP + (AREA_BOTTOM - AREA_TOP - (maxY - minY + 2) * HALF_H) / 2 - minY * HALF_H,
    }
  }

  const tileLeft = (i: number) => {
    const tile = state.tiles[i]
    return origin.ox + tile.x * HALF_W - tile.z * LIFT
  }
  const tileTop = (i: number) => {
    const tile = state.tiles[i]
    return origin.oy + tile.y * HALF_H - tile.z * LIFT
  }

  // 탭 지점의 최상단 타일 (그리기 순서상 가장 나중 = 눈에 보이는 타일)
  const hitTile = (bx: number, by: number): number => {
    let best = -1
    for (let i = 0; i < state.tiles.length; i++) {
      if (state.tiles[i].removed) continue
      const px = tileLeft(i)
      const py = tileTop(i)
      if (bx < px || bx >= px + TILE_W || by < py || by >= py + TILE_H) continue
      if (best < 0) {
        best = i
        continue
      }
      const a = state.tiles[i]
      const b = state.tiles[best]
      if (a.z > b.z || (a.z === b.z && (a.y > b.y || (a.y === b.y && a.x > b.x)))) best = i
    }
    return best
  }

  const removePair = (a: number, b: number) => {
    const ta = state.tiles[a]
    const tb = state.tiles[b]
    ta.removed = true
    tb.removed = true
    state.selected = -1
    // 3초 이내 연속 제거면 콤보 보너스
    state.combo = state.playTime - state.lastMatchAt <= 3 ? state.combo + 1 : 0
    state.lastMatchAt = state.playTime
    const pts = 100 + 50 * state.combo
    state.score = Math.min(1_000_000, state.score + pts)
    for (const i of [a, b]) pops.push({ x: tileLeft(i) + TILE_W / 2, y: tileTop(i) + TILE_H / 2, age: 0 })
    const midX = (tileLeft(a) + tileLeft(b)) / 2 + TILE_W / 2
    const midY = (tileTop(a) + tileTop(b)) / 2 - 30
    popups.push({ x: midX, y: midY, text: `+${pts}`, age: 0 })
    playMerge(Math.min(state.combo, 8))
    vibrate(20)

    if (!state.tiles.some((tile) => !tile.removed)) {
      // 스테이지 클리어: 보너스 후 다음 스테이지 (점수 누적)
      state.clearTimer = 1
      void onStageClear()
    } else if (!hasMoves(state.tiles)) {
      state.phase = 'noMoves'
      state.noMovesTimer = 1.6
    }
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing' || state.clearTimer > 0) return
      const p = stage.toBoard(clientX, clientY)
      const idx = hitTile(p.x, p.y)
      if (idx < 0) return
      const tile = state.tiles[idx]
      if (!isFree(tile, state.tiles)) {
        tile.shake = 0.35
        return
      }
      if (state.selected === idx) {
        state.selected = -1
      } else if (state.selected >= 0 && state.tiles[state.selected].kind === tile.kind) {
        removePair(state.selected, idx)
      } else {
        state.selected = idx
        playDrop()
      }
    },
    onMove() {},
    onUp() {},
  })

  const draw = () => {
    const c = stage.begin('#25503C', '#2F6B4E')
    origin = layoutOrigin()

    // 펠트 배경
    const felt = c.createRadialGradient(360, 640, 100, 360, 640, 780)
    felt.addColorStop(0, '#38795A')
    felt.addColorStop(1, '#2A5B44')
    c.fillStyle = felt
    c.fillRect(0, 0, 720, 1280)

    // 타일: 아래층부터, 같은 층은 위·왼쪽부터 (옆면이 자연스럽게 가려진다)
    const order = state.tiles
      .map((_, i) => i)
      .filter((i) => !state.tiles[i].removed)
      .sort((a, b) => {
        const ta = state.tiles[a]
        const tb = state.tiles[b]
        return ta.z - tb.z || ta.y - tb.y || ta.x - tb.x
      })
    const drawOne = (i: number, selected: boolean) => {
      const tile = state.tiles[i]
      const wobble = tile.shake > 0 ? Math.sin(tile.shake * 45) * 5 : 0
      const rise = selected ? 5 : 0
      drawTile(c, tileLeft(i) + wobble - rise, tileTop(i) - rise, tile.kind, selected)
    }
    for (const i of order) if (i !== state.selected) drawOne(i, false)
    if (state.selected >= 0) drawOne(state.selected, true)

    // 짝 제거 팝 이펙트
    for (const p of pops) {
      const k = p.age / 0.35
      const s = 1 + k * 0.7
      c.globalAlpha = 1 - k
      c.strokeStyle = '#FFE082'
      c.lineWidth = 6
      c.beginPath()
      c.roundRect(p.x - (TILE_W / 2) * s, p.y - (TILE_H / 2) * s, TILE_W * s, TILE_H * s, 12)
      c.stroke()
    }
    c.globalAlpha = 1

    // HUD (골프식 흰 카드)
    c.textAlign = 'center'
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.92
    c.beginPath()
    c.roundRect(190, 24, 340, 114, 24)
    c.fill()
    c.restore()
    c.fillStyle = '#7D8F81'
    c.font = '17px sans-serif'
    c.fillText(t('hud.score'), 360, 52)
    c.fillStyle = '#1F4432'
    c.font = 'bold 44px sans-serif'
    c.fillText(state.score.toLocaleString(), 360, 96)
    const pairsLeft = state.tiles.filter((tile) => !tile.removed).length / 2
    c.fillStyle = '#7D8F81'
    c.font = '18px sans-serif'
    c.fillText(`${t('mj.stage', { n: state.stage })} · ${t('mj.pairs', { n: pairsLeft })}`, 360, 126)

    // 점수 팝업
    for (const p of popups) {
      c.globalAlpha = 1 - p.age / 0.9
      c.fillStyle = '#FFD54F'
      c.font = 'bold 44px sans-serif'
      c.lineWidth = 7
      c.strokeStyle = 'rgb(0 0 0 / 0.45)'
      c.strokeText(p.text, p.x, p.y - p.age * 70)
      c.fillText(p.text, p.x, p.y - p.age * 70)
    }
    c.globalAlpha = 1

    // 막힘 안내
    if (state.phase === 'noMoves') {
      c.fillStyle = 'rgb(33 33 33 / 0.75)'
      c.beginPath()
      c.roundRect(80, 588, 560, 104, 20)
      c.fill()
      c.fillStyle = '#FFFFFF'
      c.font = 'bold 38px sans-serif'
      c.fillText(t('mj.noMoves'), 360, 653)
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
