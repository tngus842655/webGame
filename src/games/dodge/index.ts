import { playGameOver, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import { FIELD, PLAYER_R, PLAYER_Y, createState, scoreOf, update } from './state'

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    if (state.phase === 'playing' && update(state, dt)) void gameOver()
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  let adContinueUsed = false

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'dodge.ad',
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

  const movePlayer = (clientX: number, clientY: number) => {
    if (state.phase !== 'playing') return
    const p = stage.toBoard(clientX, clientY)
    state.playerX = Math.min(FIELD.right - PLAYER_R, Math.max(FIELD.left + PLAYER_R, p.x))
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

    // 낙하물 (회전하는 돌)
    for (const rock of state.rocks) {
      c.save()
      c.translate(rock.x, rock.y)
      c.rotate(rock.x * 0.02 + rock.y * 0.01)
      const grad = c.createRadialGradient(-rock.r * 0.3, -rock.r * 0.35, rock.r * 0.1, 0, 0, rock.r)
      grad.addColorStop(0, '#90A4AE')
      grad.addColorStop(0.6, '#607D8B')
      grad.addColorStop(1, '#37474F')
      c.fillStyle = grad
      c.beginPath()
      // 각진 바위 실루엣
      const sides = 7
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2
        const rad = rock.r * (0.82 + ((i * 37) % 10) / 40)
        const px = Math.cos(a) * rad
        const py = Math.sin(a) * rad
        if (i === 0) c.moveTo(px, py)
        else c.lineTo(px, py)
      }
      c.closePath()
      c.fill()
      c.strokeStyle = 'rgb(38 50 56 / 0.35)'
      c.lineWidth = 2
      c.stroke()
      c.restore()
    }

    // 플레이어 (방패를 든 캐릭터)
    const blink = state.invuln > 0 && Math.floor(state.invuln * 10) % 2 === 0
    c.save()
    if (blink) c.globalAlpha = 0.4
    c.fillStyle = 'rgb(0 0 0 / 0.15)'
    c.beginPath()
    c.ellipse(state.playerX, PLAYER_Y + 44, PLAYER_R * 0.9, 9, 0, 0, Math.PI * 2)
    c.fill()

    const body = c.createRadialGradient(
      state.playerX - PLAYER_R * 0.3,
      PLAYER_Y - PLAYER_R * 0.35,
      PLAYER_R * 0.1,
      state.playerX,
      PLAYER_Y,
      PLAYER_R,
    )
    body.addColorStop(0, '#90CAF9')
    body.addColorStop(0.55, '#42A5F5')
    body.addColorStop(1, '#1565C0')
    c.fillStyle = body
    c.beginPath()
    c.arc(state.playerX, PLAYER_Y, PLAYER_R, 0, Math.PI * 2)
    c.fill()

    // 머리 위 방패
    c.fillStyle = '#FFC107'
    c.beginPath()
    c.moveTo(state.playerX - 22, PLAYER_Y - PLAYER_R - 6)
    c.lineTo(state.playerX + 22, PLAYER_Y - PLAYER_R - 6)
    c.lineTo(state.playerX, PLAYER_Y - PLAYER_R + 16)
    c.closePath()
    c.fill()

    c.fillStyle = '#0D2C45'
    c.beginPath()
    c.ellipse(state.playerX - 9, PLAYER_Y - 2, 4, 5.5, 0, 0, Math.PI * 2)
    c.ellipse(state.playerX + 9, PLAYER_Y - 2, 4, 5.5, 0, 0, Math.PI * 2)
    c.fill()
    c.restore()

    // HUD
    c.textAlign = 'center'
    c.save()
    c.fillStyle = '#FFFFFF'
    c.globalAlpha = 0.8
    c.beginPath()
    c.roundRect(240, 34, 240, 88, 24)
    c.fill()
    c.restore()
    c.fillStyle = '#37474F'
    c.font = 'bold 52px sans-serif'
    c.fillText(scoreOf(state).toLocaleString(), 360, 96)

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
  return shell
}

export default defineGame(createSession)
