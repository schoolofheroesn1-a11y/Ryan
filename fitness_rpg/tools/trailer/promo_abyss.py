"""Ролик «Алая Бездна» (вертикальный 1080×1920, 30 к/с, ~16 с): новая локация, демоны, босс Алый Серафим
с аурой и второй стадией, трофеи с босса. Кадры — настоящий движок игры (abyss_capture.mjs),
иллюстрации — спрайты из web/assets/atlas.png. Музыка — music.py в стиле "epic".

Запуск:
  python promo_abyss.py --engine ENGINE_DIR --fonts FONTS_DIR --out abyss.mp4 [--lang ru|en]
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
from promo import Atlas, ease_pop, engine_crop, paste_scaled, put_caption, rays

CRIMSON = (236, 70, 64)
EMBER = (255, 140, 70)
ASH = (200, 186, 182)
SITE = "ASH-A-IRON.COM"
BATTLE = (60, 40, 620, 345)  # кадр боя из картинки игры 640×360
BATTLE_SIZE = (W, round(W * (345 - 40) / (620 - 60)))

TEXT = {
    "ru": {
        "new": "НОВАЯ ЛОКАЦИЯ", "abyss": "АЛАЯ БЕЗДНА",
        "demons": ["ДЕМОНЫ", "БЕЗДНЫ"], "demons_sub": ["БЕСЫ · ГОНЧИЕ · ПУСТЫЕ"],
        "boss": "НОВЫЙ БОСС", "seraph": "АЛЫЙ СЕРАФИМ",
        "aura": ["ЕГО АУРА ЖЖЁТ", "3% ЗДОРОВЬЯ В СЕКУНДУ"], "aura_sub": ["БЕЙ БЫСТРЕЕ"],
        "stage": ["ВТОРАЯ", "СТАДИЯ"], "stage_sub": ["ОН ПЕРЕРОЖДАЕТСЯ"],
        "angry": ["ЗЛЕЕ", "И БЫСТРЕЕ"], "angry_sub": ["ПРИСЕДАЙ ВОВРЕМЯ!"],
        "loot": ["ТРОФЕИ", "СЕРАФИМА"], "loot_sub": ["КРЫЛО · ДОСПЕХ"],
        "end": ["ИГРАЙ БЕСПЛАТНО", "В БРАУЗЕРЕ"], "tg": "t.me/ashe_and_iron",
    },
    "en": {
        "new": "NEW LOCATION", "abyss": "CRIMSON ABYSS",
        "demons": ["DEMONS OF", "THE ABYSS"], "demons_sub": ["IMPS · HOUNDS · HUSKS"],
        "boss": "NEW BOSS", "seraph": "CRIMSON SERAPH",
        "aura": ["HIS AURA BURNS", "3% HEALTH PER SECOND"], "aura_sub": ["STRIKE FAST"],
        "stage": ["STAGE", "TWO"], "stage_sub": ["HE IS REBORN"],
        "angry": ["ANGRIER", "AND FASTER"], "angry_sub": ["SQUAT IN TIME!"],
        "loot": ["SERAPH'S", "TROPHIES"], "loot_sub": ["WING · ARMOR"],
        "end": ["PLAY FREE", "IN YOUR BROWSER"], "tg": "t.me/ashe_and_iron",
    },
}


class Ash:
    """Пепел и искры поверх кадра (пиксели ×6, как в игре)."""

    def __init__(self, rnd):
        self.rnd = rnd
        self.p = []

    def step(self, rate=4):
        r = self.rnd
        for _ in range(rate):
            ember = r.random() < 0.3
            self.p.append([r.uniform(0, W), r.uniform(-40, H), r.uniform(-2, 2), r.uniform(1, 4) * (-1 if ember else 1),
                           r.uniform(0.6, 1.4), EMBER if ember else ASH])
        for q in self.p:
            q[0] += q[2] + math.sin(q[1] / 60) * 1.2
            q[1] += q[3]
            q[4] -= 1 / FPS
        self.p = [q for q in self.p if q[4] > 0 and -60 < q[1] < H + 20]

    def draw(self, f):
        d = ImageDraw.Draw(f, "RGBA")
        for x, y, _, _, life, col in self.p:
            a = int(255 * min(1, life))
            d.rectangle([x, y, x + 5, y + 5], fill=col + (a,))


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
    rnd = random.Random(46)
    ash = Ash(rnd)
    frames, events, shakes = [], [], []
    bg = at["abyss_bg"].convert("RGB")

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
        """Фон Бездны во весь экран: медленный наезд, сверху и снизу — затемнение."""
        k = H / bg.height * zoom * (1 + i * 0.0012)
        big = bg.resize((int(bg.width * k), int(bg.height * k)), Image.NEAREST)
        f = Image.new("RGBA", (W, H), BG + (255,))
        f.paste(big, ((W - big.width) // 2 - int(big.width * 0.12), (H - big.height) // 2))
        return f

    def battle(shot, idx, top, bottom, y=640, fl=True, age0=99):
        start = len(frames)
        for n, i in enumerate(idx):
            f = Image.new("RGBA", (W, H), BG + (255,))
            f.paste(engine_crop(a.engine, shot, i, box=BATTLE, size=BATTLE_SIZE), (0, y))
            put_caption(f, top, 110, n if age0 == 0 else 99)
            if bottom:
                put_caption(f, bottom, 1400, max(0, n - 4))
            ash.step(2)
            ash.draw(f)
            frames.append(flash(f, n, k=0.3) if fl else f)
        return start

    # ---------------- 0–1,6 с: «НОВАЯ ЛОКАЦИЯ — АЛАЯ БЕЗДНА»
    events += [[0.0, "thunder"], [0.0, "boom"], [0.5, "whoosh"]]
    shakes.append((0, 10))
    for i in range(48):
        f = backdrop(i)
        ash.step(6)
        ash.draw(f)
        word(f, T["new"], 300, 76, WHITE, i)
        if i >= 8:
            word(f, T["abyss"], 430, 120, CRIMSON, i - 8)
        frames.append(flash(f, i, (255, 220, 200), 0.8, 5))
    events.append([8 / FPS, "hit"])

    # ---------------- 1,6–4,4 с: демоны Бездны
    c1, c1s = two(T["demons"], EMBER), sub(T["demons_sub"], ASH)
    s = battle("hound", range(4, 48), c1, c1s, age0=0)
    events += [[s / FPS, "whoosh"], [(s + 2) / FPS, "alert"], [(s + 18) / FPS, "dodge"], [(s + 44) / FPS, "hit"]]
    s = battle("imp", range(4, 24), c1, c1s)
    events.append([(s + 6) / FPS, "hit"])
    shakes.append((s + 6, 5))
    s = battle("husk", range(30, 50), c1, c1s)
    events.append([(s + 10) / FPS, "hit"])

    # ---------------- 4,4–5,6 с: появление босса
    start = len(frames)
    events += [[start / FPS, "boom"], [start / FPS, "thunder"], [start / FPS + 0.3, "souls"]]
    shakes.append((start, 12))
    boss = at["seraph_idle_0"]
    for i in range(38):
        f = backdrop(i, 1.15)
        f.alpha_composite(rays(CRIMSON, i / FPS, 30))
        spr = at["seraph_idle_%d" % ((i // 8) % 4)]
        paste_scaled(f, spr, W / 2 + 60, 1040 + int(math.sin(i / 6) * 10), 10 * ease_pop(i, 8, 0.4))
        ash.step(6)
        ash.draw(f)
        word(f, T["boss"], 210, 64, WHITE, i)
        if i >= 6:
            word(f, T["seraph"], 320, 104, CRIMSON, i - 6)
        frames.append(flash(f, i, (255, 120, 100), 0.7, 5))

    # ---------------- 5,6–8,2 с: аура жжёт
    c2, c2s = two(T["aura"], CRIMSON), sub(T["aura_sub"], GOLD)
    s = battle("seraph1", range(8, 86), c2, c2s, age0=0)
    for k in (12, 36):
        events.append([(s + k) / FPS, "hit"])
        shakes.append((s + k, 4))
    events.append([(s + 62) / FPS, "alert"])

    # ---------------- 8,2–11 с: вторая стадия
    c3, c3s = two(T["stage"], CRIMSON), sub(T["stage_sub"], EMBER)
    s = battle("transform", range(0, 84), c3, c3s, age0=0)
    events += [[(s + 6) / FPS, "hit"], [(s + 7) / FPS, "thunder"], [(s + 8) / FPS, "boom"], [(s + 74) / FPS, "souls"]]
    shakes += [(s + 7, 14), (s + 72, 8)]

    # ---------------- 11–12,8 с: злее и быстрее
    c4, c4s = two(T["angry"], EMBER), sub(T["angry_sub"], GOLD)
    s = battle("seraph2", range(6, 60), c4, c4s, age0=0)
    events += [[(s + 2) / FPS, "alert"], [(s + 32) / FPS, "boom"], [(s + 44) / FPS, "hit"]]
    shakes += [(s + 32, 12)]

    # ---------------- 12,8–14,6 с: трофеи Серафима
    c5, c5s = two(T["loot"], GOLD), sub(T["loot_sub"], (150, 190, 255))
    start = len(frames)
    events += [[start / FPS, "fanfare"]]
    for n, (shot, i) in enumerate([("shop_sword", k) for k in range(14, 30)] + [("shop_armor", k) for k in range(14, 30)]):
        f = Image.new("RGBA", (W, H), BG + (255,))
        f.paste(engine_crop(a.engine, shot, i, box=(10, 6, 640, 356), size=(W, 600)), (0, 660))
        put_caption(f, c5, 110, n)
        put_caption(f, c5s, 1400, max(0, n - 4))
        frames.append(flash(f, n % 16, (255, 240, 200), 0.4, 3))
    s = battle("gear_fight", range(6, 30), c5, c5s, fl=False)
    events.append([(s + 4) / FPS, "hit"])
    shakes.append((s + 4, 5))

    # ---------------- финал
    start = len(frames)
    events += [[start / FPS, "boom"], [start / FPS + 0.2, "fanfare"]]
    shakes.append((start, 8))
    c_end = cap(T["end"], [WHITE, GOLD], [54, 64])
    for i in range(60):
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
        if i >= 8:  # адрес сайта — крупно и пульсирует
            z = ease_pop(i - 8, 6, 0.12) * (1 + 0.02 * math.sin(i / 3))
            ss = fit_size(pf, SITE, 76)
            img = Image.new("RGBA", (W, ss + 40), (0, 0, 0, 0))
            dd = ImageDraw.Draw(img)
            xx = (W - pf.width(SITE, ss)) // 2
            pf.draw(dd, (xx + 6, 6), SITE, ss, RED, stroke=5, stroke_fill=RED)
            pf.draw(dd, (xx, 0), SITE, ss, (150, 220, 255), stroke=5, stroke_fill=(8, 6, 12))
            img = img.resize((int(W * z), int(img.height * z)), Image.BILINEAR)
            d.rectangle([0, 1300, W, 1560], fill=(6, 4, 10, 220))
            f.alpha_composite(img, ((W - img.width) // 2, 1360 - (img.height - ss) // 2))
        if i >= 16:
            ts = fit_size(pf, T["tg"], 40)
            pf.draw(ImageDraw.Draw(f), ((W - pf.width(T["tg"], ts)) // 2, 1500), T["tg"], ts, (150, 220, 150), stroke=3, stroke_fill=(8, 6, 12))
        frames.append(flash(f, i, (255, 220, 200), 0.6, 4))

    total = len(frames)
    duration = total / FPS
    tmp = tempfile.mkdtemp()
    ev_path, wav = os.path.join(tmp, "events.json"), os.path.join(tmp, "music.wav")
    json.dump({"duration": duration, "events": events, "style": "epic", "drop": 1.6}, open(ev_path, "w"))
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
