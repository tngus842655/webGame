import { isNative } from './native'

// 스토어에 새 버전이 올라오면 알린다. 안드로이드 앱에서만 돌고, 웹과 앱인토스에서는
// 아무 일도 하지 않는다 (그쪽은 배포하면 다음 접속에 바로 반영된다).
//
// 최신 버전이 무엇인지는 Play가 안다. 그래서 앱이나 DB에 버전을 따로 적어두지 않는다 —
// 적어두는 방식이면 릴리스할 때마다 그 값을 같이 올려야 하고, 잊으면 조용히 동작을 멈춘다.
//
// 권유 방식(flexible)이다. Play가 '나중에 / 업데이트' 다이얼로그를 띄우고, 받겠다고
// 하면 게임을 하는 동안 뒤에서 내려받는다. 다 받은 것은 다음에 앱을 열 때 설치한다 —
// 게임 도중에 껐다 켜면 그 판이 날아간다.
//
// 강제(immediate)는 쓰지 않는다. 서버 스키마가 바뀌어 옛 버전이 오작동하는 경우에나
// 필요한 수준인데 지금은 그런 변경이 없고, 막아 세우면 이탈만 는다.

const ASKED_KEY = 'webgame:updateAskedAt'

// '나중에'를 누른 사람에게 열 때마다 다시 묻지 않는다
const ASK_INTERVAL = 24 * 60 * 60 * 1000

function askedRecently(): boolean {
  const at = Number(localStorage.getItem(ASKED_KEY) ?? 0)
  return Number.isFinite(at) && Date.now() - at < ASK_INTERVAL
}

export async function checkAppUpdate(): Promise<void> {
  if (!isNative) return
  try {
    // 웹 번들에 안드로이드 전용 코드가 실려 갈 이유가 없다 (native.ts와 같은 규칙)
    const { AppUpdate, AppUpdateAvailability, FlexibleUpdateInstallStatus } = await import(
      '@capawesome/capacitor-app-update'
    )
    const info = await AppUpdate.getAppUpdateInfo()

    // 지난번에 받아둔 것이 설치를 기다리고 있으면 그것부터 끝낸다.
    // 설치하면 앱이 다시 시작되므로, 아직 아무것도 안 한 지금이 가장 덜 아프다.
    if (info.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) {
      await AppUpdate.completeFlexibleUpdate()
      return
    }

    // UPDATE_IN_PROGRESS면 이미 내려받는 중이라 건드리지 않는다
    if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) return
    if (!info.flexibleUpdateAllowed || askedRecently()) return

    // 물어보기 전에 기록한다 — 다이얼로그를 띄운 것 자체가 '물었다'는 뜻이다
    localStorage.setItem(ASKED_KEY, String(Date.now()))
    await AppUpdate.startFlexibleUpdate()
  } catch {
    // Play에서 설치한 앱이 아니거나(사이드로드·로컬 빌드) 스토어에 닿지 못한 경우.
    // 업데이트 안내가 없어도 게임은 그대로 돌아야 한다.
  }
}
