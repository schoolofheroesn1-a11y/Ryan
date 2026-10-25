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


def build_promo(dur, drop=2.0, bpm=150):
    """Короткий динамичный трек для ролика-обновления: удар с первого кадра, раскачка, дроп на боссе."""
    beat = 60 / bpm
    m = np.zeros(int(SR * dur) + SR)
    mix_at(m, KICK, 0, 1.0)
    mix_at(m, CRASH, 0, 0.45)
    for b in range(int(dur / beat)):
        t = b * beat
        root, chord = CHORDS[(b // 4) % 4]
        hot = t >= drop
        if t > dur - 1.6:  # последние секунды — только аккорд финала
            break
        mix_at(m, KICK, t, 0.95 if hot else 0.7)
        if b % 2 == 1:
            mix_at(m, SNARE, t, 0.5 if hot else 0.3)
        for k in range(4 if hot else 2):
            mix_at(m, HAT, t + k * beat / (4 if hot else 2), 0.2)
        for k in range(2):
            f = hz(root, 2) * (2 if (k == 1 and hot) else 1)
            note = lp(square(f, beat / 2 * 0.9, 0.5), 0.12) * env(int(SR * beat / 2 * 0.9), 0.003, 0.12)
            mix_at(m, note, t + k * beat / 2, 0.6)
        if hot:
            for k in range(4):
                n = chord[(b * 4 + k) % 3]
                note = square(hz(n, 5), beat / 4 * 0.8, 0.25) * env(int(SR * beat / 4 * 0.8), 0.002, 0.04)
                mix_at(m, note, t + k * beat / 4, 0.09)
    for k in range(8):  # дробь перед дропом
        mix_at(m, SNARE, drop - beat * 2 + k * beat / 4, 0.2 + k * 0.04)
    mix_at(m, hp(noise(1.0)) * np.linspace(0, 1, SR) ** 2, drop - 1.0, 0.22)
    mix_at(m, CRASH, drop, 0.55)
    tail = 1.6
    pad = sum(np.sign(np.sin(2 * np.pi * hz(n, o) * (1 + det) * t_(tail)))
              for n, o in (("A", 2), ("A", 3), ("C", 4), ("E", 4)) for det in (0, 0.004))
    mix_at(m, lp(pad / 8, 0.08) * np.linspace(1, 0, int(SR * tail)) ** 1.5, dur - 1.6, 0.55)
    mix_at(m, CRASH, dur - 1.6, 0.4)
    return m


def taiko(freq=62, dur=0.5):
    """Большой барабан тайко: низкий тон с падением высоты и шлепок по коже."""
    body = sine_sweep(freq * 1.6, freq, dur) * env(int(SR * dur), 0.002, dur * 0.3)
    skin = lp(noise(0.06), 0.3) * env(int(SR * 0.06), 0.0005, 0.02)
    return body + 0.6 * np.pad(skin, (0, len(body) - len(skin)))


def saw(freq, dur):
    t = t_(dur)
    return 2 * ((t * freq) % 1.0) - 1


def build_epic(dur, drop=1.2, bpm=140):
    """Второй трек: эпичные тайко, ре минор (Dm–B♭–F–C), рычащий бас и цепляющий мотив."""
    beat = 60 / bpm
    m = np.zeros(int(SR * dur) + SR)
    prog = [("D", ["D", "F", "A"]), ("A#", ["A#", "D", "F"]), ("F", ["F", "A", "C"]), ("C", ["C", "E", "G"])]
    motif = [("D", 5), ("F", 5), ("A", 5), ("G", 5), ("F", 5), ("E", 5), ("D", 5), ("A", 4)]  # мотив на 2 такта
    big, small = taiko(58, 0.6), taiko(96, 0.35)
    # вступление: три удара тайко с нарастанием
    for k, g in ((0, 1.0), (beat, 0.8), (2 * beat, 0.9)):
        mix_at(m, big, k, g)
    mix_at(m, hp(noise(drop)) * np.linspace(0, 1, int(SR * drop)) ** 2, 0, 0.18)
    end = dur - 1.8
    n = int((end - drop) / beat)
    for b in range(n):
        t = drop + b * beat
        root, chord = prog[(b // 4) % 4]
        mix_at(m, big if b % 2 == 0 else small, t, 0.9 if b % 4 == 0 else 0.6)
        if b % 2 == 1:
            mix_at(m, SNARE, t, 0.55)  # хлопок на 2 и 4
        for k in range(2):
            mix_at(m, HAT, t + k * beat / 2, 0.14)
        # бас: восьмые, пила с перегрузом
        for k in range(2):
            note = np.tanh(3 * lp(saw(hz(root, 2), beat / 2 * 0.85), 0.2)) * env(int(SR * beat / 2 * 0.85), 0.003, 0.15)
            mix_at(m, note, t + k * beat / 2, 0.32)
        # мотив: восьмые, квадрат + октава
        name, octv = motif[(b * 2) % len(motif)]
        for k in range(2):
            nm, oc = motif[(b * 2 + k) % len(motif)]
            f = hz(nm, oc)
            note = (square(f, beat / 2 * 0.8, 0.25) + 0.4 * square(f * 2, beat / 2 * 0.8, 0.5)) * env(int(SR * beat / 2 * 0.8), 0.002, 0.08)
            mix_at(m, note, t + k * beat / 2, 0.075)
        if b % 8 == 7:  # заполнение тайко в конце фразы
            for k in range(4):
                mix_at(m, small, t + k * beat / 4, 0.4 + 0.1 * k)
    mix_at(m, CRASH, drop, 0.5)
    # финал: удар, аккорд ре минор и затухание
    tail = dur - end
    pad = sum(saw(hz(nn, o) * (1 + det), tail) for nn, o in (("D", 3), ("A", 3), ("D", 4), ("F", 4)) for det in (0, 0.005))
    mix_at(m, lp(pad / 8, 0.06) * np.linspace(1, 0, int(SR * tail)) ** 1.6, end, 0.6)
    mix_at(m, big, end, 1.0)
    mix_at(m, CRASH, end, 0.45)
    return m


def build_duel(dur, drop=1.7, bpm=132):
    """Трек для дуэлей: ми минор (Em–C–G–D), бочка на каждую долю, бегущее арпеджио и «дуэльный» мотив."""
    beat = 60 / bpm
    m = np.zeros(int(SR * dur) + SR)
    prog = [("E", ["E", "G", "B"]), ("C", ["C", "E", "G"]), ("G", ["G", "B", "D"]), ("D", ["D", "F#", "A"])]
    hook = [("B", 5), (None, 0), ("B", 5), ("A", 5), ("G", 5), (None, 0), ("E", 5), ("F#", 5),
            ("G", 5), (None, 0), ("G", 5), ("A", 5), ("B", 5), ("D", 6), ("B", 5), (None, 0)]
    kick = sine_sweep(150, 45, 0.22) * env(int(SR * 0.22), 0.001, 0.12)
    # вступление: нарастающий гул и арпеджио без ударных
    for b in range(int(drop / (beat / 4))):
        t = b * beat / 4
        nm = ["E", "G", "B", "E"][b % 4]
        f = hz(nm, 4 if b % 4 < 3 else 5)
        mix_at(m, square(f, beat / 4 * 0.7, 0.125) * env(int(SR * beat / 4 * 0.7), 0.002, 0.05), t, 0.05 + 0.05 * t / drop)
    mix_at(m, hp(noise(drop)) * np.linspace(0, 1, int(SR * drop)) ** 3, 0, 0.2)
    end = dur - 1.6
    n = int((end - drop) / beat)
    for b in range(n):
        t = drop + b * beat
        root, chord = prog[(b // 4) % 4]
        mix_at(m, kick, t, 0.9)
        if b % 2 == 1:
            mix_at(m, SNARE, t, 0.5)
        for k in range(4):
            mix_at(m, HAT, t + k * beat / 4, 0.08 if k % 2 else 0.13)
        # бас: октавы шестнадцатыми с паузой на долю бочки
        for k in range(1, 4):
            oc = 2 if k % 2 else 3
            note = np.tanh(2.5 * lp(square(hz(root, oc), beat / 4 * 0.8, 0.5), 0.25)) * env(int(SR * beat / 4 * 0.8), 0.002, 0.06)
            mix_at(m, note, t + k * beat / 4, 0.22)
        # арпеджио аккорда
        for k in range(4):
            nm = chord[k % 3] if k < 3 else chord[1]
            f = hz(nm, 5)
            mix_at(m, square(f, beat / 4 * 0.6, 0.125) * env(int(SR * beat / 4 * 0.6), 0.001, 0.04), t + k * beat / 4, 0.035)
        # мотив: восьмые, треугольник + квадрат
        for k in range(2):
            nm, oc = hook[(b * 2 + k) % len(hook)]
            if nm is None:
                continue
            f = hz(nm, oc)
            ln = beat / 2 * 0.85
            note = (0.7 * tri(f, ln) + 0.5 * square(f, ln, 0.5)) * env(int(SR * ln), 0.003, 0.18)
            mix_at(m, note, t + k * beat / 2, 0.08)
        if b % 16 == 15:  # сбивка малым в конце фразы
            for k in range(4):
                mix_at(m, SNARE, t + k * beat / 4, 0.25 + 0.08 * k)
    mix_at(m, CRASH, drop, 0.5)
    tail = dur - end
    pad = sum(square(hz(nn, o) * (1 + det), tail, 0.5) for nn, o in (("E", 3), ("B", 3), ("E", 4), ("G", 4)) for det in (0, 0.004))
    mix_at(m, lp(pad / 10, 0.05) * np.linspace(1, 0, int(SR * tail)) ** 1.5, end, 0.6)
    mix_at(m, kick, end, 1.0)
    mix_at(m, CRASH, end, 0.45)
    return m


def _vib(freq, dur, rate=5.0, depth=0.006, shape="square", duty=0.25):
    """Нота с вибрато (фаза копится, чтобы высота плыла без щелчков)."""
    t = t_(dur)
    f = freq * (1 + depth * np.sin(2 * np.pi * rate * t) * np.clip(t / 0.25, 0, 1))
    ph = np.cumsum(f) / SR
    if shape == "tri":
        return 2 * np.abs(2 * (ph % 1) - 1) - 1
    return np.where(ph % 1 < duty, 1.0, -1.0)


def bell(freq, dur=2.5):
    """Погребальный колокол: неровные обертоны, долгое затухание."""
    t = t_(dur)
    tone = sum(a * np.sin(2 * np.pi * freq * m * t) * np.exp(-t / (dur * d))
               for m, a, d in ((0.5, 0.5, 0.6), (1.0, 1.0, 0.45), (2.0, 0.5, 0.3), (2.76, 0.35, 0.2), (5.4, 0.2, 0.1)))
    return tone * np.clip(t / 0.003, 0, 1)


def build_abyss(dur, drop=1.6, bpm=84):
    """Тёмное фэнтези: ре гармонический минор (Dm–B♭–Gm–A), гул органа, колокол, «хор»,
    тяжёлые литавры и тоскливая мелодия квадратом с вибрато."""
    beat = 60 / bpm
    m = np.zeros(int(SR * dur) + 2 * SR)
    prog = [("D", [("D", 3), ("F", 3), ("A", 3)]), ("A#", [("A#", 2), ("D", 3), ("F", 3)]),
            ("G", [("G", 2), ("A#", 2), ("D", 3)]), ("A", [("A", 2), ("C#", 3), ("E", 3)])]
    tune = [("A", 4, 1.5), ("A#", 4, 0.5), ("A", 4, 1), ("F", 4, 1),        # мотив на 4 такта (доли)
            ("D", 5, 2), ("C#", 5, 1), ("A#", 4, 1),
            ("G", 4, 1.5), ("A", 4, 0.5), ("A#", 4, 1), ("D", 5, 1),
            ("C#", 5, 2), ("E", 5, 1), ("A", 4, 1)]
    big, low = taiko(48, 0.9), taiko(70, 0.6)
    # вступление: гул, ветер и два удара колокола
    drone = lp(square(hz("D", 1), drop + beat, 0.5), 0.05) * np.linspace(0, 1, int(SR * (drop + beat))) ** 1.5
    mix_at(m, drone, 0, 0.35)
    mix_at(m, lp(noise(drop + 1), 0.04) * np.linspace(0.2, 1, int(SR * (drop + 1))), 0, 0.25)
    mix_at(m, bell(hz("D", 4), 3.0), 0.0, 0.35)
    mix_at(m, bell(hz("A", 3), 3.0), drop * 0.55, 0.25)
    end = dur - 2.2
    bars = int((end - drop) / (4 * beat)) + 1
    for bar in range(bars):
        t0 = drop + bar * 4 * beat
        if t0 >= end:
            break
        root, chord = prog[bar % 4]
        bl = min(4 * beat, end - t0)
        # орган: аккорд квадратом с медленной атакой, слегка расстроен
        n = int(SR * bl)
        pad_env = np.clip(np.arange(n) / (SR * 0.35), 0, 1) * np.clip((n - np.arange(n)) / (SR * 0.2), 0, 1)
        organ = sum(square(hz(nm, o) * (1 + det), bl, 0.5) for nm, o in chord for det in (0, 0.004))
        mix_at(m, lp(organ, 0.07) * pad_env / 6, t0, 0.5)
        # «хор»: треугольники с вибрато октавой выше
        choir = sum(_vib(hz(nm, o + 1), bl, 4.2 + i * 0.7, 0.008, "tri") for i, (nm, o) in enumerate(chord))
        mix_at(m, lp(choir, 0.12) * pad_env / 3, t0, 0.22)
        # бас: пила, половинные ноты
        for k in range(2):
            note = np.tanh(2 * lp(saw(hz(root, 1), 2 * beat * 0.95), 0.08)) * env(int(SR * 2 * beat * 0.95), 0.01, 1.2)
            mix_at(m, note, t0 + k * 2 * beat, 0.3)
        # литавры: тяжёлый удар на 1, глухой на 3, дробь в конце фразы
        mix_at(m, big, t0, 1.0)
        mix_at(m, low, t0 + 2 * beat, 0.7)
        mix_at(m, SNARE * 0.6, t0 + 3 * beat, 0.35)
        if bar % 4 == 3:
            for k in range(6):
                mix_at(m, low, t0 + 3 * beat + k * beat / 6, 0.35 + 0.08 * k)
        if bar % 2 == 0:
            mix_at(m, bell(hz(root, 4), 2.5), t0, 0.18)
    # мелодия поверх, начинается со второго такта
    t, i = drop + 4 * beat, 0
    while t < end - 0.2:
        nm, o, ln = tune[i % len(tune)]
        d = min(ln * beat, end - t)
        note = _vib(hz(nm, o), d * 0.95, 5.5, 0.01, "square", 0.125) * env(int(SR * d * 0.95), 0.01, d * 0.8)
        mix_at(m, lp(note, 0.35), t, 0.09)
        t += ln * beat
        i += 1
    mix_at(m, CRASH, drop, 0.35)
    # финал: удар, колокол и долгий гул ре минора
    tail = dur - end + 1
    pad = sum(square(hz(nm, o) * (1 + det), tail, 0.5) for nm, o in (("D", 2), ("A", 2), ("D", 3), ("F", 3)) for det in (0, 0.005))
    mix_at(m, lp(pad / 8, 0.05) * np.linspace(1, 0, int(SR * tail)) ** 1.4, end, 0.6)
    mix_at(m, big, end, 1.1)
    mix_at(m, bell(hz("D", 3), 3.0), end, 0.4)
    return m


def build_tutorial(dur, bpm=112):
    """Третий трек — спокойный и весёлый «городской» чиптюн: до мажор (C–Am–F–G), подпрыгивающий бас-треугольник,
    мелодия узким квадратом, мягкие арпеджио и хэты. Для видео-инструкций, где текст надо читать."""
    beat = 60 / bpm
    m = np.zeros(int(SR * dur) + SR)
    prog = [("C", ["C", "E", "G"]), ("A", ["A", "C", "E"]), ("F", ["F", "A", "C"]), ("G", ["G", "B", "D"])]
    # мелодия на 4 такта (по восьмым): ступени аккорда и проходящие ноты
    tune = [("E", 5), ("G", 5), ("C", 6), ("G", 5), ("E", 5), ("D", 5), ("C", 5), ("D", 5),
            ("E", 5), ("C", 5), ("A", 4), ("C", 5), ("E", 5), ("D", 5), ("C", 5), ("B", 4),
            ("A", 4), ("C", 5), ("F", 5), ("A", 5), ("G", 5), ("F", 5), ("E", 5), ("F", 5),
            ("G", 5), ("B", 4), ("D", 5), ("G", 5), ("F", 5), ("E", 5), ("D", 5), ("B", 4)]
    fifth = {"C": "G", "A": "E", "F": "C", "G": "D"}
    end = dur - 2.5
    for b in range(int(end / beat)):
        t = b * beat
        root, chord = prog[(b // 4) % 4]
        phrase = (b // 16) % 2  # каждая вторая фраза — с мелодией, между ними только аккомпанемент
        mix_at(m, KICK, t, 0.45 if b % 2 == 0 else 0.0)
        mix_at(m, HAT, t + beat / 2, 0.12)
        if b % 4 == 2:
            mix_at(m, SNARE, t, 0.18)
        # бас: корень — квинта, треугольник
        bn = root if b % 2 == 0 else fifth[root]
        note = tri(hz(bn, 2 if b % 2 == 0 else 3), beat * 0.9) * env(int(SR * beat * 0.9), 0.004, 0.25)
        mix_at(m, note, t, 0.5)
        # арпеджио шестнадцатыми — тихо
        for k in range(4):
            n = chord[(b * 4 + k) % 3]
            a = square(hz(n, 4), beat / 4 * 0.7, 0.25) * env(int(SR * beat / 4 * 0.7), 0.002, 0.04)
            mix_at(m, a, t + k * beat / 4, 0.035)
        if phrase == 1 or b < 16:
            for k in range(2):
                nm, oc = tune[(b * 2 + k) % len(tune)]
                f = hz(nm, oc)
                ln = beat / 2 * 0.85
                note = square(f, ln, 0.125) * env(int(SR * ln), 0.003, 0.12)
                vib = 1 + 0.004 * np.sin(2 * np.pi * 6 * t_(ln))  # лёгкое вибрато
                mix_at(m, note * vib, t + k * beat / 2, 0.07)
    # финал: аккорд до мажор арпеджио вверх и затухание
    for k, (n, o) in enumerate((("C", 5), ("E", 5), ("G", 5), ("C", 6))):
        note = square(hz(n, o), 1.6 - k * 0.2, 0.25) * env(int(SR * (1.6 - k * 0.2)), 0.003, 0.6)
        mix_at(m, note, end + k * 0.12, 0.08)
    mix_at(m, tri(hz("C", 2), 2.0) * np.linspace(1, 0, int(SR * 2.0)), end, 0.5)
    return m[: int(SR * dur)]


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
    style = spec.get("style")
    if style == "epic":
        mus = build_epic(dur, spec.get("drop", 1.2))
    elif style == "abyss":
        mus = build_abyss(dur, spec.get("drop", 1.6))
    elif style == "duel":
        mus = build_duel(dur, spec.get("drop", 1.7))
    elif style == "promo":
        mus = build_promo(dur, spec.get("drop", 2.0))
    else:
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
