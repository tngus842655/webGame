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
    adButtonLabel: '▶ 광고 보고 이어하기',
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
    const c = stage.begin('#FFE0B2', '#FFF8E1')

    // 낙하물
    for (const rock of state.rocks) {
      c.fillStyle = '#78909C'
      c.beginPath()
      c.arc(rock.x, rock.y, rock.r, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = 'rgb(0 0 0 / 0.15)'
      c.beginPath()
      c.arc(rock.x - rock.r * 0.3, rock.y - rock.r * 0.25, rock.r * 0.25, 0, Math.PI * 2)
      c.fill()
    }

    // 플레이어 (무적 중엔 깜빡임)
    const blink = state.invuln > 0 && Math.floor(state.invuln * 10) % 2 === 0
    c.globalAlpha = blink ? 0.35 : 1
    c.fillStyle = '#42A5F5'
    c.beginPath()
    c.arc(state.playerX, PLAYER_Y, PLAYER_R, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#0D2C45'
    c.beginPath()
    c.arc(state.playerX - 9, PLAYER_Y - 6, 4.5, 0, Math.PI * 2)
    c.arc(state.playerX + 9, PLAYER_Y - 6, 4.5, 0, Math.PI * 2)
    c.fill()
    c.globalAlpha = 1

    // HUD
    c.textAlign = 'center'
    c.fillStyle = '#BCAAA4'
    c.font = '22px sans-serif'
    c.fillText('점수', 360, 60)
    c.fillStyle = '#5D4037'
    c.font = 'bold 52px sans-serif'
    c.fillText(scoreOf(state).toLocaleString(), 360, 118)

    if (state.time < 3 && state.phase === 'playing') {
      c.fillStyle = '#8D6E63'
      c.font = '26px sans-serif'
      c.fillText('드래그로 좌우 이동!', 360, 600)
      c.fillText('떨어지는 돌을 피해 버티세요', 360, 640)
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return shell
}

export default defineGame(createSession)
