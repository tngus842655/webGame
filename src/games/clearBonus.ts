import { t } from '@/shared/i18n'
import type { GameShell } from './shell'
import type { GameContext } from './types'
import { createSheet } from './ui'

// 클리어 보상 — 한 판이 길어 게임오버가 잘 나지 않는 게임(스도쿠·네모로직·디펜스·머지 가든)에서
// 성공 쪽에 붙이는 리워드 광고 지점. 방금 얻은 점수만큼 한 번 더 받는다(=2배).
export interface ClearBonus {
  // true = 광고 시청 완료 → 호출한 쪽에서 points를 한 번 더 더한다
  offer(points: number): Promise<boolean>
}

export function createClearBonus(
  shell: GameShell,
  ctx: GameContext,
  placement: string,
): ClearBonus {
  const sheet = createSheet(
    shell.wrapper,
    `<p data-title class="gui-title"></p>
     <p data-gain class="gui-gain"></p>
     <button data-double class="btn btn--go" type="button"></button>
     <button data-keep class="btn btn--ghost" type="button"></button>`,
  )

  let settle: ((doubled: boolean) => void) | null = null

  const close = (doubled: boolean) => {
    const done = settle
    settle = null
    sheet.close()
    shell.resume()
    done?.(doubled)
  }

  const watchAd = async () => {
    if (!settle) return
    // 광고가 뜨는 동안은 오버레이를 감춘다
    sheet.close()
    close(await ctx.showRewardAd(placement))
  }

  sheet.find('[data-keep]')?.addEventListener('click', () => close(false))
  sheet.find('[data-double]')?.addEventListener('click', () => void watchAd())

  return {
    offer(points) {
      // 광고를 띄울 수 없거나 이미 묻고 있으면 아무 것도 끼어들지 않는다
      if (settle || points <= 0 || !ctx.isRewardAdReady()) return Promise.resolve(false)
      const set = (selector: string, text: string) => {
        const node = sheet.find(selector)
        if (node) node.textContent = text
      }
      set('[data-title]', t('bonus.title'))
      set('[data-gain]', t('bonus.gain', { n: points.toLocaleString() }))
      set('[data-double]', t('bonus.double'))
      set('[data-keep]', t('bonus.keep'))
      shell.pause()
      sheet.open()
      return new Promise<boolean>((resolve) => {
        settle = resolve
      })
    },
  }
}
