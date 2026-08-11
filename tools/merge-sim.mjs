// 머지 가든을 화면 없이 돌려 밸런스를 잰다.
// 방법은 GAME_BALANCE.md 1장(정책 계단 + 실력:운 분해 + 계단 단조성 확인).
//
//   node tools/merge-sim.mjs                     정책 넷을 300판씩
//   node tools/merge-sim.mjs 1000                판 수 지정
//   node tools/merge-sim.mjs 300 --seed 7        시드 지정 (기본 20260809)
//   node tools/merge-sim.mjs 300 --only 중급,상급
//   node tools/merge-sim.mjs 300 --params '{"maxLevel":8,"spawnPercent":[40,25,15,10,6,3,1]}'
//
// 파라미터 키: cols rows maxLevel spawnPercent maxStage stageGoal[] stageSeconds[]
//              harvestPoints timeBonus scoreCap tapSec dragSec clearAnim hand[] miss[]
//
// 이식이 맞는지 확인:  node --experimental-strip-types tools/merge-sim.test.mjs
// 판단력만의 몫 재기:  --params '{"hand":[1.15,1.15,1.15,1.15],"miss":[0,0,0,0]}' --only 입문,중급,상급
//
// blockblast-sim과 달리 게임 코드를 import하지 않는다. state.ts가 상수를 모듈 상수로
// 박아 놔서 후보안을 덮어쓸 수 없기 때문이다. 규칙은 아래 ENGINE에 그대로 옮겼고,
// 옮긴 값이 state.ts와 어긋나면 실행 첫 줄에 경고가 뜬다(checkDrift).
//
// ⚠ 이 게임에는 위치 전략이 없다. dropItem에 인접 제한이 없어 어느 칸에서 어느 칸으로든
//   옮길 수 있고, 조합은 '같은 단계 둘'뿐이라 보드 상태가 누적 생성량의 이진 표현과 같다.
//   그래서 정책 계단의 축은 (a) 손 속도 (b) 헛 제스처 (c) 생성/조합 전환 시점 셋뿐이다.
//   놓는 자리를 고르는 정책은 만들 수 없다 — 고를 것이 없다.

import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// ── 파라미터 (기본값 = 현재 state.ts) ───────────────────────────────

const DEFAULTS = {
  cols: 5,
  rows: 7,
  maxLevel: 12,
  // 1~11단계 생성 확률(%). 최종 단계는 버튼으로 안 나온다
  spawnPercent: [38, 22, 12, 8, 6, 4.5, 3.5, 2.5, 1.8, 1.2, 0.5],
  maxStage: 10,
  stageGoal: null, // null = stage 그대로 (n단계 → 화분 n개)
  stageSeconds: null, // null = 210 + (stage-1)*85
  harvestPoints: 470,
  timeBonus: 23,
  scoreCap: 1_000_000,

  // 손 모델 — 정책 속도 배수를 여기에 곱한다
  tapSec: 0.25,
  dragSec: 0.65,
  clearAnim: 2.2, // 스테이지 완료 연출 (제한 시간은 안 깎지만 벽시계는 흐른다)

  // 정책별 손 속도 배수(작을수록 빠름)와 조합 쌍을 놓치는 비율
  hand: [2.2, 1.5, 1.15, 0.9],
  miss: [0.3, 0, 0, 0],
}

// ── state.ts와 어긋났는지 확인 ──────────────────────────────────────

function checkDrift() {
  let src
  try {
    src = readFileSync('src/games/merge/state.ts', 'utf8')
  } catch {
    console.log('⚠ src/games/merge/state.ts 를 못 읽었다 — 대조를 건너뛴다 (repo 루트에서 실행할 것)\n')
    return
  }
  const num = (re) => {
    const m = src.match(re)
    return m ? Number(m[1]) : null
  }
  const spawn = src.match(/const SPAWN_PERCENT = \[([^\]]+)\]/)
  const stageSec = src.match(/return (\d+) \+ \(stage - 1\) \* (\d+)/)
  const found = {
    cols: num(/export const COLS = (\d+)/),
    rows: num(/export const ROWS = (\d+)/),
    maxLevel: num(/export const MAX_LEVEL = (\d+)/),
    maxStage: num(/export const MAX_STAGE = (\d+)/),
    harvestPoints: num(/const HARVEST_POINTS = (\d+)/),
    timeBonus: num(/export const TIME_BONUS = (\d+)/),
    spawnPercent: spawn ? spawn[1].split(',').map((s) => Number(s.trim())) : null,
    stageBase: stageSec ? Number(stageSec[1]) : null,
    stageStep: stageSec ? Number(stageSec[2]) : null,
  }
  const bad = []
  for (const k of ['cols', 'rows', 'maxLevel', 'maxStage', 'harvestPoints', 'timeBonus']) {
    if (found[k] !== DEFAULTS[k]) bad.push(`${k}: 코드 ${found[k]} ≠ 시뮬 기본값 ${DEFAULTS[k]}`)
  }
  if (String(found.spawnPercent) !== String(DEFAULTS.spawnPercent))
    bad.push(`spawnPercent: 코드 [${found.spawnPercent}] ≠ 시뮬 [${DEFAULTS.spawnPercent}]`)
  if (found.stageBase !== 210 || found.stageStep !== 85)
    bad.push(`stageSeconds: 코드 ${found.stageBase}+(s-1)*${found.stageStep} ≠ 시뮬 210+(s-1)*85`)
  if (bad.length) {
    console.log('⚠⚠ 시뮬 기본값이 state.ts와 어긋났다 — DEFAULTS를 고칠 것')
    for (const b of bad) console.log('   ' + b)
    console.log()
  }
}

// ── 시드 RNG (mulberry32) ──────────────────────────────────────────

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── 엔진 (state.ts 이식) ────────────────────────────────────────────

function makeEngine(P) {
  const CELLS = P.cols * P.rows

  const goal = (s) => (P.stageGoal ? (P.stageGoal[s - 1] ?? s) : s)
  const secs = (s) => (P.stageSeconds ? (P.stageSeconds[s - 1] ?? 210 + (s - 1) * 85) : 210 + (s - 1) * 85)

  // rollLevel — state.ts 그대로. 확률 합이 100 미만이면 남는 몫이 여기서 1로 샌다
  function rollLevel(rng) {
    let r = rng() * 100
    for (let i = 0; i < P.spawnPercent.length; i++) {
      r -= P.spawnPercent[i]
      if (r <= 0) return i + 1
    }
    return 1
  }

  function createState() {
    return {
      phase: 'playing',
      stage: 1,
      score: 0,
      goldMade: 0,
      timeLeft: secs(1),
      grid: new Array(CELLS).fill(0), // 0 = 빈 칸, 그 외 = 단계
    }
  }

  // 생성 — 쿨다운 없이 빈 칸이 있으면 언제든
  function generate(st, rng) {
    const empty = []
    for (let i = 0; i < CELLS; i++) if (st.grid[i] === 0) empty.push(i)
    if (empty.length === 0) return { ok: false, level: 0 }
    const idx = empty[(rng() * empty.length) | 0]
    const level = rollLevel(rng)
    st.grid[idx] = level
    return { ok: true, level, idx }
  }

  // from을 to에 놓는다. 최종 단계가 되면 그 자리에서 수확되고 칸이 빈다
  function dropItem(st, from, to) {
    const out = { merged: false, harvested: false, stageClear: false }
    const lvl = st.grid[from]
    if (!lvl || from === to || st.phase !== 'playing') return out
    const tgt = st.grid[to]
    if (tgt === 0) {
      st.grid[to] = lvl
      st.grid[from] = 0
      return out
    }
    if (tgt !== lvl || lvl >= P.maxLevel) return out

    const nl = lvl + 1
    st.grid[from] = 0
    out.merged = true
    if (nl >= P.maxLevel) {
      st.grid[to] = 0 // 수확
      st.goldMade += 1
      st.score += P.harvestPoints
      out.harvested = true
      if (st.goldMade >= goal(st.stage)) {
        st.score = Math.min(P.scoreCap, st.score + Math.round(st.timeLeft) * P.timeBonus)
        st.phase = 'stageClear'
        out.stageClear = true
      }
    } else {
      st.grid[to] = nl
    }
    st.score = Math.min(P.scoreCap, st.score)
    return out
  }

  function maxBoardLevel(st) {
    let m = 0
    for (const v of st.grid) if (v > m) m = v
    return m
  }

  // ── 정책이 보는 헬퍼 ──
  const emptyCount = (st) => {
    let n = 0
    for (const v of st.grid) if (v === 0) n++
    return n
  }

  // 조합 가능한 쌍 — pickHigh면 가장 높은 단계, 아니면 가장 낮은 단계부터
  function findPair(st, pickHigh) {
    let bestLvl = -1
    let a = -1
    let b = -1
    const first = new Array(P.maxLevel + 1).fill(-1)
    for (let i = 0; i < CELLS; i++) {
      const v = st.grid[i]
      if (v === 0 || v >= P.maxLevel) continue
      if (first[v] === -1) {
        first[v] = i
        continue
      }
      if (bestLvl === -1 || (pickHigh ? v > bestLvl : v < bestLvl)) {
        bestLvl = v
        a = first[v]
        b = i
      }
    }
    return bestLvl === -1 ? null : [a, b]
  }

  // 헛 제스처 — 조합이 안 되는 곳으로 끌어다 놓는다 (빈 칸 이동이거나 무반응)
  function wasteMove(st, rng) {
    const items = []
    for (let i = 0; i < CELLS; i++) if (st.grid[i] !== 0) items.push(i)
    if (items.length === 0) return null
    const from = items[(rng() * items.length) | 0]
    const lvl = st.grid[from]
    const targets = []
    for (let i = 0; i < CELLS; i++) if (i !== from && st.grid[i] !== lvl) targets.push(i)
    if (targets.length === 0) return null
    return { type: 'waste', from, to: targets[(rng() * targets.length) | 0] }
  }

  return { CELLS, goal, secs, createState, generate, dropItem, maxBoardLevel, emptyCount, findPair, wasteMove, rollLevel }
}

// ── 정책 계단 ──────────────────────────────────────────────────────
//
// 이 게임에서 고를 수 있는 것은 "지금 생성이냐 조합이냐"와 "어느 쌍을 먼저냐"뿐이다.
// 놓는 자리는 결과에 영향이 없다 (인접 제한 없음 + 35칸은 절대 안 막힘: 스폰 단계가
// 11종뿐이라 아이템 12개만 있어도 반드시 같은 단계 쌍이 생긴다).

// 초보 — 빈 칸이 있으면 무조건 생성. 꽉 차서 흔들림을 보고서야 조합을 시작하고,
//        조합 가능한 쌍을 miss 비율만큼 놓쳐 헛 드래그를 한다. 낮은 단계부터 무작정.
function policyNovice(st, mem, rng, E) {
  const empty = E.emptyCount(st)
  if (mem.mode === 'merge' && empty >= 5) mem.mode = 'gen'
  if (mem.mode !== 'merge') {
    if (empty > 0) return { type: 'gen' }
    mem.mode = 'merge'
    return { type: 'genFail' } // 꽉 찬 걸 탭해 보고서야 안다
  }
  const pair = E.findPair(st, false)
  if (!pair) {
    mem.mode = 'gen'
    return empty > 0 ? { type: 'gen' } : { type: 'genFail' }
  }
  if (rng() < mem.miss) return E.wasteMove(st, rng) ?? { type: 'gen' }
  return { type: 'merge', from: pair[0], to: pair[1] }
}

// 입문 — 쌍이 보이면 바로 조합한다(낮은 단계 우선). 놓치지 않는다.
function policyBeginner(st, mem, rng, E) {
  const pair = E.findPair(st, false)
  if (pair) return { type: 'merge', from: pair[0], to: pair[1] }
  return E.emptyCount(st) > 0 ? { type: 'gen' } : { type: 'genFail' }
}

// 중급 — 높은 단계 우선 조합. 빈 칸이 KEEP_EMPTY 밑으로 내려가면 생성을 멈추고 정리한다.
const KEEP_EMPTY = 8
function policyIntermediate(st, mem, rng, E) {
  const pair = E.findPair(st, true)
  if (pair) return { type: 'merge', from: pair[0], to: pair[1] }
  if (E.emptyCount(st) > 0) return { type: 'gen' }
  return { type: 'genFail' }
}

// 상급 — 방금 만든 단계의 연쇄를 끝까지 밀어붙이고(높은 단계 우선), 헛 제스처 0.
//        중급과 두는 수가 사실상 같다. 이 게임에 다른 수가 없기 때문이다 — 차이는 손뿐.
function policyAdvanced(st, mem, rng, E) {
  const pair = E.findPair(st, true)
  if (pair) return { type: 'merge', from: pair[0], to: pair[1] }
  if (E.emptyCount(st) > 0) return { type: 'gen' }
  return { type: 'genFail' }
}

const POLICIES = [
  ['초보', policyNovice],
  ['입문', policyBeginner],
  ['중급', policyIntermediate],
  ['상급', policyAdvanced],
]

// ── 한 판 ──────────────────────────────────────────────────────────

const GESTURE_CAP = 200_000

function playGame(P, E, policyFn, hand, miss, rng) {
  const st = E.createState()
  const mem = { mode: 'gen', miss }
  const tapSec = P.tapSec * hand
  const dragSec = P.dragSec * hand

  const m = {
    score: 0,
    stageReached: 1,
    cleared: false,
    taps: 0, // 생성 탭 (실패 포함)
    genFails: 0,
    drags: 0, // 조합 + 헛 드래그
    merges: 0,
    wastes: 0,
    pots: 0,
    topLevel: 0, // 이번 판에서 만든 최고 단계
    wallSec: 0,
    stageSec: [], // 클리어한 스테이지마다 실제 소요 초
    dnfStage: 0, // 못 깬 스테이지 (0 = 완주)
    dnfPots: 0, // 그 스테이지에서 만든 화분 수
    dnfGoal: 0,
  }

  let gestures = 0
  while (st.phase === 'playing' && gestures < GESTURE_CAP) {
    const act = policyFn(st, mem, rng, E)
    if (!act) break
    const dur = act.type === 'gen' || act.type === 'genFail' ? tapSec : dragSec

    // 시간이 제스처 도중에 끝나면 그 제스처는 완성되지 않는다
    if (st.timeLeft < dur) {
      m.wallSec += st.timeLeft
      st.timeLeft = 0
      st.score = Math.min(P.scoreCap, st.score + 2 ** Math.max(0, E.maxBoardLevel(st) - 4))
      st.phase = 'over'
      m.dnfStage = st.stage
      m.dnfPots = st.goldMade
      m.dnfGoal = E.goal(st.stage)
      break
    }
    st.timeLeft -= dur
    m.wallSec += dur
    gestures++

    if (act.type === 'gen') {
      m.taps++
      if (!E.generate(st, rng).ok) m.genFails++
    } else if (act.type === 'genFail') {
      m.taps++
      m.genFails++
    } else {
      m.drags++
      if (act.type === 'waste') {
        m.wastes++
        E.dropItem(st, act.from, act.to)
      } else {
        const lvl = st.grid[act.from]
        const r = E.dropItem(st, act.from, act.to)
        if (r.merged) {
          m.merges++
          if (lvl + 1 > m.topLevel) m.topLevel = lvl + 1
        }
        if (r.harvested) m.pots++
        if (r.stageClear) {
          m.stageSec.push(E.secs(st.stage) - st.timeLeft)
          m.wallSec += P.clearAnim
          if (st.stage >= P.maxStage) {
            m.cleared = true
            st.phase = 'over'
          } else {
            st.stage += 1
            m.stageReached = st.stage
            st.goldMade = 0
            st.timeLeft = E.secs(st.stage)
            st.phase = 'playing'
          }
        }
      }
    }
  }

  m.score = st.score
  m.gestures = m.taps + m.drags
  return m
}

// ── 통계 ───────────────────────────────────────────────────────────

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const sd = (a) => {
  const mu = mean(a)
  return Math.sqrt(mean(a.map((x) => (x - mu) ** 2)))
}
const pct = (a, p) => {
  const s = [...a].sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}
const n = (x, d = 0) => Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

function eta2(groups) {
  const all = groups.flat()
  const gm = mean(all)
  const between = groups.reduce((s, g) => s + g.length * (mean(g) - gm) ** 2, 0)
  const total = all.reduce((s, x) => s + (x - gm) ** 2, 0)
  return total === 0 ? 0 : between / total
}

// 이식이 맞는지 확인하는 대조 테스트(tools/merge-sim.test.mjs)가 이걸 불러 쓴다
export { DEFAULTS, makeEngine, mulberry32, playGame, POLICIES }

// ── CLI ────────────────────────────────────────────────────────────

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()

function main() {
const argv = process.argv.slice(2)
const flag = (name, def) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : def
}
const games = Number(argv[0] && !argv[0].startsWith('--') ? argv[0] : 300)
const seed = Number(flag('--seed', 20260809))
const only = flag('--only')?.split(',')
const P = { ...DEFAULTS, ...JSON.parse(flag('--params', '{}')) }

checkDrift()

const E = makeEngine(P)

// ── 이론값 (파라미터에서 바로 나온다 — 시뮬을 돌리기 전에 세우는 수식) ──

const potMass = 2 ** (P.maxLevel - 1)
let expMass = 0
for (let i = 0; i < P.spawnPercent.length; i++) expMass += (P.spawnPercent[i] / 100) * 2 ** i
const spawnSum = P.spawnPercent.reduce((a, b) => a + b, 0)
const theoTaps = potMass / expMass
const totalGoal = Array.from({ length: P.maxStage }, (_, i) => E.goal(i + 1)).reduce((a, b) => a + b, 0)
const totalSec = Array.from({ length: P.maxStage }, (_, i) => E.secs(i + 1)).reduce((a, b) => a + b, 0)
const topShare = (() => {
  let t = 0
  for (let i = Math.max(0, P.spawnPercent.length - 3); i < P.spawnPercent.length; i++)
    t += (P.spawnPercent[i] / 100) * 2 ** i
  return t / expMass
})()
const topProb = P.spawnPercent.slice(-3).reduce((a, b) => a + b, 0)

// rollLevel 누수 실측 (확률 합이 100 미만이면 남는 몫이 1단계로 간다)
{
  const r = mulberry32(seed ^ 0x5bf03635)
  const N = 400_000
  const hist = new Array(P.spawnPercent.length + 1).fill(0)
  let leak = 0
  for (let k = 0; k < N; k++) {
    let x = r() * 100
    let hit = 0
    for (let i = 0; i < P.spawnPercent.length; i++) {
      x -= P.spawnPercent[i]
      if (x <= 0) {
        hit = i + 1
        break
      }
    }
    if (hit === 0) {
      leak++
      hit = 1
    }
    hist[hit]++
  }
  console.log(`머지 가든 — 정책 4단 × ${games}판  (seed=${seed}, ${P.cols}×${P.rows}칸, 최고 ${P.maxLevel}단계)\n`)
  console.log('■ 이론값 — 시뮬 없이 파라미터만으로 나오는 수')
  console.log(`   생성 확률 합 ${spawnSum}%  →  rollLevel 누수(return 1 폴백) 실측 ${((100 * leak) / N).toFixed(4)}%`)
  console.log(`   L1 실효 확률 ${((100 * hist[1]) / N).toFixed(2)}%`)
  console.log(`   탭 1회 기댓값 E = ${expMass.toFixed(3)} (1단계 환산)`)
  console.log(
    `   화분 1개 = ${n(potMass)} → 탭 ${theoTaps.toFixed(1)}회 · 드래그 ${(theoTaps - 1).toFixed(1)}회 · 제스처 ${(2 * theoTaps - 1).toFixed(1)}회`,
  )
  console.log(`   상위 3단(${P.spawnPercent.length - 2}~${P.spawnPercent.length}) 스폰 ${topProb}%가 진행량의 ${(100 * topShare).toFixed(1)}%를 만든다`)
  console.log(
    `   전판 화분 ${totalGoal}개 = 제스처 ${n(totalGoal * (2 * theoTaps - 1))}회 / 제한시간 합 ${n(totalSec)}초(${(totalSec / 60).toFixed(1)}분)\n`,
  )
}

// ── 실행 ───────────────────────────────────────────────────────────

const results = []
for (let pi = 0; pi < POLICIES.length; pi++) {
  const [name, fn] = POLICIES[pi]
  if (only && !only.includes(name)) continue
  const t0 = Date.now()
  const rng = mulberry32(seed + pi * 7919)
  const runs = []
  for (let i = 0; i < games; i++) runs.push(playGame(P, E, fn, P.hand[pi], P.miss[pi], rng))
  results.push({ name, hand: P.hand[pi], miss: P.miss[pi], runs, ms: Date.now() - t0 })
}

// ── 1) 계단 단조성 먼저 (GAME_BALANCE 1.2 · 6장) ────────────────────

console.log('■ 계단 단조성 — 이걸 먼저 본다')
const avgScores = results.map((r) => mean(r.runs.map((x) => x.score)))
console.log(
  '   ' + results.map((r, i) => `${r.name} ${n(avgScores[i])}`).join('  →  '),
)
let inverted = []
for (let i = 1; i < avgScores.length; i++) if (avgScores[i] <= avgScores[i - 1]) inverted.push(`${results[i - 1].name}(${n(avgScores[i - 1])}) ≥ ${results[i].name}(${n(avgScores[i])})`)
if (inverted.length) {
  console.log('\n   ⚠⚠⚠ 계단이 뒤집혔다 — 정책이 고장난 것이지 밸런스 결과가 아니다.')
  for (const s of inverted) console.log('   ⚠⚠⚠   ' + s)
  console.log('   ⚠⚠⚠ 아래 숫자를 근거로 쓰지 말 것 (GAME_BALANCE 6장의 기록된 실수).\n')
} else {
  console.log('   ✅ 단조 증가 — 아래 숫자를 읽어도 된다\n')
}

// ── 2) 정책별 상세 ─────────────────────────────────────────────────

for (const r of results) {
  const runs = r.runs
  const scores = runs.map((x) => x.score)
  // 화분당 비용은 판별 비율의 평균이 아니라 합계끼리의 비로 낸다.
  // 판별로 내면 화분 1개 만들고 죽은 판이 비율을 위로 끌어올린다
  const sum = (f) => runs.reduce((s, x) => s + f(x), 0)
  const potsAll = sum((x) => x.pots)
  const tapsPerPot = potsAll ? sum((x) => x.taps) / potsAll : NaN
  const gestPerPot = potsAll ? sum((x) => x.gestures) / potsAll : NaN
  const dragShare = sum((x) => x.gestures) ? sum((x) => x.drags) / sum((x) => x.gestures) : 0
  const effRate = 1 / (P.tapSec * r.hand * (1 - dragShare) + P.dragSec * r.hand * dragShare)
  const clears = runs.filter((x) => x.cleared).length
  const cv = (100 * sd(scores)) / mean(scores)

  console.log(
    `${r.name}  손 ×${r.hand} (탭 ${(P.tapSec * r.hand).toFixed(2)}s · 드래그 ${(P.dragSec * r.hand).toFixed(2)}s → 실효 ${effRate.toFixed(2)} 제스처/초)  놓침 ${(100 * r.miss).toFixed(0)}%`,
  )
  const cvFlag = cv > 40 ? '  ← 운 게임(>40%)' : cv < 20 ? '  ← 매 판 복사판(<20%)' : ''
  console.log(
    `      점수 평균 ${n(mean(scores))}  표준편차 ${n(sd(scores))}  중앙값 ${n(pct(scores, 0.5))}  p10~p90 ${n(pct(scores, 0.1))}~${n(pct(scores, 0.9))}  변동계수 ${cv.toFixed(0)}%${cvFlag}`,
  )
  console.log(
    `      화분당  탭 ${Number.isNaN(tapsPerPot) ? '—' : tapsPerPot.toFixed(1)}회 · 제스처 ${Number.isNaN(gestPerPot) ? '—' : gestPerPot.toFixed(1)}회 (드래그 비중 ${(100 * dragShare).toFixed(0)}%)  판당 화분 ${mean(runs.map((x) => x.pots)).toFixed(1)}개  최고 단계 중앙값 ${pct(runs.map((x) => x.topLevel), 0.5)}`,
  )
  console.log(
    `      헛 제스처  실패 탭 ${mean(runs.map((x) => x.genFails)).toFixed(1)}회 · 헛 드래그 ${mean(runs.map((x) => x.wastes)).toFixed(1)}회 (전체의 ${((100 * mean(runs.map((x) => x.genFails + x.wastes))) / Math.max(1, mean(runs.map((x) => x.gestures)))).toFixed(0)}%)`,
  )

  // 스테이지별 소요 초 / 도달률
  const reachRate = []
  const stageUsed = []
  for (let s = 1; s <= P.maxStage; s++) {
    const got = runs.filter((x) => x.stageSec.length >= s).map((x) => x.stageSec[s - 1])
    reachRate.push((100 * got.length) / runs.length)
    stageUsed.push(got.length ? mean(got) : NaN)
  }
  console.log('      스테이지  ' + Array.from({ length: P.maxStage }, (_, i) => `${i + 1}`.padStart(6)).join(''))
  console.log('        제한(초)' + Array.from({ length: P.maxStage }, (_, i) => n(E.secs(i + 1)).padStart(6)).join(''))
  console.log(
    '        소요(초)' +
      stageUsed.map((v) => (Number.isNaN(v) ? '   —'.padStart(6) : v.toFixed(0).padStart(6))).join(''),
  )
  console.log('        클리어%' + reachRate.map((v) => v.toFixed(0).padStart(6)).join(''))

  const dnf = runs.filter((x) => !x.cleared)
  const dnfAt = mean(dnf.map((x) => x.dnfStage))
  console.log(
    `      전판 클리어 ${((100 * clears) / runs.length).toFixed(1)}%   도달 스테이지 중앙값 ${pct(runs.map((x) => x.stageReached), 0.5)}   실패 지점 평균 ${dnf.length ? dnfAt.toFixed(1) : '—'}단계 (목표의 ${dnf.length ? ((100 * mean(dnf.map((x) => x.dnfPots))) / Math.max(1, mean(dnf.map((x) => x.dnfGoal)))).toFixed(0) : '—'}% 달성)`,
  )
  console.log(`      한 판 벽시계 중앙값 ${(pct(runs.map((x) => x.wallSec), 0.5) / 60).toFixed(1)}분   (${(r.ms / 1000).toFixed(1)}s)\n`)
}

// ── 3) 실력 : 운 ───────────────────────────────────────────────────

if (results.length >= 2) {
  const label = results.map((r) => r.name).join('·')
  const full = eta2(results.map((r) => r.runs.map((x) => x.score)))
  console.log(`실력 : 운  (${label})  ${(100 * full).toFixed(1)} : ${(100 * (1 - full)).toFixed(1)}`)
  if (results.length > 2) {
    const noFirst = eta2(results.slice(1).map((r) => r.runs.map((x) => x.score)))
    console.log(
      `실력 : 운  (${results.slice(1).map((r) => r.name).join('·')})  ${(100 * noFirst).toFixed(1)} : ${(100 * (1 - noFirst)).toFixed(1)}`,
    )
  }
  const hands = new Set(results.map((r) => r.hand))
  if (hands.size === 1) {
    console.log(`\n   ※ 손 속도를 전부 ×${[...hands][0]}로 묶은 실행이다. 위 값이 곧 '판단력만의 몫'이다.`)
  } else {
    console.log(`\n   ※ 정책마다 손 속도가 다르다. 판단력만의 몫을 보려면 hand를 전부 같게 두고 다시 돌릴 것:`)
    console.log(`      node tools/merge-sim.mjs ${games} --params '{"hand":[1.15,1.15,1.15,1.15],"miss":[0,0,0,0]}' --only 입문,중급,상급`)
  }
}
}
