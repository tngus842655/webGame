import { t, type TranslationKey } from '@/shared/i18n'
import { duckBgmForResult, resumeBgmAfterResult } from '@/shared/music'
import { countUp, createSheet } from './ui'

// 게임 공통 게임오버 오버레이 (점수·최고 기록·광고 이어하기·다시하기)
// 문구는 show() 시점에 t()로 채워 언어 변경이 즉시 반영된다.
export interface GameOverOverlayOptions {
  // 광고 보상 지점이 없는 게임은 생략한다
  adLabelKey?: TranslationKey
  onRetry(): void
  onContinue?(): void
}

export interface GameOverOverlay {
  show(score: number, prevBest: number | null, canContinue: boolean): void
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
     <p data-label class="gui-label"></p>
     <p data-score class="gui-score">0</p>
     <p data-best class="gui-sub"></p>
     ${opts.adLabelKey ? '<button data-ad class="btn btn--go" type="button"></button>' : ''}
     <button data-retry class="btn btn--amber" type="button"></button>`,
  )

  if (opts.onContinue) sheet.find('[data-ad]')?.addEventListener('click', opts.onContinue)
  sheet.find('[data-retry]')?.addEventListener('click', opts.onRetry)

  let stopCount = () => {}

  const set = (selector: string, text: string) => {
    const node = sheet.find(selector)
    if (node) node.textContent = text
  }

  return {
    show(score, prevBest, canContinue) {
      stopCount()
      // 판이 끝났으니 곡도 접는다 (다시하기·이어하기로 팝업을 닫으면 돌아온다)
      duckBgmForResult()
      const isRecord = prevBest === null || score > prevBest

      const badge = sheet.find('[data-badge]')
      if (badge) {
        badge.textContent = t('over.newRecord')
        badge.style.display = isRecord ? '' : 'none'
      }
      set('[data-title]', t('over.title'))
      set('[data-label]', t('hud.score'))
      // 신기록이면 배지가 알려주므로 아랫줄은 방금 깬 기록을 그대로 보여준다
      set('[data-best]', prevBest === null ? '' : t('over.bestScore', { n: prevBest.toLocaleString() }))
      set('[data-retry]', t('over.retry'))

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
      resumeBgmAfterResult()
    },
  }
}
