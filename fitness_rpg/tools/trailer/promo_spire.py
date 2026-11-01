"""Ролик «Хеллоуин: Шпиль Самайна» (вертикальный 1080×1920, 30 к/с, ~33 с) под тему локации «samhain».

Новый режим-выживание, монстры по рисункам (рисунок → спрайт игры), Граф Пепельной Крови, Полуночный
Охотник в двух стадиях, тыквенные дары, Сундук Самайна с наградами и усложнённый бой без камеры.
Кадры — настоящий движок (spire_capture.mjs). Звук — тема Шпиля из игры плюс звуки music.py.

Запуск:
  python promo_spire.py --engine ENGINE_DIR --fonts FONTS_DIR --music web/assets/music \\
      --drawings QUEEN.png FLUFF.png --out spire.mp4
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

import music as sfxlib
from compose import BG, FPS, GOLD, H, RED, W, WHITE, PixelFont, caption_image, fit_size
from promo import Atlas, ease_pop, engine_crop, put_caption, rays
from promo_abyss import Ash

SR = 44100
ORANGE = (255, 150, 60)
LILAC = (200, 170, 255)
BLUE = (150, 200, 255)
GREEN = (150, 240, 150)
BLOOD = (255, 90, 100)
SITE = "ASH-A-IRON.COM"


class Frames(list):
    """Кадры хранятся сжатыми RGB-байтами: ~1100 кадров 1080×1920 не помещаются в память как картинки."""

    def append(self, f):
        super().append(zlib.compress(f.convert("RGB").tobytes(), 1))

    def image(self, k):
        return Image.frombytes("RGB", (W, H), zlib.decompress(self[k]))

T = {
    "hw": "ХЕЛЛОУИН", "spire": ["ШПИЛЬ", "САМАЙНА"],
    "mode": ["НОВЫЙ РЕЖИМ", "ВЫЖИВАНИЕ"], "mode_sub": ["ЭТАЖ ЗА ЭТАЖОМ", "БЕЗ ОТДЫХА У КОСТРА"],
    "draw": ["ИЗ РИСУНКА", "В ИГРУ"],
    "fluff": ["ПУХОГЛОТ"], "fluff_sub": ["КУСАЕТ ПАРАМИ", "И ВЫСАСЫВАЕТ СИЛЫ"],
    "queen": ["КОРОЛЕВА", "ТРИНАДЦАТОГО ОКА"], "queen_sub": ["ОКО ОТКРЫТО —", "НЕ БЕЙ!"],
    "vamp": ["ГРАФ", "ПЕПЕЛЬНОЙ КРОВИ"], "vamp_sub": ["СТАЯ МЫШЕЙ · УКУС", "УДАР ИЗ ТУМАНА"],
    "hunt": ["ПОЛУНОЧНЫЙ", "ОХОТНИК"], "hunt_a": ["СУМЕРКИ:", "ВОЙ УЖАСА"], "hunt_b": ["НАСТУПАЕТ", "ПОЛНОЧЬ"],
    "hunt_c": ["ТЬМА · КРЫЛЬЯ", "ПИКЕ ИЗ ТЬМЫ"],
    "gift": ["ТЫКВЕННЫЕ", "ДАРЫ"], "gift_sub": ["1 ИЗ 3 ПОСЛЕ", "КАЖДОГО ЭТАЖА"],
    "chest": ["СУНДУК", "САМАЙНА"], "chest_sub": ["25 ПРИСЕДАНИЙ —", "ЛЕГЕНДЫ ЧАЩЕ"],
    "chest_loot": ["ТЫКВЕННЫЙ АМУЛЕТ", "КЛИНОК НЕТОПЫРЯ"],
    "bat": ["КЛИНОК", "НЕТОПЫРЯ"], "bat_sub": ["СТАЯ МЫШЕЙ", "В КАЖДОМ УДАРЕ"],
    "hard": ["БЕЗ КАМЕРЫ —", "СЛОЖНЕЕ"], "hard_a": ["ТЯЖЁЛЫЙ УДАР:", "ЖДИ МОМЕНТ"], "hard_b": ["СЕРИИ", "ДО 4 УДАРОВ"],
    "hard_c": ["ФИНТЫ · БЕЗ ПРОКАЧКИ", "НЕ ПРОЙТИ"],
    "end": ["ИГРАЙ БЕСПЛАТНО", "В БРАУЗЕРЕ"], "tg": "t.me/ashe_and_iron",
}


def load_track(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ar", str(SR), "-ac", "2", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).reshape(-1, 2).astype(np.float32) / 32768


def framed(photo, w):
    """Рисунок в светлой рамке-«холсте» с тенью."""
    k = w / photo.width
    pic = photo.convert("RGBA").resize((w, int(photo.height * k)), Image.LANCZOS)
    pad = 22
    card = Image.new("RGBA", (pic.width + pad * 2, pic.height + pad * 2), (238, 230, 214, 255))
    card.alpha_composite(pic, (pad, pad))
    shadow = Image.new("RGBA", (card.width + 30, card.height + 30), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle([18, 18, card.width + 18, card.height + 18], fill=(0, 0, 0, 150))
    shadow.alpha_composite(card, (0, 0))
    return shadow


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", required=True)
    ap.add_argument("--fonts", required=True)
    ap.add_argument("--music", required=True)
    ap.add_argument("--drawings", nargs=2, required=True, help="рисунок Королевы, рисунок Пухоглота")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    pf = PixelFont(a.fonts)
    at = Atlas()
    rnd = random.Random(1031)
    ash = Ash(rnd)
    frames, events, shakes = Frames(), [], []
    bg = at["spire_bg"].convert("RGB")

    def cap(lines, cols, sizes):
        return caption_image(pf, lines, [fit_size(pf, l, s) for l, s in zip(lines, sizes)], cols)

    def two(lines, col):
        return cap(lines, [WHITE, col], [64, 84]) if len(lines) == 2 else cap(lines, [col], [90])

    def sub(lines, col=WHITE):
        return cap(lines, [col] * len(lines), [44] * len(lines))

    def flash(f, i, col=(255, 255, 255), k=0.5, n=3):
        return Image.blend(f, Image.new("RGBA", (W, H), col + (255,)), k * (1 - i / n)) if i < n else f

    def word(f, text, y, size, col, age, shadow=RED):
        s = fit_size(pf, text, size)
        z = ease_pop(age, 6, 0.5)
        img = Image.new("RGBA", (W, s + 40), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        x = (W - pf.width(text, s)) // 2
        pf.draw(d, (x + 8, 8), text, s, shadow, stroke=6, stroke_fill=shadow)
        pf.draw(d, (x, 0), text, s, col, stroke=6, stroke_fill=(8, 6, 12))
        img = img.resize((int(W * z), int(img.height * z)), Image.BILINEAR)
        f.alpha_composite(img, ((W - img.width) // 2, y - (img.height - s) // 2))

    def backdrop(i, zoom=1.0, dark=110):
        k = H / bg.height * zoom * (1 + i * 0.0012)
        big = bg.resize((int(bg.width * k), int(bg.height * k)), Image.NEAREST)
        f = Image.new("RGBA", (W, H), BG + (255,))
        f.paste(big, ((W - big.width) // 2, (H - big.height) // 2))
        f.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, dark)))
        return f

    def scene(shots, box, top, bottom=None, label=None):
        """Кадры движка крупно посередине, подпись сверху, пояснение снизу. label(n) — сменная плашка."""
        start = len(frames)
        bw, bh = box[2] - box[0], box[3] - box[1]
        size = (W, round(W * bh / bw))
        y = 960 - size[1] // 2 + 40
        prev = None
        for n, (shot, i) in enumerate(shots):
            f = Image.new("RGBA", (W, H), BG + (255,))
            f.paste(engine_crop(a.engine, shot, i, box=box, size=size), (0, y))
            d = ImageDraw.Draw(f)
            d.rectangle([0, y - 6, W, y - 1], fill=(150, 70, 30))
            d.rectangle([0, y + size[1], W, y + size[1] + 5], fill=(150, 70, 30))
            put_caption(f, top, 150, n)
            if bottom:
                put_caption(f, bottom, y + size[1] + 90, max(0, n - 4))
            if label:
                lab = label(n)
                if lab:
                    put_caption(f, lab[0], y + size[1] + 90, lab[1])
            ash.step(2)
            ash.draw(f)
            cut = prev is not None and shot != prev
            frames.append(flash(f, n, k=0.35) if n < 3 else flash(f, 0, k=0.3) if cut else f)
            prev = shot
        return start

    def reveal(photo, sprite, scale, name_cap, n=54):
        """Рисунок → монстр: рисунок въезжает сверху, стрелка, монстр выпрыгивает со вспышкой."""
        start = len(frames)
        card = framed(photo, 560 if photo.height > photo.width else 640)
        card = card.rotate(-3, expand=True, resample=Image.BICUBIC)
        spr = sprite.resize((sprite.width * scale, sprite.height * scale), Image.NEAREST)
        c_top = two(T["draw"], ORANGE)
        for i in range(n):
            f = backdrop(i, 1.05, 150)
            f.alpha_composite(rays(ORANGE, i / FPS, 26))
            put_caption(f, c_top, 120, i)
            q = min(1, i / 9)
            cy = int(330 + (1 - q) ** 2 * -500)
            ch = min(card.height, 640)
            cc = card if card.height <= 640 else card.resize((int(card.width * 640 / card.height), 640), Image.LANCZOS)
            f.alpha_composite(cc, ((W - cc.width) // 2, cy))
            if i >= 12:  # стрелка вниз
                d = ImageDraw.Draw(f, "RGBA")
                ay = 330 + ch + 10
                z = ease_pop(i - 12, 5, 0.4)
                d.polygon([(W // 2 - 50 * z, ay), (W // 2 + 50 * z, ay), (W // 2, ay + 70 * z)], fill=ORANGE + (255,))
            if i >= 16:
                z = ease_pop(i - 16, 7, 0.35)
                big = spr.resize((int(spr.width * z), int(spr.height * z)), Image.NEAREST)
                by = 330 + ch + 110
                glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                ImageDraw.Draw(glow).ellipse([W // 2 - 300, by - 20, W // 2 + 300, by + spr.height + 60], fill=ORANGE + (40,))
                f.alpha_composite(glow)
                f.alpha_composite(big, ((W - big.width) // 2, by + spr.height - big.height))
                put_caption(f, name_cap, min(H - 200, by + spr.height + 30), i - 16)
            ash.step(3)
            ash.draw(f)
            frames.append(flash(f, i - 16, (255, 220, 160), 0.6, 4) if i >= 16 else f)
        events.extend([[start / FPS, "whoosh"], [(start + 16) / FPS, "boom"]])
        shakes.append((start + 16, 8))

    queen_photo, fluff_photo = (Image.open(p) for p in a.drawings)

    # ---------------- 0–1,6 с: ХЕЛЛОУИН / ШПИЛЬ САМАЙНА
    events += [[0.0, "boom"], [0.35, "whoosh"]]
    shakes.append((0, 10))
    for i in range(48):
        f = backdrop(i, 1.0, 80)
        f.alpha_composite(rays(ORANGE, i / FPS, 14))
        ash.step(6)
        ash.draw(f)
        word(f, T["hw"], 560, 110, ORANGE, i)
        if i >= 8:
            word(f, T["spire"][0], 760, 104, WHITE, i - 8, (70, 20, 90))
        if i >= 12:
            word(f, T["spire"][1], 900, 116, LILAC, i - 12, (70, 20, 90))
        frames.append(flash(f, i, (255, 200, 150), 0.8, 5))
    events += [[8 / FPS, "hit"], [12 / FPS, "hit"]]

    # ---------------- новый режим: зал с правилами
    s = scene([("hall", k) for k in range(0, 48)], (0, 0, 640, 360), two(T["mode"], ORANGE), sub(T["mode_sub"], LILAC))
    events.append([s / FPS, "whoosh"])

    # ---------------- рисунок → Пухоглот → бой
    reveal(fluff_photo, at["fluff_idle_0"], 14, sub(T["fluff"], LILAC))
    s = scene([("fluff", k) for k in range(8, 56)], (0, 40, 640, 330), two(T["fluff"], LILAC), sub(T["fluff_sub"], WHITE))
    events += [[(s + 16) / FPS, "hit"], [(s + 32) / FPS, "hit"]]

    # ---------------- рисунок → Королева Ока → бой
    reveal(queen_photo, at["eyequeen_gaze_0"], 7, sub(["КОРОЛЕВА ОКА"], (255, 214, 110)))
    s = scene([("queen", k) for k in range(2, 50)], (0, 40, 640, 330), two(T["queen"], (255, 214, 110)), sub(T["queen_sub"], BLOOD))
    events += [[(s + 4) / FPS, "thunder"], [(s + 20) / FPS, "hit"]]
    shakes.append((s + 20, 5))

    # ---------------- Граф Пепельной Крови
    s = scene([("vamp", k) for k in range(2, 50)] + [("vamp_bite", k) for k in range(8, 34)], (0, 40, 640, 330),
              two(T["vamp"], LILAC), sub(T["vamp_sub"], WHITE))
    events += [[(s + 20) / FPS, "hit"], [(s + 34) / FPS, "hit"], [(s + 62) / FPS, "hit"]]

    # ---------------- Полуночный Охотник: Сумерки → Полночь
    la, lb, lc = sub(T["hunt_a"], BLUE), sub(T["hunt_b"], BLUE), sub(T["hunt_c"], LILAC)
    shots = [("hunt1", k) for k in range(2, 36)] + [("hunt_tr", k) for k in range(0, 60)] + [("hunt2", k) for k in range(12, 54)]
    s = scene(shots, (0, 20, 640, 330), two(T["hunt"], BLUE),
              label=lambda n: (la, n) if n < 34 else (lb, n - 34) if n < 94 else (lc, n - 94))
    events += [[(s + 22) / FPS, "thunder"], [(s + 36) / FPS, "boom"], [(s + 94 + 34) / FPS, "boom"]]
    shakes += [(s + 36, 12), (s + 94 + 34, 10)]

    # ---------------- тыквенные дары
    s = scene([("gift", k) for k in range(2, 36)], (0, 0, 640, 360), two(T["gift"], ORANGE), sub(T["gift_sub"], WHITE))
    events.append([s / FPS, "level"])

    # ---------------- Сундук Самайна
    lr = sub(T["chest_loot"], (255, 200, 90))
    shots = [("chest_inv", k) for k in range(2, 18)] + [("chest_open", k) for k in range(0, 104, 1)] + [("chest_legend", k) for k in range(0, 50)]
    s = scene(shots, (0, 0, 640, 360), two(T["chest"], ORANGE), label=lambda n: (sub(T["chest_sub"], GREEN), n) if n < 120 else (lr, n - 120))
    for r in range(25):
        events.append([(s + 16 + 3 + r * 2) / FPS, "heal" if r == 24 else "dodge"])
    burst = s + 16 + 56
    events += [[burst / FPS, "boom"], [(s + 120) / FPS, "fanfare"]]
    shakes.append((burst, 10))

    # ---------------- Клинок Нетопыря
    s = scene([("bat", k) for k in range(0, 46)], (0, 40, 640, 330), two(T["bat"], BLOOD), sub(T["bat_sub"], WHITE))
    events += [[(s + 4) / FPS, "hit"], [(s + 20) / FPS, "hit"], [(s + 36) / FPS, "hit"]]

    # ---------------- без камеры — сложнее
    ha, hb, hc = sub(T["hard_a"], (255, 210, 120)), sub(T["hard_b"], (255, 140, 90)), sub(T["hard_c"], BLOOD)
    shots = [("hard_heavy", k) for k in range(0, 50)] + [("hard_flurry", k) for k in range(0, 64)] + [("hard_feint", k) for k in range(0, 44)]
    s = scene(shots, (0, 20, 640, 330), two(T["hard"], BLOOD),
              label=lambda n: (ha, n) if n < 50 else (hb, n - 50) if n < 114 else (hc, n - 114))
    events += [[(s + 38) / FPS, "dodge"], [(s + 50 + 12) / FPS, "dodge"], [(s + 50 + 34) / FPS, "dodge"], [(s + 114 + 22) / FPS, "whoosh"]]

    # ---------------- финал
    start = len(frames)
    events.append([start / FPS, "boom"])
    shakes.append((start, 8))
    c_end = cap(T["end"], [WHITE, ORANGE], [54, 64])
    for i in range(60):
        f = backdrop(i, 1.05, 90)
        f.paste(engine_crop(a.engine, "final", i % 60, box=(290, 196, 560, 322), size=(W, 504)), (0, 760))
        ash.step(4)
        ash.draw(f)
        d = ImageDraw.Draw(f, "RGBA")
        t, sz = "ASH & IRON", 104
        x = (W - pf.width(t, sz)) // 2
        pf.draw(d, (x + 9, 170 + 9), t, sz, RED, stroke=6, stroke_fill=RED)
        pf.draw(d, (x, 170), t, sz, (232, 206, 160), stroke=6, stroke_fill=(8, 6, 12))
        put_caption(f, c_end, 360, i)
        if i >= 6:
            z = ease_pop(i - 6, 6, 0.12) * (1 + 0.02 * math.sin(i / 3))
            ss = fit_size(pf, SITE, 76)
            img = Image.new("RGBA", (W, ss + 40), (0, 0, 0, 0))
            dd = ImageDraw.Draw(img)
            xx = (W - pf.width(SITE, ss)) // 2
            pf.draw(dd, (xx + 6, 6), SITE, ss, RED, stroke=5, stroke_fill=RED)
            pf.draw(dd, (xx, 0), SITE, ss, (255, 180, 90), stroke=5, stroke_fill=(8, 6, 12))
            img = img.resize((int(W * z), int(img.height * z)), Image.BILINEAR)
            d.rectangle([0, 1300, W, 1560], fill=(6, 4, 10, 220))
            f.alpha_composite(img, ((W - img.width) // 2, 1360 - (img.height - ss) // 2))
        if i >= 12:
            ts = fit_size(pf, T["tg"], 40)
            pf.draw(ImageDraw.Draw(f), ((W - pf.width(T["tg"], ts)) // 2, 1500), T["tg"], ts, (150, 220, 150), stroke=3, stroke_fill=(8, 6, 12))
        frames.append(flash(f, i, (255, 220, 200), 0.6, 4))

    total = len(frames)
    duration = total / FPS

    # ---------------- звук: тема Шпиля Самайна (по кругу петли) + звуки
    n = int(SR * duration)
    trk = load_track(os.path.join(a.music, "samhain.ogg"))
    a0 = int(SR * 0.5)
    loop = trk[a0:]
    reps = int(np.ceil(n / len(loop))) + 1
    mus = np.concatenate([loop] * reps)[:n].copy()
    tail = int(SR * 1.4)
    mus[-tail:] *= np.linspace(1, 0, tail)[:, None]
    mus[: int(SR * 0.05)] *= np.linspace(0, 1, int(SR * 0.05))[:, None]
    fx = np.zeros(n, np.float32)
    for t, kind in events:
        sfxlib.mix_at(fx, sfxlib.sfx(kind), t, sfxlib.SFX_GAIN[kind] * 0.7)
    mix = mus * 0.85 + fx[:, None] * 0.65
    mix = np.tanh(mix * 1.2) / np.tanh(1.2)
    tmp = tempfile.mkdtemp()
    wav = os.path.join(tmp, "audio.wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
    enc = subprocess.Popen([
        "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", wav, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-profile:v", "high",
        "-c:a", "aac", "-b:a", "192k", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-movflags", "+faststart",
        "-shortest", a.out], stdin=subprocess.PIPE)
    for k in range(len(frames)):
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
    print(f"Готово: {a.out} ({duration:.1f} с, {total} кадров)")


if __name__ == "__main__":
    main()
