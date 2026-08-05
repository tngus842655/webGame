import { t } from '@/shared/i18n'
import { playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { currentStreak, dailySeed, isDoneToday, mulberry32, recordDailyDone } from '../daily'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { createSheet } from '../ui'
import { DAILY, LAYOUT } from './config'
import { BBRenderer, type DragState, type HudInfo } from './renderer'
import {
  createState,
  dragTarget,
  pieceSize,
  placePiece,
  replaceTrayWithSmall,
  updateEffects,
} from './state'

const SLUG = 'blockblast'

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    updateEffects(state, dt)
    renderer.draw(state, drag, hud)
  })
  const renderer = new BBRenderer(shell.wrapper)
  // 데일리가 기본 — 시드 딜이라 오늘 안에는 다시 해도 같은 순서로 온다
  const state = createState(mulberry32(dailySeed()))
  const hud: HudInfo = {
    daily: true,
    streak: currentStreak(SLUG),
    done: isDoneToday(SLUG),
    goal: DAILY.target,
    best: null,
  }
  void ctx.getBestScore().then((best) => {
    hud.best = best
  })
  preloadSfx('gameover', 'pop', 'select', 'clear')
  let adSwapUsed = false
  let drag: DragState | null = null

  function newGame(daily: boolean) {
    hud.daily = daily
    // 자정을 넘겨 다시 시작해도 어제의 달성·스트릭이 남지 않게 저장소에서 다시 읽는다
    hud.streak = currentStreak(SLUG)
    hud.done = isDoneToday(SLUG)
    adSwapUsed = false
    drag = null
    Object.assign(state, createState(daily ? mulberry32(dailySeed()) : undefined))
  }

  // 모드를 바꾸면 딜이 달라져 반드시 새 판이 된다 — 놓던 판이 말없이 사라지지 않도록
  // 한 번 묻고, 바뀌는 모드가 무엇인지도 이 자리에서 설명한다
  const switchSheet = createSheet(
    shell.wrapper,
    `<p data-title class="gui-title"></p>
     <p data-desc class="gui-reason"></p>
     <p data-warn class="gui-sub"></p>
     <button data-go class="btn btn--go" type="button"></button>
     <button data-stay class="btn btn--ghost" type="button"></button>`,
  )

  const closeSwitch = (go: boolean) => {
    switchSheet.close()
    shell.resume()
    if (go) newGame(!hud.daily)
  }

  switchSheet.find('[data-go]')?.addEventListener('click', () => closeSwitch(true))
  switchSheet.find('[data-stay]')?.addEventListener('click', () => closeSwitch(false))

  function askSwitch() {
    const toDaily = !hud.daily
    const set = (selector: string, text: string) => {
      const node = switchSheet.find(selector)
      if (node) node.textContent = text
    }
    set('[data-title]', t(toDaily ? 'bb.toDaily' : 'bb.toFree'))
    set('[data-desc]', t(toDaily ? 'bb.toDailyDesc' : 'bb.toFreeDesc'))
    // 아직 한 칸도 안 놓았으면 잃을 판이 없다 — 겁줄 이유도 없다
    const warn = switchSheet.find('[data-warn]')
    if (warn) {
      warn.textContent = state.placedOnce ? t('bb.switchWarn') : ''
      warn.style.display = state.placedOnce ? '' : 'none'
    }
    set('[data-go]', t('bb.switchGo'))
    set('[data-stay]', t('bb.switchStay'))
    shell.pause()
    switchSheet.open()
  }

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'bb.ad',
    onRetry() {
      if (state.phase !== 'over') return
      newGame(hud.daily)
      overlay.hide()
    },
    onContinue() {
      void swapWithAd()
    },
  })

  // 광고 보상: 남은 블록을 소형 블록으로 교체하고 이어하기 (판당 1회)
  async function swapWithAd() {
    if (state.phase !== 'over' || adSwapUsed) return
    const rewarded = await ctx.showRewardAd('blockblast-swap')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adSwapUsed = true
    replaceTrayWithSmall(state)
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(state.score)
    hud.best = prevBest === null ? state.score : Math.max(prevBest, state.score)
    // 못 놓는 조각에 ×가 얹힌 화면을 잠깐 보여주고 팝업을 연다 — 왜 죽었는지 눈에 남게
    await new Promise((resolve) => setTimeout(resolve, 900))
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adSwapUsed, 'over.byStuck')
  }

  const hitTray = (x: number, y: number): number => {
    for (let i = 0; i < LAYOUT.traySlots.length; i++) {
      if (Math.abs(x - LAYOUT.traySlots[i]) <= 100 && Math.abs(y - LAYOUT.trayY) <= 100) return i
    }
    return -1
  }

  const detachInput = attachInput(renderer.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = renderer.toBoard(clientX, clientY)
      const chip = LAYOUT.modeChip
      if (
        p.x >= chip.x &&
        p.x <= chip.x + chip.w &&
        p.y >= chip.y &&
        p.y <= chip.y + chip.h
      ) {
        playSfx('select')
        askSwitch()
        return
      }
      const i = hitTray(p.x, p.y)
      if (i >= 0 && state.tray[i]) drag = { trayIndex: i, x: p.x, y: p.y }
    },
    onMove(clientX, clientY) {
      if (!drag) return
      const p = renderer.toBoard(clientX, clientY)
      drag.x = p.x
      drag.y = p.y
    },
    onUp() {
      if (!drag) return
      const current = drag
      drag = null
      const piece = state.tray[current.trayIndex]
      if (!piece || state.phase !== 'playing') return
      const { col, row } = dragTarget(piece, current.x, current.y)
      const result = placePiece(state, current.trayIndex, col, row)
      if (!result) return

      playSfx('select')
      const { w, h } = pieceSize(piece)
      const cx = LAYOUT.boardX + (col + w / 2) * LAYOUT.cell
      const cy = LAYOUT.boardY + (row + h / 2) * LAYOUT.cell
      state.popups.push({ x: cx, y: cy - 20, text: `+${result.gained}`, age: 0 })
      if (result.linesCleared > 0) {
        playSfx('pop', { rate: 1 + Math.min(3, result.linesCleared - 1) * 0.12 })
        vibrate(15)
        for (const cell of result.clearedCells) state.clearFx.push({ ...cell, age: 0 })
      }
      if (result.allClear) {
        playSfx('clear')
        vibrate(40)
        state.popups.push({
          x: LAYOUT.width / 2,
          y: LAYOUT.boardY + 220,
          text: t('bb.allClear'),
          age: 0,
        })
      }
      if (hud.daily && !hud.done && state.score >= DAILY.target) {
        hud.done = true
        hud.streak = recordDailyDone(SLUG)
        playSfx('clear', { rate: 1.2 })
        state.popups.push({
          x: LAYOUT.width / 2,
          y: LAYOUT.boardY + 320,
          text: t('daily.goalDone'),
          age: 0,
        })
      }
      if (result.gameOver) void gameOver()
    },
  })

  shell.addCleanup(detachInput)
  shell.addCleanup(() => renderer.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
