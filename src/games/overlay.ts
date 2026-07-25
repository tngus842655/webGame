// 게임 공통 게임오버 오버레이 (점수·최고 기록·광고 이어하기·다시하기)
export interface GameOverOverlayOptions {
  // 광고 보상이 없는 게임(예: 미니 골프)은 생략
  adButtonLabel?: string
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
  const adButtonHtml = opts.adButtonLabel
    ? `<button data-ad type="button" style="margin-top:8px;padding:12px 32px;border:none;border-radius:24px;font-size:18px;font-weight:bold;background:#43A047;color:#fff;cursor:pointer;">${opts.adButtonLabel}</button>`
    : ''
  el.innerHTML = `
    <h2 style="font-size:32px;">게임 오버</h2>
    <p data-score style="font-size:24px;"></p>
    <p data-best style="font-size:16px;opacity:.85;"></p>
    ${adButtonHtml}
    <button data-retry type="button" style="padding:12px 32px;border:none;border-radius:24px;font-size:18px;font-weight:bold;background:#8D6E63;color:#fff;cursor:pointer;">다시하기</button>`
  if (opts.onContinue) el.querySelector('[data-ad]')?.addEventListener('click', opts.onContinue)
  el.querySelector('[data-retry]')?.addEventListener('click', opts.onRetry)
  parent.appendChild(el)

  return {
    show(score, prevBest, canContinue) {
      const scoreEl = el.querySelector('[data-score]')
      const bestEl = el.querySelector('[data-best]')
      const adBtn = el.querySelector<HTMLButtonElement>('[data-ad]')
      if (scoreEl) scoreEl.textContent = `점수 ${score.toLocaleString()}`
      if (bestEl) {
        bestEl.textContent =
          prevBest === null || score > prevBest
            ? '🎉 신기록!'
            : `최고 기록 ${prevBest.toLocaleString()}`
      }
      if (adBtn) adBtn.style.display = canContinue ? '' : 'none'
      el.style.display = 'flex'
    },
    hide() {
      el.style.display = 'none'
    },
  }
}
