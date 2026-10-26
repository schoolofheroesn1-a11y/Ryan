"""Ролик об обновлении (вертикальный 1080×1920, 30 к/с, 15 с): отдельный рейтинг с камерой и без,
профили игроков, оптимизация движений, аура (медитация у костра), новые талисманы в кузнице.
Кадры — настоящий движок игры (update_capture.mjs). Музыка — music.py в стиле "boss" (мрачная битва с боссом).

Запуск:
  python promo_update.py --engine ENGINE_DIR --fonts FONTS_DIR --out update.mp4 [--lang ru|en]
"""
import argparse
import json
import math
import os
import random
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw

from compose import BG, FPS, GOLD, H, RED, W, WHITE, PixelFont, caption_image, fit_size
from promo import Atlas, ease_pop, engine_crop, put_caption, rays
from promo_abyss import Ash

AURA = (255, 230, 160)
BLUE = (150, 200, 255)
GREEN = (150, 240, 150)
SITE = "ASH-A-IRON.COM"

TEXT = {
    "ru": {
        "upd": "ОБНОВЛЕНИЕ", "name": "ASH & IRON",
        "rating": ["ОТДЕЛЬНЫЙ", "РЕЙТИНГ"], "rating_sub": ["С КАМЕРОЙ · БЕЗ КАМЕРЫ"],
        "profile": ["ПРОФИЛИ", "ИГРОКОВ"], "profile_sub": ["ВСЯ СТАТИСТИКА ГЕРОЯ"],
        "moves": ["ДВИЖЕНИЯ", "ТОЧНЕЕ"], "moves_sub": ["БЫСТРЫЙ ОТКЛИК КАМЕРЫ"],
        "aura": ["НОВОЕ:", "АУРА"], "aura_sub": ["ПЛАНКА У КОСТРА —", "+УРОН +ЗДОРОВЬЕ НАВСЕГДА"],
        "forge": ["КУЗНИЦА", "ТАЛИСМАНЫ"], "forge_sub": ["ВЕТРА · КЛЫК ВАМПИРА"],
        "end": ["ИГРАЙ БЕСПЛАТНО", "В БРАУЗЕРЕ"], "tg": "t.me/ashe_and_iron",
    },
    "en": {
        "upd": "UPDATE", "name": "ASH & IRON",
        "rating": ["SEPARATE", "RANKINGS"], "rating_sub": ["CAMERA · NO CAMERA"],
        "profile": ["PLAYER", "PROFILES"], "profile_sub": ["ALL YOUR HERO STATS"],
        "moves": ["SHARPER", "MOVES"], "moves_sub": ["FASTER CAMERA RESPONSE"],
        "aura": ["NEW:", "AURA"], "aura_sub": ["PLANK AT THE BONFIRE —", "+DAMAGE +HEALTH FOREVER"],
        "forge": ["FORGE", "TALISMANS"], "forge_sub": ["WIND · VAMPIRE FANG"],
        "end": ["PLAY FREE", "IN YOUR BROWSER"], "tg": "t.me/ashe_and_iron",
    },
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", required=True)
    ap.add_argument("--fonts", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--lang", default="ru")
    a = ap.parse_args()
    T = TEXT[a.lang]
    pf = PixelFont(a.fonts)
    at = Atlas()
    rnd = random.Random(77)
    ash = Ash(rnd)
    frames, events, shakes = [], [], []
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

    def scene(shots, box, top, bottom, y=None, fl=True):
        """Кадры движка крупно посередине, подпись сверху, пояснение снизу. shots — [(папка, кадр)]."""
        start = len(frames)
        bw, bh = box[2] - box[0], box[3] - box[1]
        size = (W, round(W * bh / bw))
        y = y if y is not None else 960 - size[1] // 2 + 40
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
            ash.step(2)
            ash.draw(f)
            cut = prev is not None and shot != prev
            frames.append(flash(f, n, k=0.35) if fl and n < 3 else f)
            if cut:  # смена кадра внутри сцены — короткая вспышка
                frames[-1] = flash(f, 0, k=0.3)
                events.append([len(frames) / FPS, "whoosh"])
            prev = shot
        return start

    # ---------------- 0–1,4 с: ОБНОВЛЕНИЕ
    events += [[0.0, "boom"], [0.35, "whoosh"]]
    shakes.append((0, 10))
    for i in range(42):
        f = backdrop(i)
        f.alpha_composite(rays(GOLD, i / FPS, 12))
        ash.step(6)
        ash.draw(f)
        word(f, T["name"], 640, 96, (232, 206, 160), i)
        if i >= 8:
            word(f, T["upd"], 820, 120, GOLD, i - 8)
        frames.append(flash(f, i, (255, 230, 190), 0.8, 5))
    events.append([8 / FPS, "hit"])

    # ---------------- 1,4–3,8 с: отдельный рейтинг (с камерой → без камеры)
    s = scene([("rating_cam", k) for k in range(4, 40)] + [("rating_btn", k) for k in range(4, 40)],
              (0, 0, 640, 300), two(T["rating"], GOLD), sub(T["rating_sub"], BLUE))
    events += [[s / FPS, "hit"], [(s + 36) / FPS, "level"]]

    # ---------------- 3,8–6 с: профили игроков
    s = scene([("profile", k) for k in range(0, 60)] + [("profile", 59)] * 6,
              (0, 0, 640, 360), two(T["profile"], GOLD), sub(T["profile_sub"], GREEN))
    events.append([s / FPS, "hit"])

    # ---------------- 6–8,6 с: движения
    s = scene([("moves", k) for k in range(2, 80)], (0, 0, 640, 360), two(T["moves"], GREEN), sub(T["moves_sub"], WHITE))
    for k, kind in ((4, "hit"), (24, "hit"), (36, "alert"), (46, "dodge"), (68, "hit")):
        events.append([(s + k) / FPS, kind])
        if kind == "hit":
            shakes.append((s + k, 4))

    # ---------------- 8,6–11,4 с: аура — медитация у костра
    s = scene([("meditate", k) for k in range(4, 88)], (250, 150, 550, 315), two(T["aura"], AURA), sub(T["aura_sub"], AURA))
    events += [[s / FPS, "souls"], [(s + 30) / FPS, "heal"]]

    # ---------------- 11,4–13,4 с: кузница — талисманы
    s = scene([("forge", k) for k in range(0, 60)], (0, 0, 640, 360), two(T["forge"], BLUE), sub(T["forge_sub"], (255, 150, 140)))
    events += [[s / FPS, "fanfare"], [(s + 30) / FPS, "hit"]]

    # ---------------- 13,4–15 с: финал
    start = len(frames)
    events += [[start / FPS, "boom"]]
    shakes.append((start, 8))
    c_end = cap(T["end"], [WHITE, GOLD], [54, 64])
    for i in range(48):
        f = backdrop(i, 1.05)
        f.paste(engine_crop(a.engine, "title", i % 60, box=(290, 196, 560, 322), size=(W, 504)), (0, 760))
        ash.step(4)
        ash.draw(f)
        d = ImageDraw.Draw(f, "RGBA")
        t, sz = "ASH & IRON", 104
        x = (W - pf.width(t, sz)) // 2
        pf.draw(d, (x + 9, 170 + 9), t, sz, RED, stroke=6, stroke_fill=RED)
        pf.draw(d, (x, 170), t, sz, (232, 206, 160), stroke=6, stroke_fill=(8, 6, 12))
        put_caption(f, c_end, 360, i)
        if i >= 6:  # адрес сайта — крупно и пульсирует
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
    tmp = tempfile.mkdtemp()
    ev_path, wav = os.path.join(tmp, "events.json"), os.path.join(tmp, "music.wav")
    json.dump({"duration": duration, "events": events, "style": "boss", "drop": 1.4}, open(ev_path, "w"))
    subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "music.py"), wav, ev_path], check=True)
    enc = subprocess.Popen([
        "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", wav, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-profile:v", "high",
        "-c:a", "aac", "-b:a", "192k", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-movflags", "+faststart",
        "-shortest", a.out], stdin=subprocess.PIPE)
    for n, f in enumerate(frames):
        f = f.convert("RGB")
        for s0, ln in shakes:  # тряска камеры на ударах
            if 0 <= n - s0 < ln:
                amp = 22 * (1 - (n - s0) / ln)
                moved = Image.new("RGB", (W, H), BG)
                moved.paste(f.resize((W + 40, H + 40), Image.BILINEAR), (-20 + int(rnd.uniform(-amp, amp)), -20 + int(rnd.uniform(-amp, amp))))
                f = moved
        enc.stdin.write(f.tobytes())
    enc.stdin.close()
    enc.wait()
    print(f"Готово: {a.out} ({duration:.1f} с, {total} кадров)")


if __name__ == "__main__":
    main()
