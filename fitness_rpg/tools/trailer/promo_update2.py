"""Ролик «Большое обновление» (вертикальный 1080×1920, 30 к/с, ~22 с): карта земель с боссами, музыка
каждой земли, серия огоньков, сундуки и инвентарь, легендарное оружие, достижения и титулы, кузница.
Кадры — настоящий движок (update2_capture.mjs). Звук — сама музыка игры (web/assets/music) по сценам
плюс звуки из music.py.

Запуск:
  python promo_update2.py --engine ENGINE_DIR --fonts FONTS_DIR --music web/assets/music --out update2.mp4
"""
import argparse
import math
import os
import random
import subprocess
import tempfile
import wave

import numpy as np
from PIL import Image, ImageDraw

import music as sfxlib
from compose import BG, FPS, GOLD, H, RED, W, WHITE, PixelFont, caption_image, fit_size
from promo import Atlas, ease_pop, engine_crop, put_caption, rays
from promo_abyss import Ash

SR = 44100
AURA = (255, 210, 120)
BLUE = (150, 200, 255)
GREEN = (150, 240, 150)
PURPLE = (200, 170, 255)
SITE = "ASH-A-IRON.COM"

T = {
    "big": "БОЛЬШОЕ", "upd": "ОБНОВЛЕНИЕ",
    "map": ["КАРТА", "ЗЕМЕЛЬ"], "map_sub": ["БОССЫ · РАУНДЫ", "НОВЫЕ ЗЕМЛИ — СКОРО"],
    "music": ["МУЗЫКА", "КАЖДОЙ ЗЕМЛИ"], "lands": ["СКЛЕП", "ПОДСТУПЫ К ЗАМКУ", "КЛАДБИЩЕ", "АЛАЯ БЕЗДНА"],
    "streak": ["СЕРИЯ", "ОГОНЬКОВ"], "streak_sub": ["ПОБЕЖДАЙ КАЖДЫЙ ДЕНЬ —", "ПЛАМЯ РАСТЁТ"],
    "chest": ["СУНДУКИ", "С ВРАГОВ"], "chest_sub": ["С БОССА — ВСЕГДА"],
    "inv": ["НОВЫЙ", "ИНВЕНТАРЬ"], "inv_sub": ["ОТКРЫВАЙ СУНДУКИ", "УПРАЖНЕНИЯМИ"],
    "legend": ["ЛЕГЕНДАРНОЕ", "ОРУЖИЕ"], "legend_sub": ["4 КЛИНКА —", "ПО ОДНОМУ НА ЗЕМЛЮ"],
    "ach": ["ДОСТИЖЕНИЯ", "И ТИТУЛЫ"], "ach_sub": ["ТИТУЛ ВИДЕН В РЕЙТИНГЕ"],
    "forge": ["НОВАЯ", "КУЗНИЦА"], "forge_sub": ["СИНИЕ + АЛЫЕ КАМНИ"],
    "end": ["ИГРАЙ БЕСПЛАТНО", "В БРАУЗЕРЕ"], "tg": "t.me/ashe_and_iron",
}


def load_track(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ar", str(SR), "-ac", "2", "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).reshape(-1, 2).astype(np.float32) / 32768


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", required=True)
    ap.add_argument("--fonts", required=True)
    ap.add_argument("--music", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    pf = PixelFont(a.fonts)
    at = Atlas()
    rnd = random.Random(2026)
    ash = Ash(rnd)
    frames, events, shakes, music = [], [], [], []  # music: [кадр начала, трек, секунда трека]
    bg = at["title_bg"].convert("RGB")

    def cap(lines, cols, sizes):
        return caption_image(pf, lines, [fit_size(pf, l, s) for l, s in zip(lines, sizes)], cols)

    def two(lines, col):
        return cap(lines, [WHITE, col], [64, 84])

    def sub(lines, col=WHITE):
        return cap(lines, [col] * len(lines), [44] * len(lines))

    def flash(f, i, col=(255, 255, 255), k=0.5, n=3):
        return Image.blend(f, Image.new("RGBA", (W, H), col + (255,)), k * (1 - i / n)) if i < n else f

    def word(f, text, y, size, col, age):
        s = fit_size(pf, text, size)
        z = ease_pop(age, 6, 0.5)
        img = Image.new("RGBA", (W, s + 40), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        x = (W - pf.width(text, s)) // 2
        pf.draw(d, (x + 8, 8), text, s, RED, stroke=6, stroke_fill=RED)
        pf.draw(d, (x, 0), text, s, col, stroke=6, stroke_fill=(8, 6, 12))
        img = img.resize((int(W * z), int(img.height * z)), Image.BILINEAR)
        f.alpha_composite(img, ((W - img.width) // 2, y - (img.height - s) // 2))

    def backdrop(i, zoom=1.0):
        k = H / bg.height * zoom * (1 + i * 0.0012)
        big = bg.resize((int(bg.width * k), int(bg.height * k)), Image.NEAREST)
        f = Image.new("RGBA", (W, H), BG + (255,))
        f.paste(big, ((W - big.width) // 2, (H - big.height) // 2))
        f.alpha_composite(Image.new("RGBA", (W, H), (0, 0, 0, 110)))
        return f

    def scene(shots, box, top, bottom, label=None):
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
            d.rectangle([0, y - 6, W, y - 1], fill=(90, 64, 50))
            d.rectangle([0, y + size[1], W, y + size[1] + 5], fill=(90, 64, 50))
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

    # ---------------- 0–1,5 с: БОЛЬШОЕ ОБНОВЛЕНИЕ (увертюра с кульминации)
    music.append([0, "menu", 49.0])
    events += [[0.0, "boom"], [0.35, "whoosh"]]
    shakes.append((0, 10))
    for i in range(45):
        f = backdrop(i)
        f.alpha_composite(rays(GOLD, i / FPS, 12))
        ash.step(6)
        ash.draw(f)
        word(f, T["big"], 660, 104, WHITE, i)
        if i >= 8:
            word(f, T["upd"], 820, 110, GOLD, i - 8)
        frames.append(flash(f, i, (255, 230, 190), 0.8, 5))
    events.append([8 / FPS, "hit"])

    # ---------------- карта земель
    s = scene([("map", k) for k in range(0, 66)], (0, 0, 640, 360), two(T["map"], GOLD), sub(T["map_sub"], BLUE))
    events += [[s / FPS, "whoosh"], [(s + 40) / FPS, "hit"]]

    # ---------------- музыка: 4 земли, у каждой своя тема
    caps = [sub([l], AURA) for l in T["lands"]]
    shots = [(b, k) for b in ("b1", "b2", "b3", "b4") for k in range(0, 24)]
    s = scene(shots, (0, 0, 640, 360), two(T["music"], AURA), None, label=lambda n: (caps[n // 24], n % 24))
    for j, (trk, at_s) in enumerate((("crypt", 30.0), ("castle", 22.0), ("grave", 6.0), ("abyss", 27.0))):
        music.append([s + j * 24, trk, at_s])
        events.append([(s + j * 24 + 4) / FPS, "hit"])
        shakes.append((s + j * 24 + 4, 4))

    # ---------------- серия огоньков (тема костра)
    music.append([len(frames), "bonfire", 12.0])
    s = scene([("streak", k) for k in range(2, 66)], (110, 0, 530, 340), two(T["streak"], AURA), sub(T["streak_sub"], AURA))
    events.append([s / FPS, "souls"])

    # ---------------- сундук падает с босса
    s = scene([("drop", k) for k in range(2, 54)], (0, 0, 640, 360), two(T["chest"], GOLD), sub(T["chest_sub"], WHITE))
    events += [[(s + 1) / FPS, "hit"], [(s + 12) / FPS, "level"]]
    shakes.append((s + 1, 6))

    # ---------------- инвентарь и открытие упражнениями
    s = scene([("inv", k) for k in range(0, 20)] + [("open", k) for k in range(0, 104)], (0, 0, 640, 360),
              two(T["inv"], GOLD), sub(T["inv_sub"], GREEN))
    for r in range(10):
        events.append([(s + 20 + 4 + r * 3) / FPS, "heal" if r == 9 else "dodge"])
    events += [[(s + 20 + 34) / FPS, "boom"], [(s + 20 + 58) / FPS, "fanfare"]]
    shakes.append((s + 20 + 34, 10))

    # ---------------- легендарное оружие (увертюра снова)
    music.append([len(frames), "menu", 52.0])
    s = scene([("open", k) for k in range(104, 150)] + [("legend", k) for k in range(0, 30)], (110, 0, 530, 330),
              two(T["legend"], (255, 200, 80)), sub(T["legend_sub"], AURA))
    events += [[s / FPS, "thunder"], [(s + 2) / FPS, "fanfare"]]
    shakes.append((s + 2, 8))

    # ---------------- достижения и титулы
    s = scene([("ach", k) for k in range(4, 70)], (0, 0, 640, 360), two(T["ach"], PURPLE), sub(T["ach_sub"], PURPLE))
    events.append([s / FPS, "level"])

    # ---------------- кузница
    s = scene([("forge", k) for k in range(0, 48)], (0, 0, 640, 360), two(T["forge"], BLUE), sub(T["forge_sub"], (255, 150, 140)))
    events.append([s / FPS, "hit"])

    # ---------------- финал
    start = len(frames)
    events.append([start / FPS, "boom"])
    shakes.append((start, 8))
    c_end = cap(T["end"], [WHITE, GOLD], [54, 64])
    for i in range(60):
        f = backdrop(i, 1.05)
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
            pf.draw(dd, (xx, 0), SITE, ss, (150, 220, 255), stroke=5, stroke_fill=(8, 6, 12))
            img = img.resize((int(W * z), int(img.height * z)), Image.BILINEAR)
            d.rectangle([0, 1300, W, 1560], fill=(6, 4, 10, 220))
            f.alpha_composite(img, ((W - img.width) // 2, 1360 - (img.height - ss) // 2))
        if i >= 12:
            ts = fit_size(pf, T["tg"], 40)
            pf.draw(ImageDraw.Draw(f), ((W - pf.width(T["tg"], ts)) // 2, 1500), T["tg"], ts, (150, 220, 150), stroke=3, stroke_fill=(8, 6, 12))
        frames.append(flash(f, i, (255, 220, 200), 0.6, 4))

    total = len(frames)
    duration = total / FPS

    # ---------------- звук: музыка игры по сценам (короткие переходы) + звуки
    n = int(SR * duration)
    mix = np.zeros((n, 2), np.float32)
    tracks = {}
    music.sort()
    for j, (f0, name, at_s) in enumerate(music):
        if name not in tracks:
            tracks[name] = load_track(os.path.join(a.music, f"{name}.ogg"))
        trk = tracks[name]
        i0 = int(SR * f0 / FPS)
        i1 = int(SR * music[j + 1][0] / FPS) if j + 1 < len(music) else n
        fade = int(SR * 0.06)
        seg = trk[int(SR * at_s): int(SR * at_s) + (i1 - i0) + fade]
        seg = seg[: max(0, min(len(seg), n - i0))].copy()
        if not len(seg):
            continue
        env = np.ones(len(seg), np.float32)
        k = min(fade, len(seg))
        env[:k] = np.linspace(0, 1, k)
        env[-k:] = np.minimum(env[-k:], np.linspace(1, 0, k))
        if j + 1 == len(music):  # финал: затухание
            tail = min(len(seg), int(SR * 1.2))
            env[-tail:] *= np.linspace(1, 0, tail)
        mix[i0:i0 + len(seg)] += seg * env[:, None]
    fx = np.zeros(n, np.float32)
    for t, kind in events:
        sfxlib.mix_at(fx, sfxlib.sfx(kind), t, sfxlib.SFX_GAIN[kind] * 0.8)
    mix = mix * 0.8 + fx[:, None] * 0.7
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
    for k, f in enumerate(frames):
        f = f.convert("RGB")
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
