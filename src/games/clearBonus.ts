import { t } from '@/shared/i18n'
import type { GameShell } from './shell'
import type { GameContext } from './types'

// 클리어 보상 — 한 판이 길어 게임오버가 잘 나지 않는 게임(스도쿠·네모로직·디펜스·머지 가든)에서
// 성공 쪽에 붙이는 리워드 광고 지점. 방금 얻은 점수만큼 한 번 더 받는다(=2배).
export interface ClearBonus {
  // true = 광고 시청 완료 → 호출한 쪽에서 points를 한 번 더 더한다
  offer(points: number): Promise<boolean>
}

const BUTTON = 'padding:14px 30px;border:none;border-radius:26px;font-size:19px;font-weight:bold;cursor:pointer;'

export function createClearBonus(
  shell: GameShell,
  ctx: GameContext,
  placement: string,
): ClearBonus {
  const el = document.createElement('div')
  el.style.cssText =
    'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgb(38 26 22 / 0.72);color:#fff;text-align:center;'
  el.innerHTML = `
    <p data-title style="font-size:30px;font-weight:bold;"></p>
    <p data-gain style="font-size:52px;font-weight:bold;color:#FFD54F;"></p>
    <button data-double type="button" style="${BUTTON}margin-top:10px;background:#43A047;color:#fff;"></button>
    <button data-keep type="button" style="${BUTTON}background:transparent;color:#fff;opacity:.75;"></button>`
  shell.wrapper.appendChild(el)

  let settle: ((doubled: boolean) => void) | null = null

  const close = (doubled: boolean) => {
    const done = settle
    settle = null
    el.style.display = 'none'
    shell.resume()
    done?.(doubled)
  }

  const watchAd = async () => {
    if (!settle) return
    // 광고가 뜨는 동안은 오버레이를 감춘다
    el.style.display = 'none'
    close(await ctx.showRewardAd(placement))
  }

  el.querySelector('[data-keep]')?.addEventListener('click', () => close(false))
  el.querySelector('[data-double]')?.addEventListener('click', () => void watchAd())

  return {
    offer(points) {
      // 광고를 띄울 수 없거나 이미 묻고 있으면 아무 것도 끼어들지 않는다
      if (settle || points <= 0 || !ctx.isRewardAdReady()) return Promise.resolve(false)
      const set = (selector: string, text: string) => {
        const node = el.querySelector(selector)
        if (node) node.textContent = text
      }
      set('[data-title]', t('bonus.title'))
      set('[data-gain]', t('bonus.gain', { n: points.toLocaleString() }))
      set('[data-double]', t('bonus.double'))
      set('[data-keep]', t('bonus.keep'))
      shell.pause()
      el.style.display = 'flex'
      return new Promise<boolean>((resolve) => {
        settle = resolve
      })
    },
  }
}
