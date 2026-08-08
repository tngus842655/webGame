<script setup lang="ts">
// 게임 화면 오른쪽 위, 멈춤·도움말 바로 아래. 이 게임이 어땠는지 하루 한 번 묻는다.
// 판이 돌아가는 위라서 눌러도 게임은 멈추지 않고, 알림도 읽으라고 세워두는 것이
// 아니라 전달됐다는 표시라 스스로 사라진다.
import { onBeforeUnmount, ref } from 'vue'
import { readVote, saveVote, type VoteValue } from './gameVotes'
import { t, type TranslationKey } from './i18n'
import UiIcon from './UiIcon.vue'

const props = defineProps<{ slug: string }>()

const OPTIONS: Array<{
  vote: VoteValue
  icon: 'arrow-up' | 'arrow-down'
  labelKey: TranslationKey
}> = [
  { vote: 1, icon: 'arrow-up', labelKey: 'vote.up' },
  { vote: -1, icon: 'arrow-down', labelKey: 'vote.down' },
]

const myVote = ref<VoteValue | null>(readVote(props.slug))

// 번지는 동그라미와 알림 한 줄. 둘 다 key를 새로 달아야 연달아 눌렀을 때
// 하던 동작을 이어받지 않고 처음부터 다시 시작한다.
const pop = ref<{ vote: VoteValue; seq: number } | null>(null)
const notice = ref<{ key: TranslationKey; seq: number } | null>(null)
let seq = 0
let noticeTimer = 0
// 저장이 끝나기 전에 또 누르면 요청 둘이 겹쳐, 늦게 도착한 앞 요청이 뒤 요청을 덮는다.
// 하루 한 번 누르는 버튼이라 그 짧은 사이는 막는 편이 낫다 (연달아 두드린 것도 함께 걸러진다).
let saving = false

function say(key: TranslationKey) {
  notice.value = { key, seq: ++seq }
  clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    notice.value = null
  }, 1600)
}

async function cast(vote: VoteValue) {
  if (saving) return
  // 같은 화살표를 한 번 더 누르면 취소, 반대쪽을 누르면 오늘 표가 그쪽으로 옮겨간다.
  // 어느 쪽이든 오늘 남는 표는 하나뿐이라 둘 다 켜지는 상태가 없다.
  const next = myVote.value === vote ? null : vote
  const before = myVote.value
  myVote.value = next
  pop.value = { vote, seq: ++seq }
  say(next === null ? 'vote.undone' : next === 1 ? 'vote.thanksUp' : 'vote.thanksDown')
  saving = true
  try {
    await saveVote(props.slug, next)
  } catch {
    // 저장되지 않은 표를 눌린 채로 두면 다음에 들어왔을 때 조용히 비어 있다
    myVote.value = before
    say('vote.failed')
  } finally {
    saving = false
  }
}

onBeforeUnmount(() => clearTimeout(noticeTimer))
</script>

<template>
  <div class="vote">
    <button
      v-for="opt in OPTIONS"
      :key="opt.vote"
      class="vote-btn"
      :class="[
        opt.vote === 1 ? 'up' : 'down',
        { on: myVote === opt.vote, popping: pop?.vote === opt.vote },
      ]"
      type="button"
      :aria-pressed="myVote === opt.vote"
      :aria-label="t(opt.labelKey)"
      @click="cast(opt.vote)"
    >
      <UiIcon :name="opt.icon" />
      <span
        v-if="pop?.vote === opt.vote"
        :key="pop?.seq"
        class="vote-pop"
        @animationend="pop = null"
      ></span>
    </button>

    <p v-if="notice" :key="notice.seq" class="vote-notice">{{ t(notice.key) }}</p>
  </div>
</template>

<style scoped>
/* 크기·간격은 바로 위 줄(멈춤·도움말)과 같은 값이다 — 38 + 8 + 38.
   두 화살표가 그 두 버튼 밑에 정확히 한 칸씩 들어가고, 판의 양 끝도 거기서 끊긴다.
   재질만 같고 아이콘은 옅게 둔다: 나란히 서되 앞서지는 않아야 하는 줄이다. */
.vote {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  border-radius: 19px;
  background: rgb(255 255 255 / 0.82);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: 0 2px 8px rgb(40 24 16 / 0.16);
}

.vote-btn {
  position: relative;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--ink-faint);
  cursor: pointer;
  transition:
    color 0.14s ease,
    background-color 0.14s ease,
    transform 0.1s ease;
}

.vote-btn:active {
  transform: scale(0.88);
}

.vote-btn svg {
  width: 18px;
  height: 18px;
}

/* 투표하면 화살표 속이 차고 그 뒤로 옅은 동그라미가 깔린다 —
   비어 있는 동안은 아직 고르지 않았다는 뜻이다 */
.vote-btn.on .ui-icon {
  fill: currentColor;
}

.vote-btn.on.up {
  color: #3e9a46;
  background: rgb(62 154 70 / 0.15);
}

.vote-btn.on.down {
  color: #d0453f;
  background: rgb(208 69 63 / 0.15);
}

/* 누른 자리에서 한 번 번지고 사라진다. 취소했을 때는 색이 빠진 채로 번지므로
   같은 동작이 '켰다'와 '거뒀다'를 다르게 말해 준다. */
.vote-pop {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 30px;
  height: 30px;
  margin: -15px 0 0 -15px;
  border-radius: 50%;
  background: currentColor;
  pointer-events: none;
  animation: vote-pop 0.52s ease-out forwards;
}

.vote-btn.popping .ui-icon {
  animation: vote-bump 0.42s cubic-bezier(0.22, 1.3, 0.4, 1);
}

/* 알림은 판을 가리지 않을 만큼만. 여기서 할 일은 읽는 게 아니라
   '들어갔다'를 확인하는 것이라, 눈에 걸리기 전에 물러난다. */
.vote-notice {
  position: absolute;
  top: calc(100% + 6px);
  right: 2px;
  padding: 4px 10px;
  border-radius: 12px;
  background: rgb(46 32 25 / 0.72);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  color: #fff6ea;
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
  pointer-events: none;
  animation: vote-notice 1.6s ease-out forwards;
}

[data-theme='dark'] .vote {
  background: rgb(38 31 27 / 0.86);
}

/* 어두운 판 위에서는 같은 초록·빨강이 가라앉는다 — 한 단계씩 올려 잡는다 */
[data-theme='dark'] .vote-btn.on.up {
  color: #6ec975;
  background: rgb(110 201 117 / 0.16);
}

[data-theme='dark'] .vote-btn.on.down {
  color: #ff7a72;
  background: rgb(255 122 114 / 0.16);
}

[data-theme='dark'] .vote-notice {
  background: rgb(18 14 12 / 0.82);
}

@keyframes vote-pop {
  from {
    transform: scale(0.5);
    opacity: 0.4;
  }
  to {
    transform: scale(2);
    opacity: 0;
  }
}

@keyframes vote-bump {
  0% {
    transform: scale(1);
  }
  38% {
    transform: scale(1.34);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes vote-notice {
  0% {
    opacity: 0;
    transform: translateY(-4px);
  }
  12%,
  62% {
    opacity: 1;
    transform: none;
  }
  100% {
    opacity: 0;
    transform: translateY(-3px);
  }
}

/* 동작을 줄여 달라고 한 기기에서도 사라지기는 해야 한다 — 동그라미는 스스로
   끝나야 지워지고(animationend), 알림은 그 자리에 남으면 판을 가린다.
   그래서 animation을 끄는 대신 자리를 옮기지 않는 쪽으로 갈아 끼운다. */
@media (prefers-reduced-motion: reduce) {
  .vote-pop {
    animation-name: vote-pop-still;
  }

  .vote-btn.popping .ui-icon {
    animation: none;
  }

  .vote-notice {
    animation-name: vote-notice-still;
  }
}

@keyframes vote-pop-still {
  from {
    opacity: 0.35;
  }
  to {
    opacity: 0;
  }
}

@keyframes vote-notice-still {
  0% {
    opacity: 0;
  }
  12%,
  62% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>
