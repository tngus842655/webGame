export interface InputHandlers {
  onAim(clientX: number, clientY: number): void
  onRelease(clientX: number, clientY: number): void
}

// 드래그 조준 + 놓아서 드롭, 탭 한 번으로도 드롭 (DESIGN.md 7.5)
export function attachInput(canvas: HTMLCanvasElement, handlers: InputHandlers): () => void {
  const onPointerDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId)
    handlers.onAim(e.clientX, e.clientY)
  }
  const onPointerMove = (e: PointerEvent) => {
    handlers.onAim(e.clientX, e.clientY)
  }
  const onPointerUp = (e: PointerEvent) => {
    handlers.onRelease(e.clientX, e.clientY)
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
