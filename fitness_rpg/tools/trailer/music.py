"""Музыка и звуки рекламного ролика Ash & Iron: чиптюн 120 BPM (ля минор) + SFX по событиям.

Запуск: python music.py OUT.wav EVENTS.json
EVENTS.json — список [время_в_секундах, "тип"]; типы: thunder, hit, alert, dodge, heal, level,
whoosh, souls, fanfare, boom. Длительность берётся из поля "duration".
"""
import json
import sys
import wave

import numpy as np

SR = 44100
BPM = 120
BEAT = 60 / BPM
rng = np.random.default_rng(7)


def t_(dur):
    return np.arange(int(SR * dur)) / SR


def env(n, attack=0.002, decay=None, total=None):
    t = np.arange(n) / SR
    a = np.clip(t / attack, 0, 1) if attack else 1
    d = np.exp(-t / decay) if decay else 1
    return a * d


def square(freq, dur, duty=0.5):
    t = t_(dur)
    return np.where((t * freq) % 1 < duty, 1.0, -1.0)


def tri(freq, dur):
    t = t_(dur)
    return 2 * np.abs(2 * ((t * freq) % 1) - 1) - 1


def sine_sweep(f0, f1, dur):
    t = t_(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def noise(dur):
    return rng.uniform(-1, 1, int(SR * dur))


def hp(x, k=0.97):  # простой фильтр верхних частот
    y = np.empty_like(x)
    prev_x = prev_y = 0.0
    for i, v in enumerate(x):
        prev_y = k * (prev_y + v - prev_x)
        prev_x = v
        y[i] = prev_y
    return y


def lp(x, k=0.15):  # простой фильтр нижних частот
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += k * (v - acc)
        y[i] = acc
    return y


NOTE = {n: 440 * 2 ** ((i - 9) / 12) for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def hz(name, octave):
    return NOTE[name] * 2 ** (octave - 4)


# --- инструменты
KICK = sine_sweep(150, 42, 0.28) * env(int(SR * 0.28), 0.001, 0.09)
SNARE = (hp(noise(0.2)) * 0.8 + 0.4 * np.sin(2 * np.pi * 190 * t_(0.2))) * env(int(SR * 0.2), 0.001, 0.05)
HAT = hp(noise(0.05), 0.85) * env(int(SR * 0.05), 0.0005, 0.012)
CRASH = hp(noise(1.6), 0.9) * env(int(SR * 1.6), 0.001, 0.45)

CHORDS = [("A", ["A", "C", "E"]), ("F", ["F", "A", "C"]), ("C", ["C", "E", "G"]), ("G", ["G", "B", "D"])]


def mix_at(buf, x, t, gain=1.0):
    i = int(t * SR)
    if i >= len(buf):
        return
    x = x[: len(buf) - i]
    buf[i:i + len(x)] += x * gain


def build_music(dur):
    m = np.zeros(int(SR * dur) + SR)
    beats = int(dur / BEAT)
    for b in range(beats):
        t = b * BEAT
        bar = b // 4
        chord_root, chord = CHORDS[bar % 4]
        intro, groove = t < 2.0, 2.0 <= t < 21.5
        build = 14.0 <= t < 19.0
        drop = 19.0 <= t < 21.5
        if groove:
            mix_at(m, KICK, t, 0.9)
            if b % 2 == 1:
                mix_at(m, SNARE, t, 0.45)
            for k in range(4 if (build or drop) else 2):  # хэты восьмыми / шестнадцатыми
                mix_at(m, HAT, t + k * BEAT / (4 if (build or drop) else 2), 0.18)
            # бас восьмыми: корень и октава, прямоугольная волна через НЧ-фильтр
            for k in range(2):
                f = hz(chord_root, 2) * (2 if (k == 1 and (build or drop)) else 1)
                note = lp(square(f, BEAT / 2 * 0.9, 0.5), 0.12) * env(int(SR * BEAT / 2 * 0.9), 0.003, 0.18)
                mix_at(m, note, t + k * BEAT / 2, 0.55)
            # арпеджио шестнадцатыми (громче на нарастании)
            if t >= 6.0:
                for k in range(4):
                    n = chord[(b * 4 + k) % 3]
                    f = hz(n, 5 if (build or drop) else 4)
                    note = square(f, BEAT / 4 * 0.8, 0.25) * env(int(SR * BEAT / 4 * 0.8), 0.002, 0.05)
                    mix_at(m, note, t + k * BEAT / 4, 0.10 if (build or drop) else 0.06)
        if intro and b == 0:
            mix_at(m, KICK, 0, 1.0)
            mix_at(m, CRASH, 0, 0.5)
    # дробь малого и подъём шума перед кульминацией
    for k in range(8):
        mix_at(m, SNARE, 18.5 + k * BEAT / 8, 0.25 + k * 0.04)
    riser = hp(noise(1.0)) * np.linspace(0, 1, SR) ** 2
    mix_at(m, riser, 18.0, 0.25)
    mix_at(m, hp(noise(1.0)) * np.linspace(0, 1, SR) ** 2, 1.0, 0.18)
    mix_at(m, CRASH, 19.0, 0.55)
    mix_at(m, CRASH, 2.0, 0.3)
    mix_at(m, CRASH, 14.0, 0.35)
    # финал: аккорд ля минор + медленное арпеджио, затухание
    tail = dur - 21.5
    pad = sum(np.sign(np.sin(2 * np.pi * hz(n, o) * (1 + det) * t_(tail)))
              for n, o in (("A", 2), ("A", 3), ("C", 4), ("E", 4)) for det in (0, 0.004))
    pad = lp(pad / 8, 0.08) * np.linspace(1, 0, int(SR * tail)) ** 1.5
    mix_at(m, pad, 21.5, 0.5)
    for k, n in enumerate(["A", "C", "E", "A", "E", "C", "A", "E"]):
        note = tri(hz(n, 5 if k == 3 else 4), 0.5) * env(int(SR * 0.5), 0.004, 0.25)
        mix_at(m, note, 21.6 + k * 0.42, 0.18)
    return m


def sfx(kind):
    if kind == "thunder":  # молния «Гнева грозы»: треск и низкий раскат
        crack = hp(noise(0.5), 0.6) * env(int(SR * 0.5), 0.001, 0.12)
        rumble = np.sin(2 * np.pi * 55 * t_(0.5)) * env(int(SR * 0.5), 0.002, 0.25)
        return crack * 0.9 + rumble * 0.8
    if kind == "hit":
        tone = np.pad(square(180, 0.12) * env(int(SR * 0.12), 0.001, 0.04), (0, int(SR * 0.02)))
        return hp(noise(0.14)) * env(int(SR * 0.14), 0.001, 0.04) + 0.6 * tone[: int(SR * 0.14)]
    if kind == "alert":  # сигнал «приседай» из игры: дин-дин-ДОН
        out = np.zeros(int(SR * 0.7))
        for f, d, n in ((988, 0, 0.12), (988, 0.14, 0.12), (1319, 0.28, 0.3)):
            note = square(f, n) * env(int(SR * n), 0.002, n / 3) * 0.5 + tri(f * 2, n) * env(int(SR * n), 0.002, n / 4) * 0.25
            i = int(d * SR)
            out[i:i + len(note)] += note
        return out
    if kind == "dodge":
        return np.sin(2 * np.pi * np.cumsum(np.linspace(500, 900, int(SR * 0.15))) / SR) * env(int(SR * 0.15), 0.002, 0.06) * 0.5 + \
            hp(noise(0.15)) * env(int(SR * 0.15), 0.01, 0.05) * 0.3
    if kind == "heal":
        out = np.zeros(int(SR * 0.5))
        for i, f in enumerate((440, 554, 659)):
            note = tri(f, 0.18) * env(int(SR * 0.18), 0.003, 0.08)
            j = int(i * 0.08 * SR)
            out[j:j + len(note)] += note * 0.6
        return out
    if kind == "level":
        out = np.zeros(int(SR * 0.7))
        for i, f in enumerate((392, 494, 587, 784)):
            note = tri(f, 0.24) * env(int(SR * 0.24), 0.003, 0.12)
            j = int(i * 0.1 * SR)
            out[j:j + len(note)] += note * 0.6
        return out
    if kind == "whoosh":
        n = hp(noise(0.25), 0.8)
        return n * np.sin(np.linspace(0, np.pi, len(n))) * 0.35
    if kind == "souls":
        out = np.zeros(int(SR * 0.7))
        for i in range(3):
            note = np.sin(2 * np.pi * np.cumsum(np.linspace(520 - i * 70, 340 - i * 70, int(SR * 0.4))) / SR) * env(int(SR * 0.4), 0.01, 0.15)
            j = int(i * 0.1 * SR)
            out[j:j + len(note)] += note * 0.4
        return out
    if kind == "fanfare":
        out = np.zeros(int(SR * 1.1))
        for f, d in ((523, 0), (659, 0.12), (784, 0.24), (1047, 0.38)):
            note = square(f, 0.28) * env(int(SR * 0.28), 0.003, 0.12) * 0.25 + tri(f / 2, 0.28) * env(int(SR * 0.28), 0.003, 0.12) * 0.3
            j = int(d * SR)
            out[j:j + len(note)] += note
        return out
    if kind == "boom":
        return sine_sweep(90, 30, 1.2) * env(int(SR * 1.2), 0.002, 0.35) * 0.9 + CRASH[:int(SR * 1.2)] * 0.3
    raise ValueError(kind)


SFX_GAIN = {"thunder": 0.55, "hit": 0.5, "alert": 0.5, "dodge": 0.45, "heal": 0.5, "level": 0.5,
            "whoosh": 0.5, "souls": 0.45, "fanfare": 0.45, "boom": 0.7}


def main(out, events_path):
    spec = json.load(open(events_path, encoding="utf-8"))
    dur = spec["duration"]
    mus = build_music(dur)
    fx = np.zeros_like(mus)
    for t, kind in spec["events"]:
        mix_at(fx, sfx(kind), t, SFX_GAIN[kind])
    # музыка чуть приглушается под звуки игры (ducking)
    duck = np.ones_like(mus)
    for t, kind in spec["events"]:
        i = int(t * SR)
        n = int(0.35 * SR)
        duck[i:i + n] = np.minimum(duck[i:i + n], np.linspace(0.6, 1, len(duck[i:i + n])))
    mix = mus * duck * 0.75 + fx
    mix = mix[: int(SR * dur)]
    mix = np.tanh(mix * 1.3) / np.tanh(1.3)  # мягкое ограничение пиков
    mix *= 0.89 / max(1e-9, np.max(np.abs(mix)))
    stereo = np.stack([mix, mix], axis=1)
    data = (stereo * 32767).astype(np.int16)
    with wave.open(out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
