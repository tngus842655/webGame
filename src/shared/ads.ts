import { t } from './i18n'

// 리워드 광고 추상화. 게임은 이 인터페이스만 알면 되고, 실제 매체는 Provider 구현으로 갈아끼운다.
// 운영 빌드는 VITE_ADSENSE_CLIENT가 있으면 H5 Games Ads, 없으면 NoAdProvider(=광고 버튼 미노출).

export interface AdProvider {
  isReady(): boolean
  // true = 끝까지 시청 완료(보상 지급)
  show(placement: string): Promise<boolean>
}

const AD_SECONDS = 5

// 개발용 가짜 광고: 카운트다운 후 보상. 광고 루프를 실기기에서 미리 검증하기 위한 용도.
class StubAdProvider implements AdProvider {
  private showing = false

  isReady() {
    return true
  }

  show(_placement: string): Promise<boolean> {
    if (this.showing) return Promise.resolve(false)
    this.showing = true
    return new Promise((resolve) => {
      const el = document.createElement('div')
      el.style.cssText =
        'position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#263238;color:#fff;text-align:center;'
      el.innerHTML = `
        <p data-label style="font-size:14px;opacity:.7;"></p>
        <p data-count style="font-size:56px;font-weight:bold;">${AD_SECONDS}</p>
        <button data-action type="button" style="padding:12px 32px;border:none;border-radius:24px;font-size:16px;font-weight:bold;background:#546E7A;color:#fff;cursor:pointer;"></button>`
      const labelEl = el.querySelector('[data-label]')
      if (labelEl) labelEl.textContent = t('ad.sim')
      document.body.appendChild(el)

      const countEl = el.querySelector('[data-count]')
      const button = el.querySelector<HTMLButtonElement>('[data-action]')
      if (button) button.textContent = t('ad.skip')
      let remain = AD_SECONDS

      const finish = (rewarded: boolean) => {
        clearInterval(timer)
        el.remove()
        this.showing = false
        resolve(rewarded)
      }

      const timer = setInterval(() => {
        remain -= 1
        if (remain > 0) {
          if (countEl) countEl.textContent = String(remain)
          return
        }
        clearInterval(timer)
        if (countEl) countEl.textContent = t('ad.done')
        if (button) {
          button.textContent = t('ad.claim')
          button.style.background = '#43A047'
        }
      }, 1000)

      button?.addEventListener('click', () => finish(remain <= 0))
    })
  }
}

class NoAdProvider implements AdProvider {
  isReady() {
    return false
  }

  show(_placement: string): Promise<boolean> {
    return Promise.resolve(false)
  }
}

// H5 Games Ads (AdSense Ad Placement API) — 웹과 안드로이드 패키징(TWA) 양쪽에서 같은 코드로 돈다.
// adBreak/adConfig는 adsbygoogle 큐에 객체를 넣는 방식이라 스크립트 로드 전에 호출해도 쌓였다가 처리된다.
type AdBreakStatus = 'viewed' | 'dismissed' | 'notReady' | 'timeout' | 'error' | string

class H5GamesAdProvider implements AdProvider {
  private queue: unknown[]
  private showing = false

  constructor(client: string) {
    const script = document.createElement('script')
    script.async = true
    script.crossOrigin = 'anonymous'
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`
    // 미리 받아두지 않으면 버튼을 누른 뒤 광고가 뜰 때까지 몇 초씩 빈다
    script.dataset.adFrequencyHint = '60s'
    document.head.appendChild(script)

    const w = window as Window & { adsbygoogle?: unknown[] }
    w.adsbygoogle = w.adsbygoogle ?? []
    this.queue = w.adsbygoogle
    this.queue.push({ preloadAdBreaks: 'on', sound: 'on' })
  }

  isReady() {
    return !this.showing
  }

  // 재고가 없거나 빈도 상한에 걸리면 광고 없이 breakStatus만 돌아온다 → false(보상 없음)
  show(placement: string): Promise<boolean> {
    if (this.showing) return Promise.resolve(false)
    this.showing = true
    return new Promise((resolve) => {
      let viewed = false
      const done = () => {
        this.showing = false
        resolve(viewed)
      }
      this.queue.push({
        type: 'reward',
        name: placement,
        beforeReward: (showAdFn: () => void) => showAdFn(),
        adViewed: () => {
          viewed = true
        },
        adDismissed: () => {
          viewed = false
        },
        adBreakDone: (info: { breakStatus: AdBreakStatus }) => {
          if (info.breakStatus !== 'viewed') viewed = false
          done()
        },
      })
    })
  }
}

function createProvider(): AdProvider {
  if (import.meta.env.DEV) return new StubAdProvider()
  const client = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined
  return client ? new H5GamesAdProvider(client) : new NoAdProvider()
}

export const adProvider: AdProvider = createProvider()
