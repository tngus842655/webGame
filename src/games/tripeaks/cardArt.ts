// 카드 아트 — 무늬는 벡터 패스로 직접 그린다 (플랫폼별 텍스트 글리프 렌더 차이 방지)

import { CARD_H, CARD_W } from './state'
import { font } from '../ui'

const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const RED = '#C62828'
const BLACK = '#263238'

function suitColor(suit: number): string {
  return suit === 1 || suit === 2 ? RED : BLACK
}

// (0,0) 중심, s = 반높이 크기로 무늬 경로 구성 (♠♥♦♣ = 0..3)
function traceSuit(c: CanvasRenderingContext2D, suit: number, s: number) {
  c.beginPath()
  if (suit === 1) {
    // 하트
    c.moveTo(0, s)
    c.bezierCurveTo(-s * 1.2, s * 0.05, -s * 0.75, -s, 0, -s * 0.4)
    c.bezierCurveTo(s * 0.75, -s, s * 1.2, s * 0.05, 0, s)
  } else if (suit === 2) {
    // 다이아몬드
    c.moveTo(0, -s)
    c.lineTo(s * 0.72, 0)
    c.lineTo(0, s)
    c.lineTo(-s * 0.72, 0)
    c.closePath()
  } else if (suit === 0) {
    // 스페이드: 역하트 + 줄기
    c.moveTo(0, -s)
    c.bezierCurveTo(-s * 1.2, -s * 0.05, -s * 0.8, s * 0.75, 0, s * 0.3)
    c.bezierCurveTo(s * 0.8, s * 0.75, s * 1.2, -s * 0.05, 0, -s)
    c.moveTo(0, s * 0.3)
    c.quadraticCurveTo(-s * 0.05, s * 0.7, -s * 0.4, s)
    c.lineTo(s * 0.4, s)
    c.quadraticCurveTo(s * 0.05, s * 0.7, 0, s * 0.3)
  } else {
    // 클럽: 원 3개 + 줄기
    const r = s * 0.44
    c.moveTo(r, -s * 0.5)
    c.arc(0, -s * 0.5, r, 0, Math.PI * 2)
    c.moveTo(-s * 0.45 + r, s * 0.12)
    c.arc(-s * 0.45, s * 0.12, r, 0, Math.PI * 2)
    c.moveTo(s * 0.45 + r, s * 0.12)
    c.arc(s * 0.45, s * 0.12, r, 0, Math.PI * 2)
    c.moveTo(0, s * 0.1)
    c.quadraticCurveTo(-s * 0.05, s * 0.65, -s * 0.38, s)
    c.lineTo(s * 0.38, s)
    c.quadraticCurveTo(s * 0.05, s * 0.65, 0, s * 0.1)
  }
}

// 앞면: 흰 라운드 사각형 + 모서리 랭크·작은 무늬 + 중앙 큰 무늬. glow = 낼 수 있는 카드 발광
export function drawCardFace(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rank: number,
  suit: number,
  glow: boolean,
) {
  const x = cx - CARD_W / 2
  const y = cy - CARD_H / 2
  c.save()
  if (glow) {
    c.save()
    c.strokeStyle = '#FFD54F'
    c.lineWidth = 5
    c.shadowColor = '#FFC107'
    c.shadowBlur = 16
    c.beginPath()
    c.roundRect(x - 2, y - 2, CARD_W + 4, CARD_H + 4, 12)
    c.stroke()
    c.restore()
  }
  c.shadowColor = 'rgb(0 0 0 / 0.25)'
  c.shadowBlur = 5
  c.shadowOffsetY = 2
  c.fillStyle = '#FFFFFF'
  c.beginPath()
  c.roundRect(x, y, CARD_W, CARD_H, 10)
  c.fill()
  c.shadowColor = 'transparent'
  c.shadowBlur = 0
  c.shadowOffsetY = 0
  c.strokeStyle = '#D8D2C8'
  c.lineWidth = 1.5
  c.stroke()

  const color = suitColor(suit)
  c.fillStyle = color
  c.font = font(24, true)
  c.textAlign = 'left'
  c.textBaseline = 'top'
  c.fillText(RANK_LABELS[rank], x + 8, y + 8)
  c.save()
  c.translate(x + 16, y + 46)
  traceSuit(c, suit, 8)
  c.fill()
  c.restore()
  c.save()
  c.translate(cx, cy + 14)
  traceSuit(c, suit, 26)
  c.fill()
  c.restore()
  c.restore()
}

// 뒷면: 남색 바탕 + 단순 격자 패턴
export function drawCardBack(c: CanvasRenderingContext2D, cx: number, cy: number) {
  const x = cx - CARD_W / 2
  const y = cy - CARD_H / 2
  c.save()
  c.shadowColor = 'rgb(0 0 0 / 0.25)'
  c.shadowBlur = 5
  c.shadowOffsetY = 2
  c.fillStyle = '#283593'
  c.beginPath()
  c.roundRect(x, y, CARD_W, CARD_H, 10)
  c.fill()
  c.shadowColor = 'transparent'
  c.shadowBlur = 0
  c.shadowOffsetY = 0
  c.strokeStyle = '#1A237E'
  c.lineWidth = 2
  c.stroke()
  c.beginPath()
  c.roundRect(x + 7, y + 7, CARD_W - 14, CARD_H - 14, 6)
  c.clip()
  c.strokeStyle = 'rgb(255 255 255 / 0.16)'
  c.lineWidth = 1.5
  c.beginPath()
  for (let gx = x - CARD_H; gx < x + CARD_W; gx += 14) {
    c.moveTo(gx, y)
    c.lineTo(gx + CARD_H, y + CARD_H)
    c.moveTo(gx + CARD_H, y)
    c.lineTo(gx, y + CARD_H)
  }
  c.stroke()
  c.restore()
}
