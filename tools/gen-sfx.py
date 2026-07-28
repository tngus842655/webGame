#!/usr/bin/env python3
"""효과음을 합성해 public/sfx/*.wav 로 굽는다.

녹음 파일을 쓰지 않는 이유: 이 앱은 그림도 전부 벡터로 그린다. 여기저기서
모은 녹음 21개를 섞으면 게임마다 소리의 결이 달라진다. 파형을 직접 만들면
21개가 한 악기에서 나온 것처럼 들린다 (sfxr 계열 게임들이 쓰는 방법).

같은 이름의 .mp3 를 public/sfx/ 에 넣으면 그쪽이 이긴다 (shared/sound.ts).
소리를 고치고 싶으면 아래 값을 바꾸고 이 스크립트를 다시 돌리면 된다.

    python3 tools/gen-sfx.py
"""

import math
import os
import random
import struct
import wave

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'sfx')


# ── 신호 만들기 ────────────────────────────────────────────────

def buf(seconds):
    return [0.0] * int(SR * seconds)


def osc(dst, freq, amp=1.0, shape='sine', start=0.0, dur=None, freq_end=None, curve=1.0):
    """dst에 파형을 더한다. freq_end를 주면 그동안 음이 미끄러진다."""
    i0 = int(start * SR)
    n = len(dst) - i0 if dur is None else int(dur * SR)
    n = min(n, len(dst) - i0)
    phase = 0.0
    for i in range(n):
        k = i / max(1, n - 1)
        f = freq if freq_end is None else freq * (freq_end / freq) ** (k ** curve)
        phase += 2 * math.pi * f / SR
        if shape == 'sine':
            v = math.sin(phase)
        elif shape == 'tri':
            v = 2 / math.pi * math.asin(max(-1.0, min(1.0, math.sin(phase))))
        elif shape == 'square':
            v = 1.0 if math.sin(phase) >= 0 else -1.0
        else:  # saw
            v = 2 * ((phase / (2 * math.pi)) % 1.0) - 1.0
        dst[i0 + i] += v * amp


def noise(dst, amp=1.0, start=0.0, dur=None, seed=1):
    rng = random.Random(seed)
    i0 = int(start * SR)
    n = len(dst) - i0 if dur is None else int(dur * SR)
    n = min(n, len(dst) - i0)
    for i in range(n):
        dst[i0 + i] += rng.uniform(-1.0, 1.0) * amp


def env(dst, attack=0.002, decay=None, curve=3.0, start=0.0, dur=None, hold=0.0):
    """감쇠 곡선을 곱한다. curve가 클수록 빨리 사그라든다."""
    i0 = int(start * SR)
    n = len(dst) - i0 if dur is None else int(dur * SR)
    n = min(n, len(dst) - i0)
    a = max(1, int(attack * SR))
    h = int(hold * SR)
    d = n - a - h if decay is None else int(decay * SR)
    for i in range(n):
        if i < a:
            g = i / a
        elif i < a + h:
            g = 1.0
        else:
            k = min(1.0, (i - a - h) / max(1, d))
            g = (1.0 - k) ** curve
        dst[i0 + i] *= g


def biquad(dst, kind, freq, q=0.7, freq_end=None):
    """RBJ 쿡북 필터. freq_end를 주면 차단 주파수가 그동안 미끄러진다."""
    n = len(dst)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(n):
        k = i / max(1, n - 1)
        f = freq if freq_end is None else freq * (freq_end / freq) ** k
        f = max(20.0, min(SR * 0.45, f))
        w = 2 * math.pi * f / SR
        cs, sn = math.cos(w), math.sin(w)
        alpha = sn / (2 * q)
        if kind == 'lp':
            b0, b1, b2 = (1 - cs) / 2, 1 - cs, (1 - cs) / 2
        elif kind == 'hp':
            b0, b1, b2 = (1 + cs) / 2, -(1 + cs), (1 + cs) / 2
        else:  # bp
            b0, b1, b2 = alpha, 0.0, -alpha
        a0, a1, a2 = 1 + alpha, -2 * cs, 1 - alpha
        x0 = dst[i]
        y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1 = x1, x0
        y2, y1 = y1, y0
        dst[i] = y0


def mix(dst, src, gain=1.0):
    for i in range(min(len(dst), len(src))):
        dst[i] += src[i] * gain


def finish(dst, peak=0.89):
    """정규화 + 앞뒤 마무리. 앞뒤를 다듬지 않으면 '틱' 소리가 붙는다."""
    top = max(abs(v) for v in dst) or 1.0
    g = peak / top
    fade_in = int(0.0015 * SR)
    fade_out = int(0.006 * SR)
    n = len(dst)
    for i in range(n):
        v = dst[i] * g
        if i < fade_in:
            v *= i / fade_in
        if i > n - fade_out:
            v *= (n - i) / fade_out
        # 부드러운 리미터 — 정점만 눌러 준다
        dst[i] = math.tanh(v * 1.1) * 0.92
    return dst


# 밝은 소리만 44.1kHz로 굽는다. 나머지는 22.05kHz로 내려도 귀로는 같고 파일은 절반이다.
BRIGHT = {'rhythm-hit', 'coin', 'select', 'flip', 'ice-slide'}


def save(name, samples):
    os.makedirs(OUT, exist_ok=True)
    rate = SR
    if name not in BRIGHT:
        biquad(samples, 'lp', 9200, 0.8)  # 솎기 전에 위를 잘라 앨리어싱을 막는다
        samples = samples[::2]
        rate = SR // 2
    path = os.path.join(OUT, name + '.wav')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v)) * 32767)) for v in samples))
    return path


# ── 소리 하나하나 ──────────────────────────────────────────────
# 길이·음높이는 SOUND_REQUEST.md에 적어 둔 기준을 따른다.

def s_tap():
    # 손끝으로 톡 — 짧고 둥글게. 하루에 수천 번 들릴 소리라 날이 서면 안 된다.
    d = buf(0.09)
    osc(d, 440, 0.7, 'sine', freq_end=200, curve=0.6)
    env(d, 0.001, curve=4)
    click = buf(0.09)
    noise(click, 0.5, dur=0.006, seed=11)
    biquad(click, 'lp', 2600)
    mix(d, click, 0.5)
    return finish(d, 0.7)


def s_select():
    # 결정했다는 딸깍 — tap보다 단단하다
    d = buf(0.07)
    osc(d, 880, 0.5, 'square', freq_end=660)
    env(d, 0.0008, curve=5)
    body = buf(0.07)
    noise(body, 0.6, dur=0.01, seed=22)
    biquad(body, 'bp', 3200, 1.4)
    env(body, 0.0005, curve=6)
    mix(d, body, 0.7)
    return finish(d, 0.75)


def s_pop():
    # 물방울이 터질 때는 음이 위로 튄다
    d = buf(0.13)
    osc(d, 320, 0.9, 'sine', freq_end=1100, curve=0.45)
    env(d, 0.001, curve=3.2)
    air = buf(0.13)
    noise(air, 0.35, dur=0.02, seed=33)
    biquad(air, 'bp', 2200, 1.1)
    env(air, 0.001, curve=5)
    mix(d, air, 0.5)
    return finish(d, 0.8)


def s_merge():
    # 종·마림바 — 배음을 얹어야 '팅' 소리가 난다
    d = buf(0.34)
    for partial, amp, det in ((1.0, 1.0, 1.0), (2.01, 0.42, 1.0), (3.02, 0.2, 1.0), (4.9, 0.1, 1.0)):
        p = buf(0.34)
        osc(p, 523.25 * partial * det, amp, 'sine')
        env(p, 0.002, curve=2.4 + partial * 0.5)
        mix(d, p, 1.0)
    strike = buf(0.34)
    noise(strike, 0.4, dur=0.005, seed=44)
    biquad(strike, 'bp', 4200, 1.6)
    mix(d, strike, 0.5)
    return finish(d, 0.82)


def s_coin():
    # 두 음 아르페지오 — 아케이드 동전의 기본형
    d = buf(0.34)
    a = buf(0.34)
    osc(a, 987.77, 0.8, 'square', dur=0.055)
    env(a, 0.001, curve=2, dur=0.055)
    b = buf(0.34)
    osc(b, 1318.51, 0.8, 'square', start=0.055, dur=0.28)
    env(b, 0.001, curve=2.6, start=0.055, dur=0.28)
    mix(d, a)
    mix(d, b)
    return finish(d, 0.72)


def s_clear():
    # 오르는 네 음. 1.2초를 넘기면 다음 판을 가로막는다.
    d = buf(0.95)
    notes = ((523.25, 0.0, 0.16), (659.25, 0.13, 0.16), (783.99, 0.26, 0.2), (1046.5, 0.39, 0.5))
    for freq, at, dur in notes:
        v = buf(0.95)
        osc(v, freq, 0.55, 'tri', start=at, dur=dur)
        osc(v, freq * 2, 0.16, 'sine', start=at, dur=dur)
        env(v, 0.004, curve=2.2, start=at, dur=dur)
        mix(d, v)
    return finish(d, 0.8)


def s_gameover():
    # 내려앉는 세 음 — 무섭기보다 아쉽게
    d = buf(1.05)
    notes = ((392.0, 0.0, 0.3), (311.13, 0.26, 0.32), (196.0, 0.54, 0.5))
    for freq, at, dur in notes:
        v = buf(1.05)
        osc(v, freq, 0.5, 'saw', start=at, dur=dur)
        osc(v, freq * 0.5, 0.3, 'tri', start=at, dur=dur)
        env(v, 0.006, curve=2, start=at, dur=dur)
        mix(d, v)
    biquad(d, 'lp', 2200, 0.8, freq_end=700)
    return finish(d, 0.78)


def s_fail():
    # 낮은 부저 — 크면 게임을 관두게 된다
    d = buf(0.26)
    osc(d, 165, 0.8, 'square', freq_end=118)
    env(d, 0.003, curve=1.8)
    grit = buf(0.26)
    noise(grit, 0.3, dur=0.26, seed=55)
    biquad(grit, 'lp', 900)
    env(grit, 0.003, curve=2.4)
    mix(d, grit, 0.45)
    # square의 높은 배음을 걷어낸다 — 안 그러면 부저가 지직거린다
    biquad(d, 'lp', 1200, 0.9)
    return finish(d, 0.72)


def s_hurt():
    # 퍽 — 저음 덩어리에 짧은 파열음
    d = buf(0.3)
    osc(d, 190, 1.0, 'sine', freq_end=68, curve=0.5)
    env(d, 0.001, curve=2.8)
    hit = buf(0.3)
    noise(hit, 0.9, dur=0.06, seed=66)
    biquad(hit, 'lp', 1500, 0.9)
    env(hit, 0.0008, curve=5)
    mix(d, hit, 0.8)
    return finish(d, 0.85)


def s_impact():
    # 나무에 부딪히는 탁 — 울림 없이 딱 끊긴다
    d = buf(0.15)
    body = buf(0.15)
    noise(body, 1.0, dur=0.08, seed=77)
    biquad(body, 'bp', 520, 3.5)
    env(body, 0.0005, curve=6)
    thump = buf(0.15)
    osc(thump, 150, 0.7, 'sine', freq_end=90)
    env(thump, 0.001, curve=5)
    mix(d, body, 1.0)
    mix(d, thump, 0.7)
    return finish(d, 0.84)


def s_whoosh():
    # 스치는 바람 — 지나가는 느낌이 나려면 필터가 열렸다 닫혀야 한다
    d = buf(0.24)
    noise(d, 1.0, seed=88)
    biquad(d, 'bp', 500, 0.9, freq_end=2600)
    biquad(d, 'lp', 5200)
    n = len(d)
    for i in range(n):
        k = i / (n - 1)
        d[i] *= math.sin(math.pi * k) ** 1.6
    return finish(d, 0.6)


def s_unlock():
    # 열리는 두 음 — 위로
    d = buf(0.46)
    for freq, at, dur in ((587.33, 0.0, 0.16), (880.0, 0.1, 0.36)):
        v = buf(0.46)
        osc(v, freq, 0.6, 'sine', start=at, dur=dur)
        osc(v, freq * 2.01, 0.22, 'sine', start=at, dur=dur)
        env(v, 0.004, curve=2.4, start=at, dur=dur)
        mix(d, v)
    return finish(d, 0.75)


def s_rhythm_hit():
    # 클로즈드 하이햇 — 1초에 여덟 번까지 울리므로 울림이 있으면 안 된다
    d = buf(0.1)
    noise(d, 1.0, seed=99)
    biquad(d, 'hp', 7000, 0.8)
    biquad(d, 'bp', 9500, 0.6)
    env(d, 0.0004, curve=9)
    tick = buf(0.1)
    osc(tick, 1600, 0.35, 'square', dur=0.008)
    env(tick, 0.0003, curve=7, dur=0.008)
    mix(d, tick, 0.5)
    return finish(d, 0.7)


def s_rhythm_miss():
    # 김빠지는 삑
    d = buf(0.2)
    osc(d, 220, 0.7, 'square', freq_end=140)
    env(d, 0.002, curve=2.2)
    biquad(d, 'lp', 1800)
    return finish(d, 0.62)


def s_shoot():
    # 짧은 레이저 — 0.15초마다 연사되므로 꼬리가 길면 뭉친다
    d = buf(0.13)
    osc(d, 1400, 0.8, 'saw', freq_end=220, curve=0.7)
    env(d, 0.001, curve=3.4)
    biquad(d, 'lp', 6000, 1.2, freq_end=1200)
    fizz = buf(0.13)
    noise(fizz, 0.3, dur=0.04, seed=101)
    biquad(fizz, 'bp', 3000, 1.0)
    env(fizz, 0.001, curve=4)
    mix(d, fizz, 0.4)
    return finish(d, 0.66)


def s_explode():
    # 펑 — 화면을 흔들 만큼은 아니게
    d = buf(0.46)
    noise(d, 1.0, seed=111)
    biquad(d, 'lp', 3600, 0.9, freq_end=260)
    env(d, 0.002, curve=2.6)
    boom = buf(0.46)
    osc(boom, 120, 0.9, 'sine', freq_end=45, curve=0.6)
    env(boom, 0.002, curve=2.2)
    mix(d, boom, 0.85)
    return finish(d, 0.86)


def s_sword():
    # 쉭 하고 지나간 뒤 금속이 운다
    d = buf(0.32)
    air = buf(0.32)
    noise(air, 1.0, dur=0.16, seed=121)
    biquad(air, 'bp', 900, 1.1, freq_end=4200)
    n = int(0.16 * SR)
    for i in range(n):
        k = i / (n - 1)
        air[i] *= math.sin(math.pi * k) ** 1.4
    ring = buf(0.32)
    for freq, amp in ((2450.0, 0.5), (3170.0, 0.3), (4310.0, 0.16)):
        p = buf(0.32)
        osc(p, freq, amp, 'sine', start=0.055, dur=0.26)
        env(p, 0.002, curve=3.2, start=0.055, dur=0.26)
        mix(ring, p)
    mix(d, air, 0.9)
    mix(d, ring, 0.55)
    return finish(d, 0.72)


def s_stone():
    # 나무판 위 바둑돌 — 마르고 단단하게
    d = buf(0.14)
    knock = buf(0.14)
    noise(knock, 1.0, dur=0.03, seed=131)
    biquad(knock, 'bp', 1150, 4.5)
    env(knock, 0.0004, curve=7)
    board = buf(0.14)
    osc(board, 430, 0.6, 'sine', freq_end=300)
    osc(board, 880, 0.25, 'sine', freq_end=700)
    env(board, 0.0006, curve=6)
    mix(d, knock, 1.0)
    mix(d, board, 0.8)
    return finish(d, 0.82)


def s_ice_slide():
    # 얼음 위를 스르륵 — 필터가 서서히 올라가며 미끄러지는 느낌을 만든다
    d = buf(0.44)
    noise(d, 1.0, seed=141)
    biquad(d, 'bp', 900, 1.6, freq_end=3400)
    biquad(d, 'hp', 500)
    n = len(d)
    for i in range(n):
        k = i / (n - 1)
        d[i] *= (math.sin(math.pi * min(1.0, k * 1.15)) ** 0.9)
    shimmer = buf(0.44)
    osc(shimmer, 2600, 0.18, 'sine', freq_end=4200)
    env(shimmer, 0.05, curve=1.6)
    mix(d, shimmer, 0.5)
    return finish(d, 0.55)


def s_water():
    # 첨벙보다 찰랑 — 낮게 떨어지는 물방울에 잔물결
    d = buf(0.38)
    plop = buf(0.38)
    osc(plop, 620, 0.8, 'sine', freq_end=180, curve=0.5, dur=0.12)
    env(plop, 0.001, curve=3.4, dur=0.12)
    ripple = buf(0.38)
    noise(ripple, 0.7, start=0.02, dur=0.34, seed=151)
    biquad(ripple, 'bp', 1500, 0.8, freq_end=600)
    n = len(ripple)
    for i in range(n):
        k = i / (n - 1)
        # 물결이 두 번 일렁인다
        ripple[i] *= max(0.0, (1 - k) ** 2.2) * (0.6 + 0.4 * math.sin(k * 22))
    mix(d, plop, 1.0)
    mix(d, ripple, 0.55)
    return finish(d, 0.66)


def s_flip():
    # 종이 한 장이 넘어가는 탁 — 여섯 칸이 연달아 울린다
    d = buf(0.08)
    noise(d, 1.0, dur=0.035, seed=161)
    biquad(d, 'bp', 1900, 1.3)
    env(d, 0.0006, curve=6)
    edge = buf(0.08)
    osc(edge, 700, 0.35, 'tri', freq_end=420, dur=0.03)
    env(edge, 0.0006, curve=6, dur=0.03)
    mix(d, edge, 0.6)
    return finish(d, 0.62)


SOUNDS = {
    'tap': s_tap,
    'select': s_select,
    'pop': s_pop,
    'merge': s_merge,
    'coin': s_coin,
    'clear': s_clear,
    'gameover': s_gameover,
    'fail': s_fail,
    'hurt': s_hurt,
    'impact': s_impact,
    'whoosh': s_whoosh,
    'unlock': s_unlock,
    'rhythm-hit': s_rhythm_hit,
    'rhythm-miss': s_rhythm_miss,
    'shoot': s_shoot,
    'explode': s_explode,
    'sword': s_sword,
    'stone': s_stone,
    'ice-slide': s_ice_slide,
    'water': s_water,
    'flip': s_flip,
}


if __name__ == '__main__':
    total = 0
    for name, make in SOUNDS.items():
        path = save(name, make())
        size = os.path.getsize(path)
        total += size
        print(f'{name:14s} {size / 1024:6.1f} KB')
    print(f'{"합계":14s} {total / 1024:6.1f} KB  ({len(SOUNDS)}개)')
