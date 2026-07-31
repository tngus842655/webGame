import { Capacitor } from '@capacitor/core'

// 안드로이드 네이티브 앱(Capacitor)에서만 켜지는 것들. 웹과 앱인토스 빌드에서는
// isNative가 false라 아래 함수들이 전부 그냥 돌아간다.
//
// 플러그인은 전부 동적 import다 — 웹 번들에 안드로이드 전용 코드가 실려 갈 이유가 없다.

export const isNative = Capacitor.isNativePlatform()

// 소셜 로그인이 끝나고 앱으로 돌아올 주소.
// AndroidManifest의 custom_url_scheme(= strings.xml)과 같아야 하고,
// Supabase 대시보드의 Redirect URLs에도 등록되어 있어야 한다.
export const AUTH_CALLBACK = 'com.minigame30.app://auth-callback'

// 로그인 창을 앱 웹뷰가 아니라 크롬 커스텀 탭으로 연다.
// 구글이 임베디드 웹뷰의 OAuth를 막아 놨고(disallowed_useragent), 카카오도
// 웹뷰 안에서는 '카카오톡으로 로그인'을 쓸 수 없다.
export async function openAuthTab(url: string): Promise<void> {
  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url })
}

export async function closeAuthTab(): Promise<void> {
  const { Browser } = await import('@capacitor/browser')
  await Browser.close().catch(() => {})
}

// 딥링크로 앱이 다시 열릴 때(로그인 완료) / 커스텀 탭이 닫힐 때(사용자가 취소) 알린다.
export async function watchAuthTab(handlers: {
  onCallback: (url: string) => void
  onClosed: () => void
}): Promise<void> {
  const [{ App }, { Browser }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/browser'),
  ])
  await App.addListener('appUrlOpen', ({ url }) => handlers.onCallback(url))
  await Browser.addListener('browserFinished', () => handlers.onClosed())
}

// 앱 껍데기 초기화. 스플래시는 첫 화면을 그린 뒤에 내려야 흰 화면이 스치지 않는다.
export async function startNativeShell(onBack: () => void): Promise<void> {
  if (!isNative) return
  const [{ App }, { SplashScreen }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/splash-screen'),
  ])
  await App.addListener('backButton', onBack)
  await SplashScreen.hide()
}

export async function exitApp(): Promise<void> {
  const { App } = await import('@capacitor/app')
  await App.exitApp()
}
