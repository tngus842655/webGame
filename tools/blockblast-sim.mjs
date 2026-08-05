// 블록퍼즐을 화면 없이 돌려 밸런스를 잰다.
// GAME_BALANCE.md 5장의 숫자가 여기서 나온다. 방법은 1장(정책 계단 + 점수 분해 + 죽음 부검).
//
//   node tools/blockblast-sim.mjs               정책 넷을 200판씩
//   node tools/blockblast-sim.mjs 100           판 수 지정
//   node tools/blockblast-sim.mjs 100 ramp      딜 변형 (base | fairdeal | ramp)
//   node tools/blockblast-sim.mjs 100 base 초보,입문   정책 골라 돌리기
//
// config.ts·state.ts는 게임 코드를 그대로 불러 쓰므로 상수를 고치면 바로 반영된다.
// 정책(초보~상급)은 사람의 성장 단계를 흉내 낸 이 파일의 것이다 — 상급은 빔서치라
// 사람 상한의 근사로만 읽을 것.
//
// 변형 둘은 측정용 후보다 (게임 코드에는 없다):
//   fairdeal  새 트레이 셋 다 놓을 곳이 없으면 리롤 — 측정 결과 효과 없음 (즉사 딜이 1~4%뿐)
//   ramp      진행할수록 소형 가중치↓ 대형↑ — 첫 판 수명 +46%, 상급 마라톤 78분 → 27분

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function loadGameModules() {
  const dir = mkdtempSync(join(tmpdir(), 'bb-sim-'))
  for (const name of ['config', 'state']) {
    const src = readFileSync(`src/games/blockblast/${name}.ts`, 'utf8')
    writeFileSync(join(dir, `${name}.ts`), src.replace(/from '\.\/(\w+)'/g, "from './$1.ts'"))
  }
  return {
    config: await import(join(dir, 'config.ts')),
    state: await import(join(dir, 'state.ts')),
  }
}

const { config, state: stateMod } = await loadGameModules()
const { GRID, SHAPES, SCORING, COLORS } = config
const { createState, fits, placePiece } = stateMod

// ── 순수 헬퍼 (탐색용 — 게임 상태를 건드리지 않는다) ───────────────

function fullLines(grid) {
  const rows = []
  const cols = []
  for (let r = 0; r < GRID; r++) {
    let full = true
    for (let c = 0; c < GRID; c++) if (grid[r * GRID + c] === 0) { full = false; break }
    if (full) rows.push(r)
  }
  for (let c = 0; c < GRID; c++) {
    let full = true
    for (let r = 0; r < GRID; r++) if (grid[r * GRID + c] === 0) { full = false; break }
    if (full) cols.push(c)
  }
  return { rows, cols }
}

function applySim(grid, piece, col, row) {
  const g = grid.slice()
  for (const [dx, dy] of piece.shape.cells) g[(row + dy) * GRID + (col + dx)] = piece.color + 1
  const { rows, cols } = fullLines(g)
  for (const r of rows) for (let x = 0; x < GRID; x++) g[r * GRID + x] = 0
  for (const c of cols) for (let y = 0; y < GRID; y++) g[y * GRID + c] = 0
  return { g, lines: rows.length + cols.length }
}

function anyFit(grid, piece) {
  for (let row = 0; row < GRID; row++)
    for (let col = 0; col < GRID; col++)
      if (fits(grid, piece, col, row)) return true
  return false
}

function allPlacements(grid, piece) {
  const out = []
  for (let row = 0; row < GRID; row++)
    for (let col = 0; col < GRID; col++)
      if (fits(grid, piece, col, row)) out.push([col, row])
  return out
}

// 보드 평가 (중급·상급용): 구멍(사방이 막힌 빈칸)과 표면 거칠기를 벌점, 빈칸을 가점.
// 주의 — '거의 찬 줄 가점' 류를 넣으면 계단이 뒤집힌다 (7칸 채우고 못 끝내는 줄을 양산).
function evalBoard(grid) {
  let holes = 0
  let empty = 0
  let edge = 0
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const filled = grid[r * GRID + c] !== 0
      if (!filled) {
        empty++
        const blocked =
          (r === 0 || grid[(r - 1) * GRID + c] !== 0) &&
          (r === GRID - 1 || grid[(r + 1) * GRID + c] !== 0) &&
          (c === 0 || grid[r * GRID + c - 1] !== 0) &&
          (c === GRID - 1 || grid[r * GRID + c + 1] !== 0)
        if (blocked) holes++
        continue
      }
      if (r > 0 && grid[(r - 1) * GRID + c] === 0) edge++
      if (r < GRID - 1 && grid[(r + 1) * GRID + c] === 0) edge++
      if (c > 0 && grid[r * GRID + c - 1] === 0) edge++
      if (c < GRID - 1 && grid[r * GRID + c + 1] === 0) edge++
    }
  }
  return -14 * holes - 1.5 * edge + 1.2 * empty
}

// 벽·기존 블록에 붙는 정도 (입문용 — "구석부터 차곡차곡")
function adjacency(grid, piece, col, row) {
  let n = 0
  for (const [dx, dy] of piece.shape.cells) {
    const r = row + dy
    const c = col + dx
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      if (nr < 0 || nc < 0 || nr >= GRID || nc >= GRID) n++
      else if (grid[nr * GRID + nc] !== 0) n++
    }
  }
  return n
}

// ── 정책 계단 ──────────────────────────────────────────────────────

// 초보: 트레이 순서대로, 처음 맞는 칸에 놓는다 (규칙만 안다)
function policyNovice(state) {
  for (let i = 0; i < state.tray.length; i++) {
    const piece = state.tray[i]
    if (!piece) continue
    for (let row = 0; row < GRID; row++)
      for (let col = 0; col < GRID; col++)
        if (fits(state.grid, piece, col, row)) return { trayIndex: i, col, row }
  }
  return null
}

// 입문: 트레이 순서대로. 지금 줄이 지워지면 최우선, 아니면 구석에 붙여 쌓는다
function policyBeginner(state) {
  for (let i = 0; i < state.tray.length; i++) {
    const piece = state.tray[i]
    if (!piece) continue
    let best = null
    let bestKey = -Infinity
    for (const [col, row] of allPlacements(state.grid, piece)) {
      const { lines } = applySim(state.grid, piece, col, row)
      const key = lines * 1000 + adjacency(state.grid, piece, col, row)
      if (key > bestKey) { bestKey = key; best = { trayIndex: i, col, row } }
    }
    if (best) return best
  }
  return null
}

// 중급: 세 조각 중 아무거나, 1수 탐욕 — 줄 클리어 우선 + 보드를 매끈하게 유지
function policyIntermediate(state) {
  let best = null
  let bestKey = -Infinity
  for (let i = 0; i < state.tray.length; i++) {
    const piece = state.tray[i]
    if (!piece) continue
    for (const [col, row] of allPlacements(state.grid, piece)) {
      const { g, lines } = applySim(state.grid, piece, col, row)
      const key = 300 * lines + evalBoard(g)
      if (key > bestKey) { bestKey = key; best = { trayIndex: i, col, row } }
    }
  }
  return best
}

// 상급: 남은 트레이 전체(최대 3개, 순서 자유)를 빔서치로 계획한다
const BEAM = 8
function policyAdvanced(state) {
  let beams = [{ grid: state.grid, used: 0, gained: 0, streak: state.streak, first: null, key: 0 }]
  const indices = []
  for (let i = 0; i < state.tray.length; i++) if (state.tray[i]) indices.push(i)
  for (let depth = 0; depth < indices.length; depth++) {
    const next = []
    for (const b of beams) {
      for (const i of indices) {
        if (b.used & (1 << i)) continue
        const piece = state.tray[i]
        for (const [col, row] of allPlacements(b.grid, piece)) {
          const { g, lines } = applySim(b.grid, piece, col, row)
          const streak = lines > 0 ? b.streak + 1 : 0
          const gained =
            b.gained +
            SCORING.perCell * piece.shape.cells.length +
            (lines > 0 ? SCORING.lineBase * lines * lines + (streak - 1) * SCORING.streakBonus : 0)
          next.push({
            grid: g,
            used: b.used | (1 << i),
            gained,
            streak,
            first: b.first ?? { trayIndex: i, col, row },
            key: gained + 3 * evalBoard(g),
          })
        }
      }
      // 이 조각을 어디에도 못 놓는 빔은 여기서 끊긴다 — 부분 계획도 후보로 남긴다
      if (next.length === 0) next.push(b)
    }
    next.sort((a, b2) => b2.key - a.key)
    beams = next.slice(0, BEAM)
  }
  return beams[0]?.first ?? null
}

const POLICIES = [
  ['초보', policyNovice],
  ['입문', policyBeginner],
  ['중급', policyIntermediate],
  ['상급', policyAdvanced],
]

// ── 딜 변형 ────────────────────────────────────────────────────────

// ramp: p=0(시작) 소형 ×1.6·대형 ×0.5 → p=1(150배치) 소형 ×0.8·대형 ×1.5
function weightedShape(progress) {
  const w = SHAPES.map((s) => {
    if (progress === undefined) return s.weight
    const size = s.cells.length
    if (size <= 3) return s.weight * (1.6 - 0.8 * progress)
    if (size >= 5) return s.weight * (0.5 + 1.0 * progress)
    return s.weight
  })
  const total = w.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < SHAPES.length; i++) {
    r -= w[i]
    if (r < 0) return SHAPES[i]
  }
  return SHAPES[0]
}
const randomPiece = (progress) => ({
  shape: weightedShape(progress),
  color: Math.floor(Math.random() * COLORS.length),
})

function dealTray(grid, variant, placements = 0) {
  const progress = variant === 'ramp' ? Math.min(1, placements / 150) : undefined
  const deal = () => [randomPiece(progress), randomPiece(progress), randomPiece(progress)]
  let tray = deal()
  if (variant === 'fairdeal') {
    for (let t = 0; t < 30 && !tray.some((p) => anyFit(grid, p)); t++) tray = deal()
  }
  return tray
}

// ── 한 판 ──────────────────────────────────────────────────────────

const PLACE_CAP = 2000 // ≈83분. 상급이 여기 걸리는 비율이 '안 끝나는 게임'의 크기다

function playGame(policy, variant) {
  const state = createState()
  state.tray = dealTray(state.grid, variant)

  const m = {
    score: 0, placements: 0, clears1: 0, clears2: 0, clears3: 0,
    perCell: 0, lineScore: 0, streakScore: 0, allClearScore: 0, maxStreak: 0,
    allClears: 0, freshDeals: 1,
    deathEmpty: 0, deathShapesFit: 0, deathAtFreshDeal: false, capped: false,
  }

  while (state.phase === 'playing' && m.placements < PLACE_CAP) {
    const move = policy(state)
    if (!move) break
    const piece = state.tray[move.trayIndex]
    const cells = piece.shape.cells.length
    const trayBefore = state.tray.filter(Boolean).length

    const result = placePiece(state, move.trayIndex, move.col, move.row)
    if (!result) throw new Error('정책이 놓을 수 없는 수를 골랐다')
    m.placements++

    // 점수 분해 (state.ts의 채점식 그대로 역산)
    const lines = result.linesCleared
    m.perCell += SCORING.perCell * cells
    if (lines > 0) {
      m.lineScore += SCORING.lineBase * lines * lines
      if (result.allClear) m.allClearScore += SCORING.allClear
      m.streakScore +=
        result.gained -
        SCORING.perCell * cells -
        SCORING.lineBase * lines * lines -
        (result.allClear ? SCORING.allClear : 0)
      if (lines === 1) m.clears1++
      else if (lines === 2) m.clears2++
      else m.clears3++
      if (result.allClear) m.allClears++
    }
    m.maxStreak = Math.max(m.maxStreak, state.streak)

    // 엔진이 트레이를 다시 채웠다면 (마지막 조각을 놓은 직후) 변형 딜로 교체
    if (trayBefore === 1) {
      m.freshDeals++
      state.tray = dealTray(state.grid, variant, m.placements)
      const alive = state.tray.some((p) => anyFit(state.grid, p))
      if (!alive) {
        m.deathAtFreshDeal = true
        state.phase = 'over'
      } else state.phase = 'playing'
    }
  }
  if (m.placements >= PLACE_CAP) m.capped = true

  // 죽음 부검: 그 순간 보드가 얼마나 비어 있었고, 22종 중 몇 종은 놓을 수 있었나
  m.score = state.score
  m.deathEmpty = state.grid.filter((v) => v === 0).length
  m.deathShapesFit = SHAPES.filter((s) => anyFit(state.grid, { shape: s, color: 0 })).length
  return m
}

// ── 통계 ───────────────────────────────────────────────────────────

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length
const sd = (a) => {
  const m = mean(a)
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)))
}
const pct = (a, p) => {
  const s = [...a].sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}

const games = Number(process.argv[2] ?? 200)
const variant = process.argv[3] ?? 'base'
const only = process.argv[4]?.split(',')

console.log(`정책 4단 × ${games}판, 변형=${variant}\n`)

const perPolicy = []
for (const [name, fn] of POLICIES) {
  if (only && !only.includes(name)) continue
  const t0 = Date.now()
  const runs = []
  for (let i = 0; i < games; i++) runs.push(playGame(fn, variant))
  const scores = runs.map((r) => r.score)
  const places = runs.map((r) => r.placements)
  perPolicy.push({ name, scores })

  const comp = {
    perCell: mean(runs.map((r) => r.perCell)),
    line: mean(runs.map((r) => r.lineScore)),
    streak: mean(runs.map((r) => r.streakScore)),
    allClear: mean(runs.map((r) => r.allClearScore)),
  }
  const total = comp.perCell + comp.line + comp.streak + comp.allClear
  console.log(
    `${name}  점수 중앙값 ${Math.round(pct(scores, 0.5)).toLocaleString()}  평균 ${Math.round(mean(scores)).toLocaleString()}  p10~p90 ${Math.round(pct(scores, 0.1)).toLocaleString()}~${Math.round(pct(scores, 0.9)).toLocaleString()}  흔들림 ${(100 * sd(scores) / mean(scores)).toFixed(0)}%`,
  )
  console.log(
    `      배치 중앙값 ${pct(places, 0.5)}개 (배치당 2.5초로 ≈${(pct(places, 0.5) * 2.5 / 60).toFixed(1)}분)  캡 도달 ${runs.filter((r) => r.capped).length}판`,
  )
  console.log(
    `      점수 구성  칸 ${(100 * comp.perCell / total).toFixed(0)}% · 줄 ${(100 * comp.line / total).toFixed(0)}% · 콤보 ${(100 * comp.streak / total).toFixed(0)}% · 올클 ${(100 * comp.allClear / total).toFixed(0)}%`,
  )
  console.log(
    `      판당 줄클리어  1줄 ${mean(runs.map((r) => r.clears1)).toFixed(1)} · 2줄 ${mean(runs.map((r) => r.clears2)).toFixed(1)} · 3줄+ ${mean(runs.map((r) => r.clears3)).toFixed(2)}  최대콤보 중앙값 ×${pct(runs.map((r) => r.maxStreak), 0.5)}`,
  )
  console.log(
    `      올클리어 ${mean(runs.map((r) => r.allClears)).toFixed(2)}회/판 (겪은 판 ${(100 * runs.filter((r) => r.allClears > 0).length / games).toFixed(0)}%)`,
  )
  console.log(
    `      죽음  빈칸 중앙값 ${pct(runs.map((r) => r.deathEmpty), 0.5)}/64  그때 놓을 수 있던 도형 ${pct(runs.map((r) => r.deathShapesFit), 0.5)}/22종  새 딜 즉사 ${(100 * runs.filter((r) => r.deathAtFreshDeal).length / games).toFixed(0)}%`,
  )
  console.log(`      (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`)
}

// η² — 실력:운 (1장의 방법. 상급이 캡에 걸리면 부풀려지니 캡 도달 수와 같이 볼 것)
function eta2(groups) {
  const all = groups.flat()
  const gm = mean(all)
  const between = groups.reduce((s, g) => s + g.length * (mean(g) - gm) ** 2, 0)
  const totalSS = all.reduce((s, x) => s + (x - gm) ** 2, 0)
  return between / totalSS
}
if (perPolicy.length === POLICIES.length) {
  const full = eta2(perPolicy.map((p) => p.scores))
  const noNovice = eta2(perPolicy.slice(1).map((p) => p.scores))
  console.log(`실력 : 운  (전체)      ${(100 * full).toFixed(0)} : ${(100 * (1 - full)).toFixed(0)}`)
  console.log(`실력 : 운  (초보 제외)  ${(100 * noNovice).toFixed(0)} : ${(100 * (1 - noNovice)).toFixed(0)}`)
}
