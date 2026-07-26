import { Bodies, Body, Composite, Engine, Events, type IEventCollision } from 'matter-js'
import { BOARD, PHYSICS, TIERS, WATERMELON_BONUS } from './config'

export interface MergeEvent {
  x: number
  y: number
  tier: number // 합체가 일어난 티어
  gained: number
  spawnedTier: number | null // 수박+수박 소멸이면 null
}

const WALL_THICKNESS = 80

export class SuikaWorld {
  readonly engine: Engine
  onMerge: ((e: MergeEvent) => void) | null = null

  private readonly tierByBody = new Map<number, number>()
  private pendingPairs: Array<[Body, Body]> = []
  private readonly collisionHandler: (e: IEventCollision<Engine>) => void

  constructor() {
    this.engine = Engine.create()
    this.engine.gravity.y = PHYSICS.gravityY

    const centerX = (BOARD.wallLeft + BOARD.wallRight) / 2
    const wallHeight = BOARD.height * 2
    Composite.add(this.engine.world, [
      Bodies.rectangle(BOARD.wallLeft - WALL_THICKNESS / 2, BOARD.height / 2, WALL_THICKNESS, wallHeight, { isStatic: true }),
      Bodies.rectangle(BOARD.wallRight + WALL_THICKNESS / 2, BOARD.height / 2, WALL_THICKNESS, wallHeight, { isStatic: true }),
      Bodies.rectangle(centerX, BOARD.floorY + WALL_THICKNESS / 2, BOARD.wallRight - BOARD.wallLeft + WALL_THICKNESS * 2, WALL_THICKNESS, { isStatic: true }),
    ])

    // 이벤트 중에는 쌍만 모아두고, 실제 합체는 물리 스텝이 끝난 뒤 처리한다
    this.collisionHandler = (e) => {
      for (const pair of e.pairs) {
        const tierA = this.tierByBody.get(pair.bodyA.id)
        const tierB = this.tierByBody.get(pair.bodyB.id)
        if (tierA !== undefined && tierA === tierB) {
          this.pendingPairs.push([pair.bodyA, pair.bodyB])
        }
      }
    }
    Events.on(this.engine, 'collisionStart', this.collisionHandler)
  }

  addFruit(tier: number, x: number, y: number): Body {
    const body = Bodies.circle(x, y, TIERS[tier].radius, {
      restitution: PHYSICS.restitution,
      friction: PHYSICS.friction,
    })
    this.tierByBody.set(body.id, tier)
    Composite.add(this.engine.world, body)
    return body
  }

  fruitBodies(): Array<{ body: Body; tier: number }> {
    const out: Array<{ body: Body; tier: number }> = []
    for (const body of Composite.allBodies(this.engine.world)) {
      const tier = this.tierByBody.get(body.id)
      if (tier !== undefined) out.push({ body, tier })
    }
    return out
  }

  step(dtMs: number) {
    Engine.update(this.engine, dtMs)
    this.processPending()
  }

  private processPending() {
    if (this.pendingPairs.length === 0) return
    const pairs = this.pendingPairs
    this.pendingPairs = []
    for (const [a, b] of pairs) {
      const tier = this.tierByBody.get(a.id)
      // 같은 프레임의 다른 합체로 이미 제거된 바디는 건너뜀
      if (tier === undefined || this.tierByBody.get(b.id) !== tier) continue
      const x = (a.position.x + b.position.x) / 2
      const y = (a.position.y + b.position.y) / 2
      this.removeFruit(a)
      this.removeFruit(b)

      const isLast = tier === TIERS.length - 1
      let spawnedTier: number | null = null
      if (!isLast) {
        spawnedTier = tier + 1
        const spawned = this.addFruit(spawnedTier, x, y)
        Body.setVelocity(spawned, { x: 0, y: -3 })
      }
      this.onMerge?.({
        x,
        y,
        tier,
        gained: isLast ? WATERMELON_BONUS : TIERS[tier].mergeScore,
        spawnedTier,
      })
    }
  }

  private removeFruit(body: Body) {
    Composite.remove(this.engine.world, body)
    this.tierByBody.delete(body.id)
  }

  // 광고 부활: 작은 과일만 걷어내 자리를 만든다. 통을 통째로 비우면 애써 키운
  // 큰 과일까지 사라져 사실상 새 판이 된다 — 이어하기의 의미가 없다.
  clearSmallFruits(maxTier: number): number {
    let removed = 0
    for (const { body, tier } of this.fruitBodies()) {
      if (tier > maxTier) continue
      this.removeFruit(body)
      removed += 1
    }
    return removed
  }

  reset() {
    for (const { body } of this.fruitBodies()) Composite.remove(this.engine.world, body)
    this.tierByBody.clear()
    this.pendingPairs = []
  }

  destroy() {
    Events.off(this.engine, 'collisionStart', this.collisionHandler)
    Composite.clear(this.engine.world, false)
    Engine.clear(this.engine)
  }
}
