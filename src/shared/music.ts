// 게임 BGM — public/bgm/<트랙>.mp3 를 반복 재생한다.
// 음원 파일이 없으면 조용히 넘어가므로, 파일을 넣기 전에도 앱은 그대로 돈다.
// 효과음(sound.ts)과 토글을 따로 둔다 — 효과음은 켜두고 BGM만 끄고 싶은 사람이 많다.

const KEY = 'webgame:music'
const VOLUME = 0.3

let audio: HTMLAudioElement | null = null
let track = ''
let gestureRetry: (() => void) | null = null
let fadeId = 0

export function isMusicEnabled(): boolean {
  return localStorage.getItem(KEY) !== 'off'
}

export function setMusicEnabled(on: boolean) {
  localStorage.setItem(KEY, on ? 'on' : 'off')
  if (on) play()
  else stopAudio()
}

function clearGestureRetry() {
  if (!gestureRetry) return
  window.removeEventListener('pointerdown', gestureRetry)
  gestureRetry = null
}

function clearFade() {
  if (!fadeId) return
  clearInterval(fadeId)
  fadeId = 0
}

function stopAudio() {
  clearFade()
  audio?.pause()
  audio = null
  clearGestureRetry()
}

function play() {
  if (!track || !isMusicEnabled()) return
  clearFade()
  audio ??= new Audio(`${import.meta.env.BASE_URL}bgm/${track}.mp3`)
  audio.loop = true
  audio.volume = VOLUME
  void audio.play().catch((err: DOMException) => {
    // 자동 재생이 막힌 경우에만 첫 터치 때 다시 시도한다.
    // 파일이 없거나 디코딩에 실패한 경우는 재시도해도 소용없으니 그대로 둔다.
    if (err?.name !== 'NotAllowedError') return
    clearGestureRetry()
    gestureRetry = () => {
      clearGestureRetry()
      play()
    }
    window.addEventListener('pointerdown', gestureRetry, { once: true })
  })
}

export function startBgm(next: string) {
  if (next === track && audio) return
  stopAudio()
  track = next
  play()
}

export function stopBgm() {
  track = ''
  stopAudio()
}

// 판이 끝나면 곡을 접는다 — 결과 팝업 뒤에서 경쾌한 곡이 계속 흐르면
// 방금 끝났다는 게 전달되지 않는다. 곡은 멈춘 자리에 세워 두고,
// 다시 시작하면 이어서 튼다 (처음부터 다시 틀면 판마다 앞부분만 듣게 된다).
const FADE_STEP = 40

function fade(to: number, ms: number, onDone?: () => void) {
  const target = audio
  if (!target) return
  clearFade()
  const delta = ((to - target.volume) * FADE_STEP) / ms
  fadeId = window.setInterval(() => {
    const next = target.volume + delta
    const done = delta < 0 ? next <= to : next >= to
    target.volume = Math.max(0, Math.min(VOLUME, done ? to : next))
    if (!done) return
    clearFade()
    onDone?.()
  }, FADE_STEP)
}

export function duckBgmForResult() {
  if (!audio || audio.paused) return
  fade(0, 500, () => audio?.pause())
}

export function resumeBgmAfterResult() {
  if (!track || !isMusicEnabled() || !audio) return
  void audio.play().catch(() => {})
  fade(VOLUME, 400)
}

// 게임마다 곡을 만들 수는 없으니 분위기 셋으로 묶는다.
const ACTION = new Set(['runner', 'dodge', 'orbit', 'rhythm', 'survivor', 'jump', 'brick', 'defense'])
const SIM = new Set(['deck', 'autochess'])

export function bgmFor(slug: string): string {
  if (ACTION.has(slug)) return 'action'
  if (SIM.has(slug)) return 'sim'
  return 'puzzle'
}
