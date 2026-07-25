// 리워드 광고 추상화. 실제 SDK(AdSense 등) 연동 시 Provider 구현만 교체한다.
// 운영 빌드에서는 SDK가 없으므로 NoAdProvider → 광고 버튼이 아예 노출되지 않는다.

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
        <p style="font-size:14px;opacity:.7;">광고 (개발용 시뮬레이션)</p>
        <p data-count style="font-size:56px;font-weight:bold;">${AD_SECONDS}</p>
        <button data-action type="button" style="padding:12px 32px;border:none;border-radius:24px;font-size:16px;font-weight:bold;background:#546E7A;color:#fff;cursor:pointer;">건너뛰기 (보상 없음)</button>`
      document.body.appendChild(el)

      const countEl = el.querySelector('[data-count]')
      const button = el.querySelector<HTMLButtonElement>('[data-action]')
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
        if (countEl) countEl.textContent = '시청 완료!'
        if (button) {
          button.textContent = '보상 받기'
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

export const adProvider: AdProvider = import.meta.env.DEV ? new StubAdProvider() : new NoAdProvider()
