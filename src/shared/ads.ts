import { t } from './i18n'
import { isNative } from './native'
import { isInToss } from './toss'

// 리워드 광고 추상화. 게임은 이 인터페이스만 알면 되고, 실제 매체는 Provider 구현으로 갈아끼운다.
// 웹은 VITE_ADSENSE_CLIENT가 있으면 H5 Games Ads,
// 앱인토스는 VITE_TOSS_AD_GROUP_ID가 있으면 토스 인앱광고,
// 안드로이드 앱은 VITE_ADMOB_REWARD_ID가 있으면 AdMob,
// 없으면 5초 카운트다운 가짜 광고(스텁)를 쓴다.
//
// 매체가 셋으로 갈리는 건 취향이 아니라 정책이다 — AdSense는 웹사이트용이라 앱 웹뷰에
// 게재하면 프로그램 정책 위반이고, 미니앱 안에서는 토스가 자기 광고 SDK를 쓰게 한다.

// 광고를 한 번 부른 결과.
//   viewed      광고를 끝까지 봤다
//   dismissed   사용자가 중간에 닫았다
//   unavailable 띄울 수 없었다 (재고 없음·빈도 상한·에러)
// 보상 지급 여부(= dismissed만 거절)는 gameContext가 판단한다. 셋을 구분해 두는
// 이유는 통계 때문이다 — 하나로 뭉치면 '광고를 봤다'와 '광고가 아예 안 떴는데
// 봐준 것'이 같은 값이 되어, 재고가 비었는지 영영 알 수 없다.
export type AdOutcome = 'viewed' | 'dismissed' | 'unavailable'

// 광고가 나간 매체. 재고도 단가도 따로 놀아서 통계는 이 단위로 갈라 본다.
export type AdMedium = 'adsense' | 'admob' | 'toss'

export interface AdProvider {
  // 통계에 남길 매체. 테스트 광고면 null이고, 그때는 기록을 남기지 않는다.
  readonly medium: AdMedium | null
  isReady(): boolean
  show(placement: string): Promise<AdOutcome>
  // 판에 들어올 때 미리 받아 두라는 신호. 받아 두는 개념이 있는 매체만 구현한다
  // (앱인토스는 로드에 최대 1분이 걸려서, 버튼을 누른 뒤에 부르면 늦는다).
  preload?(): void
}

const AD_SECONDS = 5

// 가짜 광고: 5초 카운트다운 후 보상. 실제 매체를 붙이기 전까지 배포본에서도 이걸 쓴다 —
// 버튼 노출부터 보상 지급까지 흐름을 실기기에서 그대로 확인할 수 있다. 통계에는 남지
// 않는다 (medium이 null) — 5초 스텁은 무조건 '시청'이라 시청률을 통째로 부풀린다.
class StubAdProvider implements AdProvider {
  readonly medium = null
  private showing = false

  isReady() {
    return true
  }

  show(_placement: string): Promise<AdOutcome> {
    // 겹쳐 부르면 띄울 수 없는 상황이다 (실제 매체와 같은 규칙)
    if (this.showing) return Promise.resolve('unavailable')
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

      const finish = (outcome: AdOutcome) => {
        clearInterval(timer)
        window.removeEventListener('popstate', onBack)
        el.remove()
        this.showing = false
        resolve(outcome)
      }

      // 광고 화면은 body에 붙어 있어서 라우터가 페이지를 바꿔도 남는다.
      // 뒤로 가기로 빠져나가면 화면을 덮은 채 굳어 버리므로 여기서 닫는다.
      // (끝까지 안 봤으니 보상은 없다)
      const onBack = () => finish('dismissed')
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

      button?.addEventListener('click', () => finish(remain <= 0 ? 'viewed' : 'dismissed'))
    })
  }
}

// H5 Games Ads (AdSense Ad Placement API) — 웹과 앱인토스에서 쓴다. 안드로이드 앱은 AdMob 쪽.
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

class H5GamesAdProvider implements AdProvider {
  private queue: unknown[]
  private showing = false

  constructor(client: string, readonly medium: AdMedium | null) {
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

  show(placement: string): Promise<AdOutcome> {
    // 이미 광고가 떠 있는데 또 부르면 매체가 거절한다
    if (this.showing) return Promise.resolve('unavailable')
    this.showing = true
    return new Promise((resolve) => {
      let dismissed = false
      let settled = false
      const finish = (outcome: AdOutcome) => {
        if (settled) return
        settled = true
        this.showing = false
        resolve(outcome)
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
          if (dismissed || info.breakStatus === 'dismissed') finish('dismissed')
          else if (info.breakStatus === 'viewed') finish('viewed')
          // 재고가 없거나 상한에 걸리면 광고 없이 breakStatus만 돌아온다
          else finish('unavailable')
        },
      })
    })
  }
}

// AdMob 리워드 광고 — 안드로이드 앱 전용.
// H5 Games Ads(AdSense)는 웹사이트용 상품이라 앱 웹뷰 안에서 게재하면 프로그램 정책 위반이고,
// 게시자 계정이 제재 대상이 된다. 앱에서 쓸 수 있는 구글 매체는 AdMob 쪽이다.
class AdMobProvider implements AdProvider {
  private showing = false
  private sdk: Promise<typeof import('@capacitor-community/admob')> | null = null

  constructor(
    private readonly adId: string,
    readonly medium: AdMedium | null,
  ) {}

  // 광고를 처음 부를 때 받아 온다 — 게임만 하고 버튼을 안 누르는 사람도 많다
  private load() {
    if (!this.sdk) {
      this.sdk = import('@capacitor-community/admob').then(async (mod) => {
        await mod.AdMob.initialize()
        return mod
      })
    }
    return this.sdk
  }

  isReady() {
    return !this.showing
  }

  async show(_placement: string): Promise<AdOutcome> {
    if (this.showing) return 'unavailable'
    this.showing = true
    try {
      const { AdMob, RewardAdPluginEvents } = await this.load()
      try {
        await AdMob.prepareRewardVideoAd({ adId: this.adId })
      } catch {
        // 재고가 없거나 로드에 실패했다 = 매체 사정이니 기회를 뺏지 않는다
        return 'unavailable'
      }

      let rewarded = false
      const earned = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        rewarded = true
      })
      try {
        // 사용자가 중간에 닫으면 여기서 튄다 — 그때는 rewarded가 false로 남는다
        await AdMob.showRewardVideoAd()
      } catch {
        /* 닫혔거나 표시에 실패했다. 판단은 rewarded가 한다 */
      } finally {
        await earned.remove()
      }
      // 로드까지 끝난 광고가 표시에 실패하는 경우는 여기서 '닫음'으로 잡힌다.
      // 둘을 가를 신호가 SDK에 없다 — 통계의 '못 뜸'은 그만큼 적게 잡힌다.
      return rewarded ? 'viewed' : 'dismissed'
    } finally {
      this.showing = false
    }
  }
}

type TossSdk = typeof import('@apps-in-toss/web-framework')

// 셋 다 SDK가 아무 이벤트도 주지 않을 때를 위한 안전망이다. 정상 동작에서는 걸리지 않는다.
//
// 받아 두기: 애드몹 광고는 5~20초, 네트워크 사정에 따라 SDK 자체 상한인 60초까지 걸린다.
// 화면을 막지 않고 뒤에서 도는 일이라 넉넉히 잡는다.
const TOSS_LOAD_TIMEOUT = 90000
// 버튼을 눌렀는데 아직 안 받아졌을 때, 게임을 멈춰 둔 채 기다리는 한도
const TOSS_WAIT_TIMEOUT = 20000
// 안드로이드 토스앱 5.255.0은 dismissed를 주지 않는다(가이드 FAQ). 그 버전에서 화면이
// 영영 굳지 않게 끊는다 — 그때 보상은 userEarnedReward를 받았는지로 가른다.
const TOSS_SHOW_TIMEOUT = 180000

// 앱인토스 리워드 광고 — 미니앱 빌드 전용.
// 미니앱도 결국 토스 앱 안의 웹뷰라 위의 AdSense를 그대로 쓸 수 없고, 토스가 자체 SDK로
// 재고를 준다. adGroupId는 앱인토스 콘솔에서 발급받은 광고 단위 그룹 ID다.
//
// 가이드가 정한 순서를 그대로 따른다 — 화면에 들어올 때 미리 받아 두고(load), 버튼을
// 누르면 그것을 띄우고(show), 띄운 광고는 소진되므로 다음 편을 다시 받아 둔다.
// 한 번에 하나만 받아 둘 수 있어서, 받는 중이면 그 약속을 함께 쓴다.
class TossAdProvider implements AdProvider {
  private showing = false
  private loaded = false
  private loading: Promise<boolean> | null = null
  private sdk: Promise<TossSdk> | null = null

  constructor(
    private readonly adGroupId: string,
    readonly medium: AdMedium | null,
  ) {}

  private loadSdk() {
    if (!this.sdk) this.sdk = import('@apps-in-toss/web-framework')
    return this.sdk
  }

  preload() {
    void this.ensureLoaded()
  }

  // 받아 둔 광고가 있거나 받는 중이면 버튼을 보여준다. 받기가 실패한 뒤에는 감춘다 —
  // 눌러도 광고가 안 나올 버튼이다.
  isReady() {
    return !this.showing && (this.loaded || this.loading !== null)
  }

  private ensureLoaded(): Promise<boolean> {
    if (this.loaded) return Promise.resolve(true)
    if (!this.loading) {
      this.loading = this.runLoad().then((ok) => {
        this.loaded = ok
        this.loading = null
        return ok
      })
    }
    return this.loading
  }

  async show(_placement: string): Promise<AdOutcome> {
    if (this.showing) return 'unavailable'
    this.showing = true
    try {
      const { showFullScreenAd } = await this.loadSdk()
      // 아직 받는 중이면 잠깐 기다린다. 한도를 넘겨도 받기 자체는 계속 돌아 다음 기회에 쓰인다
      const ready = await Promise.race([
        this.ensureLoaded(),
        new Promise<boolean>((r) => setTimeout(() => r(false), TOSS_WAIT_TIMEOUT)),
      ])
      if (!ready) return 'unavailable'
      return await this.present(showFullScreenAd)
    } catch {
      return 'unavailable'
    } finally {
      // 한 번 띄운 광고는 다시 띄울 수 없다 — 비우고 다음 편을 받아 둔다
      this.loaded = false
      this.showing = false
      this.preload()
    }
  }

  private async runLoad(): Promise<boolean> {
    try {
      const { loadFullScreenAd } = await this.loadSdk()
      // 토스 밖(브라우저로 연 dev 서버, 샌드박스)에는 브릿지가 없다
      if (!loadFullScreenAd.isSupported()) return false
      return await new Promise<boolean>((resolve) => {
        let dispose = () => {}
        let done = false
        const settle = (ok: boolean) => {
          if (done) return
          done = true
          clearTimeout(timer)
          dispose()
          resolve(ok)
        }
        const timer = setTimeout(() => settle(false), TOSS_LOAD_TIMEOUT)
        dispose = loadFullScreenAd({
          options: { adGroupId: this.adGroupId },
          onEvent: (event) => {
            if (event.type === 'loaded') settle(true)
          },
          onError: () => settle(false),
        })
        if (done) dispose()
      })
    } catch {
      return false
    }
  }

  // 보상은 userEarnedReward로 먼저 오고, 광고 창이 닫힐 때 dismissed가 온다.
  // dismissed를 기다리는 것은 광고가 화면을 덮고 있는 동안 게임이 뒤에서 되살아나지
  // 않게 하기 위해서다 — 러너처럼 손을 놓으면 죽는 게임이 있다.
  private present(show: TossSdk['showFullScreenAd']): Promise<AdOutcome> {
    return new Promise((resolve) => {
      let dispose = () => {}
      let done = false
      let rewarded = false
      const settle = (outcome: AdOutcome) => {
        if (done) return
        done = true
        clearTimeout(timer)
        dispose()
        resolve(outcome)
      }
      const timer = setTimeout(() => settle(rewarded ? 'viewed' : 'unavailable'), TOSS_SHOW_TIMEOUT)
      dispose = show({
        options: { adGroupId: this.adGroupId },
        onEvent: (event) => {
          if (event.type === 'userEarnedReward') rewarded = true
          else if (event.type === 'dismissed') settle(rewarded ? 'viewed' : 'dismissed')
          else if (event.type === 'failedToShow') settle('unavailable')
        },
        onError: () => settle('unavailable'),
      })
      if (done) dispose()
    })
  }
}

// 실제 광고인지 테스트 광고인지는 광고 단위 ID로 가른다. 테스트 단위는 출시한 뒤에도
// 계속 쓴다 — AdMob은 개발 중에 실제 단위로 자기 광고를 보면 무효 트래픽으로 계정이
// 막히고, 앱인토스도 운영 ID로 테스트하면 정책 위반이다. 게임을 하나 더 붙일 때마다
// 다시 쓰게 되는 값이라, 출시하면 없어질 것으로 두면 안 된다.
//
// 구글이 공개한 테스트 광고 단위는 전부 이 게시자 ID를 쓴다
const ADMOB_TEST_PUBLISHER = 'ca-app-pub-3940256099942544/'
// 앱인토스 테스트 광고 그룹 — 고정 ID와 개발 환경 ID. 운영은 ait.v2.live.* 꼴이다
const TOSS_TEST_PREFIXES = ['ait-ad-test-', 'ait.dev.']

// dev 서버도 테스트로 친다. 운영과 같은 Supabase를 보는 데다, localhost는 AdSense
// 승인 도메인이 아니라 광고가 전부 '못 뜸'으로 떨어져서 재고 지표를 통째로 망친다.
const isDev = import.meta.env.DEV

function createProvider(): AdProvider {
  if (isNative) {
    const adId = import.meta.env.VITE_ADMOB_REWARD_ID as string | undefined
    if (!adId) return new StubAdProvider()
    const isTest = isDev || adId.startsWith(ADMOB_TEST_PUBLISHER)
    return new AdMobProvider(adId, isTest ? null : 'admob')
  }

  // 미니앱에서는 AdSense로 흘려보내면 안 된다. 광고 그룹 ID가 아직 없으면 스텁으로 둔다.
  if (isInToss) {
    const adGroupId = import.meta.env.VITE_TOSS_AD_GROUP_ID as string | undefined
    if (!adGroupId) return new StubAdProvider()
    const isTest = isDev || TOSS_TEST_PREFIXES.some((prefix) => adGroupId.startsWith(prefix))
    return new TossAdProvider(adGroupId, isTest ? null : 'toss')
  }

  const client = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined
  if (client) return new H5GamesAdProvider(client, isDev ? null : 'adsense')
  // 아직 실제 매체를 붙이지 않았다 — 가짜 광고로 보상 흐름을 그대로 돌린다.
  // VITE_ADSENSE_CLIENT를 넣는 순간 실제 광고로 바뀐다.
  return new StubAdProvider()
}

export const adProvider: AdProvider = createProvider()
