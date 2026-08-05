// 안드로이드 하드웨어 뒤로가기를 화면이 직접 받고 싶을 때 쓰는 창구.
// 지금 등록하는 곳은 게임 화면 하나다 — 손에 쥐고 조작하다 화면 아래를 스치면
// 판이 통째로 날아가던 것을 일시정지에서 한 번 받아내기 위해서다.
//
// 등록한 화면은 벗어날 때 반드시 setBackHandler(null)로 거둔다.
let handler: (() => void) | null = null

export function setBackHandler(fn: (() => void) | null) {
  handler = fn
}

// 화면이 받아서 처리했으면 true — 호출부는 기본 동작(한 화면 되돌리기)을 건너뛴다
export function handleBack(): boolean {
  if (!handler) return false
  handler()
  return true
}
