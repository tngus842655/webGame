import { ref } from 'vue'
import { isNative } from './native'

// 스토어에 새 버전이 올라오면 알린다. 안드로이드 앱에서만 돌고, 웹과 앱인토스에서는
// 아무 일도 하지 않는다 (그쪽은 배포하면 다음 접속에 바로 반영된다).
//
// 최신 버전이 무엇인지는 Play가 안다. 그래서 앱이나 DB에 버전을 따로 적어두지 않는다 —
// 적어두는 방식이면 릴리스할 때마다 그 값을 같이 올려야 하고, 잊으면 조용히 동작을 멈춘다.
//
// Play가 대신 띄워주는 다이얼로그(flexible)는 쓰지 않는다. '업데이트'를 눌러도 화면에는
// 아무 일도 일어나지 않고 — 내려받기는 뒤에서 조용히 돌고, 설치는 다음에 앱을 열 때다 —
// 사용자에게는 버튼이 먹지 않은 것으로 읽혔다. 진행 표시를 직접 그려 붙일 수도 있지만,
// 그러면 앱 안에 스토어의 내려받기 화면을 하나 더 만드는 일이 된다.
//
// 그래서 안내만 우리가 하고(UpdatePrompt.vue), '업데이트'를 누르면 플레이 스토어의 이 앱
// 페이지를 연다. 받는 것도 설치도 눈에 보이는 채로 거기서 끝난다.
//
// 강제(immediate)도 쓰지 않는다. 서버 스키마가 바뀌어 옛 버전이 오작동하는 경우에나
// 필요한 수준인데 지금은 그런 변경이 없고, 막아 세우면 이탈만 는다.

const ASKED_KEY = 'webgame:updateAskedAt'

// '나중에'를 누른 사람에게 열 때마다 다시 묻지 않는다
const ASK_INTERVAL = 24 * 60 * 60 * 1000

// 팝업을 띄울지 여부. AppLayout이 이 값을 보고 UpdatePrompt를 그린다.
export const updateAvailable = ref(false)

function askedRecently(): boolean {
  const at = Number(localStorage.getItem(ASKED_KEY) ?? 0)
  return Number.isFinite(at) && Date.now() - at < ASK_INTERVAL
}

export async function checkAppUpdate(): Promise<void> {
  if (!isNative) return
  try {
    if (askedRecently()) return
    // 웹 번들에 안드로이드 전용 코드가 실려 갈 이유가 없다 (native.ts와 같은 규칙)
    const { AppUpdate, AppUpdateAvailability } = await import('@capawesome/capacitor-app-update')
    const info = await AppUpdate.getAppUpdateInfo()
    if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) return

    // 물어보기 전에 기록한다 — 팝업을 띄운 것 자체가 '물었다'는 뜻이다
    localStorage.setItem(ASKED_KEY, String(Date.now()))
    updateAvailable.value = true
  } catch {
    // Play에서 설치한 앱이 아니거나(사이드로드·로컬 빌드) 스토어에 닿지 못한 경우.
    // 업데이트 안내가 없어도 게임은 그대로 돌아야 한다.
  }
}

// 팝업의 '업데이트'. market:// 인텐트라 플레이 스토어 앱이 이 앱 페이지에서 열린다
// (스토어 앱이 없으면 플러그인이 웹 주소로 떨어뜨린다).
export async function startAppUpdate(): Promise<void> {
  const { AppUpdate } = await import('@capawesome/capacitor-app-update')
  // 스토어가 열린 뒤에 닫는다. 먼저 닫아 버리면 인텐트가 실패했을 때 누른 사람 눈에는
  // 아무 일도 안 일어난 것으로 보인다 — 지금 고치고 있는 바로 그 모양이다.
  await AppUpdate.openAppStore()
  updateAvailable.value = false
}

export function dismissAppUpdate(): void {
  updateAvailable.value = false
}
