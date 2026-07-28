import { t } from '@/shared/i18n'
import { playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { drawHazard, drawRunner } from './sprites'
import { FIELD, GRAZE_POINTS, PLAYER_R, PLAYER_Y, createState, scoreOf, update } from './state'
import { drawScorePanel, font } from '../ui'

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    if (state.phase === 'playing') {
      const result = update(state, dt)
      if (result.grazed) {
        playSfx('whoosh', { gain: 0.6 })
        grazeFlash = 0.5
      }
      if (result.died) void gameOver()
    }
    grazeFlash = Math.max(0, grazeFlash - dt)
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  preloadSfx('gameover', 'whoosh')
  let adContinueUsed = false
  let grazeFlash = 0 // 스침 보너스 표시 잔상

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'dodge.ad',
    onRetry() {
      if (state.phase !== 'over') return
      adContinueUsed = false
      grazeFlash = 0
      Object.assign(state, createState())
      overlay.hide()
    },
    onContinue() {
      void continueWithAd()
    },
  })

  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('dodge_continue')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.rocks = []
    state.invuln = 2
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const score = scoreOf(state)
    const prevBest = await ctx.getBestScore()
    await ctx.submitScore(score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(score, prevBest, ctx.isRewardAdReady() && !adContinueUsed)
  }

  let moveDir = 0
  const movePlayer = (clientX: number, clientY: number) => {
    if (state.phase !== 'playing') return
    const p = stage.toBoard(clientX, clientY)
    const next = Math.min(FIELD.right - PLAYER_R, Math.max(FIELD.left + PLAYER_R, p.x))
    moveDir = Math.max(-1, Math.min(1, (next - state.playerX) / 24))
    state.playerX = next
  }

  const detachInput = attachInput(stage.canvas, {
    onDown: movePlayer,
    onMove: movePlayer,
    onUp() {},
  })

  const draw = () => {
    const c = stage.begin('#8B98A6', '#ECEFF1')

    // 어두워지는 하늘
    const sky = c.createLinearGradient(0, 0, 0, 1280)
    sky.addColorStop(0, '#C5CED6')
    sky.addColorStop(0.6, '#E4E9ED')
    sky.addColorStop(1, '#F5F7F8')
    c.fillStyle = sky
    c.fillRect(0, 0, 720, 1280)

    // 바닥
    c.fillStyle = '#B0BEC5'
    c.fillRect(0, PLAYER_Y + 52, 720, 1280 - PLAYER_Y - 52)
    c.fillStyle = '#90A4AE'
    c.fillRect(0, PLAYER_Y + 52, 720, 8)

    // 낙하물
    for (const rock of state.rocks) {
      drawHazard(c, rock.x, rock.y, rock.r, rock.kind, rock.spin)
    }

    // 플레이어 (사람 형체)
    const blink = state.invuln > 0 && Math.floor(state.invuln * 10) % 2 === 0
    c.save()
    if (blink) c.globalAlpha = 0.4
    drawRunner(c, state.playerX, PLAYER_Y, PLAYER_R, state.time, moveDir)
    c.restore()

    // HUD — 낙하물이 지나는 자리라 좁은 판을 쓴다
    drawScorePanel(c, {
      label: t('hud.score'),
      value: scoreOf(state).toLocaleString(),
      compact: true,
      panelColor: 'rgb(255 255 255 / 0.8)',
      labelColor: '#A6B4BC',
      valueColor: '#37474F',
    })

    // 스침 보너스 — 아슬아슬하게 피할수록 점수가 붙는다는 걸 그 자리에서 알려준다
    if (grazeFlash > 0) {
      c.save()
      c.globalAlpha = Math.min(1, grazeFlash * 2)
      c.fillStyle = '#F4511E'
      c.font = font(34, true)
      c.fillText(`+${GRAZE_POINTS}`, state.playerX, PLAYER_Y - 96 - (0.5 - grazeFlash) * 60)
      c.restore()
    }

    // 텍스트 없는 조작 안내: 좌우로 움직이는 표식
    if (state.time < 4 && state.phase === 'playing') {
      const hx = 360 + Math.sin(state.time * 2) * 150
      c.save()
      c.globalAlpha = 0.4
      c.strokeStyle = '#37474F'
      c.lineWidth = 3
      c.beginPath()
      c.arc(hx, PLAYER_Y - 130, 26, 0, Math.PI * 2)
      c.stroke()
      c.globalAlpha = 0.6
      c.fillStyle = '#37474F'
      c.beginPath()
      c.arc(hx, PLAYER_Y - 130, 14, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => scoreOf(state) }
}

export default defineGame(createSession)
