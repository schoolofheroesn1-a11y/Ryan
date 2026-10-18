"""Ретро-звуки, синтезированные на лету (numpy -> pygame.mixer). Файлы не нужны.

Если звука нет (нет устройства, нет numpy), все вызовы просто ничего не делают.
"""
import pygame

RATE = 22050


def _tone(np, freq, dur, kind="square", vol=0.25, slide=0.0, delay=0.0):
    n = int(RATE * dur)
    t = np.arange(n) / RATE
    f = freq + slide * t / max(dur, 1e-3)
    phase = 2 * np.pi * np.cumsum(f) / RATE
    if kind == "square":
        wave = np.sign(np.sin(phase))
    elif kind == "triangle":
        wave = 2 / np.pi * np.arcsin(np.sin(phase))
    elif kind == "saw":
        wave = 2 * ((phase / (2 * np.pi)) % 1) - 1
    else:  # noise
        wave = np.random.uniform(-1, 1, n)
    env = np.exp(-4 * t / max(dur, 1e-3))
    pad = np.zeros(int(RATE * delay))
    return np.concatenate([pad, wave * env * vol])


def _mix(np, *parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


class Sfx:
    def __init__(self):
        self.sounds = {}
        try:
            import numpy as np
            if not pygame.mixer.get_init():
                pygame.mixer.init(RATE, -16, 1, 512)
            T = lambda *a, **k: _tone(np, *a, **k)  # noqa: E731
            recipes = {
                "hit": _mix(np, T(0, 0.12, "noise", 0.3), T(180, 0.1, slide=-100)),
                "crit": _mix(np, T(0, 0.15, "noise", 0.35), T(320, 0.15, slide=-200), T(640, 0.1, vol=0.15, delay=0.05)),
                "hurt": _mix(np, T(140, 0.3, "saw", 0.3, slide=-90), T(0, 0.2, "noise", 0.2)),
                "dodge": T(500, 0.12, "triangle", 0.2, slide=300),
                "heal": _mix(np, *[T(440 * (1 + i * 0.25), 0.15, "triangle", 0.2, delay=i * 0.08) for i in range(3)]),
                "warn": T(220, 0.08, vol=0.15),
                "rep": T(660, 0.06, "triangle", 0.15),
                "level": _mix(np, *[T(f, 0.22, "triangle", 0.22, delay=i * 0.1) for i, f in enumerate((392, 494, 587, 784))]),
                "win": _mix(np, *[T(f, 0.35, "triangle", 0.22, delay=i * 0.15) for i, f in enumerate((330, 415, 494))]),
                "die": _mix(np, *[T(f, 0.5, "saw", 0.18, delay=i * 0.25) for i, f in enumerate((220, 185, 147))]),
            }
            for name, wave in recipes.items():
                data = (np.clip(wave, -1, 1) * 32767).astype(np.int16)
                channels = pygame.mixer.get_init()[2]
                if channels > 1:
                    data = np.repeat(data[:, None], channels, axis=1)
                self.sounds[name] = pygame.sndarray.make_sound(data)
        except Exception:  # нет звуковой карты/numpy — играем без звука
            self.sounds = {}

    def play(self, name):
        snd = self.sounds.get(name)
        if snd:
            snd.play()
