// WebAudio 신스 효과음 — 오디오 에셋 0개 유지. 설정의 토글과 localStorage 키를 공유한다.

const KEY = 'webgame:sound'

let audioCtx: AudioContext | null = null

export function isSoundEnabled(): boolean {
  return localStorage.getItem(KEY) !== 'off'
}

export function setSoundEnabled(on: boolean) {
  localStorage.setItem(KEY, on ? 'on' : 'off')
}

function ensureCtx(): AudioContext | null {
  if (!isSoundEnabled()) return null
  audioCtx ??= new AudioContext()
  if (audioCtx.state === 'suspended') void audioCtx.resume()
  return audioCtx
}

function tone(freq: number, duration: number, type: OscillatorType, volume: number, delay = 0) {
  const ac = ensureCtx()
  if (!ac) return
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  const t0 = ac.currentTime + delay
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  gain.gain.setValueAtTime(volume, t0)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  osc.connect(gain).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + duration)
}

export function playDrop() {
  tone(220, 0.08, 'triangle', 0.08)
}

// 티어가 높을수록 높은 음의 2음 팝
export function playMerge(tier: number) {
  const base = 280 + tier * 55
  tone(base, 0.12, 'sine', 0.12)
  tone(base * 1.5, 0.15, 'sine', 0.1, 0.06)
}

export function playGameOver() {
  tone(330, 0.25, 'sawtooth', 0.07)
  tone(247, 0.3, 'sawtooth', 0.07, 0.22)
  tone(165, 0.5, 'sawtooth', 0.07, 0.5)
}

export function vibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) navigator.vibrate(pattern)
}
