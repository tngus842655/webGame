<script setup lang="ts">
import { computed } from 'vue'
import UiIcon from '@/shared/UiIcon.vue'
import { promotionStatus } from '@/shared/tossPromotion'

// 앱인토스 프로모션 고지 화면. 미니앱 빌드에서만 라우터에 등록된다(app/router.ts).
//
// 토스가 요구하는 고지 항목이 여기 다 있어야 한다 — 지급 시점, 지급 조건, 지급 제한,
// 그리고 "사전 고지 없이 중단될 수 있습니다" 문구 (toss-docs/promotion.md).
//
// 약관·개인정보처리방침과 같은 이유로 한국어로만 쓴다. 앱인토스는 한국 서비스이고,
// 고지 문구를 임의로 번역하면 효력이 문제될 수 있다.
//
// 금액의 기준은 SQL의 promotion_stages()다. 아래 숫자는 그것을 사람 말로 옮긴 고지 문구라
// 양쪽을 함께 고쳐야 한다.
const STEPS = [
  { stage: 1, label: '미니게임30 접속하기', amount: 20 },
  { stage: 2, label: '게임 1판 마치기', amount: 30 },
  { stage: 3, label: '게임 3판 마치기', amount: 50 },
]

const status = computed(() => promotionStatus.value)
const granted = computed(() => status.value?.granted ?? 0)
const total = computed(() => status.value?.total ?? 100)
const percent = computed(() => Math.min(100, Math.round((granted.value / total.value) * 100)))
const allDone = computed(() => status.value != null && granted.value >= total.value)
const ended = computed(() => status.value?.ended ?? false)

function isDone(stage: number) {
  return status.value?.done.includes(stage) ?? false
}

// 3판까지 몇 판 남았는지 — 조건을 숫자로 보여주면 "한 판만 더"가 눈에 들어온다
const playsLeft = computed(() => Math.max(0, 3 - (status.value?.plays ?? 0)))
</script>

<template>
  <div class="event">
    <header class="event-header">
      <RouterLink class="back" to="/"><UiIcon name="back" /></RouterLink>
      <h1>토스포인트 100원 받기</h1>
    </header>

    <section class="progress card">
      <p v-if="allDone" class="headline done">100원을 모두 받았어요</p>
      <p v-else-if="ended" class="headline">이벤트가 끝났어요</p>
      <p v-else-if="granted > 0" class="headline">
        {{ granted }}원 받았어요<span class="left">{{ total - granted }}원 남음</span>
      </p>
      <p v-else class="headline">게임 3판이면 100원</p>

      <div class="bar"><span :style="{ width: `${percent}%` }" /></div>

      <ol class="steps">
        <li v-for="step in STEPS" :key="step.stage" :class="{ done: isDone(step.stage) }">
          <span class="mark">
            <UiIcon v-if="isDone(step.stage)" name="check" />
          </span>
          <span class="label">{{ step.label }}</span>
          <span class="amount">{{ step.amount }}원</span>
        </li>
      </ol>

      <!-- 끝난 뒤에는 재촉을 지운다. 남은 판을 채워도 지급되지 않는다.
           다 받은 사람에게는 띄우지 않는다 — 못 받은 것이 없는데 '더 받을 수 없다'고
           하면 손해를 본 것처럼 읽힌다 -->
      <p v-if="ended && !allDone" class="ended">
        지급이 끝나 더 이상 포인트를 받을 수 없어요. 이미 받은 포인트는 토스 앱 혜택 탭 →
        토스포인트에서 확인할 수 있어요.
      </p>
      <p v-else-if="!allDone && playsLeft > 0 && isDone(1)" class="nudge">
        {{ playsLeft }}판만 더 하면 남은 포인트를 받아요
      </p>
    </section>

    <section class="card notice">
      <h2>언제 지급되나요</h2>
      <p>
        조건을 채우면 바로 지급됩니다. 지급되면 토스 앱에서 알림이 오고, 혜택 탭 →
        토스포인트에서 적립 내역을 확인할 수 있습니다.
      </p>

      <h2>무엇을 하면 받나요</h2>
      <p>
        접속하면 20원, 게임을 1판 마치면 30원, 3판을 마치면 50원을 드립니다. 모두 합해
        한 사람당 100원입니다.
      </p>
      <p class="sub">
        판을 마쳤다는 것은 게임이 끝나 결과가 나온 것을 말합니다. 점수나 승패는 상관없습니다.
      </p>

      <h2>받을 수 없는 경우</h2>
      <ul>
        <li>한 사람당 100원까지만 받을 수 있습니다. 이미 받은 단계는 다시 받을 수 없습니다.</li>
        <li>탈퇴했거나 부정한 방법으로 참여한 경우 지급되지 않습니다.</li>
        <li>준비된 예산이 모두 소진되면 지급이 중단됩니다.</li>
      </ul>

      <p class="warn">본 프로모션은 사전 고지 없이 중단될 수 있습니다.</p>
    </section>
  </div>
</template>

<style scoped>
.event {
  padding: 20px 16px 40px;
}

.event-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.event-header h1 {
  margin: 0;
  font-size: 20px;
  color: var(--ink);
}

.back {
  display: inline-flex;
  color: var(--ink-muted);
}

/* UiIcon은 놓이는 자리가 크기를 정한다 (:where(.ui-icon)이 100%다) */
.back svg {
  width: 20px;
  height: 20px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  box-shadow: var(--shadow-card);
  padding: 18px 16px;
}

.card + .card {
  margin-top: 14px;
}

/* 진행 카드만 따뜻한 색을 쓴다 — 포인트를 받는 곳이라는 신호 */
.progress {
  background: linear-gradient(#fffaf2, #fff8e1);
  border-color: #ffe0b2;
}

.headline {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
}

.headline.done {
  color: #c66d20;
}

.left {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-muted);
}

.bar {
  height: 6px;
  border-radius: 3px;
  background: #f0e2d2;
  overflow: hidden;
}

.bar span {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #ffb85c, #f28f37);
  transition: width 0.3s ease;
}

.steps {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
}

.steps li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  font-size: 14px;
  color: var(--ink-muted);
}

.steps li.done {
  color: var(--ink-body);
}

.mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex: none;
  border: 1.5px solid #e5d8d0;
  border-radius: 50%;
  color: #fff;
}

.steps li.done .mark {
  background: #f28f37;
  border-color: #f28f37;
}

.label {
  flex: 1;
}

.amount {
  font-weight: 700;
  color: var(--ink-body);
}

.nudge {
  margin: 12px 0 0;
  font-size: 13px;
  color: #c66d20;
}

/* 재촉이 아니라 사실 전달이라 nudge처럼 색을 쓰지 않는다 */
.ended {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--ink-muted);
}

.notice h2 {
  margin: 0 0 6px;
  font-size: 15px;
  color: var(--ink);
}

.notice h2:not(:first-child) {
  margin-top: 20px;
}

.notice p {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--ink-body);
}

.notice .sub {
  margin-top: 6px;
  font-size: 13px;
  color: var(--ink-muted);
}

.notice ul {
  margin: 0;
  padding-left: 18px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--ink-body);
}

.warn {
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
  font-size: 13px;
  color: var(--ink-muted);
}
</style>
