// 서바이버를 화면 없이 돌려 "몇 분을 버티는가"를 잰다.
// GAME_BALANCE.md 7장의 숫자가 여기서 나온다. 난이도 곡선을 만질 때마다
// 손으로 10분씩 버텨 볼 수는 없어서 만들었다.
//
//   node tools/survivor-sim.mjs            정책 넷을 12판씩
//   node tools/survivor-sim.mjs 40         판 수 지정
//   node tools/survivor-sim.mjs 12 sweep   스폰 증가율 × 체력 곡선 격자 탐색
//
// state.ts 를 그대로 불러 쓰므로 상수를 고치면 바로 반영된다.
// 다만 조작(터치 목표점 찍기)은 index.ts 를 흉내 낸 것이다 —
// index.ts 의 입력 처리를 고치면 여기 decide() 도 같이 봐야 한다.

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DT = 1 / 60
const RUN_CAP = 900 // 초. 15분을 넘기면 "안 끝나는 판"으로 본다
const CONTACT_R = 46 // 적 반지름 24 + 플레이어 26 - 4

// 판마다 같은 난수를 쓰려고 Math.random 을 갈아 끼운다 (state.ts 가 안에서 쓴다)
let seed = 1
function reseed(n) {
  seed = n >>> 0 || 1
}
Math.random = () => {
  seed ^= seed << 13
  seed ^= seed >>> 17
  seed ^= seed << 5
  return ((seed >>> 0) % 1e9) / 1e9
}

// state.ts 만 있으면 되지만, 곡선을 바꿔 끼우려면 원본을 건드리지 않고
// 임시 폴더에 고쳐 쓴 사본을 만들어야 한다
const SRC = 'src/games/survivor/state.ts'
const CURVES = [
  { name: 'spawn', re: /return 1 \/ \(([\d.]+) \+ time \* ([\d.]+)\)/ },
  { name: 'hp', re: /return 1 \+ Math\.floor\(\(time \/ ([\d.]+)\) \*\* ([\d.]+)\)/ },
]

async function loadState(overrides) {
  let src = readFileSync(SRC, 'utf8')
  for (const { name, re } of CURVES) {
    if (!re.test(src)) throw new Error(`${SRC} 의 ${name} 곡선을 못 찾았다 — 시뮬의 정규식을 고칠 것`)
  }
  if (overrides?.spawnRamp !== undefined) {
    src = src.replace(CURVES[0].re, (_, base) => `return 1 / (${base} + time * ${overrides.spawnRamp})`)
  }
  if (overrides?.hpPeriod !== undefined) {
    src = src.replace(CURVES[1].re, (_, _period, exp) =>
      `return 1 + Math.floor((time / ${overrides.hpPeriod}) ** ${exp})`)
  }
  const dir = mkdtempSync(join(tmpdir(), 'survivor-sim-'))
  const file = join(dir, 'state.ts')
  writeFileSync(file, src)
  return import(file)
}

// ── 정책 넷 ────────────────────────────────────────────────────────────────
// 사람의 성장 단계를 흉내 낸 결정적 정책들 (GAME_BALANCE.md 1.1).
// react = 다음 손가락 위치를 정하기까지 걸리는 시간, ahead = 적 위치를 몇 초 앞서 보는가.
const POLICIES = {
  초보: { dirs: 8, react: 0.32, ahead: 0, wall: 0, orb: 0, item: 0, jitter: 0.35, pick: 'random' },
  입문: { dirs: 12, react: 0.2, ahead: 0.15, wall: 0.9, orb: 0.2, item: 0.6, jitter: 0.12, pick: 'naive' },
  중급: { dirs: 16, react: 0.11, ahead: 0.3, wall: 1.8, orb: 0.7, item: 2.5, jitter: 0.04, pick: 'greedy' },
  상급: { dirs: 32, react: 0.05, ahead: 0.3, wall: 2.0, orb: 0.9, item: 3.5, jitter: 0, pick: 'optimal' },
}

// 입문 — 눈에 띄는 숫자를 고른다. '공격력 +1'이 제일 세 보인다
const NAIVE_ORDER = ['damage', 'maxhp', 'firerate', 'shots', 'speed']
// 중급 — 초당 몇 발을 뿌리는지가 중요하다는 것까지는 안다
const GREEDY_ORDER = ['shots', 'firerate', 'damage', 'maxhp', 'speed']

// 초당 처치 상한. 넘치는 위력은 뒤로 뚫고 나가므로 공격력이 적 체력을 넘으면
// 한 발이 여럿을 눕힌다 (state.ts 의 총알 처리와 같은 셈)
function killRate(player, enemyHp) {
  const perBullet =
    player.damage >= enemyHp
      ? Math.floor(player.damage / enemyHp)
      : 1 / Math.ceil(enemyHp / player.damage)
  return (player.shots / player.fireInterval) * perBullet
}

function byOrder(choices, order) {
  for (const key of order) {
    const hit = choices.find((c) => c.key === key)
    if (hit) return hit
  }
  return choices[0]
}

function chooseUpgrade(mod, state, policy) {
  const choices = state.choices
  if (policy.pick === 'random') return choices[Math.floor(Math.random() * choices.length)]
  if (policy.pick === 'naive') return byOrder(choices, NAIVE_ORDER)
  if (policy.pick === 'greedy') return byOrder(choices, GREEDY_ORDER)

  // 상급 — 체력 ÷ 공격력의 올림 계단을 본다. 공격력 한 칸이 계단을 하나 내리는
  // 순간에는 그게 갈래 하나보다 크다는 것을 아는 쪽이다
  if (state.player.hp <= 2) {
    const heal = choices.find((c) => c.key === 'maxhp')
    if (heal) return heal
  }
  const hpSoon = mod.enemyHp(state.time + 45) // 곧 두꺼워질 적을 기준으로 고른다
  let best = choices[0]
  let bestRate = -1
  for (const choice of choices) {
    const p = { ...state.player }
    if (choice.key === 'damage') p.damage += 1
    else if (choice.key === 'shots') p.shots = Math.min(mod.SHOTS_CAP, p.shots + 1)
    else if (choice.key === 'firerate') p.fireInterval = Math.max(mod.FIRE_INTERVAL_MIN, p.fireInterval * 0.82)
    // 처치 속도가 같으면 오래 쓰는 쪽(갈래 > 연사 > 공격력)을 남긴다
    const rate = killRate(p, hpSoon) - GREEDY_ORDER.indexOf(choice.key) * 1e-6
    if (rate > bestRate) {
      bestRate = rate
      best = choice
    }
  }
  return best
}

// ── 이동 ──────────────────────────────────────────────────────────────────
// 후보 지점을 매기고 가장 안전한 쪽으로 손가락을 옮긴다. 낮을수록 좋은 점수다
function cost(x, y, state, policy, ahead, arena) {
  let danger = 0
  for (const e of state.enemies) {
    let ex = e.x
    let ey = e.y
    if (ahead > 0) {
      const dx = x - e.x
      const dy = y - e.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const step = Math.min(d, e.speed * ahead)
      ex += (dx / d) * step
      ey += (dy / d) * step
    }
    const dx = x - ex
    const dy = y - ey
    const d = Math.sqrt(dx * dx + dy * dy) - CONTACT_R
    danger += d < 0 ? 40 : 1 / (1 + (d * d) / 2500)
  }

  let wall = 0
  if (policy.wall > 0) {
    for (const d of [x - arena.left, arena.right - x, y - arena.top, arena.bottom - y]) {
      const k = Math.max(0, 1 - d / 150)
      wall += k * k
    }
  }

  let orb = 0
  if (policy.orb > 0) {
    for (const o of state.orbs) {
      const d2 = (x - o.x) ** 2 + (y - o.y) ** 2
      orb += 1 / (1 + d2 / 90000)
    }
  }

  // 아이템은 판 건너편에 떨어지므로 오브보다 멀리까지 끌어당겨야 주우러 간다
  let item = 0
  if (policy.item > 0) {
    for (const it of state.items) {
      const d2 = (x - it.x) ** 2 + (y - it.y) ** 2
      item += 1 / (1 + d2 / 160000)
    }
  }

  return danger + policy.wall * wall - policy.orb * orb - policy.item * item
}

function decide(mod, state, policy) {
  const p = state.player
  const arena = mod.ARENA
  const step = p.speed * Math.max(policy.react, 0.1)
  const ahead = policy.react + policy.ahead

  let bestX = p.x
  let bestY = p.y
  let bestCost = cost(p.x, p.y, state, policy, ahead, arena) + 0.05 // 제자리는 살짝 불리하게
  for (let i = 0; i < policy.dirs; i++) {
    const a = (i / policy.dirs) * Math.PI * 2
    const x = Math.min(arena.right - mod.PLAYER_R, Math.max(arena.left + mod.PLAYER_R, p.x + Math.cos(a) * step))
    const y = Math.min(arena.bottom - mod.PLAYER_R, Math.max(arena.top + mod.PLAYER_R, p.y + Math.sin(a) * step))
    const c = cost(x, y, state, policy, ahead, arena)
    if (c < bestCost) {
      bestCost = c
      bestX = x
      bestY = y
    }
  }
  if (policy.jitter > 0 && Math.random() < policy.jitter) {
    const a = Math.random() * Math.PI * 2
    bestX = p.x + Math.cos(a) * step
    bestY = p.y + Math.sin(a) * step
  }
  // 손가락은 진행 방향 조금 앞에 둔다 — 다음 판단 전에 도착해 멈추지 않도록
  const dx = bestX - p.x
  const dy = bestY - p.y
  const len = Math.hypot(dx, dy)
  if (len < 1) state.move = null
  else mod.setMoveTarget(state, p.x + (dx / len) * 300, p.y + (dy / len) * 300)
}

function run(mod, policy, runSeed) {
  reseed(runSeed)
  const state = mod.createState()
  let think = 0
  while (state.phase !== 'over' && state.time < RUN_CAP) {
    if (state.phase === 'levelup') {
      mod.applyUpgrade(state, chooseUpgrade(mod, state, policy))
      state.choices = []
      state.phase = 'playing'
    }
    think -= DT
    if (think <= 0) {
      think = policy.react
      decide(mod, state, policy)
    }
    mod.update(state, DT)
  }
  return {
    time: state.time,
    kills: state.kills,
    level: state.level,
    score: mod.scoreOf(state),
    capped: state.phase !== 'over',
  }
}

// ── 집계 ──────────────────────────────────────────────────────────────────
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function summarize(rows) {
  const times = rows.map((r) => r.time)
  const scores = rows.map((r) => r.score)
  const avg = mean(scores)
  const sd = Math.sqrt(mean(scores.map((s) => (s - avg) ** 2)))
  return {
    medianTime: median(times),
    p10: [...times].sort((a, b) => a - b)[Math.floor(times.length * 0.1)],
    p90: [...times].sort((a, b) => a - b)[Math.min(times.length - 1, Math.floor(times.length * 0.9))],
    medianScore: median(scores),
    medianLevel: median(rows.map((r) => r.level)),
    medianKills: median(rows.map((r) => r.kills)),
    cv: avg > 0 ? sd / avg : 0,
    capped: rows.filter((r) => r.capped).length,
    scores,
  }
}

// 실력 % = 집단 간 분산 / 전체 분산 (GAME_BALANCE.md 1.1)
function skillShare(groups) {
  const all = groups.flat()
  const grand = mean(all)
  const between = groups.reduce((a, g) => a + g.length * (mean(g) - grand) ** 2, 0)
  const within = groups.reduce((a, g) => a + g.reduce((b, v) => b + (v - mean(g)) ** 2, 0), 0)
  return between + within === 0 ? 0 : between / (between + within)
}

async function main() {
  const runs = Number(process.argv[2]) || 12
  const mode = process.argv[3] ?? 'report'

  if (mode === 'sweep') {
    console.log(`스폰 증가율 × 체력 주기 — ${runs}판씩, 중앙 생존 시간 (중급 / 상급)\n`)
    const ramps = [0.017, 0.024, 0.032, 0.042]
    const periods = [70, 60, 52, 45]
    console.log(`ramp     ${periods.map((p) => `hp/${p}`.padStart(14)).join('')}`)
    for (const ramp of ramps) {
      const cells = []
      for (const period of periods) {
        const mod = await loadState({ spawnRamp: ramp, hpPeriod: period })
        const mid = summarize(Array.from({ length: runs }, (_, i) => run(mod, POLICIES.중급, i + 1)))
        const top = summarize(Array.from({ length: runs }, (_, i) => run(mod, POLICIES.상급, i + 1)))
        cells.push(`${mmss(mid.medianTime)} / ${mmss(top.medianTime)}`.padStart(14))
      }
      console.log(`${String(ramp).padEnd(8)} ${cells.join('')}`)
    }
    return
  }

  const mod = await loadState()
  console.log(`정책 넷 × ${runs}판\n`)
  console.log('정책     중앙 생존   하위10%   상위10%    레벨    처치   중앙점수   흔들림')
  const groups = []
  for (const [name, policy] of Object.entries(POLICIES)) {
    const rows = Array.from({ length: runs }, (_, i) => run(mod, policy, i + 1))
    const s = summarize(rows)
    groups.push(s.scores)
    console.log(
      `${name.padEnd(8)} ${mmss(s.medianTime).padStart(8)} ${mmss(s.p10).padStart(9)} ${mmss(s.p90).padStart(9)}` +
        ` ${String(s.medianLevel).padStart(7)} ${String(s.medianKills).padStart(7)}` +
        ` ${String(s.medianScore).padStart(10)} ${(s.cv * 100).toFixed(0).padStart(7)}%` +
        (s.capped ? `  (${s.capped}판 15분 초과)` : ''),
    )
  }
  console.log(`\n실력의 몫 — 전체 ${(skillShare(groups) * 100).toFixed(0)}%` +
    `, 초보 제외 ${(skillShare(groups.slice(1)) * 100).toFixed(0)}%`)
}

await main()
