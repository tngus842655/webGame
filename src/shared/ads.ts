import { t } from './i18n'

// 리워드 광고 추상화. 게임은 이 인터페이스만 알면 되고, 실제 매체는 Provider 구현으로 갈아끼운다.
// VITE_ADSENSE_CLIENT가 있으면 H5 Games Ads, 없으면 5초 카운트다운 가짜 광고(스텁)를 쓴다.

export interface AdProvider {
  isReady(): boolean
  // 반환값 = 보상을 지급할지.
  //   광고를 끝까지 봤다            → true
  //   광고를 띄울 수 없었다(재고 없음·빈도 상한·에러) → true
  //   사용자가 광고를 중간에 닫았다 → false
  // 두 번째가 중요하다. 버튼을 눌렀는데 매체 사정으로 광고가 안 나온 것은
  // 사용자 잘못이 아니므로 기회를 뺏지 않는다.
  show(placement: string): Promise<boolean>
}

const AD_SECONDS = 5

// 가짜 광고: 5초 카운트다운 후 보상. 실제 매체를 붙이기 전까지 배포본에서도 이걸 쓴다 —
// 버튼 노출·보상 지급 흐름을 실기기에서 그대로 확인할 수 있다.
class StubAdProvider implements AdProvider {
  private showing = false

  isReady() {
    return true
  }

  show(_placement: string): Promise<boolean> {
    // 겹쳐 부르면 띄울 수 없는 상황이라 보상은 준다 (실제 매체와 같은 규칙)
    if (this.showing) return Promise.resolve(true)
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
        window.removeEventListener('popstate', onBack)
        el.remove()
        this.showing = false
        resolve(rewarded)
      }

      // 광고 화면은 body에 붙어 있어서 라우터가 페이지를 바꿔도 남는다.
      // 뒤로 가기로 빠져나가면 화면을 덮은 채 굳어 버리므로 여기서 닫는다.
      // (끝까지 안 봤으니 보상은 없다)
      const onBack = () => finish(false)
      window.addEventListener('popstate', onBack)

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

// H5 Games Ads (AdSense Ad Placement API) — 웹과 안드로이드 패키징(TWA) 양쪽에서 같은 코드로 돈다.
// adBreak/adConfig는 adsbygoogle 큐에 객체를 넣는 방식이라 스크립트 로드 전에 호출해도 쌓였다가 처리된다.
type AdBreakStatus =
  | 'viewed'
  | 'dismissed'
  | 'notReady'
  | 'timeout'
  | 'error'
  | 'noAdPreloaded'
  | 'frequencyCapped'
  | 'ignored'
  | 'other'
  | string

// 사용자가 스스로 광고를 닫은 경우에만 보상을 막는다. 나머지(재고 없음·상한·에러)는
// 매체 사정이라 보상을 준다.
const DENIES_REWARD: ReadonlySet<AdBreakStatus> = new Set(['dismissed'])

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

  show(placement: string): Promise<boolean> {
    // 이미 광고가 떠 있는데 또 부르면 매체가 거절한다 — 사용자에게 기회를 돌려준다
    if (this.showing) return Promise.resolve(true)
    this.showing = true
    return new Promise((resolve) => {
      let dismissed = false
      let settled = false
      const finish = (reward: boolean) => {
        if (settled) return
        settled = true
        this.showing = false
        resolve(reward)
      }
      this.queue.push({
        type: 'reward',
        name: placement,
        beforeReward: (showAdFn: () => void) => showAdFn(),
        adViewed: () => {
          dismissed = false
        },
        adDismissed: () => {
          dismissed = true
        },
        adBreakDone: (info: { breakStatus: AdBreakStatus }) => {
          // 재고가 없거나 상한에 걸리면 광고 없이 breakStatus만 돌아온다 → 보상 지급
          finish(!dismissed && !DENIES_REWARD.has(info.breakStatus))
        },
      })
    })
  }
}

function createProvider(): AdProvider {
  const client = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined
  if (client) return new H5GamesAdProvider(client)
  // 아직 실제 매체를 붙이지 않았다 — 가짜 광고로 보상 흐름을 그대로 돌린다.
  // VITE_ADSENSE_CLIENT를 넣는 순간 실제 광고로 바뀐다.
  return new StubAdProvider()
}

export const adProvider: AdProvider = createProvider()
