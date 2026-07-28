// 효과음 — public/sfx/<이름>.mp3 를 먼저 찾고, 파일이 없으면 신스 소리로 대신한다.
// 그래서 파일을 넣기 전에도 앱은 그대로 돌고, 파일을 넣는 순간 그 소리부터 바뀐다.
// (BGM은 music.ts가 같은 방식을 쓴다. 켜고 끄는 스위치는 설정의 효과음 토글 하나다.)

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

// 미끄러지는 소리처럼 음이 이어서 움직이는 것
function sweep(from: number, to: number, duration: number, type: OscillatorType, volume: number) {
  const ac = ensureCtx()
  if (!ac) return
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  const t0 = ac.currentTime
  osc.type = type
  osc.frequency.setValueAtTime(from, t0)
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + duration)
  gain.gain.setValueAtTime(volume, t0)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  osc.connect(gain).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + duration)
}

// ── 효과음 목록 ───────────────────────────────────────────────
// 이름 하나가 public/sfx/<이름>.mp3 하나에 대응한다.
export type SfxName =
  // 공통 — 여러 게임이 나눠 쓴다
  | 'tap'
  | 'merge'
  | 'gameover'
  | 'pop'
  | 'clear'
  | 'fail'
  | 'hurt'
  | 'coin'
  | 'whoosh'
  | 'impact'
  | 'unlock'
  | 'select'
  // 그 게임의 정체가 되는 소리
  | 'rhythm-hit'
  | 'rhythm-miss'
  | 'shoot'
  | 'explode'
  | 'sword'
  | 'stone'
  | 'ice-slide'
  | 'water'
  | 'flip'

interface SfxDef {
  // 파일마다 녹음 크기가 달라서 여기서 맞춘다
  gain: number
  // 파일이 없을 때 낼 소리. rate는 playSfx가 넘긴 음높이 배수.
  synth: (rate: number) => void
}

const SFX: Record<SfxName, SfxDef> = {
  tap: { gain: 0.5, synth: (r) => tone(220 * r, 0.08, 'triangle', 0.08) },
  merge: {
    gain: 0.55,
    synth: (r) => {
      tone(280 * r, 0.12, 'sine', 0.12)
      tone(420 * r, 0.15, 'sine', 0.1, 0.06)
    },
  },
  gameover: {
    gain: 0.5,
    synth: () => {
      tone(330, 0.25, 'sawtooth', 0.07)
      tone(247, 0.3, 'sawtooth', 0.07, 0.22)
      tone(165, 0.5, 'sawtooth', 0.07, 0.5)
    },
  },
  pop: { gain: 0.5, synth: (r) => tone(660 * r, 0.07, 'sine', 0.1) },
  clear: {
    gain: 0.5,
    synth: () => {
      tone(523, 0.12, 'sine', 0.1)
      tone(659, 0.12, 'sine', 0.1, 0.1)
      tone(784, 0.26, 'sine', 0.11, 0.2)
    },
  },
  fail: { gain: 0.5, synth: () => tone(150, 0.22, 'square', 0.06) },
  hurt: {
    gain: 0.5,
    synth: () => {
      tone(180, 0.14, 'sawtooth', 0.09)
      tone(120, 0.2, 'sawtooth', 0.07, 0.05)
    },
  },
  coin: {
    gain: 0.45,
    synth: () => {
      tone(988, 0.06, 'square', 0.05)
      tone(1319, 0.14, 'square', 0.05, 0.05)
    },
  },
  whoosh: { gain: 0.4, synth: () => sweep(700, 180, 0.18, 'sine', 0.05) },
  impact: { gain: 0.55, synth: () => tone(110, 0.12, 'triangle', 0.12) },
  unlock: {
    gain: 0.5,
    synth: () => {
      tone(587, 0.1, 'sine', 0.09)
      tone(880, 0.2, 'sine', 0.09, 0.08)
    },
  },
  select: { gain: 0.5, synth: () => tone(440, 0.06, 'square', 0.06) },
  'rhythm-hit': { gain: 0.5, synth: (r) => tone(880 * r, 0.05, 'sine', 0.09) },
  'rhythm-miss': { gain: 0.5, synth: () => tone(140, 0.16, 'square', 0.07) },
  shoot: { gain: 0.4, synth: () => sweep(900, 300, 0.1, 'sawtooth', 0.05) },
  explode: { gain: 0.5, synth: () => sweep(300, 60, 0.3, 'sawtooth', 0.09) },
  sword: { gain: 0.5, synth: () => sweep(1200, 400, 0.12, 'sawtooth', 0.06) },
  stone: { gain: 0.55, synth: () => tone(300, 0.06, 'triangle', 0.12) },
  'ice-slide': { gain: 0.4, synth: () => sweep(400, 900, 0.35, 'sine', 0.04) },
  water: { gain: 0.4, synth: () => sweep(500, 200, 0.22, 'sine', 0.05) },
  flip: { gain: 0.45, synth: () => tone(520, 0.05, 'triangle', 0.07) },
}

// undefined = 아직 안 불러봄, null = 파일이 없어 신스로 간다
const buffers = new Map<SfxName, AudioBuffer | null>()
const loading = new Set<SfxName>()
const lastAt = new Map<SfxName, number>()

// mp3를 먼저 찾고 없으면 wav. 기본 소리는 합성해 구운 wav가 들어 있고
// (tools/gen-sfx.py), 같은 이름의 mp3를 넣으면 그쪽이 이긴다.
const EXTENSIONS = ['mp3', 'wav']

async function load(name: SfxName) {
  if (loading.has(name) || buffers.has(name)) return
  const ac = ensureCtx()
  // 소리를 꺼 둔 동안은 받지 않는다 (다시 켜면 그때 받는다)
  if (!ac) return
  loading.add(name)
  for (const ext of EXTENSIONS) {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}sfx/${name}.${ext}`)
      if (!res.ok) continue
      // 없는 파일에 index.html이 돌아오는 배포도 있어서, 디코딩까지 돼야 있는 것으로 친다
      buffers.set(name, await ac.decodeAudioData(await res.arrayBuffer()))
      loading.delete(name)
      return
    } catch {
      // 다음 확장자로
    }
  }
  // 둘 다 없다. 신스로 내고 다시 찾지 않는다.
  buffers.set(name, null)
  loading.delete(name)
}

// 게임을 열 때 그 게임이 쓸 소리를 미리 받아 둔다 (첫 소리만 신스로 나가지 않게)
export function preloadSfx(...names: SfxName[]) {
  for (const name of names) void load(name)
}

export interface SfxOptions {
  // 음높이 배수 — 연쇄가 쌓일 때 음을 올리는 데 쓴다
  rate?: number
  gain?: number
}

export function playSfx(name: SfxName, opts: SfxOptions = {}) {
  const ac = ensureCtx()
  if (!ac) return
  // 같은 소리가 한 프레임 안에 여러 번 겹치면 뭉쳐서 커진다
  const now = ac.currentTime
  if (now - (lastAt.get(name) ?? -1) < 0.02) return
  lastAt.set(name, now)

  const rate = opts.rate ?? 1
  const buffer = buffers.get(name)
  if (buffer === undefined) void load(name)
  if (!buffer) {
    SFX[name].synth(rate)
    return
  }
  const src = ac.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = rate
  const gain = ac.createGain()
  gain.gain.value = SFX[name].gain * (opts.gain ?? 1)
  src.connect(gain).connect(ac.destination)
  src.start()
}

// 아래 셋은 부르는 곳이 많아 이름을 그대로 둔다 — 속만 파일 기반으로 바뀌었다.
export function playDrop() {
  playSfx('tap')
}

// 티어가 높을수록 높은 음. 연쇄가 쌓이는 게 소리로 들려야 한다.
// 파일은 1.5배까지만 올린다 (그 이상은 표본이 지나치게 짧고 날카로워진다).
export function playMerge(tier: number) {
  playSfx('merge', { rate: Math.min(1.5, 1 + Math.max(0, tier) * 0.07) })
}

export function playGameOver() {
  playSfx('gameover')
}

export function vibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) navigator.vibrate(pattern)
}
