// 벽돌깨기를 화면 없이 돌려 밸런스를 잰다.
// GAME_BALANCE.md 3장의 숫자가 여기서 나온다. 상수를 만질 때마다 손으로 100판을
// 해 볼 수는 없어서 만들었다.
//
//   node tools/brick-sim.mjs               정책 넷을 16판씩
//   node tools/brick-sim.mjs 100           판 수 지정
//   node tools/brick-sim.mjs 40 sweep      아이템 확률 × HP 성장률 격자 탐색
//
// config.ts·state.ts 는 게임 코드를 그대로 불러 쓰므로 상수를 고치면 바로 반영된다.
// 다만 공 물리와 턴 진행은 index.ts 를 옮겨 적은 것이다 —
// index.ts 의 moveBall / collideBricks / update 를 고치면 여기도 같이 고쳐야 한다.

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// node 의 ESM 은 확장자를 생략한 import 를 못 찾는다. 임시 폴더에 확장자만 붙여
// 복사한 뒤 불러온다 (타입은 node 가 알아서 걷어낸다).
async function loadGameModules() {
  const dir = mkdtempSync(join(tmpdir(), 'brick-sim-'))
  for (const name of ['config', 'state']) {
    const src = readFileSync(`src/games/brick/${name}.ts`, 'utf8')
    writeFileSync(join(dir, `${name}.ts`), src.replace(/from '\.\/(\w+)'/g, "from './$1.ts'"))
  }
  return {
    config: await import(join(dir, 'config.ts')),
    state: await import(join(dir, 'state.ts')),
  }
}

const { config, state: stateMod } = await loadGameModules()
const { BALL, COL_W, LAYOUT, MIN_AIM_TAN, WAVE, brickRect } = config
const { advanceWave, createState } = stateMod

const DT = 1 / 60
const TURN_CAP = 60 // 초. 넘으면 턴이 안 끝난 것으로 본다

function explode(state, bomb) {
  for (const b of [...state.bricks]) {
    if (Math.abs(b.col - bomb.col) > 1 || Math.abs(b.row - bomb.row) > 1) continue
    b.hp -= bomb.maxHp
    if (b.hp <= 0) breakBrick(state, b)
  }
}

function breakBrick(state, brick) {
  const index = state.bricks.indexOf(brick)
  if (index < 0) return
  state.bricks.splice(index, 1)
  state.score += Math.ceil(brick.maxHp / 7)
  if (brick.kind === 'item') state.attack += 1
  else if (brick.kind === 'bomb') explode(state, brick)
}

function damageBrick(state, index) {
  const brick = state.bricks[index]
  brick.hp -= state.attack
  if (brick.hp <= 0) breakBrick(state, brick)
}

function collideBricks(state, ball) {
  for (let i = 0; i < state.bricks.length; i++) {
    const r = brickRect(state.bricks[i].col, state.bricks[i].row)
    const nx = Math.min(Math.max(ball.x, r.x), r.x + r.w)
    const ny = Math.min(Math.max(ball.y, r.y), r.y + r.h)
    const dx = ball.x - nx
    const dy = ball.y - ny
    if (dx * dx + dy * dy > BALL.radius * BALL.radius) continue
    if (Math.abs(dx) > Math.abs(dy)) ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx)
    else ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy)
    damageBrick(state, i)
    break
  }
}

function moveBall(state, ball, dt) {
  let remaining = BALL.speed * dt
  while (remaining > 0 && ball.active) {
    const d = Math.min(BALL.step, remaining)
    remaining -= d
    const len = Math.hypot(ball.vx, ball.vy) || 1
    ball.x += (ball.vx / len) * d
    ball.y += (ball.vy / len) * d

    if (ball.x < LAYOUT.fieldLeft + BALL.radius) {
      ball.x = LAYOUT.fieldLeft + BALL.radius
      ball.vx = Math.abs(ball.vx)
    } else if (ball.x > LAYOUT.fieldRight - BALL.radius) {
      ball.x = LAYOUT.fieldRight - BALL.radius
      ball.vx = -Math.abs(ball.vx)
    }
    if (ball.y < LAYOUT.fieldTop + BALL.radius) {
      ball.y = LAYOUT.fieldTop + BALL.radius
      ball.vy = Math.abs(ball.vy)
    }
    if (ball.vy > 0 && ball.y >= LAYOUT.launchY) {
      ball.active = false
      if (state.firstLandedX === null) state.firstLandedX = ball.x
      break
    }
    collideBricks(state, ball)
  }
}

// 한 턴을 끝까지 굴린다 → [흐른 시간(초), 게임오버 여부]
function playTurn(state, aim) {
  state.aim = aim
  state.toLaunch = BALL.count
  state.launchTimer = 0
  state.phase = 'flying'
  let time = 0

  while (time < TURN_CAP) {
    time += DT
    if (state.toLaunch > 0 && state.aim) {
      state.launchTimer -= DT
      if (state.launchTimer <= 0) {
        state.launchTimer = BALL.launchInterval
        state.balls.push({
          x: state.launchX,
          y: LAYOUT.launchY,
          vx: state.aim.dx * BALL.speed,
          vy: state.aim.dy * BALL.speed,
          active: true,
        })
        state.toLaunch -= 1
      }
    }
    for (const ball of state.balls) if (ball.active) moveBall(state, ball, DT)

    if (state.toLaunch === 0 && state.balls.every((b) => !b.active)) {
      state.balls = []
      state.aim = null
      if (state.firstLandedX !== null) {
        state.launchX = Math.min(
          LAYOUT.fieldRight - BALL.radius,
          Math.max(LAYOUT.fieldLeft + BALL.radius, state.firstLandedX),
        )
      }
      state.firstLandedX = null
      return [time, advanceWave(state)]
    }
  }
  return [time, false] // 턴이 안 끝났다
}

// index.ts 의 setAim 과 같은 규칙 — 목표점을 향하되 최소 각도로 붙인다
function aimAt(state, px, py) {
  const dx = px - state.launchX
  const dy = py - LAYOUT.launchY
  const ay = Math.min(dy, -Math.abs(dx) * MIN_AIM_TAN)
  const len = Math.hypot(dx, ay)
  return { dx: dx / len, dy: ay / len }
}

// 격자 위에서 공 하나를 굴려 몇 칸을 스치는지 센다. 벽돌은 부서지지 않는다고 보고
// 반사만 시킨다 — 주머니에 갇혀 오래 튕기는 경로를 알아보려면 반사가 있어야 한다.
// 실제 물리의 근사다. 정책이 쓸 만큼만 맞으면 된다.
function countHits(state, aim) {
  const occupied = new Set()
  for (const b of state.bricks) occupied.add(b.row * LAYOUT.cols + b.col)

  const cellOf = (x, y) =>
    Math.floor((y - LAYOUT.fieldTop) / LAYOUT.rowH) * LAYOUT.cols +
    Math.floor((x - LAYOUT.fieldLeft) / COL_W)

  let x = state.launchX
  let y = LAYOUT.launchY
  let { dx, dy } = aim
  const step = 12
  const seen = new Set()
  let col = Math.floor((x - LAYOUT.fieldLeft) / COL_W)
  let row = -1

  for (let i = 0; i < 400; i++) {
    let nx = x + dx * step
    let ny = y + dy * step
    if (nx < LAYOUT.fieldLeft) {
      nx = LAYOUT.fieldLeft
      dx = -dx
    } else if (nx > LAYOUT.fieldRight) {
      nx = LAYOUT.fieldRight
      dx = -dx
    }
    if (ny < LAYOUT.fieldTop) {
      ny = LAYOUT.fieldTop
      dy = -dy
    }
    if (ny > LAYOUT.launchY) break

    const key = cellOf(nx, ny)
    if (occupied.has(key)) {
      seen.add(key)
      // 어느 면으로 들어왔는지로 꺾을 축을 고르고, 칸에는 들어가지 않는다
      const nc = key % LAYOUT.cols
      const nr = (key - nc) / LAYOUT.cols
      if (nc !== col && nr !== row) {
        if (Math.abs(dx) > Math.abs(dy)) dx = -dx
        else dy = -dy
      } else if (nc !== col) dx = -dx
      else dy = -dy
      continue
    }
    x = nx
    y = ny
    col = key % LAYOUT.cols
    row = (key - col) / LAYOUT.cols
  }
  return seen.size
}

// 사람의 성장 단계를 흉내 낸 결정적 정책들 (GAME_BALANCE.md 1.1)
const policies = {
  초보: () => ({ dx: 0, dy: -1 }),

  무작위: (s) => aimAt(s, Math.random() * LAYOUT.width, Math.random() * LAYOUT.launchY),

  입문: (s) => {
    let target = s.bricks[0]
    for (const b of s.bricks) if (b.row > target.row) target = b
    const r = brickRect(target.col, target.row)
    return aimAt(s, r.x + r.w / 2, r.y + r.h / 2)
  },

  // 각도는 45° 이상으로 묶고 위치만 고른다. 눕히지 않고도 잘 쏘면 이길 수 있는가 —
  // 조준 판단에 값어치가 있는지를 재는 계단이다.
  정밀: (s) => {
    let best = { dx: 0, dy: -1 }
    let bestHits = -1
    for (const sign of [-1, 1]) {
      for (let deg = 45; deg <= 90; deg += 5) {
        const rad = (deg * Math.PI) / 180
        const aim = { dx: sign * Math.cos(rad), dy: -Math.sin(rad) }
        const hits = countHits(s, aim)
        if (hits > bestHits) {
          bestHits = hits
          best = aim
        }
      }
    }
    return best
  },

  상급: (s) => {
    const toRight = LAYOUT.fieldRight - s.launchX > s.launchX - LAYOUT.fieldLeft
    return aimAt(s, toRight ? LAYOUT.fieldRight + 4000 : LAYOUT.fieldLeft - 4000, 0)
  },
}

function playRun(policy, maxTurns = 2000) {
  const state = createState()
  let seconds = 0
  let over = false
  let stalled = false
  for (let turn = 0; turn < maxTurns; turn++) {
    const [t, dead] = playTurn(state, policy(state))
    seconds += t
    if (t >= TURN_CAP) {
      stalled = true
      break
    }
    if (dead) {
      over = true
      break
    }
  }
  return { wave: state.wave, score: state.score, attack: state.attack, seconds, over, stalled }
}

function stats(xs) {
  const sorted = [...xs].sort((a, b) => a - b)
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length)
  return { mean, median: sorted[Math.floor(sorted.length / 2)], cv: mean === 0 ? 0 : sd / mean }
}

const runs = Number(process.argv[2] ?? 16)

if (process.argv[3] === 'sweep') {
  // 아이템 확률 × HP 성장률. 조건: 전부 게임오버 · 25~90웨이브 · 180초 이내 · 배수 1.3 이하
  console.log(`정상 플레이(정밀) 기준 · 조합마다 ${runs}판씩\n`)
  console.log('HP성장  아이템   웨이브  최장(초)  배수(중앙값)  게임오버  흔들림  판정')
  for (const hp of [0.85, 1, 1.15]) {
    for (const item of [0.05, 0.06, 0.07, 0.08]) {
      WAVE.hpGrowth = hp
      WAVE.itemChance = item
      const normal = Array.from({ length: runs }, () => playRun(policies['정밀']))
      const flat = Array.from({ length: runs }, () => playRun(policies['상급']))
      const all = [...normal, ...flat]
      const ns = stats(normal.map((r) => r.score))
      const fs = stats(flat.map((r) => r.score))
      const wave = stats(normal.map((r) => r.wave)).mean
      const secs = Math.max(...all.map((r) => r.seconds))
      const ratio = ns.median === 0 ? Infinity : fs.median / ns.median
      const overs = all.filter((r) => r.over).length
      const ok =
        overs === runs * 2 && wave >= 25 && wave <= 90 && secs <= 180 && ratio <= 1.3
      console.log(
        `${hp.toFixed(2).padStart(6)}  ${item.toFixed(2).padStart(6)}  ${wave.toFixed(0).padStart(6)}  ` +
          `${secs.toFixed(0).padStart(8)}  ${ratio.toFixed(2).padStart(12)}  ` +
          `${`${overs}/${runs * 2}`.padStart(8)}  ${`${(ns.cv * 100).toFixed(0)}%`.padStart(6)}  ${ok ? '통과' : ''}`,
      )
    }
  }
} else {
  console.log(`정책마다 ${runs}판\n`)
  console.log('계단     점수(중앙값)   웨이브   공격력  한 판(초)  게임오버  흔들림')
  const median = {}
  for (const [name, policy] of Object.entries(policies)) {
    const r = Array.from({ length: runs }, () => playRun(policy))
    const score = stats(r.map((x) => x.score))
    const wave = stats(r.map((x) => x.wave))
    const secs = stats(r.map((x) => x.seconds))
    const atk = stats(r.map((x) => x.attack))
    const stalls = r.filter((x) => x.stalled).length
    median[name] = score.median
    console.log(
      `${name.padEnd(7)} ${Math.round(score.median).toString().padStart(12)} ` +
        `${wave.mean.toFixed(0).padStart(8)} ${atk.mean.toFixed(1).padStart(8)} ` +
        `${secs.mean.toFixed(0).padStart(10)} ${`${r.filter((x) => x.over).length}/${runs}`.padStart(9)} ` +
        `${(score.cv * 100).toFixed(0).padStart(6)}%` +
        (stalls ? `  (턴 안 끝남 ${stalls})` : ''),
    )
  }
  // 눕혀 쏘기가 '잘 쏘기'를 얼마나 이기는지가 본 지표다.
  // 입문 대비는 예전 표와 이어 보려고 같이 찍는다.
  console.log(`\n배수(상급 / 정밀, 중앙값) = ${(median['상급'] / median['정밀']).toFixed(2)}`)
  console.log(`배수(상급 / 입문, 중앙값) = ${(median['상급'] / median['입문']).toFixed(2)}`)
}
