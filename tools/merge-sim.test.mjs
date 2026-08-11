// merge-sim.mjs의 엔진이 src/games/merge/state.ts와 같은 수를 내는지 대조한다.
// 같은 시드의 Math.random을 진짜 state.ts에 물리고, 같은 조작 순서를 양쪽에 먹인 뒤
// 매 수마다 grid·score·goldMade·phase를 통째로 비교한다.
//
//   node --experimental-strip-types tools/merge-sim.test.mjs

import { makeEngine, DEFAULTS, mulberry32 } from './merge-sim.mjs'
import * as real from '../src/games/merge/state.ts'

const CELLS = real.COLS * real.ROWS
const sim = makeEngine(DEFAULTS)
const gridOf = (s) => s.grid.map((v) => (v && typeof v === 'object' ? v.level : v || 0)).join(',')

let steps = 0
for (let trial = 0; trial < 200; trial++) {
  const rng = mulberry32(1000 + trial)
  const origRandom = Math.random
  Math.random = rng // state.ts는 Math.random을 직접 쓴다
  const A = real.createState()
  const B = sim.createState()

  try {
    for (let k = 0; k < 4000; k++) {
      if (A.phase !== 'playing' || B.phase !== 'playing') break

      // 조합 가능한 쌍이 있으면 절반의 확률로 조합, 아니면 생성 — 두 엔진에 같은 조작
      const pair = sim.findPair(B, k % 2 === 0)
      if (pair && rng() < 0.5) {
        real.dropItem(A, pair[0], pair[1])
        sim.dropItem(B, pair[0], pair[1])
      } else if (sim.emptyCount(B) > 0) {
        // generate는 Math.random을 두 번 쓴다 (자리, 단계). 양쪽에 같은 난수를 주려고
        // 진짜 쪽을 먼저 돌리고 시드를 되감아 시뮬 쪽에 같은 값을 먹인다
        const before = rng
        let drawn = []
        Math.random = () => {
          const v = before()
          drawn.push(v)
          return v
        }
        real.generate(A)
        Math.random = before
        let i = 0
        sim.generate(B, () => drawn[i++])
      } else break

      steps++
      if (gridOf(A) !== gridOf(B)) throw new Error(`grid 불일치 (trial ${trial}, step ${k})\n  실제 ${gridOf(A)}\n  시뮬 ${gridOf(B)}`)
      if (A.score !== B.score) throw new Error(`score 불일치 (trial ${trial}, step ${k}): 실제 ${A.score} ≠ 시뮬 ${B.score}`)
      if (A.goldMade !== B.goldMade) throw new Error(`goldMade 불일치 (trial ${trial}, step ${k})`)
      if (A.phase !== B.phase) throw new Error(`phase 불일치 (trial ${trial}, step ${k}): 실제 ${A.phase} ≠ 시뮬 ${B.phase}`)
    }
  } finally {
    Math.random = origRandom
  }
}

// 보드가 막힐 수 있는지 — 시뮬의 "35칸은 절대 안 막힌다" 전제를 확인한다
let worstEmpty = CELLS
{
  const rng = mulberry32(4242)
  const st = sim.createState()
  for (let k = 0; k < 200000; k++) {
    if (sim.emptyCount(st) === 0) {
      if (!sim.findPair(st, true)) throw new Error('보드가 꽉 찼는데 조합 가능한 쌍이 없다 — 데드락 가능')
      const p = sim.findPair(st, true)
      sim.dropItem(st, p[0], p[1])
    } else sim.generate(st, rng)
    worstEmpty = Math.min(worstEmpty, sim.emptyCount(st))
  }
}

console.log(`✅ state.ts 대조 통과 — ${steps.toLocaleString()}수 동안 grid·score·goldMade·phase 전부 일치`)
console.log(`✅ 데드락 없음 — 20만 조작 동안 최소 빈 칸 ${worstEmpty}/${CELLS} (꽉 차도 항상 조합 가능한 쌍이 있다)`)
