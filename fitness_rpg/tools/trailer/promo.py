"""Ролик-обновление Ash & Iron на 10 секунд (вертикальный 1080×1920, 30 к/с): кладбище, Король-Призрак,
новое снаряжение. Иллюстрации — спрайты игры из web/assets/atlas.png, геймплей — кадры движка
(шоты gy_* из engine_update.mjs). Музыка — music.py в стиле "promo".

Запуск:
  python promo.py --engine ENGINE_DIR --fonts FONTS_DIR --out update.mp4 [--lang ru|en]
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

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TEAL = (110, 240, 210)

TEXT = {
    "ru": {
        "new_loc": "НОВАЯ ЛОКАЦИЯ", "graveyard": "КЛАДБИЩЕ",
        "mobs": ["ЗОМБИ", "ЛЕТУЧИЕ МЫШИ", "СКЕЛЕТЫ"],
        "new_boss": "НОВЫЙ БОСС", "boss": "КОРОЛЬ-ПРИЗРАК", "revive": ["ВОССТАЁТ", "ИЗ МЁРТВЫХ"],
        "weapon": "НОВОЕ ОРУЖИЕ", "armor": "НОВЫЙ ДОСПЕХ",
        "items": [
            ("ГИГАНТСКИЙ МЕЧ", "+20 УРОНА", "ОШЕЛОМЛЯЕТ ВРАГА"),
            ("РАДИАТОР", "ЖАР: 6 УРОНА", "КАЖДУЮ СЕКУНДУ"),
            ("ГРИФ ОТ ШТАНГИ", "+18 УРОНА · КРИТ x2", "ОРУЖИЕ ПОДДЕРЖКИ"),
            ("ДОСПЕХ КОРОЛЯ", "-35% УРОНА", "КУЁТСЯ В КУЗНИЦЕ"),
        ],
        "end": ["КЛАДБИЩЕ ЖДЁТ.", "А ТЫ ГОТОВ?"],
        "cta": ["Играй бесплатно в браузере", "daniil19991.github.io/-Ash-Iron", "t.me/melnikovdania"],
    },
    "en": {
        "new_loc": "NEW LOCATION", "graveyard": "GRAVEYARD",
        "mobs": ["ZOMBIES", "BATS", "SKELETONS"],
        "new_boss": "NEW BOSS", "boss": "WRAITH KING", "revive": ["RISES FROM", "THE DEAD"],
        "weapon": "NEW WEAPON", "armor": "NEW ARMOR",
        "items": [
            ("GIANT SWORD", "+20 DAMAGE", "STUNS ENEMIES"),
            ("RADIATOR", "HEAT: 6 DAMAGE", "EVERY SECOND"),
            ("BARBELL", "+18 DMG · CRIT x2", "SUPPORTER WEAPON"),
            ("KING'S ARMOR", "-35% DAMAGE", "FORGED AT THE FORGE"),
        ],
        "end": ["THE GRAVEYARD WAITS.", "ARE YOU READY?"],
        "cta": ["Play free in your browser", "daniil19991.github.io/-Ash-Iron", "t.me/melnikovdania"],
    },
}


class Atlas:
    def __init__(self):
        web = os.path.join(ROOT, "web", "assets")
        self.img = Image.open(os.path.join(web, "atlas.png")).convert("RGBA")
        f = json.load(open(os.path.join(web, "atlas.json"), encoding="utf-8"))
        self.frames = f.get("frames", f)

    def __getitem__(self, k):
        x, y, w, h = self.frames[k]
        return self.img.crop((x, y, x + w, y + h))


def ease_pop(i, n=6, amp=0.35):
    """Масштаб «удара»: 1+amp → 1 за n кадров."""
    return 1 + amp * max(0.0, 1 - i / n) ** 2


def paste_scaled(f, img, cx, cy, scale):
    big = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.NEAREST)
    f.alpha_composite(big, (int(cx - big.width / 2), int(cy - big.height / 2)))


def put_caption(f, img, y, age):
    z = ease_pop(age, 6, 0.3)
    big = img.resize((int(img.width * z), int(img.height * z)), Image.BILINEAR) if z > 1 else img
    f.alpha_composite(big, ((W - big.width) // 2, int(y - (big.height - img.height) / 2)))


def rays(color, t, alpha=60):
    """Вращающиеся лучи и свечение за иллюстрацией."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = W // 2, 640
    for k in range(12):
        a0 = t * 0.6 + k * math.pi / 6
        pts = [(cx, cy)] + [(cx + 1500 * math.cos(a0 + s), cy + 1500 * math.sin(a0 + s)) for s in (-0.11, 0.11)]
        d.polygon(pts, fill=color + (alpha,))
    for r, a in ((430, 40), (320, 50), (220, 60)):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (a,))
    return layer


def engine_crop(engine, shot, i, box=(110, 110, 530, 320), size=(W, 540)):
    ui = Image.open(os.path.join(engine, shot, f"ui_{i:04d}.png")).convert("RGB")
    return ui.crop(box).resize(size, Image.NEAREST)


MOB_SCALE = 16


def graveyard_window(atlas, x, mobs):
    """Окно 101×180 фона кладбища на весь кадр; враги крупно поверх (центр x, низ y — в пикселях кадра)."""
    f = atlas["graveyard_bg"].crop((int(x), 0, int(x) + 101, 180)).resize((W, H), Image.NEAREST)
    for spr, cx, bottom, rise in mobs:
        h = int(spr.height * rise)
        if h <= 0:
            continue
        part = spr.crop((0, 0, spr.width, h))  # вылезает из земли: видна только верхняя часть
        big = part.resize((spr.width * MOB_SCALE, h * MOB_SCALE), Image.NEAREST)
        f.alpha_composite(big, (int(cx - big.width / 2), int(bottom - big.height)))
    return f


def shade_top(f, h=700, a=200):
    grad = Image.new("RGBA", (1, h))
    for y in range(h):
        grad.putpixel((0, y), (6, 4, 10, int(a * (1 - y / h))))
    f.alpha_composite(grad.resize((W, h)), (0, 0))


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
    rnd = random.Random(7)
    frames, events, shakes = [], [], []

    def title(small, big, big_col=GOLD, big_size=104):
        return caption_image(pf, [small, big], [fit_size(pf, small, 44), fit_size(pf, big, big_size)], [WHITE, big_col])

    # ---------------- 0–2 с: кладбище, враги встают из земли
    c_loc = title(T["new_loc"], T["graveyard"], big_size=120)
    mob_spr = [at["zombie_idle_0"], at["bat_idle_0"], at["skeleton_idle_0"]]
    appear = [10, 24, 38]
    events += [[0.0, "boom"], [0.0, "thunder"]] + [[t / FPS, "whoosh"] for t in appear]
    labels = {}
    for i in range(60):
        x = 128 + 50 * i / 59
        mobs = []
        for j, (spr, t0) in enumerate(zip(mob_spr, appear)):
            rise = min(1.0, max(0.0, (i - t0) / 6))
            if j == 0:
                mobs.append((spr, 270, 1560, rise))
            elif j == 1:  # мышь падает с неба
                if i >= t0:
                    by = 600 + 300 * min(1.0, (i - t0) / 6) + 30 * math.sin(i / 3)
                    mobs.append((spr, 560, by, 1.0))
            else:
                mobs.append((spr, 830, 1500, rise))
        f = graveyard_window(at, x, mobs).convert("RGBA")
        shade_top(f)
        put_caption(f, c_loc, 150, i)
        shown = [m for m, t0 in zip(T["mobs"], appear) if i >= t0]
        if shown:
            key = " · ".join(shown) if a.lang == "en" else "\n".join(shown)
            if key not in labels:
                lines = shown
                labels[key] = (caption_image(pf, lines, [fit_size(pf, l, 58) for l in lines], [WHITE] * len(lines)), i)
            img, born = labels[key]
            put_caption(f, img, 1590, i - born)
        frames.append(f)

    # ---------------- 2–3.4 с: босс — иллюстрация с ударом
    c_boss = title(T["new_boss"], T["boss"], TEAL, 96)
    events += [[2.0, "thunder"], [2.0, "boom"]]
    shakes.append((len(frames), 10))
    for i in range(42):
        f = Image.new("RGBA", (W, H), (6, 10, 14, 255))
        f.alpha_composite(rays(TEAL, i / FPS, 40 if i > 3 else 90))
        spr = at["wraith_enraged_0" if (i // 8) % 2 else "wraith_idle_0"]
        paste_scaled(f, spr, W / 2, 760, 15 * ease_pop(i, 7, 0.5))
        put_caption(f, c_boss, 130, i)
        if i < 4:  # молния
            f = Image.blend(f, Image.new("RGBA", (W, H), (220, 255, 250, 255)), 0.7 * (1 - i / 4))
        frames.append(f)

    # ---------------- 3.4–4.6 с: настоящий бой — Король-Призрак возрождается
    c_rev = caption_image(pf, T["revive"], [fit_size(pf, T["revive"][0], 64), fit_size(pf, T["revive"][1], 84)], [WHITE, TEAL])
    start = len(frames)
    events += [[(start + 3) / FPS, "hit"], [(start + 4) / FPS, "souls"]]
    shakes.append((start + 3, 6))
    for i in range(36):
        f = Image.new("RGBA", (W, H), (6, 10, 14, 255))
        band = engine_crop(a.engine, "gy_wraith", 31 + i, box=(110, 95, 490, 330), size=(W, 668))
        f.paste(band, (0, 420))
        put_caption(f, c_boss, 130, 99)
        put_caption(f, c_rev, 1220, i)
        frames.append(f)

    # ---------------- 4.6–8.2 с: новое снаряжение, по 0.9 с
    gear = [
        ("hero_giant_base_idle_0", T["weapon"], (255, 210, 110), "gy_giant", 0, [6], "crit"),
        ("hero_radiator_base_attack_0", T["weapon"], (255, 130, 50), "gy_radiator", 24, [6], "hit"),
        ("hero_barbell_base_attack_0", T["weapon"], (200, 200, 220), "gy_barbell", 0, [6], "hit"),
        ("hero_steel_king_idle_0", T["armor"], TEAL, "gy_wraith", 2, [], "dodge"),
    ]
    for (spr_name, kind, col, shot, first, hits, snd), (name, s1, s2) in zip(gear, T["items"]):
        start = len(frames)
        events.append([start / FPS, "whoosh"])
        for h in hits:
            events.append([(start + h) / FPS, "hit"])
            shakes.append((start + h, 5))
        if snd == "dodge":
            events.append([(start + 4) / FPS, "dodge"])
        c_name = title(kind, name, col, 90)
        c_stat = caption_image(pf, [s1, s2], [fit_size(pf, s1, 54, W - 200), fit_size(pf, s2, 40, W - 200)], [col, WHITE])
        spr = at[spr_name]
        sc = min(560 / spr.height, 820 / spr.width)
        for i in range(27):
            f = Image.new("RGBA", (W, H), BG + (255,))
            f.alpha_composite(rays(col, (start + i) / FPS, 34))
            bob = 8 * math.sin(i / 4)
            paste_scaled(f, spr, W / 2, 660 + bob, sc * ease_pop(i, 6, 0.4))
            put_caption(f, c_name, 110, i)
            put_caption(f, c_stat, 990, max(0, i - 3))
            band = engine_crop(a.engine, shot, first + i, box=(130, 160, 490, 320), size=(W, 480))
            slide = int(300 * max(0.0, 1 - i / 5) ** 2)
            f.paste(band, (0, 1300 + slide))
            ImageDraw.Draw(f).rectangle([0, 1294 + slide, W, 1300 + slide], fill=col + (255,))
            if i < 3:
                f = Image.blend(f, Image.new("RGBA", (W, H), (255, 255, 255, 255)), 0.5 * (1 - i / 3))
            frames.append(f)

    # ---------------- 8.2–10 с: финал
    start = len(frames)
    events += [[start / FPS, "boom"], [start / FPS + 0.2, "fanfare"]]
    shakes.append((start, 8))
    for i in range(54):
        mobs = [(at["wraith_idle_1" if (i // 10) % 2 else "wraith_idle_0"], W / 2, 1420, 1.0)]
        f = graveyard_window(at, 128, mobs).convert("RGBA")
        f = Image.blend(f, Image.new("RGBA", (W, H), (6, 4, 10, 255)), 0.45)
        shade_top(f, 900, 230)
        d = ImageDraw.Draw(f, "RGBA")
        t, s = "ASH & IRON", 104
        x = (W - pf.width(t, s)) // 2
        pf.draw(d, (x + 9, 170 + 9), t, s, RED, stroke=6, stroke_fill=RED)
        pf.draw(d, (x, 170), t, s, (232, 206, 160), stroke=6, stroke_fill=(8, 6, 12))
        if i >= 4:
            img = caption_image(pf, T["end"], [fit_size(pf, T["end"][0], 56), fit_size(pf, T["end"][1], 72)], [WHITE, GOLD])
            put_caption(f, img, 360, i - 4)
        if i >= 12:
            d.rectangle([0, 1470, W, 1760], fill=(6, 4, 10, 215))
            for j, (line, size, c) in enumerate(zip(T["cta"], (42, 32, 36), (WHITE, (150, 200, 255), (150, 220, 150)))):
                ss = fit_size(pf, line, size)
                pf.draw(d, ((W - pf.width(line, ss)) // 2, 1510 + j * 78), line, ss, c, stroke=4, stroke_fill=(8, 6, 12))
        frames.append(f)

    total = len(frames)
    duration = total / FPS
    tmp = tempfile.mkdtemp()
    ev_path, wav = os.path.join(tmp, "events.json"), os.path.join(tmp, "music.wav")
    json.dump({"duration": duration, "events": events, "style": "promo", "drop": 2.0}, open(ev_path, "w"))
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
                dx, dy = int(rnd.uniform(-amp, amp)), int(rnd.uniform(-amp, amp))
                moved = Image.new("RGB", (W, H), BG)
                moved.paste(f.resize((W + 40, H + 40), Image.BILINEAR), (-20 + dx, -20 + dy))
                f = moved
        enc.stdin.write(f.tobytes())
    enc.stdin.close()
    enc.wait()
    print(f"Готово: {a.out} ({duration:.1f} с, {total} кадров)")


if __name__ == "__main__":
    main()
