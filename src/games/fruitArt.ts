import { TIERS } from './suika/config'

// 과일 벡터 아트 — 이미지 에셋 없이 티어마다 고유한 모습을 그린다.
//
// 하단 진화 도표는 반지름 22px로 그리는데, 그 크기에서는 씨앗·잔점 같은 잔무늬가
// 전부 사라져 색만 남는다. 그래서 무늬보다 먼저 **실루엣과 꼭지**로 차이를 낸다.
// (딸기는 뾰족한 원뿔, 사과는 꼭지 홈, 배는 조롱박 — 색을 지워도 구분된다.)
//
// 그리는 순서: 꼭지·잎(뒤) → 본체 → 무늬·광택(본체로 클리핑) → 꽃받침(앞) → 얼굴

export function drawFruit(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  tier: number,
  radius: number = TIERS[tier].radius,
) {
  const t = TIERS[tier]
  c.save()
  c.translate(x, y)
  c.rotate(angle)

  drawTop(c, tier, radius)
  fillBody(c, tier, t.color, t.dark, radius)

  c.save()
  bodyPath(c, tier, radius)
  c.clip()
  drawPattern(c, tier, radius, t.dark)
  drawGloss(c, radius)
  c.restore()

  drawCalyx(c, tier, radius)
  drawFace(c, t.faceColor, radius)

  c.restore()
}

// ── 실루엣 ────────────────────────────────────────────────
// 물리 몸체는 전부 원이라 크게 벗어나지 않는 선에서만 변형한다.

function bodyPath(c: CanvasRenderingContext2D, tier: number, r: number) {
  switch (tier) {
    case 1:
      strawberryPath(c, r)
      break
    case 4:
      applePath(c, r)
      break
    case 5:
      pearPath(c, r)
      break
    default:
      c.beginPath()
      c.arc(0, 0, r, 0, Math.PI * 2)
  }
}

// 어깨가 넓고 아래로 갈수록 좁아지는 원뿔
function strawberryPath(c: CanvasRenderingContext2D, r: number) {
  c.beginPath()
  c.moveTo(-r * 0.97, -r * 0.22)
  c.bezierCurveTo(-r * 0.97, -r * 1.02, r * 0.97, -r * 1.02, r * 0.97, -r * 0.22)
  c.bezierCurveTo(r * 0.88, r * 0.5, r * 0.34, r, 0, r)
  c.bezierCurveTo(-r * 0.34, r, -r * 0.88, r * 0.5, -r * 0.97, -r * 0.22)
  c.closePath()
}

// 꼭지 자리가 움푹 들어간 원
function applePath(c: CanvasRenderingContext2D, r: number) {
  c.beginPath()
  c.moveTo(0, -r * 0.76)
  c.bezierCurveTo(r * 0.46, -r * 1.06, r, -r * 0.68, r, 0)
  c.bezierCurveTo(r, r * 0.74, r * 0.5, r, 0, r)
  c.bezierCurveTo(-r * 0.5, r, -r, r * 0.74, -r, 0)
  c.bezierCurveTo(-r, -r * 0.68, -r * 0.46, -r * 1.06, 0, -r * 0.76)
  c.closePath()
}

// 위가 좁고 아래가 불룩한 조롱박
function pearPath(c: CanvasRenderingContext2D, r: number) {
  c.beginPath()
  c.moveTo(0, -r)
  c.bezierCurveTo(r * 0.4, -r * 0.94, r * 0.48, -r * 0.36, r * 0.42, -r * 0.06)
  c.bezierCurveTo(r * 1.0, r * 0.3, r * 0.84, r, 0, r)
  c.bezierCurveTo(-r * 0.84, r, -r * 1.0, r * 0.3, -r * 0.42, -r * 0.06)
  c.bezierCurveTo(-r * 0.48, -r * 0.36, -r * 0.4, -r * 0.94, 0, -r)
  c.closePath()
}

// 왼쪽 위 광원 기준 입체 음영
function fillBody(
  c: CanvasRenderingContext2D,
  tier: number,
  color: string,
  dark: string,
  r: number,
) {
  const grad = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.08)
  grad.addColorStop(0, mix(color, '#FFFFFF', 0.34))
  grad.addColorStop(0.5, color)
  // 가장자리는 완전한 dark가 아니라 살짝 섞어 채도를 유지 (무늬 대비 확보)
  grad.addColorStop(1, mix(color, dark, 0.78))
  c.fillStyle = grad
  bodyPath(c, tier, r)
  c.fill()
}

function drawGloss(c: CanvasRenderingContext2D, r: number) {
  c.save()
  // 큰 하이라이트
  c.globalAlpha = 0.32
  c.fillStyle = '#FFFFFF'
  c.beginPath()
  c.ellipse(-r * 0.36, -r * 0.46, r * 0.3, r * 0.19, -0.5, 0, Math.PI * 2)
  c.fill()
  // 작은 반짝임
  c.globalAlpha = 0.55
  c.beginPath()
  c.ellipse(-r * 0.14, -r * 0.62, r * 0.09, r * 0.06, -0.4, 0, Math.PI * 2)
  c.fill()
  // 아래쪽 반사광
  c.globalAlpha = 0.14
  c.beginPath()
  c.ellipse(r * 0.18, r * 0.62, r * 0.42, r * 0.14, 0.2, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

// ── 꼭지·잎 (본체 뒤) ─────────────────────────────────────
// 작게 그려도 남는 부분이라 티어마다 길이와 모양을 다르게 준다.

function drawTop(c: CanvasRenderingContext2D, tier: number, r: number) {
  if (tier === 7) {
    pineappleCrown(c, r)
    return
  }
  // 딸기는 꽃받침이 본체 앞에 오므로 여기서는 그리지 않는다
  const STEM: Record<number, { len: number; leaf: boolean }> = {
    0: { len: 0.42, leaf: true }, // 체리 — 길게 늘어뜨려 사과와 구분
    2: { len: 0.14, leaf: false }, // 포도
    4: { len: 0.2, leaf: true }, // 사과
    5: { len: 0.16, leaf: true }, // 배
    6: { len: 0.12, leaf: true }, // 복숭아
    8: { len: 0.13, leaf: false }, // 멜론
    9: { len: 0.14, leaf: true }, // 수박
  }
  const spec = STEM[tier]
  if (!spec) return

  const len = r * spec.len
  c.save()
  c.strokeStyle = '#6D4C2F'
  c.lineWidth = Math.max(r * 0.08, 2)
  c.lineCap = 'round'
  c.beginPath()
  c.moveTo(0, -r * 0.9)
  c.quadraticCurveTo(r * 0.08, -r - len * 0.7, r * 0.18, -r - len)
  c.stroke()
  if (spec.leaf) {
    c.fillStyle = '#4CAF50'
    c.beginPath()
    c.ellipse(r * 0.36, -r - len * 0.85, r * 0.2, r * 0.1, -0.5, 0, Math.PI * 2)
    c.fill()
  }
  c.restore()
}

// 파인애플 — 위로 뻗은 잎 다발
function pineappleCrown(c: CanvasRenderingContext2D, r: number) {
  c.save()
  c.fillStyle = '#5A9E3D'
  for (const [tilt, len] of [
    [-0.55, 0.34],
    [-0.24, 0.46],
    [0, 0.52],
    [0.24, 0.46],
    [0.55, 0.34],
  ] as Array<[number, number]>) {
    c.save()
    c.rotate(tilt)
    c.beginPath()
    c.moveTo(-r * 0.11, -r * 0.9)
    c.quadraticCurveTo(0, -r * (1 + len), r * 0.11, -r * 0.9)
    c.closePath()
    c.fill()
    c.restore()
  }
  c.restore()
}

// 딸기 꽃받침 — 본체 위에 얹힌 별 모양. 클리핑 안에서 그리면 표면에 박힌
// 초록 조각처럼 보여서 본체를 다 그린 뒤 위에 올린다.
function drawCalyx(c: CanvasRenderingContext2D, tier: number, r: number) {
  if (tier !== 1) return
  c.save()
  c.translate(0, -r * 0.72)
  c.fillStyle = '#43A047'
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    c.save()
    c.rotate(a)
    c.beginPath()
    c.moveTo(-r * 0.1, 0)
    c.quadraticCurveTo(0, -r * 0.52, r * 0.1, 0)
    c.closePath()
    c.fill()
    c.restore()
  }
  // 가운데 짧은 꼭지
  c.strokeStyle = '#2E7D32'
  c.lineWidth = Math.max(r * 0.07, 1.8)
  c.lineCap = 'round'
  c.beginPath()
  c.moveTo(0, 0)
  c.lineTo(0, -r * 0.34)
  c.stroke()
  c.restore()
}

// ── 표면 무늬 (본체로 클리핑된 상태에서 호출) ──────────────

function drawPattern(c: CanvasRenderingContext2D, tier: number, r: number, dark: string) {
  switch (tier) {
    case 0: // 체리 — 중앙 세로 홈
      creaseLine(c, r, dark, 0.28)
      break
    case 1: // 딸기 — 씨앗
      strawberrySeeds(c, r)
      break
    case 2: // 포도 — 알갱이 뭉치
      grape(c, r, dark)
      break
    case 3: // 오렌지 — 껍질 질감 + 배꼽
      orange(c, r, dark)
      break
    case 4: // 사과 — 세로 홈
      creaseLine(c, r, dark, 0.22)
      break
    case 5: // 배 — 잔점 무늬
      speckles(c, r, dark, 26, 0.4)
      break
    case 6: // 복숭아 — 붉은 볼터치 + 깊은 홈
      peach(c, r, dark)
      break
    case 7: // 파인애플 — 격자 무늬
      pineapple(c, r, dark)
      break
    case 8: // 멜론 — 그물 무늬
      melonNet(c, r, dark)
      break
    case 9: // 수박 — 물결 줄무늬
      watermelonStripes(c, r, dark)
      break
  }
}

function creaseLine(c: CanvasRenderingContext2D, r: number, dark: string, alpha: number) {
  c.save()
  c.globalAlpha = alpha
  c.strokeStyle = dark
  c.lineWidth = Math.max(r * 0.07, 1.5)
  c.beginPath()
  c.moveTo(0, -r)
  c.quadraticCurveTo(r * 0.16, 0, 0, r)
  c.stroke()
  c.restore()
}

function strawberrySeeds(c: CanvasRenderingContext2D, r: number) {
  c.save()
  c.fillStyle = '#FFE082'
  const seeds: Array<[number, number]> = [
    [-0.5, -0.1], [-0.2, 0.22], [0.12, -0.02], [0.42, 0.2],
    [-0.36, 0.48], [0.02, 0.58], [0.38, -0.34], [-0.12, -0.42],
    [0.58, -0.06], [-0.62, 0.28],
  ]
  for (const [sx, sy] of seeds) {
    c.save()
    c.translate(sx * r, sy * r)
    c.rotate(sx + sy)
    c.beginPath()
    c.ellipse(0, 0, r * 0.075, r * 0.045, 0, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }
  c.restore()
}

function grape(c: CanvasRenderingContext2D, r: number, dark: string) {
  c.save()
  // 알갱이 뭉치 — 각 알을 살짝 밝게 칠하고 경계선을 그어 송이처럼 보이게
  const cells: Array<[number, number, number]> = [
    [-0.44, -0.34, 0.36], [0.36, -0.42, 0.34], [0.02, 0.02, 0.38],
    [-0.46, 0.42, 0.32], [0.46, 0.34, 0.33], [0, -0.72, 0.28],
  ]
  for (const [gx, gy, gr] of cells) {
    const grad = c.createRadialGradient(
      (gx - gr * 0.3) * r, (gy - gr * 0.3) * r, r * 0.02,
      gx * r, gy * r, gr * r,
    )
    grad.addColorStop(0, 'rgb(255 255 255 / 0.35)')
    grad.addColorStop(1, 'rgb(255 255 255 / 0)')
    c.fillStyle = grad
    c.beginPath()
    c.arc(gx * r, gy * r, gr * r, 0, Math.PI * 2)
    c.fill()

    c.globalAlpha = 0.6
    c.strokeStyle = dark
    c.lineWidth = Math.max(r * 0.05, 1.3)
    c.stroke()
    c.globalAlpha = 1
  }
  c.restore()
}

function orange(c: CanvasRenderingContext2D, r: number, dark: string) {
  speckles(c, r, dark, 30, 0.16)
  c.save()
  // 배꼽 — 작게 그려도 남도록 별 모양 자국
  c.globalAlpha = 0.4
  c.strokeStyle = dark
  c.lineWidth = Math.max(r * 0.045, 1.2)
  c.lineCap = 'round'
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    c.beginPath()
    c.moveTo(0, -r * 0.78)
    c.lineTo(Math.sin(a) * r * 0.18, -r * 0.78 + Math.cos(a) * r * 0.18)
    c.stroke()
  }
  c.restore()
}

function speckles(
  c: CanvasRenderingContext2D,
  r: number,
  dark: string,
  count: number,
  alpha = 0.22,
) {
  c.save()
  c.globalAlpha = alpha
  c.fillStyle = dark
  // 고정 패턴(난수 없이) — 프레임마다 흔들리지 않도록
  for (let i = 0; i < count; i++) {
    const a = i * 2.399
    const d = Math.sqrt((i + 0.5) / count) * r * 0.92
    c.beginPath()
    c.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.035, 0, Math.PI * 2)
    c.fill()
  }
  c.restore()
}

function peach(c: CanvasRenderingContext2D, r: number, dark: string) {
  c.save()
  // 붉은 그라데이션 블러시
  const grad = c.createRadialGradient(r * 0.35, r * 0.1, r * 0.05, r * 0.3, 0, r * 1.1)
  grad.addColorStop(0, 'rgb(244 67 54 / 0.45)')
  grad.addColorStop(1, 'rgb(244 67 54 / 0)')
  c.fillStyle = grad
  c.beginPath()
  c.arc(0, 0, r, 0, Math.PI * 2)
  c.fill()
  c.restore()
  creaseLine(c, r, dark, 0.4)
}

function pineapple(c: CanvasRenderingContext2D, r: number, dark: string) {
  c.save()
  c.globalAlpha = 0.35
  c.strokeStyle = dark
  c.lineWidth = Math.max(r * 0.045, 1.2)
  const step = r * 0.34
  for (let i = -3; i <= 3; i++) {
    c.beginPath()
    c.moveTo(-r * 1.2, i * step - r * 1.2)
    c.lineTo(r * 1.2, i * step + r * 1.2)
    c.stroke()
    c.beginPath()
    c.moveTo(-r * 1.2, -i * step + r * 1.2)
    c.lineTo(r * 1.2, -i * step - r * 1.2)
    c.stroke()
  }
  c.restore()
}

function melonNet(c: CanvasRenderingContext2D, r: number, dark: string) {
  c.save()
  c.globalAlpha = 0.85
  c.strokeStyle = mix(dark, '#FFFFFF', 0.72)
  c.lineWidth = Math.max(r * 0.055, 1.6)
  c.lineCap = 'round'
  for (let i = -2; i <= 2; i++) {
    c.beginPath()
    c.moveTo(-r, i * r * 0.42 - r * 0.1)
    c.bezierCurveTo(-r * 0.3, i * r * 0.42 + r * 0.22, r * 0.3, i * r * 0.42 - r * 0.3, r, i * r * 0.42 + r * 0.1)
    c.stroke()
    c.beginPath()
    c.moveTo(i * r * 0.42 - r * 0.1, -r)
    c.bezierCurveTo(i * r * 0.42 + r * 0.22, -r * 0.3, i * r * 0.42 - r * 0.3, r * 0.3, i * r * 0.42 + r * 0.1, r)
    c.stroke()
  }
  c.restore()
}

// 진짜 수박 느낌의 물결 줄무늬 — 구면을 따라 폭이 좁아지는 세로 띠
function watermelonStripes(c: CanvasRenderingContext2D, r: number, dark: string) {
  c.save()
  c.globalAlpha = 0.9
  c.fillStyle = dark
  // 구의 경도선처럼 중앙일수록 넓고 가장자리로 갈수록 좁아진다
  for (const center of [-0.82, -0.5, -0.17, 0.17, 0.5, 0.82]) {
    const cx = center * r
    const halfWidth = r * 0.085 * Math.sqrt(Math.max(0.08, 1 - center * center))
    const wobble = halfWidth * 0.9
    c.beginPath()
    c.moveTo(cx - halfWidth, -r * 1.05)
    c.bezierCurveTo(
      cx - halfWidth - wobble, -r * 0.35,
      cx - halfWidth + wobble, r * 0.35,
      cx - halfWidth * 0.8, r * 1.05,
    )
    c.lineTo(cx + halfWidth * 0.8, r * 1.05)
    c.bezierCurveTo(
      cx + halfWidth + wobble, r * 0.35,
      cx + halfWidth - wobble, -r * 0.35,
      cx + halfWidth, -r * 1.05,
    )
    c.closePath()
    c.fill()
  }
  c.restore()
}

// 눈동자에 캐치라이트 + 볼터치가 들어간 마스코트 얼굴
function drawFace(c: CanvasRenderingContext2D, faceColor: string, r: number) {
  const eyeR = Math.max(r * 0.115, 2.5)
  const eyeX = r * 0.33
  const eyeY = -r * 0.12

  c.save()
  // 볼터치
  c.globalAlpha = 0.3
  c.fillStyle = '#FF7A7A'
  c.beginPath()
  c.ellipse(-eyeX - r * 0.2, eyeY + r * 0.28, r * 0.15, r * 0.1, 0, 0, Math.PI * 2)
  c.ellipse(eyeX + r * 0.2, eyeY + r * 0.28, r * 0.15, r * 0.1, 0, 0, Math.PI * 2)
  c.fill()
  c.globalAlpha = 1

  // 눈 (세로로 긴 타원 = 더 귀여움)
  c.fillStyle = faceColor
  c.beginPath()
  c.ellipse(-eyeX, eyeY, eyeR * 0.85, eyeR * 1.15, 0, 0, Math.PI * 2)
  c.ellipse(eyeX, eyeY, eyeR * 0.85, eyeR * 1.15, 0, 0, Math.PI * 2)
  c.fill()

  // 캐치라이트
  c.fillStyle = '#FFFFFF'
  c.beginPath()
  c.arc(-eyeX + eyeR * 0.32, eyeY - eyeR * 0.42, eyeR * 0.34, 0, Math.PI * 2)
  c.arc(eyeX + eyeR * 0.32, eyeY - eyeR * 0.42, eyeR * 0.34, 0, Math.PI * 2)
  c.fill()

  // 입
  c.strokeStyle = faceColor
  c.lineWidth = Math.max(r * 0.06, 1.8)
  c.lineCap = 'round'
  c.beginPath()
  c.arc(0, r * 0.16, r * 0.22, 0.2 * Math.PI, 0.8 * Math.PI)
  c.stroke()
  c.restore()
}

// 두 hex 색을 섞는다 (ratio 0 = a, 1 = b)
function mix(a: string, b: string, ratio: number): string {
  const pa = parseHex(a)
  const pb = parseHex(b)
  const ch = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * ratio)
  return `rgb(${ch(0)} ${ch(1)} ${ch(2)})`
}

function parseHex(hex: string): [number, number, number] {
  const v = hex.replace('#', '')
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ]
}
