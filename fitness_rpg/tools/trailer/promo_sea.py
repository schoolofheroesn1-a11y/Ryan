"""Ролик «Штормовое море» (вертикальный 1080×1920, 30 к/с, 40 с) под трек пользователя без слов.

Новая земля на карте, утопленники, крабы и наги, появление Кракена со стихом «Появилось к нам из моря…»
(глаза Кракена открываются ровно на дроп трека), бой с Кракеном, Сундук Прилива, облик «Новый пират»
и Меч Прилива (крит — удар волной). Кадры — настоящий движок (sea_capture.mjs).

Звук: инструментал трека (вокал отделён моделью UVR MDX-Net, sep.py), переделанный под игру — ниже на
полтона, «пиксельный» слой с понижением разрядности, шторм и закрытый фильтр в нарастании, раскрытие на
дропе, удары тайко и звуки игры.

Запуск:
  python promo_sea.py --engine ENGINE_DIR --fonts FONTS_DIR --inst INSTRUMENTAL.wav --out sea.mp4
"""
import argparse
import math
import os
import random
import subprocess
import tempfile
import wave
import zlib

import numpy as np
from PIL import Image, ImageDraw
from scipy import signal

import music as sfxlib
from compose import BG, FPS, H, RED, W, WHITE, PixelFont, caption_image, fit_size
from promo import Atlas, ease_pop, engine_crop, put_caption, rays

SR = 44100
SEA = (120, 210, 240)
FOAM = (220, 245, 255)
GOLD = (255, 200, 90)
INK = (200, 110, 255)
BLOOD = (255, 90, 90)
SITE = "ASH-A-IRON.COM"
BEAT = 60 / 132.5  # темп трека
DROP_TRACK = 30.96  # дроп в треке (с)
DROP = 14.5  # где дроп в ролике (с)
DUR = 37.6
RHYME = ["Появилось к нам из моря", "вдруг чудовище морское,", "на корабль вцепился друг", "гигантский осьминог!"]

T = {
    "new": "ОБНОВЛЕНИЕ", "land": ["ШТОРМОВОЕ", "МОРЕ"],
    "map": ["НОВАЯ ЗЕМЛЯ", "НА КАРТЕ"], "map_sub": ["ПОСЛЕ АЛОЙ БЕЗДНЫ"],
    "foes": ["БОЙ", "НА ПАЛУБЕ"], "crab": ["КРАБ-ГРОМИЛА"], "naga": ["НАГА: ПЕСНЯ СИРЕНЫ"], "drowned": ["УТОПЛЕННИК"],
    "boss": ["НОВЫЙ БОСС"], "kraken": "КРАКЕН",
    "slam": ["УДАР ЩУПАЛЬЦЕМ"], "grab": ["ХВАТКА!", "БЕЙ, ЧТОБЫ ВЫРВАТЬСЯ"], "ink": ["ЧЕРНИЛА СЛЕПЯТ"], "tide": ["ВОЛНА ПО ВСЕЙ ПАЛУБЕ"],
    "chest": ["СУНДУК", "ПРИЛИВА"], "chest_sub": ["20 ОТЖИМАНИЙ —", "И ОН ОТКРЫТ"],
    "pirate": ["НОВЫЙ", "ПИРАТ"], "pirate_sub": ["ЖИЛЕТКА И ТРЕУГОЛКА", "ПОВЕРХ ЛЮБОЙ БРОНИ"],
    "sword": ["МЕЧ", "ПРИЛИВА"], "sword_sub": ["КРИТ —", "УДАР ВОЛНОЙ!"],
    "end": ["ИГРАЙ БЕСПЛАТНО", "В БРАУЗЕРЕ"], "tg": "t.me/ashe_and_iron",
}


class Frames(list):
    """Кадры хранятся сжатыми: 1200 кадров 1080×1920 не помещаются в память картинками."""

    def append(self, f):
        super().append(zlib.compress(f.convert("RGB").tobytes(), 1))

    def image(self, k):
        return Image.frombytes("RGB", (W, H), zlib.decompress(self[k]))


class Spray:
    """Брызги и капли шторма поверх кадра (пиксели ×6), ветер слева направо."""

    def __init__(self, rnd):
        self.rnd = rnd
        self.p = []

    def step(self, rate=4):
        r = self.rnd
        for _ in range(rate):
            self.p.append([r.uniform(-200, W), r.uniform(-60, H), r.uniform(6, 14), r.uniform(10, 22), r.uniform(0.5, 1.2),
                           FOAM if r.random() < 0.4 else SEA])
        for q in self.p:
            q[0] += q[2]
            q[1] += q[3]
            q[4] -= 1 / FPS
        self.p = [q for q in self.p if q[4] > 0 and q[1] < H + 20 and q[0] < W + 20]

    def draw(self, f):
        d = ImageDraw.Draw(f, "RGBA")
        for x, y, vx, vy, life, col in self.p:
            a = int(200 * min(1, life))
            d.line([x, y, x - vx * 0.8, y - vy * 0.8], fill=col + (a,), width=4)


# ------------------------------------------------------------------ звук
def read_wav(path):
    with wave.open(path) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, w.getnchannels())
    return a.astype(np.float32) / 32768


def write_wav(path, a):
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes())


def restyle(inst_path, tmp, events):
    """Трек без слов под стиль игры. events — [(время, звук)] в секундах ролика."""
    a = read_wav(inst_path)
    s0 = int((DROP_TRACK - DROP) * SR)
    seg = a[s0:s0 + int(DUR * SR)].copy()
    # на полтона ниже — темнее, «тяжелее» (темп не меняется)
    raw, low = os.path.join(tmp, "seg.wav"), os.path.join(tmp, "low.wav")
    write_wav(raw, seg)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af", f"rubberband=pitch={2 ** (-1 / 12):.6f}:transients=crisp", low], check=True)
    mus = read_wav(low)[: len(seg)]
    n = len(mus)
    t = np.arange(n) / SR
    # пиксельный слой: 6 бит и удержание отсчётов — как звук старых приставок, подмешан сбоку
    held = np.repeat(mus[::3], 3, axis=0)[:n]
    crush = np.round(held * 32) / 32
    mus = mus + 0.22 * crush
    # нарастание: шторм за стеной — фильтр закрыт и раскрывается к дропу (по кадрам STFT)
    f, tt, Z = signal.stft(mus.T, SR, nperseg=2048, noverlap=1536)
    cut = np.where(tt < DROP, 350 * (19000 / 350) ** np.clip(tt / DROP, 0, 1) ** 2.2, 22000)
    cut = np.where((tt > DROP - 1.5) & (tt < DROP), 220, cut)  # затишье перед дропом: только глубина
    mask = 1 / (1 + (f[:, None] / cut[None, :]) ** 4)
    _, y = signal.istft(Z * mask[None], SR, nperseg=2048, noverlap=1536)
    mus = y.T[:n]
    rnd = np.random.default_rng(7)
    # шторм: шум прибоя волнами в нарастании и в финале, раскаты грома
    wn = rnd.standard_normal(n).astype(np.float32)
    surf = signal.lfilter([1], [1, -0.995], wn) * 0.004
    surf *= 0.5 + 0.5 * np.sin(2 * np.pi * t / 4.3) ** 2
    surf *= np.clip(1 - (t - DROP) / 0.4, 0, 1) + np.clip((t - (DUR - 6)) / 3, 0, 1) * 0.6
    mus += np.stack([surf, np.roll(surf, 900)], 1)
    fx = np.zeros(n, np.float32)
    for k in range(int((DUR - DROP) / (BEAT * 4)) + 1):  # тайко на каждый такт после дропа
        tb = DROP + k * BEAT * 4
        if tb < DUR - 3:
            sfxlib.mix_at(fx, sfxlib.taiko(58, 0.6), tb, 0.55)
            sfxlib.mix_at(fx, sfxlib.taiko(74, 0.4), tb + BEAT * 2.5, 0.3)
    for tm, kind in events:
        sfxlib.mix_at(fx, sfxlib.sfx(kind), tm, sfxlib.SFX_GAIN[kind] * 0.75)
    mix = mus * 0.9 + fx[:, None] * 0.7
    mix[: int(SR * 0.08)] *= np.linspace(0, 1, int(SR * 0.08))[:, None]
    tail = int(SR * 2.5)
    mix[-tail:] *= np.linspace(1, 0, tail)[:, None] ** 1.5
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    out = os.path.join(tmp, "audio.wav")
    write_wav(out, mix)
    return out


# ------------------------------------------------------------------ картинка
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", required=True)
    ap.add_argument("--fonts", required=True)
    ap.add_argument("--inst", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    pf = PixelFont(a.fonts)
    at = Atlas()
    rnd = random.Random(2061)
    spray = Spray(rnd)
    frames, events, shakes = Frames(), [], []
    bg = at["sea_bg"].convert("RGB")
    sec = lambda s: int(round(s * FPS))

    def cap(lines, cols, sizes):
        return caption_image(pf, lines, [fit_size(pf, l, s) for l, s in zip(lines, sizes)], cols)

    def two(lines, col):
        return cap(lines, [WHITE, col], [64, 84]) if len(lines) == 2 else cap(lines, [col], [76])

    def sub(lines, col=WHITE):
        return cap(lines, [col] * len(lines), [44] * len(lines))

    def flash(f, i, col=(255, 255, 255), k=0.5, n=3):
        return Image.blend(f, Image.new("RGBA", (W, H), col + (255,)), k * (1 - i / n)) if i < n else f

    def word(f, text, y, size, col, age, shadow=(10, 40, 70)):
        s = fit_size(pf, text, size)
        z = ease_pop(age, 6, 0.5)
        img = Image.new("RGBA", (W, s + 40), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        x = (W - pf.width(text, s)) // 2
        pf.draw(d, (x + 8, 8), text, s, shadow, stroke=6, stroke_fill=shadow)
        pf.draw(d, (x, 0), text, s, col, stroke=6, stroke_fill=(4, 8, 14))
        img = img.resize((int(W * z), int(img.height * z)), Image.BILINEAR)
        f.alpha_composite(img, ((W - img.width) // 2, y - (img.height - s) // 2))

    def backdrop(i, zoom=1.0, dark=110):
        k = H / bg.height * zoom * (1 + i * 0.0012)
        big = bg.resize((int(bg.width * k), int(bg.height * k)), Image.NEAREST)
        f = Image.new("RGBA", (W, H), BG + (255,))
        f.paste(big, ((W - big.width) // 2 + int(math.sin(i / 9) * 14), (H - big.height) // 2 + int(math.sin(i / 7) * 10)))
        f.alpha_composite(Image.new("RGBA", (W, H), (0, 6, 16, dark)))
        return f

    def band(f, y, h):
        d = ImageDraw.Draw(f)
        d.rectangle([0, y - 6, W, y - 1], fill=(40, 120, 160))
        d.rectangle([0, y + h, W, y + h + 5], fill=(40, 120, 160))

    def scene(shots, box, top, bottom=None, label=None, n_frames=None):
        """Кадры движка крупно посередине, подпись сверху, пояснение снизу. label(n) — сменная плашка."""
        start = len(frames)
        bw, bh = box[2] - box[0], box[3] - box[1]
        size = (W, round(W * bh / bw))
        y = 960 - size[1] // 2 + 40
        prev = None
        for n, (shot, i) in enumerate(shots[:n_frames] if n_frames else shots):
            f = backdrop(len(frames), 1.1, 170)
            f.paste(engine_crop(a.engine, shot, i, box=box, size=size), (0, y))
            band(f, y, size[1])
            put_caption(f, top, 170, n)
            if bottom:
                put_caption(f, bottom, y + size[1] + 80, max(0, n - 4))
            if label:
                lab = label(n)
                if lab:
                    put_caption(f, lab[0], y + size[1] + 80, lab[1])
            spray.step(2)
            spray.draw(f)
            cut = prev is not None and shot != prev
            frames.append(flash(f, n, FOAM, 0.35) if n < 3 else flash(f, 0, FOAM, 0.3) if cut else f)
            prev = shot
        return start

    def fill_to(t_end, make):
        """Дописать кадры до момента t_end (с) функцией make(i)."""
        i = 0
        while len(frames) < sec(t_end):
            frames.append(make(i))
            i += 1

    # ---------------- 0–2,7 с: ОБНОВЛЕНИЕ / ШТОРМОВОЕ МОРЕ
    events += [[0.0, "thunder"], [0.3, "whoosh"]]
    shakes.append((0, 8))

    def title(i):
        f = backdrop(i, 1.0, 70)
        f.alpha_composite(rays(SEA, i / FPS, 12))
        spray.step(7)
        spray.draw(f)
        word(f, T["new"], 520, 84, GOLD, i, (60, 30, 10))
        if i >= 8:
            word(f, T["land"][0], 720, 108, WHITE, i - 8)
        if i >= 13:
            word(f, T["land"][1], 860, 140, SEA, i - 13)
        return flash(f, i, FOAM, 0.8, 5)
    fill_to(2.7, title)
    events += [[8 / FPS, "hit"], [13 / FPS, "boom"]]
    shakes.append((13, 6))

    # ---------------- карта: новая земля
    s = scene([("map", k) for k in range(0, 46)], (40, 0, 600, 300), two(T["map"], SEA), sub(T["map_sub"], GOLD), n_frames=sec(4.6) - len(frames))
    events.append([s / FPS, "whoosh"])

    # ---------------- враги на палубе: краб, нага, утопленник (смена по долям такта)
    box = (0, 40, 640, 330)
    lc, ln, ld = sub(T["crab"], (255, 150, 110)), sub(T["naga"], SEA), sub(T["drowned"], (170, 220, 180))
    shots = [("crab", k) for k in range(14, 44)] + [("naga", k) for k in range(8, 50)] + [("drowned", k) for k in range(4, 30)]
    need = sec(8.1) - len(frames)
    shots = (shots * 2)[:need]
    s = scene(shots, box, two(T["foes"], SEA), label=lambda n: (lc, n) if n < 30 else (ln, n - 30) if n < 72 else (ld, n - 72))
    events += [[(s + 16) / FPS, "hit"], [(s + 30) / FPS, "whoosh"], [(s + 48) / FPS, "alert"], [(s + 72) / FPS, "whoosh"], [(s + 92) / FPS, "hit"]]

    # ---------------- появление Кракена: стих строка за строкой, глаза — на дроп
    e0 = len(frames)
    assert abs(e0 / FPS - (DROP - 6.4)) < 0.05, e0 / FPS
    rhyme_caps = []
    for k, line in enumerate(RHYME):
        last = k == len(RHYME) - 1
        size = fit_size(pf, line, 52 if last else 40)
        img = Image.new("RGBA", (W, size + 30), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        x = (W - pf.width(line, size)) // 2
        pf.draw(d, (x + 6, 6), line, size, (60, 10, 10) if last else (8, 30, 60), stroke=5, stroke_fill=(60, 10, 10) if last else (8, 30, 60))
        pf.draw(d, (x, 0), line, size, BLOOD if last else FOAM, stroke=5, stroke_fill=(4, 6, 12))
        rhyme_caps.append(img)
    boss_cap = two(T["boss"], BLOOD)
    size = (W, round(W * 360 / 640))
    py = 1180 - size[1] // 2
    for k in range(250):
        tt = (k + 1) / FPS
        f = backdrop(len(frames), 1.15, 190)
        rock = min(1, tt / 6)
        f.paste(engine_crop(a.engine, "emerge", k, box=(0, 0, 640, 360), size=size), (int(math.sin(tt * 3) * 10 * rock), py))
        band(f, py, size[1])
        top = 260
        for j, img in enumerate(rhyme_caps):
            age = (tt - 0.5 - j * 1.5) * FPS
            if age < 0:
                continue
            alpha = min(1, age / 8)
            im = img if alpha >= 1 else Image.blend(Image.new("RGBA", img.size, (0, 0, 0, 0)), img, alpha)
            z = ease_pop(age, 6, 0.45 if j == 3 else 0.25)
            if z > 1:
                im = im.resize((int(im.width * z), int(im.height * z)), Image.BILINEAR)
            f.alpha_composite(im, ((W - im.width) // 2, top + j * 120 - (im.height - img.height) // 2))
        if tt >= 6.4:  # дроп: НОВЫЙ БОСС — КРАКЕН
            age = int((tt - 6.4) * FPS)
            word(f, T["kraken"], py + size[1] + 80, 150, BLOOD, age, (60, 10, 10))
            put_caption(f, boss_cap, 120, age) if age < 50 else None
        spray.step(3 + int(rock * 5))
        spray.draw(f)
        if tt >= 6.4:
            f = flash(f, int((tt - 6.4) * FPS), (255, 240, 220), 0.9, 6)
        frames.append(f)
    for j in range(4):
        events.append([(e0 + sec(0.5 + j * 1.5)) / FPS, "whoosh"])
    for j in range(4):
        events.append([(e0 + sec(1.5 + j * 0.6)) / FPS, "hit"])
    events += [[(e0 + sec(4.6)) / FPS, "thunder"], [DROP, "boom"], [DROP + 0.05, "thunder"]]
    shakes += [(e0 + sec(1.5), 6), (e0 + sec(2.1), 6), (e0 + sec(2.7), 6), (e0 + sec(3.3), 6), (sec(DROP), 18)]

    # ---------------- бой с Кракеном
    labs = [sub(T["slam"], (255, 170, 130)), sub(T["grab"], BLOOD), sub(T["ink"], INK), sub(T["tide"], SEA)]
    shots = [("k_slam", k) for k in range(4, 44)] + [("k_grab", k) for k in range(4, 70)] + [("k_ink", k) for k in range(6, 44)] + [("k_tide", k) for k in range(6, 46)]
    cuts = [0, 40, 106, 144]
    s = scene(shots, box, two(["КРАКЕН"], BLOOD), label=lambda n: (labs[sum(n >= c for c in cuts) - 1], n - cuts[sum(n >= c for c in cuts) - 1]))
    events += [[(s + 26) / FPS, "boom"], [(s + 40 + 26) / FPS, "hit"], [(s + 40 + 36) / FPS, "hit"], [(s + 40 + 52) / FPS, "hit"],
               [(s + 40 + 60) / FPS, "hit"], [(s + 106 + 24) / FPS, "whoosh"], [(s + 144 + 26) / FPS, "boom"]]
    shakes += [(s + 26, 8), (s + 144 + 26, 10)]

    # ---------------- Сундук Прилива: 20 отжиманий → Новый пират
    lr = sub(T["chest_sub"], (150, 230, 140))
    shots = [("chest_inv", k) for k in range(4, 16)] + [("chest_open", k) for k in range(0, 96, 2)] + [("chest_legend", k) for k in range(0, 44)]
    s = scene(shots, (0, 0, 640, 360), two(T["chest"], SEA), label=lambda n: (lr, n) if n < 60 else None)
    for r in range(20):
        events.append([(s + 12 + 1 + r) / FPS, "dodge" if r % 2 else "hit"])
    events += [[(s + 60) / FPS, "boom"], [(s + 62) / FPS, "fanfare"]]
    shakes.append((s + 60, 10))

    # ---------------- Новый пират: облик крупно поверх разных доспехов, потом в бою
    pir = at["pirate_idle_0"]
    looks = ["base", "armor", "king", "wing"]
    c_top, c_sub = two(T["pirate"], GOLD), sub(T["pirate_sub"], WHITE)
    p0 = len(frames)
    for i in range(sec(2.6)):
        f = backdrop(len(frames), 1.05, 150)
        f.alpha_composite(rays(GOLD, i / FPS, 30))
        look = looks[min(len(looks) - 1, i // 19)]
        key = f"hero_tide_{look}_idle_{(i // 12) % 2}"
        hero = at[key if key in at.frames else "hero_tide_base_idle_0"].copy()
        hero.alpha_composite(pir, (0, hero.height - pir.height))
        z = 22 * ease_pop(i % 19, 5, 0.12)
        big = hero.resize((int(hero.width * z), int(hero.height * z)), Image.NEAREST)
        f.alpha_composite(big, ((W - big.width) // 2, 1500 - big.height))
        put_caption(f, c_top, 170, i)
        put_caption(f, c_sub, 1560, max(0, i - 4))
        spray.step(3)
        spray.draw(f)
        frames.append(flash(f, i % 19, (255, 230, 170), 0.5, 3) if i % 19 < 3 else f)
        if i % 19 == 0:
            events.append([len(frames) / FPS, "hit"])
    s = scene([("pirate_fight", k) for k in range(2, 40)], box, two(T["pirate"], GOLD), sub(["В БОЮ"], WHITE))
    events += [[(s + 2) / FPS, "hit"], [(s + 24) / FPS, "hit"]]

    # ---------------- Меч Прилива: клинок крупно → крит волной
    sw = at["sword_tide"]
    c_top = two(T["sword"], SEA)
    for i in range(sec(1.4)):
        f = backdrop(len(frames), 1.05, 160)
        f.alpha_composite(rays(SEA, i / FPS, 34))
        z = 30 * ease_pop(i, 6, 0.25)
        big = sw.resize((int(sw.width * z), int(sw.height * z)), Image.NEAREST).rotate(-35 + i * 0.6, expand=True, resample=Image.NEAREST)
        f.alpha_composite(big, ((W - big.width) // 2, 980 - big.height // 2))
        put_caption(f, c_top, 170, i)
        spray.step(5)
        spray.draw(f)
        frames.append(flash(f, i, FOAM, 0.7, 5))
    events += [[(len(frames) - sec(1.4)) / FPS, "boom"]]
    s = scene([("tide", k) for k in range(30, 70)], box, c_top, sub(T["sword_sub"], SEA))
    events += [[(s + 4) / FPS, "hit"], [(s + 22) / FPS, "boom"], [(s + 23) / FPS, "whoosh"]]
    shakes.append((s + 22, 10))

    # ---------------- финал
    start = len(frames)
    events.append([start / FPS, "boom"])
    shakes.append((start, 8))
    c_end = cap(T["end"], [WHITE, SEA], [54, 64])

    def final(i):
        f = backdrop(start + i, 1.05, 100)
        f.paste(engine_crop(a.engine, "final", min(59, i), box=(290, 196, 560, 322), size=(W, 504)), (0, 760))
        spray.step(4)
        spray.draw(f)
        d = ImageDraw.Draw(f, "RGBA")
        t, sz = "ASH & IRON", 104
        x = (W - pf.width(t, sz)) // 2
        pf.draw(d, (x + 9, 179), t, sz, RED, stroke=6, stroke_fill=RED)
        pf.draw(d, (x, 170), t, sz, (232, 206, 160), stroke=6, stroke_fill=(8, 6, 12))
        put_caption(f, c_end, 360, i)
        if i >= 6:
            z = ease_pop(i - 6, 6, 0.12) * (1 + 0.02 * math.sin(i / 3))
            ss = fit_size(pf, SITE, 76)
            img = Image.new("RGBA", (W, ss + 40), (0, 0, 0, 0))
            dd = ImageDraw.Draw(img)
            xx = (W - pf.width(SITE, ss)) // 2
            pf.draw(dd, (xx + 6, 6), SITE, ss, (10, 40, 70), stroke=5, stroke_fill=(10, 40, 70))
            pf.draw(dd, (xx, 0), SITE, ss, SEA, stroke=5, stroke_fill=(4, 8, 14))
            img = img.resize((int(W * z), int(img.height * z)), Image.BILINEAR)
            d.rectangle([0, 1300, W, 1560], fill=(4, 8, 16, 220))
            f.alpha_composite(img, ((W - img.width) // 2, 1360 - (img.height - ss) // 2))
        if i >= 12:
            ts = fit_size(pf, T["tg"], 40)
            pf.draw(ImageDraw.Draw(f), ((W - pf.width(T["tg"], ts)) // 2, 1500), T["tg"], ts, (150, 220, 150), stroke=3, stroke_fill=(8, 6, 12))
        return flash(f, i, FOAM, 0.6, 4)
    fill_to(DUR, final)
    del frames[sec(DUR):]
    total = len(frames)
    print(f"кадров {total} ({total / FPS:.1f} с), финал с {start / FPS:.1f} с")

    tmp = tempfile.mkdtemp()
    wav = restyle(a.inst, tmp, [(t, k) for t, k in events if t < DUR - 0.3])
    enc = subprocess.Popen([
        "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", wav, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-profile:v", "high",
        "-c:a", "aac", "-b:a", "192k", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-movflags", "+faststart",
        "-shortest", a.out], stdin=subprocess.PIPE)
    for k in range(total):
        f = frames.image(k)
        for s0, ln in shakes:
            if 0 <= k - s0 < ln:
                amp = 22 * (1 - (k - s0) / ln)
                moved = Image.new("RGB", (W, H), BG)
                moved.paste(f.resize((W + 40, H + 40), Image.BILINEAR), (-20 + int(rnd.uniform(-amp, amp)), -20 + int(rnd.uniform(-amp, amp))))
                f = moved
        enc.stdin.write(f.tobytes())
    enc.stdin.close()
    enc.wait()
    print(f"Готово: {a.out}")


if __name__ == "__main__":
    main()
