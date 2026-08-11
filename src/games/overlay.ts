import {
  askedVoteToday,
  markVoteAsked,
  readVote,
  saveVote,
  type VoteValue,
} from '@/shared/gameVotes'
import { t, type TranslationKey } from '@/shared/i18n'
import { duckBgm, resumeBgm } from '@/shared/music'
import { countUp, createSheet } from './ui'

// 게임 공통 게임오버 오버레이 (점수·최고 기록·광고 이어하기·다시하기)
// 문구는 show() 시점에 t()로 채워 언어 변경이 즉시 반영된다.

// 끝까지 해내고 끝난 판. 이 사유가 오면 팝업이 실패한 얼굴('게임 오버')이 아니라
// 완주한 얼굴('클리어!')로 바뀐다 — 다 깨고도 진 것과 똑같은 화면을 보면 허탈하다.
// 사유 키가 곧 판의 결말이므로 게임마다 따로 깃발을 넘기게 하지 않는다.
const CLEAR_REASON: TranslationKey = 'over.byClear'

// 지금 돌고 있는 게임. 게임오버 팝업은 게임 30여 개가 함께 쓰는데 slug를 받지 않아서
// (받게 하면 게임 서른 곳의 호출부를 다 고쳐야 한다) 플레이 화면이 여기 한 번 적어 둔다.
// 캔버스 점수판이 최고 기록을 받는 방식(ui.ts의 setHudBest)과 같다.
let currentSlug: string | null = null

export function setOverlayGame(slug: string | null): void {
  currentSlug = slug
}

// 좋아요·싫어요를 묻기 시작하는 판. 첫 게임오버는 이미 붐비고(신기록 배지·점수·광고)
// 한 판으로는 의견도 안 선다. 이어하기로 이어 간 판도 한 번으로 세지 않는다 —
// 여기서 세는 것은 이 팝업이 뜬 횟수다.
const ASK_AFTER_ROUNDS = 2

// 게임 화면 구석의 그 화살표와 같은 그림이다 (UiIcon의 arrow-up·arrow-down).
// 여기서 문구를 달고 나오므로, 아무 설명 없이 떠 있던 그 아이콘이 이름을 얻는다.
const ARROWS: Record<'up' | 'down', string> = {
  up: 'M12 4.2 18 11.8h-3.2v8h-5.6v-8H6z',
  down: 'M12 19.8 18 12.2h-3.2v-8h-5.6v8H6z',
}

function arrowSvg(dir: 'up' | 'down'): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ARROWS[dir]}"/></svg>`
}

export interface GameOverOverlayOptions {
  // 광고 보상 지점이 없는 게임은 생략한다
  adLabelKey?: TranslationKey
  onRetry(): void
  onContinue?(): void
}

// 점수 아래에 붙는 부가 기록 (판정 분포처럼 게임마다 다른 것)
export interface GameOverStat {
  label: string
  value: string
  color?: string
}

export interface GameOverOverlay {
  // reasonKey = 왜 끝났는지 (over.by*). 끝나는 길이 하나뿐인 게임은 생략한다 —
  // 뻔한 것을 굳이 적으면 팝업만 길어진다.
  show(
    score: number,
    prevBest: number | null,
    canContinue: boolean,
    reasonKey?: TranslationKey,
    stats?: GameOverStat[],
  ): void
  hide(): void
}

export function createGameOverOverlay(
  parent: HTMLElement,
  opts: GameOverOverlayOptions,
): GameOverOverlay {
  const sheet = createSheet(
    parent,
    `<div data-badge class="gui-badge"></div>
     <p data-title class="gui-title"></p>
     <p data-reason class="gui-reason"></p>
     <p data-label class="gui-label"></p>
     <p data-score class="gui-score">0</p>
     <p data-best class="gui-sub"></p>
     <div data-stats class="gui-stats"></div>
     <div data-vote class="gui-vote">
       <span data-vote-ask class="gui-vote-ask"></span>
       <button data-vote-up class="gui-vote-btn up" type="button">${arrowSvg('up')}</button>
       <button data-vote-down class="gui-vote-btn down" type="button">${arrowSvg('down')}</button>
     </div>
     ${opts.adLabelKey ? '<button data-ad class="btn btn--go" type="button"></button>' : ''}
     <button data-retry class="btn btn--amber" type="button"></button>`,
  )

  if (opts.onContinue) sheet.find('[data-ad]')?.addEventListener('click', opts.onContinue)
  sheet.find('[data-retry]')?.addEventListener('click', opts.onRetry)

  const voteRow = sheet.find('[data-vote]')
  const voteAsk = sheet.find('[data-vote-ask]')
  const voteButtons: Array<{
    el: HTMLButtonElement | null
    vote: VoteValue
    labelKey: TranslationKey
  }> = [
    { el: sheet.find<HTMLButtonElement>('[data-vote-up]'), vote: 1, labelKey: 'vote.up' },
    { el: sheet.find<HTMLButtonElement>('[data-vote-down]'), vote: -1, labelKey: 'vote.down' },
  ]

  // 이 팝업이 몇 번째로 떴는가. 게임마다 팝업을 따로 만들므로(게임 하나에 하나)
  // 이 숫자도 이 게임 것만 센다.
  let rounds = 0
  // 저장이 끝나기 전에 또 누르면 늦게 도착한 앞 요청이 뒤 요청을 덮는다 (GameVote.vue와 같다)
  let voting = false

  const sayVote = (key: TranslationKey) => {
    if (voteAsk) voteAsk.textContent = t(key)
  }

  // 눌린 표를 화살표에 칠한다. 저장은 뒤따라가므로 저장된 값이 아니라 칠할 값을 받는다
  const paintVote = (value: VoteValue | null) => {
    for (const button of voteButtons) {
      button.el?.classList.toggle('on', value === button.vote)
      button.el?.setAttribute('aria-pressed', String(value === button.vote))
    }
  }

  async function castVote(vote: VoteValue) {
    const slug = currentSlug
    if (!slug || voting) return
    // 같은 화살표를 한 번 더 누르면 취소, 반대쪽을 누르면 표가 그쪽으로 옮겨간다 (GameVote.vue와 같다)
    const before = readVote(slug)
    const next = before === vote ? null : vote
    voting = true
    paintVote(next)
    sayVote(next === null ? 'vote.undone' : next === 1 ? 'vote.thanksUp' : 'vote.thanksDown')
    try {
      await saveVote(slug, next)
    } catch {
      paintVote(before)
      sayVote('vote.failed')
    } finally {
      voting = false
    }
  }

  for (const button of voteButtons) {
    button.el?.addEventListener('click', () => void castVote(button.vote))
  }

  let stopCount = () => {}

  const set = (selector: string, text: string) => {
    const node = sheet.find(selector)
    if (node) node.textContent = text
  }

  return {
    show(score, prevBest, canContinue, reasonKey, stats) {
      stopCount()
      rounds += 1
      // 판이 끝났으니 곡도 접는다 (다시하기·이어하기로 팝업을 닫으면 돌아온다)
      duckBgm()
      const isRecord = prevBest === null || score > prevBest
      const isClear = reasonKey === CLEAR_REASON
      sheet.find('.gui-sheet')?.classList.toggle('is-clear', isClear)

      const badge = sheet.find('[data-badge]')
      if (badge) {
        badge.textContent = t('over.newRecord')
        badge.style.display = isRecord ? '' : 'none'
      }
      set('[data-title]', t(isClear ? 'over.clearTitle' : 'over.title'))
      const reason = sheet.find('[data-reason]')
      if (reason) {
        reason.textContent = reasonKey ? t(reasonKey) : ''
        reason.style.display = reasonKey ? '' : 'none'
      }
      set('[data-label]', t('hud.score'))
      // 신기록이면 배지가 알려주므로 아랫줄은 방금 깬 기록을 그대로 보여준다
      set('[data-best]', prevBest === null ? '' : t('over.bestScore', { n: prevBest.toLocaleString() }))
      set('[data-retry]', t('over.retry'))

      const statsEl = sheet.find('[data-stats]')
      if (statsEl) {
        statsEl.replaceChildren(
          ...(stats ?? []).map((stat) => {
            const cell = document.createElement('div')
            const label = cell.appendChild(document.createElement('span'))
            label.className = 'gui-stat-label'
            label.textContent = stat.label
            const value = cell.appendChild(document.createElement('strong'))
            value.className = 'gui-stat-value'
            value.textContent = stat.value
            if (stat.color) value.style.color = stat.color
            return cell
          }),
        )
        statsEl.style.display = stats?.length ? '' : 'none'
      }

      // 판이 끝난 자리가 이 게임이 어땠는지 묻기 가장 좋은 때다 — 의견은 지금 굳는다.
      // 다만 이 팝업은 다시하기 루프 한복판이라 딱 한 번만 묻는다: 두 번째 판부터,
      // 오늘 이 게임에 아직 표가 없고 물어본 적도 없을 때.
      const slug = currentSlug
      const asking =
        slug !== null &&
        rounds >= ASK_AFTER_ROUNDS &&
        readVote(slug) === null &&
        !askedVoteToday(slug)
      if (voteRow) voteRow.style.display = asking ? '' : 'none'
      if (asking && slug) {
        markVoteAsked(slug)
        sayVote('vote.ask')
        paintVote(null)
        for (const button of voteButtons) button.el?.setAttribute('aria-label', t(button.labelKey))
      }

      const adBtn = sheet.find<HTMLButtonElement>('[data-ad]')
      if (adBtn && opts.adLabelKey) {
        adBtn.textContent = t(opts.adLabelKey)
        adBtn.style.display = canContinue ? '' : 'none'
      }

      sheet.open()
      const scoreEl = sheet.find('[data-score]')
      if (scoreEl) stopCount = countUp(scoreEl, score)
    },
    hide() {
      stopCount()
      sheet.close()
      resumeBgm()
    },
  }
}
