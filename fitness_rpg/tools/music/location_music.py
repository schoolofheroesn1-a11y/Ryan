"""Музыка локаций Ash & Iron: тёмное фэнтези в духе старых «Героев» — у каждой земли свой голос.

Всё синтезируется здесь же (без сэмплов): струнные, хор, медь, орган, арфа/лютня, флейта, колокола,
музыкальная шкатулка, литавры и тайко, ветер и треск костра, затем общий зал (свёртка с реверберацией).
Каждый трек — бесшовная петля: рендерятся три круга, берётся средний (хвосты эха переходят через стык).

Каждый трек сохраняется в .m4a (AAC: Safari, Chrome) и запасной .ogg (Opus).
Запуск (нужны numpy, scipy и ffmpeg):
  python tools/music/location_music.py web/assets/music        — все треки
  python tools/music/location_music.py web/assets/music crypt  — один
"""
import json
import math
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
rng = np.random.default_rng(1337)

NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7,
        "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def hz(n):
    """«D4» → частота."""
    name, octave = n[:-1], int(n[-1])
    return 440.0 * 2 ** ((NOTE[name] + 12 * (octave + 1) - 69) / 12)


def t_(dur):
    return np.arange(int(SR * dur)) / SR


def lp(x, cut, order=2):
    return sosfilt(butter(order, min(cut, SR * 0.45), "low", fs=SR, output="sos"), x)


def hp(x, cut, order=2):
    return sosfilt(butter(order, cut, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, min(hi, SR * 0.45)], "band", fs=SR, output="sos"), x)


def adsr(n, a=0.01, d=0.1, s=0.7, r=0.2):
    """Огибающая длины n: атака, спад до s, удержание, затухание r (сек) в конце."""
    t = np.arange(n) / SR
    dur = n / SR
    env = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = np.clip((dur - t) / max(r, 1e-4), 0, 1)
    return env * rel


def saw(f, t):
    return 2 * ((f * t) % 1.0) - 1


def vib(f, t, rate=5.0, depth=0.004, delay=0.25):
    """Фаза с вибрато, нарастающим после delay."""
    ramp = np.clip((t - delay) / 0.4, 0, 1)
    inst = f * (1 + depth * ramp * np.sin(2 * np.pi * rate * t + rng.uniform(0, 6)))
    return np.cumsum(inst) / SR


# ------------------------------------------------------------------ инструменты (моно)
def strings(f, dur, bright=2600, voices=5, a=0.35, r=0.6):
    t = t_(dur + r)
    out = np.zeros_like(t)
    for i in range(voices):
        det = 1 + (i - voices // 2) * 0.0035
        ph = vib(f * det, t, 5.2 + i * 0.3, 0.003)
        out += 2 * (ph % 1.0) - 1
    out = lp(out / voices, bright)
    return out * adsr(len(t), a, 0.5, 0.85, r)


def cello(f, dur, r=0.5):
    t = t_(dur + r)
    ph = vib(f, t, 5.0, 0.006, 0.15)
    x = 2 * (ph % 1.0) - 1 + 0.3 * np.sign(np.sin(2 * np.pi * ph))
    x = lp(x, 1400) + 0.3 * bp(x, 250, 900)
    return x * adsr(len(t), 0.12, 0.4, 0.8, r)


FORMANTS = {"a": [(800, 1.0), (1150, 0.5), (2900, 0.25)], "o": [(450, 1.0), (800, 0.45), (2830, 0.12)],
            "u": [(325, 1.0), (700, 0.3), (2530, 0.08)]}


def choir(f, dur, vowel="a", voices=4, a=0.6, r=0.9):
    """Хор: несколько чуть расстроенных голосов, гармоники взвешены формантами гласной."""
    t = t_(dur + r)
    out = np.zeros_like(t)
    forms = FORMANTS[vowel]
    for v in range(voices):
        ph = vib(f * (1 + (v - voices / 2) * 0.004), t, 4.6 + v * 0.4, 0.006, 0.1)
        for h in range(1, 16):
            fh = f * h
            if fh > 5000:
                break
            amp = sum(g * math.exp(-((fh - fc) / (fc * 0.18)) ** 2) for fc, g in forms) + 0.02
            out += amp / h ** 0.3 * np.sin(2 * np.pi * h * ph)
    out += 0.02 * bp(rng.standard_normal(len(t)), 600, 3000)  # дыхание
    return out / (voices * 3) * adsr(len(t), a, 0.6, 0.9, r)


def brass(f, dur, r=0.25, power=1.0):
    t = t_(dur + r)
    ph = vib(f, t, 5.5, 0.003, 0.3)
    x = 2 * (ph % 1.0) - 1
    # фильтр раскрывается на атаке — «дыхание» валторны
    env = adsr(len(t), 0.07, 0.3, 0.8, r)
    sweep = lp(x, 900 + 1800 * power) * (0.4 + 0.6 * np.clip(t / 0.12, 0, 1))
    return (sweep + 0.25 * lp(x, 500)) * env


def organ(f, dur, r=0.4):
    t = t_(dur + r)
    x = sum(a * np.sin(2 * np.pi * f * m * t) for m, a in ((0.5, 0.6), (1, 1.0), (2, 0.5), (3, 0.25), (4, 0.2), (8, 0.06)))
    x *= 1 + 0.08 * np.sin(2 * np.pi * 5.6 * t)  # тремоло
    return x / 2.5 * adsr(len(t), 0.08, 0.3, 0.9, r)


def pluck(f, dur=1.6, bright=1.0, body=0.6):
    """Арфа/лютня: гармоники, верхние гаснут быстрее."""
    t = t_(dur)
    x = np.zeros_like(t)
    for h in range(1, 12):
        if f * h > 9000:
            break
        decay = (1.4 + body) / (1 + 0.6 * h / bright)
        x += (1 / h ** 1.1) * np.sin(2 * np.pi * f * h * t * (1 + 0.0004 * h)) * np.exp(-t / decay)
    x *= np.clip(t / 0.003, 0, 1)
    return x * 0.6


def flute(f, dur, r=0.3):
    t = t_(dur + r)
    ph = vib(f, t, 5.0, 0.006, 0.2)
    x = np.sin(2 * np.pi * ph) + 0.18 * np.sin(4 * np.pi * ph) + 0.06 * np.sin(6 * np.pi * ph)
    breath = bp(rng.standard_normal(len(t)), f * 0.8, f * 3) * 0.08
    return (x + breath) * adsr(len(t), 0.08, 0.2, 0.85, r) * 0.6


def bell(f, dur=4.0):
    t = t_(dur)
    x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / (dur * d))
            for m, a, d in ((0.5, 0.45, 0.6), (1.0, 1.0, 0.45), (2.0, 0.55, 0.3), (2.76, 0.4, 0.2), (5.4, 0.2, 0.1), (8.9, 0.08, 0.05)))
    return x * np.clip(t / 0.002, 0, 1) * 0.5


def musicbox(f, dur=2.2):
    t = t_(dur)
    x = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / d) for m, a, d in ((1, 1.0, 0.9), (2.0, 0.3, 0.35), (3.0, 0.12, 0.15), (5.1, 0.08, 0.06)))
    return x * np.clip(t / 0.001, 0, 1) * 0.45


def timpani(f=55, dur=1.6):
    t = t_(dur)
    body = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.25 * np.exp(-t / 0.05))) / SR) * np.exp(-t / 0.55)
    skin = lp(rng.standard_normal(len(t)), 900) * np.exp(-t / 0.04) * 0.6
    return (body + skin) * 0.9


def taiko(f=60, dur=0.9):
    t = t_(dur)
    body = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.8 * np.exp(-t / 0.03))) / SR) * np.exp(-t / 0.28)
    slap = lp(rng.standard_normal(len(t)), 2200) * np.exp(-t / 0.015)
    return body * 1.1 + slap * 0.5


def snare(dur=0.25, vol=1.0):
    t = t_(dur)
    x = bp(rng.standard_normal(len(t)), 1500, 7000) * np.exp(-t / 0.07) + 0.4 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04)
    return x * 0.5 * vol


def wind(dur, cut=600):
    x = lp(rng.standard_normal(int(SR * dur)), cut, 2)
    t = t_(dur)
    swell = 0.5 + 0.5 * np.sin(2 * np.pi * t / 7.3) * np.sin(2 * np.pi * t / 3.1 + 1)
    return x * (0.3 + 0.7 * swell) * 1.5


def drone(f, dur):
    t = t_(dur)
    x = saw(f, t) + saw(f * 1.004, t) + 0.5 * np.sin(2 * np.pi * f / 2 * t)
    return lp(x, 300) * 0.4


def crackle(dur):
    """Треск костра: редкие щелчки и шорох."""
    n = int(SR * dur)
    x = lp(rng.standard_normal(n), 1200) * 0.04
    for p in rng.integers(0, n - 2000, int(dur * 9)):
        k = np.exp(-np.arange(800) / rng.uniform(30, 160)) * rng.uniform(0.2, 1.0)
        x[p:p + 800] += bp(rng.standard_normal(800), 900, 4000) * k
    return x * 0.5


# ------------------------------------------------------------------ сборка трека
class Track:
    def __init__(self, bpm, bars, beats=4):
        self.bpm, self.beats = bpm, beats
        self.beat = 60 / bpm
        self.L = bars * beats * self.beat
        n = int(SR * (self.L * 3 + 6))
        self.dry = np.zeros((2, n))
        self.wet = np.zeros((2, n))

    def at(self, bar, beat=0.0):
        return (bar * self.beats + beat) * self.beat

    def add(self, sig, t, pan=0.0, gain=1.0, send=0.35):
        """Звук в моменте t (сек от начала петли) — во все три круга."""
        lg, rg = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
        for c in range(3):
            i = int(SR * (t + c * self.L))
            j = min(i + len(sig), self.dry.shape[1])
            if i >= j:
                continue
            s = sig[: j - i] * gain
            self.dry[0, i:j] += s * lg * (1 - send * 0.5)
            self.dry[1, i:j] += s * rg * (1 - send * 0.5)
            self.wet[0, i:j] += s * lg * send
            self.wet[1, i:j] += s * rg * send

    def render(self, rt60=2.6, damp=4500, width=1.0):
        n_ir = int(SR * rt60 * 1.1)
        t = np.arange(n_ir) / SR
        env = np.exp(-6.9 * t / rt60)
        mix = np.zeros_like(self.dry)
        for ch in range(2):
            ir = rng.standard_normal(n_ir) * env
            ir = lp(ir, damp)
            ir[: int(SR * 0.012)] *= np.linspace(0, 1, int(SR * 0.012))  # пред-задержка
            ir /= np.sqrt(np.sum(ir ** 2))
            mix[ch] = fftconvolve(self.wet[ch] + self.wet[1 - ch] * (1 - width) * 0.5, ir)[: self.dry.shape[1]]
        out = self.dry + mix * 1.2
        # мастер: убрать гул (до вырезки петли — иначе фильтр щёлкает на стыке), ограничитель, громкость
        out = np.stack([hp(out[0], 35), hp(out[1], 35)])
        a, b = int(SR * self.L), int(SR * self.L * 2)
        loop = out[:, a:b]
        rms = np.sqrt(np.mean(loop ** 2)) + 1e-9
        loop = loop * (0.16 / rms)
        loop = np.tanh(loop * 1.1) / np.tanh(1.1)
        return loop * (0.92 / max(1e-9, np.max(np.abs(loop))))


def chord_tones(root, kind, octave):
    iv = {"m": [0, 3, 7], "M": [0, 4, 7], "dim": [0, 3, 6], "7": [0, 4, 7, 10], "sus": [0, 5, 7], "m7": [0, 3, 7, 10]}[kind]
    base = NOTE[root] + 12 * (octave + 1)
    return [440 * 2 ** ((base + i - 69) / 12) for i in iv]


def melody(tr, notes, start_bar, inst, pan=0.0, gain=1.0, send=0.4, **kw):
    """notes: [(нота|None, доли)] подряд от start_bar."""
    t = tr.at(start_bar)
    for n, beats in notes:
        d = beats * tr.beat
        if n:
            tr.add(inst(hz(n), d * 0.95, **kw), t, pan, gain, send)
        t += d


# ------------------------------------------------------------------ Склеп: ре минор, орган и хор в подземелье
def crypt():
    tr = Track(bpm=66, bars=16)
    prog = [("D", "m"), ("D", "m"), ("A#", "M"), ("A", "M"), ("G", "m"), ("D", "m"), ("A", "7"), ("D", "m")] * 2
    for b, (r, k) in enumerate(prog):
        dur = tr.beats * tr.beat
        for i, f in enumerate(chord_tones(r, k, 3)):
            tr.add(organ(f, dur), tr.at(b), (i - 1) * 0.3, 0.16, 0.5)
        tr.add(organ(chord_tones(r, k, 1)[0], dur), tr.at(b), 0, 0.22, 0.4)  # педаль органа
        if b >= 8 or b % 2 == 0:
            tr.add(choir(chord_tones(r, k, 3)[0], dur, "u"), tr.at(b), -0.4, 0.5, 0.7)
            tr.add(choir(chord_tones(r, k, 3)[2], dur, "u"), tr.at(b), 0.4, 0.4, 0.7)
        for j, f in enumerate([chord_tones(r, k, 4)[x] for x in (0, 1, 2, 1)]):  # арфа: медленное арпеджио
            tr.add(pluck(f, 2.4), tr.at(b, j), 0.5 - j * 0.3, 0.32, 0.6)
    theme = [("D4", 2), ("F4", 1), ("A4", 1), ("A#4", 2), ("A4", 1), ("G4", 1), ("F4", 1.5), ("E4", 0.5), ("D4", 1), ("C#4", 1), ("D4", 4),
             ("G4", 2), ("A#4", 1), ("A4", 1), ("F4", 2), ("E4", 1), ("D4", 1), ("E4", 1.5), ("C#4", 0.5), ("E4", 2), ("D4", 4)]
    melody(tr, theme, 8, cello, pan=-0.15, gain=0.5, send=0.45)
    for b in (0, 4, 8, 12):
        tr.add(bell(hz("D3"), 5.0), tr.at(b), 0.3, 0.5, 0.7)
    for k in range(26):  # капли воды в темноте
        tr.add(pluck(hz(["A6", "D7", "F6", "C7"][k % 4]), 0.5, 2.0, 0.0), rng.uniform(0, tr.L - 1), rng.uniform(-0.8, 0.8), 0.12, 0.8)
    tr.add(wind(tr.L + 2, 380), 0, 0, 0.05, 0.3)
    return tr.render(rt60=3.6, damp=3500)


# ------------------------------------------------------------------ Подступы к замку: марш, валторны, литавры
def castle():
    tr = Track(bpm=92, bars=32)
    A = [("E", "m"), ("C", "M"), ("D", "M"), ("B", "m"), ("E", "m"), ("C", "M"), ("A", "m"), ("B", "M")]
    B = [("G", "M"), ("D", "M"), ("E", "m"), ("C", "M"), ("A", "m"), ("E", "m"), ("B", "sus"), ("B", "M")]
    prog = A + A + B + A
    for b, (r, k) in enumerate(prog):
        dur = tr.beats * tr.beat
        ct = chord_tones(r, k, 3)
        for i, f in enumerate(ct):
            tr.add(strings(f, dur, 2200), tr.at(b), (i - 1) * 0.5, 0.2, 0.45)
        root = chord_tones(r, k, 2)[0]
        for e in range(8):  # остинато виолончелей восьмыми
            f = root if e % 4 != 2 else root * 1.5
            tr.add(cello(f, tr.beat * 0.42, 0.1), tr.at(b, e * 0.5), -0.3, 0.32, 0.25)
        tr.add(timpani(chord_tones(r, k, 1)[0] * 1.0), tr.at(b), 0.1, 0.75, 0.3)
        if b % 2 == 1:
            tr.add(timpani(chord_tones(r, k, 1)[0] * 1.5), tr.at(b, 3), 0.1, 0.45, 0.3)
        for s, v in ((0, 0.6), (1.5, 0.35), (2, 0.8), (3, 0.45), (3.5, 0.35)):  # малый барабан: марш
            if b >= 4:
                tr.add(snare(vol=v), tr.at(b, s), 0.25, 0.45, 0.2)
        if b in (15, 31):  # дробь в конце фразы
            for i in range(8):
                tr.add(snare(vol=0.3 + i * 0.07), tr.at(b, 2 + i * 0.25), 0.25, 0.4, 0.2)
        for j in range(4):  # лютня: перебор
            tr.add(pluck(chord_tones(r, k, 4)[j % 3], 1.2, 1.4, 0.3), tr.at(b, j + 0.5), 0.6, 0.18, 0.35)
    horn_a = [("E4", 1.5), ("B3", 0.5), ("E4", 1), ("G4", 1), ("F#4", 1.5), ("E4", 0.5), ("D4", 2),
              ("E4", 1), ("G4", 1), ("B4", 1.5), ("A4", 0.5), ("G4", 1), ("F#4", 1), ("D4", 2),
              ("E4", 1.5), ("G4", 0.5), ("C5", 2), ("B4", 1), ("A4", 1), ("G4", 1), ("F#4", 1),
              ("E4", 1), ("D#4", 1), ("E4", 2), ("F#4", 4)]
    horn_b = [("B4", 2), ("A4", 1), ("G4", 1), ("A4", 2), ("F#4", 2), ("G4", 1.5), ("F#4", 0.5), ("E4", 2), ("G4", 2), ("E4", 2),
              ("C5", 2), ("B4", 1), ("A4", 1), ("B4", 2), ("G4", 2), ("F#4", 2), ("E4", 1), ("F#4", 1), ("D#4", 4)]
    melody(tr, horn_a, 8, brass, pan=-0.2, gain=0.42, send=0.4)
    melody(tr, horn_b, 16, brass, pan=0.2, gain=0.42, send=0.4, power=1.3)
    melody(tr, [(n.replace("4", "3").replace("5", "4") if n else None, d) for n, d in horn_b], 16, brass, pan=-0.3, gain=0.22, send=0.4)
    melody(tr, horn_a, 24, strings, pan=0.1, gain=0.33, send=0.45, bright=3200)
    return tr.render(rt60=2.4, damp=5000)


# ------------------------------------------------------------------ Кладбище: вальс шкатулки, хор и ветер
def grave():
    tr = Track(bpm=84, bars=24, beats=3)
    prog = [("A", "m"), ("A", "m"), ("D", "m"), ("E", "7"), ("A", "m"), ("F", "M"), ("D", "m"), ("E", "7"),
            ("C", "M"), ("G", "M"), ("A", "m"), ("E", "M"), ("F", "M"), ("D", "m"), ("E", "7"), ("A", "m")]
    prog = prog + prog[:8]
    for b, (r, k) in enumerate(prog):
        dur = 3 * tr.beat
        ct = chord_tones(r, k, 3)
        tr.add(pluck(chord_tones(r, k, 2)[0], 1.4, 0.7, 0.1), tr.at(b), -0.2, 0.55, 0.3)  # пиццикато на раз
        for j in (1, 2):
            for i, f in enumerate(ct[1:3]):
                tr.add(pluck(f, 0.9, 0.9, 0.0), tr.at(b, j), 0.3 + i * 0.2, 0.25, 0.3)
        tr.add(choir(ct[0], dur, "o", 3, 0.9, 1.0), tr.at(b), -0.5, 0.33, 0.8)
        tr.add(choir(ct[2], dur, "o", 3, 0.9, 1.0), tr.at(b), 0.5, 0.25, 0.8)
        if b % 4 == 0:
            tr.add(bell(hz("A2"), 6.0), tr.at(b), -0.6, 0.55, 0.8)  # похоронный колокол
    box = [("E5", 1), ("A5", 1), ("C6", 1), ("B5", 2), ("G#5", 1), ("A5", 3), ("F5", 1), ("A5", 1), ("D6", 1), ("C6", 2), ("B5", 1),
           ("G#5", 3), ("E5", 1), ("A5", 1), ("C6", 1), ("E6", 2), ("D6", 1), ("C6", 1), ("B5", 1), ("A5", 1), ("D5", 1), ("F5", 1),
           ("B5", 1), ("A5", 1.5), ("G#5", 1.5), ("A5", 3),
           ("C6", 2), ("B5", 1), ("D6", 2), ("C6", 1), ("A5", 2), ("E5", 1), ("G#5", 3), ("A5", 1), ("C6", 1), ("E6", 1), ("D#6", 1),
           ("E6", 1), ("F6", 1), ("E6", 2), ("D6", 1), ("C6", 3), ("A5", 1), ("D6", 1), ("C6", 1), ("B5", 1), ("G#5", 1), ("B5", 1), ("A5", 3)]
    melody(tr, box, 0, musicbox, pan=0.15, gain=0.5, send=0.55)
    melody(tr, [(n.replace("5", "4").replace("6", "5"), d) for n, d in box[:26]], 16, strings, pan=-0.1, gain=0.22, send=0.6, bright=2000)
    tr.add(wind(tr.L + 2, 700), 0, 0, 0.09, 0.4)
    for k in range(6):  # крик ворона вдали
        t0 = rng.uniform(0, tr.L - 1)
        t = t_(0.35)
        caw = bp(saw(620 - 260 * t / 0.35, t) + 0.3 * rng.standard_normal(len(t)), 500, 2200) * np.exp(-t / 0.15)
        tr.add(caw * 0.3, t0, rng.uniform(-0.9, 0.9), 0.2, 0.9)
    return tr.render(rt60=3.2, damp=3800)


# ------------------------------------------------------------------ Алая Бездна: ритуальные барабаны, медь и хор
def abyss():
    tr = Track(bpm=104, bars=24)
    prog = [("C", "M"), ("C#", "M"), ("C", "M"), ("A#", "m"), ("G#", "M"), ("C#", "M"), ("C", "M"), ("C", "M")] * 3
    for b, (r, k) in enumerate(prog):
        dur = tr.beats * tr.beat
        ct = chord_tones(r, k, 3)
        for i, f in enumerate(ct):  # струнные тремоло
            t = t_(dur + 0.3)
            trem = strings(f, dur, 3000, 3, 0.15, 0.3) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 9 * t)))[: len(t)]
            tr.add(trem, tr.at(b), (i - 1) * 0.6, 0.12, 0.4)
        tr.add(drone(chord_tones(r, k, 1)[0], dur + 0.2), tr.at(b), 0, 0.5, 0.2)
        # тайко: тяжёлый ритуальный рисунок
        for s, (f, v) in {0: (52, 1.0), 1.5: (70, 0.55), 2: (52, 0.85), 2.75: (90, 0.4), 3: (70, 0.6), 3.5: (90, 0.5)}.items():
            tr.add(taiko(f), tr.at(b, s), (-0.2 if f < 60 else 0.3), 0.6 * v, 0.25)
        if b % 2 == 0 and b >= 4:  # удары меди на слабую долю
            for f in chord_tones(r, k, 2):
                tr.add(brass(f, tr.beat * 0.6, 0.15, 1.6), tr.at(b, 1), -0.1, 0.22, 0.35)
        if b >= 8:
            tr.add(choir(ct[0], dur, "a", 4, 0.3, 0.6), tr.at(b), -0.5, 0.35, 0.6)
            tr.add(choir(ct[0] * 2 ** (1 / 12), dur, "a", 3, 0.3, 0.6), tr.at(b), 0.5, 0.18, 0.6)  # диссонанс полутона
        if b in (7, 15, 23):
            for i in range(8):
                tr.add(taiko(80), tr.at(b, 2 + i * 0.25), 0.2, 0.3 + i * 0.06, 0.25)
    horns = [("C4", 1.5), ("C#4", 0.5), ("E4", 2), ("F4", 1), ("E4", 1), ("C#4", 1), ("C4", 1), ("G3", 4),
             ("C4", 1), ("E4", 1), ("G4", 2), ("G#4", 1.5), ("G4", 0.5), ("F4", 1), ("E4", 1), ("C#4", 2), ("C4", 4), (None, 4),
             ("G4", 2), ("G#4", 1), ("G4", 1), ("F4", 2), ("E4", 2), ("C#4", 2), ("E4", 1), ("C#4", 1), ("C4", 4),
             ("G#4", 2), ("G4", 1), ("F4", 1), ("E4", 1.5), ("C#4", 0.5), ("E4", 2), ("C4", 8)]
    melody(tr, horns, 8, brass, pan=0.0, gain=0.5, send=0.4, power=1.4)
    melody(tr, [(n.replace("4", "3") if n else None, d) for n, d in horns], 8, brass, pan=-0.3, gain=0.25, send=0.4)
    return tr.render(rt60=2.8, damp=4200)


# ------------------------------------------------------------------ Костёр: лютня, флейта и треск огня (меню)
def bonfire():
    tr = Track(bpm=72, bars=16)
    prog = [("D", "m"), ("C", "M"), ("A#", "M"), ("A", "m"), ("G", "m"), ("A#", "M"), ("C", "M"), ("D", "m")] * 2
    for b, (r, k) in enumerate(prog):
        dur = tr.beats * tr.beat
        ct = chord_tones(r, k, 3)
        for i, f in enumerate(ct):
            tr.add(strings(f, dur, 1600, 4, 0.8, 1.0), tr.at(b), (i - 1) * 0.5, 0.11, 0.5)
        arp = [chord_tones(r, k, 3)[0], chord_tones(r, k, 3)[2], chord_tones(r, k, 4)[0], chord_tones(r, k, 4)[1],
               chord_tones(r, k, 4)[2], chord_tones(r, k, 4)[1], chord_tones(r, k, 4)[0], chord_tones(r, k, 3)[2]]
        for j, f in enumerate(arp):  # лютня: перебор восьмыми
            tr.add(pluck(f, 1.6, 1.2, 0.5), tr.at(b, j * 0.5), 0.35 - (j % 2) * 0.2, 0.3, 0.35)
        tr.add(cello(chord_tones(r, k, 2)[0], dur * 0.95, 0.6), tr.at(b), -0.3, 0.2, 0.35)
    fl = [("A4", 2), ("D5", 1), ("C5", 1), ("A#4", 1.5), ("A4", 0.5), ("G4", 2), ("A4", 1), ("F4", 1), ("G4", 2), ("A4", 4),
          ("D5", 2), ("E5", 1), ("F5", 1), ("E5", 1.5), ("D5", 0.5), ("C5", 2), ("A#4", 1), ("A4", 1), ("G4", 1), ("E4", 1), ("D4", 4)]
    melody(tr, fl, 8, flute, pan=0.15, gain=0.42, send=0.45)
    tr.add(crackle(tr.L + 1), 0, 0.1, 0.14, 0.05)
    return tr.render(rt60=2.0, damp=5000)


TRACKS = {"crypt": crypt, "castle": castle, "grave": grave, "abyss": abyss, "bonfire": bonfire}


def save(name, loop, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    tmp = os.path.join(tempfile.mkdtemp(), f"{name}.wav")
    data = (np.clip(loop.T, -1, 1) * 32767).astype(np.int16)
    with wave.open(tmp, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    dst = os.path.join(out_dir, f"{name}.m4a")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-c:a", "aac", "-b:a", "112k", "-movflags", "+faststart", dst], check=True)
    # запасной Opus — для браузеров без AAC (Firefox на Linux, некоторые сборки Chromium)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-c:a", "libopus", "-b:a", "96k", dst[:-4] + ".ogg"], check=True)
    return dst, loop.shape[1] / SR


def main():
    out = sys.argv[1]
    names = sys.argv[2:] or list(TRACKS)
    man_path = os.path.join(out, "music.json")
    manifest = json.load(open(man_path)) if os.path.exists(man_path) else {}
    for n in names:
        dst, dur = save(n, TRACKS[n](), out)
        manifest[n] = round(dur, 4)
        print(f"{n}: {dur:.1f} с → {dst} ({os.path.getsize(dst) // 1024} КБ)")
    json.dump(manifest, open(man_path, "w"), indent=1, sort_keys=True)


if __name__ == "__main__":
    main()
