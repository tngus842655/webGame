import { ensureAdminChecked, isAdmin } from '@/shared/admin'
import { t } from '@/shared/i18n'
import { playDrop, playGameOver, playSfx, preloadSfx, vibrate } from '@/shared/sound'
import type { GameContext } from '../types'
import { createClearBonus } from '../clearBonus'
import { createGameOverOverlay } from '../overlay'
import { attachInput } from '../pointer'
import { createGameShell, defineGame } from '../shell'
import { CanvasStage } from '../stage'
import {
  applyFill,
  createState,
  loadPuzzle,
  puzzlePoints,
  toggleMark,
  type CellState,
  type Mode,
} from './state'
import { SCORE_PANEL, drawScorePanel, font } from '../ui'
import { drawIcon } from '../icons'
import { ground } from '../scene'

// 화면 배치 (논리 720×1280): 좌측·상단 힌트 영역 ~170px, 그리드는 정사각
const GRID_X = 190
const GRID_Y = 370
const GRID_W = 510
const BTN = { y: 1040, h: 150, w: 290, x1: 50, x2: 380 } as const
// 관리자 전용 건너뛰기 버튼 — 그리드 아래(880)와 모드 버튼(1040) 사이 빈 자리
const SKIP = { x: 50, y: 900, w: 620, h: 100 } as const

function createSession(host: HTMLElement, ctx: GameContext) {
  const shell = createGameShell(host, (dt) => {
    state.playTime += dt
    state.shakeTime = Math.max(0, state.shakeTime - dt)
    if (state.phase === 'clearing') {
      state.clearTimer -= dt
      if (state.clearTimer <= 0) {
        loadPuzzle(state, state.level + 1)
        state.phase = 'playing'
      }
    }
    if (state.phase === 'over' && state.overTimer > 0) {
      state.overTimer -= dt
      if (state.overTimer <= 0) void gameOver()
    }
    if (popup) {
      popup.age += dt
      if (popup.age > 1) popup = null
    }
    if (lostHeart) {
      lostHeart.age += dt
      if (lostHeart.age > 0.6) lostHeart = null
    }
    draw()
  })
  const stage = new CanvasStage(shell.wrapper, 720, 1280)
  const state = createState()
  // 홈을 거치지 않고 게임 주소로 바로 들어오면 아직 관리자 확인 전이다.
  // 결과는 캐시되므로 두 번 묻지 않고, 확인 전이나 일반 사용자는 isAdmin이 false라 버튼이 없다.
  void ensureAdminChecked()
  preloadSfx('clear', 'gameover', 'pop', 'tap')
  // 누르고 있는 동안 지나간 칸들. 확정은 손을 뗄 때 한 번에 하고, 격자 밖에서 떼면
  // 통째로 버린다. 10×10에서 한 칸이 5mm라 손가락이 칸을 통째로 덮어 이웃을 짚기 쉬운데,
  // 칠하기는 한 번 틀리면 생명이 깎이고 되돌릴 수 없다 — 떼기 전까지는 무를 수 있어야 한다.
  //
  // 첫 칸만 미루고 나머지는 즉시 칠하는 방식도 해봤지만 못 쓴다. 안쪽 칸에서 격자 밖으로
  // 빼려면 반드시 이웃 칸을 지나가야 해서, 그 순간 첫 칸이 확정돼 버린다. 정작 잘못
  // 짚기 쉬운 안쪽에서 취소가 안 되고 테두리 칸에서만 됐다.
  //
  // 잘못 취소되면 다시 그으면 그만이지만 잘못 확정되면 생명이 날아간다. 애매하면
  // 취소 쪽으로 기운다 — 격자 밖에서 떼면 버리는 것도 그래서다.
  let stroke: { mode: Mode; markValue: CellState; cells: number[] } | null = null
  // 지금 손끝이 짚고 있는 칸. 10×10에서 칸이 51px이라 손가락이 칸을 통째로 가린다 —
  // 줄 띠와 힌트 강조가 손 밖으로 삐져나와야 어디를 칠하는지 보인다.
  let aim: { row: number; col: number } | null = null
  let popup: { text: string; age: number } | null = null
  let lostHeart: { index: number; age: number } | null = null
  let adContinueUsed = false
  const bonus = createClearBonus(shell, ctx, 'nonogram-clear')

  const overlay = createGameOverOverlay(shell.wrapper, {
    adLabelKey: 'no.ad',
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

  // 광고 보상: 생명 1개를 받고 같은 퍼즐을 이어서 푼다 (판당 1회)
  async function continueWithAd() {
    if (state.phase !== 'over' || adContinueUsed) return
    const rewarded = await ctx.showRewardAd('nonogram-life')
    if (shell.isDestroyed() || !rewarded || state.phase !== 'over') return
    adContinueUsed = true
    state.lives = 1
    state.phase = 'playing'
    overlay.hide()
  }

  async function gameOver() {
    playGameOver()
    vibrate(120)
    const prevBest = await ctx.getBestScore()
    void ctx.submitScore(state.score)
    if (shell.isDestroyed() || state.phase !== 'over') return
    overlay.show(state.score, prevBest, ctx.isRewardAdReady() && !adContinueUsed, 'over.byLives')
  }

  const cellAt = (x: number, y: number) => {
    const cell = GRID_W / state.size
    const col = Math.floor((x - GRID_X) / cell)
    const row = Math.floor((y - GRID_Y) / cell)
    if (row < 0 || col < 0 || row >= state.size || col >= state.size) return null
    return { row, col }
  }

  // 한 칸 칠하기. 오답이거나 판이 끝나면 false — 획의 남은 칸은 적용하지 않는다.
  const fillOne = (row: number, col: number): boolean => {
    const result = applyFill(state, row, col)
    if (result === 'miss') {
      vibrate(60)
      state.shakeTime = 0.35
      state.lives -= 1
      lostHeart = { index: state.lives, age: 0 }
      if (state.lives <= 0) {
        state.phase = 'over'
        state.overTimer = 0.9
      }
      return false
    }
    if (result === 'filled') {
      playSfx('pop', { gain: 0.7 })
      if (state.remaining === 0) {
        void onPuzzleClear()
        return false
      }
    }
    return true
  }

  // 획을 확정한다. 지나간 칸을 순서대로 적용하고, 칠하기는 첫 오답에서 멈춘다.
  // (onPuzzleClear는 첫 await 전에 phase를 바꾸므로 이 반복 도중 판이 갈리지 않는다)
  const commitStroke = () => {
    if (!stroke) return
    const size = state.size
    if (stroke.mode === 'fill') {
      for (const key of stroke.cells) {
        if (!fillOne(Math.floor(key / size), key % size)) break
      }
      return
    }
    let changed = false
    for (const key of stroke.cells) {
      const row = Math.floor(key / size)
      const col = key % size
      const cur = state.cells[row][col]
      // 첫 칸과 같은 방향(표시/해제)으로만 적용한다. 이미 그 값이면 건너뛰므로
      // 같은 칸을 두 번 지나가도 도로 뒤집히지 않는다.
      if (stroke.markValue === 2 ? cur === 0 : cur === 2) {
        toggleMark(state, row, col)
        changed = true
      }
    }
    if (changed) playDrop()
  }

  const onPuzzleClear = async () => {
    let points = puzzlePoints(state.size) + state.lives * 100
    playSfx('clear')
    vibrate(30)
    state.phase = 'clearing'
    state.clearTimer = 1.4
    // 3판에 한 번만 묻는다 — 5×5는 20초면 끝나서 매 판 물으면 1분 반 사이에 세 번
    // 화면이 멈춘다. 보너스 시트는 광고를 안 봐도 닫아야 넘어가는 모달이라 잦으면
    // 그 자체가 방해고, 800점짜리 제안을 반복하면 '그냥 받기'가 습관이 되어 정작
    // 10×10 클리어의 좋은 제안까지 같이 닫힌다. 디펜스도 같은 이유로 5웨이브마다 묻는다.
    // 보너스를 묻는 동안 셸이 멈추므로 다음 퍼즐로 넘어가지 않는다
    if (state.level % 3 === 0 && (await bonus.offer(points))) points *= 2
    if (shell.isDestroyed()) return
    state.score = Math.min(1_000_000, state.score + points)
    popup = { text: `+${points}`, age: 0 }
  }

  const detachInput = attachInput(stage.canvas, {
    onDown(clientX, clientY) {
      if (state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      // 하단 모드 토글 버튼
      if (p.y >= BTN.y && p.y <= BTN.y + BTN.h) {
        if (p.x >= BTN.x1 && p.x <= BTN.x1 + BTN.w) {
          state.mode = 'fill'
          playDrop()
        } else if (p.x >= BTN.x2 && p.x <= BTN.x2 + BTN.w) {
          state.mode = 'mark'
          playDrop()
        }
        return
      }
      // 관리자 전용 건너뛰기 — 퍼즐 번호만 올린다. 점수도 기록도 건드리지 않으므로
      // 건너뛴 판의 점수는 붙지 않고, 이후 게임오버 시 실제로 번 점수만 등록된다.
      if (
        isAdmin.value &&
        p.x >= SKIP.x &&
        p.x <= SKIP.x + SKIP.w &&
        p.y >= SKIP.y &&
        p.y <= SKIP.y + SKIP.h
      ) {
        loadPuzzle(state, state.level + 1)
        stroke = null
        aim = null
        playDrop()
        return
      }
      const hit = cellAt(p.x, p.y)
      if (!hit) return
      // 여기서는 획을 시작만 한다. 확정은 손을 뗄 때(onUp) 한 번에.
      // 표시 방향은 첫 칸이 정한다 — 이미 X면 지우는 획, 아니면 표시하는 획.
      // 칠해진 칸에서 시작하는 X 획은 열지 않는다(그 칸은 바꿀 수 없다).
      const first = state.cells[hit.row][hit.col]
      if (state.mode === 'mark' && first === 1) return
      stroke = {
        mode: state.mode,
        markValue: first === 2 ? 0 : 2,
        cells: [hit.row * state.size + hit.col],
      }
      aim = hit
    },
    onMove(clientX, clientY) {
      if (!stroke || state.phase !== 'playing') return
      const p = stage.toBoard(clientX, clientY)
      const hit = cellAt(p.x, p.y)
      // 격자 밖으로 나가면 강조를 끈다 — 지금 떼면 아무 일도 없다는 표시다
      aim = hit
      if (!hit) return
      const key = hit.row * state.size + hit.col
      if (key !== stroke.cells[stroke.cells.length - 1]) stroke.cells.push(key)
    },
    onUp(clientX, clientY) {
      // 격자 안에서 떼야 확정된다. 밖에서 떼면 획을 통째로 버린다
      if (stroke && state.phase === 'playing') {
        const p = stage.toBoard(clientX, clientY)
        if (cellAt(p.x, p.y)) commitStroke()
      }
      stroke = null
      aim = null
    },
  })

  const draw = () => {
    const c = stage.begin(ground('#5C6BC0', '#141726'), ground('#E8EAF6', '#1D2136'))
    const size = state.size
    const cell = GRID_W / size
    const clearing = state.phase === 'clearing'

    // HUD: 흰 카드 + 점수 + 퍼즐 번호 + 하트
    drawScorePanel(c, {
      value: state.score.toLocaleString(),
      sub: true,
      panelColor: ground('rgb(255 255 255 / 0.92)', 'rgb(16 18 34 / 0.86)'),
      labelColor: ground('#9FA8DA', '#8A93C4'),
      valueColor: ground('#283593', '#D6DBFF'),
    })
    c.fillStyle = ground('#5C6BC0', '#9AA3D8')
    c.font = font(24)
    c.textAlign = 'left'
    c.fillText(t('no.puzzle', { n: state.level }), SCORE_PANEL.left, SCORE_PANEL.subY)
    c.textAlign = 'center'
    const heartX = (i: number) => 462 + i * 42
    for (let i = 0; i < 3; i++) {
      drawIcon(c, 'heart', heartX(i), SCORE_PANEL.subY - 8, 14, { dim: i >= state.lives })
    }
    if (lostHeart) {
      const k = lostHeart.age / 0.6
      drawIcon(c, 'heart', heartX(lostHeart.index), SCORE_PANEL.subY - 8 - k * 28, 14, {
        alpha: 1 - k,
      })
    }

    // 그리드 (오답 시 좌우 흔들림)
    c.save()
    if (state.shakeTime > 0) {
      c.translate(Math.sin(state.playTime * 70) * 8 * (state.shakeTime / 0.35), 0)
    }
    c.fillStyle = '#FFFFFF'
    c.fillRect(GRID_X, GRID_Y, GRID_W, GRID_W)

    // 짚고 있는 줄에 띠를 깐다 — 손가락 위아래로 삐져나와 어느 줄인지 알려 준다
    const spot = clearing ? null : aim
    if (spot) {
      c.fillStyle = 'rgb(92 107 192 / 0.12)'
      c.fillRect(GRID_X, GRID_Y + spot.row * cell, GRID_W, cell)
      c.fillRect(GRID_X + spot.col * cell, GRID_Y, cell, GRID_W)
    }

    const cross = (x: number, y: number) => {
      c.strokeStyle = '#B0BEC5'
      c.lineWidth = 4
      c.lineCap = 'round'
      const m = cell * 0.28
      c.beginPath()
      c.moveTo(x + m, y + m)
      c.lineTo(x + cell - m, y + cell - m)
      c.moveTo(x + cell - m, y + m)
      c.lineTo(x + m, y + cell - m)
      c.stroke()
    }

    // 확정 전 획. 손을 떼기 전까지는 아무것도 반영되지 않으므로, 지금 떼면 어떻게
    // 되는지 옅게 그려 준다 — 이게 없으면 긋는 동안 화면이 죽은 것처럼 보인다.
    const preview = stroke && !clearing ? new Set(stroke.cells) : null

    // 셀: 칠함 / X 표시 (완성 연출 중에는 그림만 남긴다)
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const st = state.cells[row][col]
        const x = GRID_X + col * cell
        const y = GRID_Y + row * cell
        if (st === 1) {
          c.fillStyle = '#303F9F'
          c.beginPath()
          c.roundRect(x + 2, y + 2, cell - 4, cell - 4, clearing ? cell * 0.18 : 4)
          c.fill()
        } else if (st === 2 && !clearing) {
          cross(x, y)
        }
        if (!preview?.has(row * size + col) || st === 1) continue
        c.save()
        c.globalAlpha = 0.45
        if (stroke!.mode === 'fill') {
          c.fillStyle = '#303F9F'
          c.beginPath()
          c.roundRect(x + 2, y + 2, cell - 4, cell - 4, 4)
          c.fill()
        } else if (stroke!.markValue === 2) {
          if (st === 0) cross(x, y)
        } else if (st === 2) {
          // 지워질 X를 흰 사각으로 덮어 미리 지워 보인다
          c.fillStyle = '#FFFFFF'
          c.fillRect(x + 2, y + 2, cell - 4, cell - 4)
        }
        c.restore()
      }
    }

    if (!clearing) {
      // 격자선: 5셀마다 굵은 구분선
      for (let i = 0; i <= size; i++) {
        const bold = i % 5 === 0 || i === size
        c.strokeStyle = bold ? '#5C6BC0' : '#C5CAE9'
        c.lineWidth = bold ? 3 : 1
        c.beginPath()
        c.moveTo(GRID_X + i * cell, GRID_Y)
        c.lineTo(GRID_X + i * cell, GRID_Y + GRID_W)
        c.moveTo(GRID_X, GRID_Y + i * cell)
        c.lineTo(GRID_X + GRID_W, GRID_Y + i * cell)
        c.stroke()
      }

      // 짚고 있는 칸 — 손끝이 덮어도 테두리 모서리는 보인다
      if (spot) {
        c.strokeStyle = '#FF6F00'
        c.lineWidth = 4
        c.beginPath()
        c.roundRect(
          GRID_X + spot.col * cell + 1,
          GRID_Y + spot.row * cell + 1,
          cell - 2,
          cell - 2,
          5,
        )
        c.stroke()
      }

      // 힌트 숫자 (완성한 줄은 회색 처리, 짚고 있는 줄은 주황)
      const hintSize = size === 5 ? 40 : size === 8 ? 32 : 27
      const gap = hintSize + 6
      c.font = font(hintSize, true)
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      for (let col = 0; col < size; col++) {
        const hints = state.colHints[col]
        // 다 맞힌 줄은 흐려져야 남은 줄이 눈에 들어온다. 어두운 판에서는
        // 그 관계가 뒤집히므로 밝기를 서로 바꿔 넣는다.
        c.fillStyle =
          spot?.col === col
            ? '#FF6F00'
            : state.colDone[col]
              ? ground('#B4BAD9', '#4E5478')
              : ground('#1A237E', '#AEB6E8')
        const cx = GRID_X + col * cell + cell / 2
        hints.forEach((n, i) => {
          c.fillText(String(n), cx, GRID_Y - 10 - gap / 2 - (hints.length - 1 - i) * gap)
        })
      }
      for (let row = 0; row < size; row++) {
        const hints = state.rowHints[row]
        c.fillStyle =
          spot?.row === row
            ? '#FF6F00'
            : state.rowDone[row]
              ? ground('#B4BAD9', '#4E5478')
              : ground('#1A237E', '#AEB6E8')
        const cy = GRID_Y + row * cell + cell / 2
        hints.forEach((n, i) => {
          c.fillText(String(n), GRID_X - 10 - gap / 2 - (hints.length - 1 - i) * gap, cy)
        })
      }
      c.textBaseline = 'alphabetic'
    }
    c.restore()

    // 점수 팝업
    if (popup) {
      c.save()
      c.globalAlpha = 1 - popup.age
      c.font = font(64, true)
      c.textAlign = 'center'
      c.lineWidth = 8
      c.strokeStyle = '#FFFFFF'
      c.fillStyle = '#FF6F00'
      c.strokeText(popup.text, GRID_X + GRID_W / 2, GRID_Y + GRID_W / 2 - popup.age * 50)
      c.fillText(popup.text, GRID_X + GRID_W / 2, GRID_Y + GRID_W / 2 - popup.age * 50)
      c.restore()
    }

    // 하단 모드 토글 버튼
    const drawButton = (x: number, label: string, active: boolean) => {
      c.save()
      c.fillStyle = active ? '#3949AB' : '#FFFFFF'
      c.strokeStyle = '#3949AB'
      c.lineWidth = 3
      c.beginPath()
      c.roundRect(x, BTN.y, BTN.w, BTN.h, 28)
      c.fill()
      c.stroke()
      c.fillStyle = active ? '#FFFFFF' : '#3949AB'
      c.font = font(40, true)
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(label, x + BTN.w / 2, BTN.y + BTN.h / 2)
      c.restore()
    }
    drawButton(BTN.x1, t('no.fill'), state.mode === 'fill')
    drawButton(BTN.x2, t('no.mark'), state.mode === 'mark')

    // 관리자 전용 건너뛰기. 게임 버튼과 헷갈리면 안 되므로 점선 테두리에 옅은 글씨로
    // 두어 '이건 개발용'이라는 게 눌러 보기 전에 보이게 한다.
    if (isAdmin.value) {
      c.save()
      c.strokeStyle = ground('#9FA8DA', '#4E5478')
      c.setLineDash([10, 8])
      c.lineWidth = 2
      c.beginPath()
      c.roundRect(SKIP.x, SKIP.y, SKIP.w, SKIP.h, 20)
      c.stroke()
      c.fillStyle = ground('#5C6BC0', '#9AA3D8')
      c.font = font(30)
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(t('admin.skipLevel'), SKIP.x + SKIP.w / 2, SKIP.y + SKIP.h / 2)
      c.restore()
    }
  }

  shell.addCleanup(detachInput)
  shell.addCleanup(() => stage.destroy())
  return { destroy: () => shell.destroy(), getScore: () => state.score }
}

export default defineGame(createSession)
