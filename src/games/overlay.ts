import { t, type TranslationKey } from '@/shared/i18n'

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
  const el = document.createElement('div')
  el.style.cssText =
    'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgb(62 39 35 / 0.55);color:#fff;text-align:center;'
  const adButtonHtml = opts.adLabelKey
    ? '<button data-ad type="button" style="margin-top:8px;padding:12px 32px;border:none;border-radius:24px;font-size:18px;font-weight:bold;background:#43A047;color:#fff;cursor:pointer;"></button>'
    : ''
  el.innerHTML = `
    <h2 data-title style="font-size:32px;"></h2>
    <p data-score style="font-size:24px;"></p>
    <p data-best style="font-size:16px;opacity:.85;"></p>
    ${adButtonHtml}
    <button data-retry type="button" style="padding:12px 32px;border:none;border-radius:24px;font-size:18px;font-weight:bold;background:#8D6E63;color:#fff;cursor:pointer;"></button>`
  if (opts.onContinue) el.querySelector('[data-ad]')?.addEventListener('click', opts.onContinue)
  el.querySelector('[data-retry]')?.addEventListener('click', opts.onRetry)
  parent.appendChild(el)

  return {
    show(score, prevBest, canContinue) {
      const set = (selector: string, text: string) => {
        const node = el.querySelector(selector)
        if (node) node.textContent = text
      }
      set('[data-title]', t('over.title'))
      set('[data-score]', t('over.score', { n: score.toLocaleString() }))
      set(
        '[data-best]',
        prevBest === null || score > prevBest
          ? t('over.newRecord')
          : t('over.bestScore', { n: prevBest.toLocaleString() }),
      )
      set('[data-retry]', t('over.retry'))
      const adBtn = el.querySelector<HTMLButtonElement>('[data-ad]')
      if (adBtn && opts.adLabelKey) {
        adBtn.textContent = t(opts.adLabelKey)
        adBtn.style.display = canContinue ? '' : 'none'
      }
      el.style.display = 'flex'
    },
    hide() {
      el.style.display = 'none'
    },
  }
}
