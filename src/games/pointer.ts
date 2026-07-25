// 게임 공통 포인터 입력 (down/move/up, 포인터 캡처 포함)
export interface PointerHandlers {
  onDown(clientX: number, clientY: number): void
  onMove(clientX: number, clientY: number): void
  onUp(clientX: number, clientY: number): void
}

export function attachInput(canvas: HTMLCanvasElement, handlers: PointerHandlers): () => void {
  const onPointerDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId)
    handlers.onDown(e.clientX, e.clientY)
  }
  const onPointerMove = (e: PointerEvent) => {
    handlers.onMove(e.clientX, e.clientY)
  }
  const onPointerUp = (e: PointerEvent) => {
    handlers.onUp(e.clientX, e.clientY)
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
  }
}
