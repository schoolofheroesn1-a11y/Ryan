"""Ролик «большое обновление» на 15 секунд (вертикальный 1080×1920, 30 к/с): свой сайт и сервер,
мультиплеер (аккаунты, рейтинг, «Бросить вызов», дуэли) и доспех самурая.
Кадры — настоящий движок игры (шоты из promo_capture.mjs: mp_*, duel, challenge, samurai_*),
иллюстрации — спрайты из web/assets/atlas.png. Музыка — music.py в стиле "promo".

Запуск:
  python promo_mp.py --engine ENGINE_DIR --fonts FONTS_DIR --jacks IMG_7667.MOV --pushups IMG_7595.MP4 \
      --squat IMG_7572.MOV --out update_mp.mp4 [--lang ru|en]
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

from compose import BG, FPS, GOLD, H, RED, W, WHITE, PixelFont, caption_image, fit_size, video_frames

# игра сверху, игрок снизу (запись IMG_7572: экран игры + камера)
V1 = ("[0:v]split[a][b];[a]crop=456:315:100:58,scale=1080:746:flags=lanczos[g];"
      "[b]crop=656:713:0:450,scale=1080:1174:flags=lanczos[c];[g][c]vstack")
from promo import Atlas, ease_pop, engine_crop, paste_scaled, put_caption, rays

TEAL = (110, 240, 210)
CRIMSON = (236, 70, 64)
SAKURA = [(255, 183, 197), (255, 140, 170), (255, 222, 232), (236, 96, 130)]
SITE = "ASH-A-IRON.COM"

TEXT = {
    "ru": {
        "big": "БОЛЬШОЕ", "update": "ОБНОВЛЕНИЕ",
        "body": ["ТВОЁ ТЕЛО —", "КОНТРОЛЛЕР"], "squat": ["ПРИСЕЛ —", "УВЕРНУЛСЯ"], "push": ["ОТЖАЛСЯ —", "ВЫПАД"],
        "server": ["СВОЙ СЕРВЕР", SITE], "server_sub": ["АККАУНТЫ · ОБЩИЙ РЕЙТИНГ"],
        "challenge": ["БРОСЬ ВЫЗОВ", "ИГРОКАМ И БОТАМ"], "challenge_sub": ["10 ВЫЗОВОВ В ДЕНЬ"],
        "duel": ["ДУЭЛИ", "В РЕАЛЬНОМ ВРЕМЕНИ"], "duel_sub": ["ДРУГ ПРОТИВ ДРУГА"],
        "skin": ["НОВЫЙ ОБЛИК", "ДОСПЕХ САМУРАЯ"], "skin_sub": ["РОГА · ЗНАМЯ · ВИХРЬ САКУРЫ"],
        "end": ["ИГРАЙ БЕСПЛАТНО", "В БРАУЗЕРЕ"], "tg": "t.me/ashe_and_iron",
    },
    "en": {
        "big": "BIG", "update": "UPDATE",
        "body": ["YOUR BODY IS", "THE CONTROLLER"], "squat": ["SQUAT —", "DODGE"], "push": ["PUSH-UP —", "LUNGE"],
        "server": ["OUR OWN SERVER", SITE], "server_sub": ["ACCOUNTS · GLOBAL RANKING"],
        "challenge": ["CHALLENGE", "PLAYERS AND BOTS"], "challenge_sub": ["10 CHALLENGES A DAY"],
        "duel": ["DUELS", "IN REAL TIME"], "duel_sub": ["FRIEND VS FRIEND"],
        "skin": ["NEW LOOK", "SAMURAI ARMOR"], "skin_sub": ["HORNS · BANNER · SAKURA STORM"],
        "end": ["PLAY FREE", "IN YOUR BROWSER"], "tg": "t.me/ashe_and_iron",
    },
}


def portrait_frame(engine, shot, i, rows=900, y=420):
    """Вертикальный экран игры (640×H): верхние rows строк во всю ширину кадра."""
    ui = Image.open(os.path.join(engine, shot, f"ui_{i:04d}.png")).convert("RGB")
    crop = ui.crop((0, 0, 640, rows)).resize((W, int(rows * W / 640)), Image.NEAREST)
    f = Image.new("RGBA", (W, H), BG + (255,))
    f.paste(crop, (0, y))
    return f


class Petals:
    """Лепестки сакуры поверх иллюстрации (пиксели ×6, как в игре)."""

    def __init__(self, rnd):
        self.rnd = rnd
        self.p = []

    def step(self, burst=0):
        r = self.rnd
        for _ in range(3):
            self.p.append([r.uniform(-100, W), r.uniform(-200, 200), r.uniform(4, 12), r.uniform(6, 14), r.uniform(0, 6), r.choice(SAKURA)])
        for _ in range(burst):
            a, v = r.uniform(0, 2 * math.pi), r.uniform(20, 60)
            self.p.append([W / 2, 780, math.cos(a) * v, math.sin(a) * v, r.uniform(0, 6), r.choice(SAKURA)])
        for q in self.p:
            q[0] += q[2] + math.sin(q[4]) * 4
            q[1] += q[3]
            q[4] += 0.2
            q[2] *= 0.96
            q[3] = min(q[3] + 0.6, 14)
        self.p = [q for q in self.p if q[1] < H + 20]

    def draw(self, f):
        d = ImageDraw.Draw(f)
        for x, y, _, _, ph, col in self.p:
            w, h = (12, 6) if math.sin(ph * 2) > 0 else (6, 12)
            d.rectangle([x, y, x + w, y + h], fill=col + (255,))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", required=True)
    ap.add_argument("--fonts", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--lang", default="ru")
    ap.add_argument("--jacks", required=True, help="запись «звёздочки» с захватом движения (IMG_7667)")
    ap.add_argument("--pushups", required=True, help="отжимания у костра (IMG_7595)")
    ap.add_argument("--squat", required=True, help="бой с камерой: присед (IMG_7572)")
    a = ap.parse_args()
    T = TEXT[a.lang]
    pf = PixelFont(a.fonts)
    at = Atlas()
    rnd = random.Random(11)
    frames, events, shakes = [], [], []

    def cap(lines, cols, sizes):
        return caption_image(pf, lines, [fit_size(pf, l, s) for l, s in zip(lines, sizes)], cols)

    def two(lines, col):
        return cap(lines, [WHITE, col], [64, 84])

    def sub(lines, col=WHITE):
        return cap(lines, [col] * len(lines), [44] * len(lines))

    def flash(f, i, col=(255, 255, 255), k=0.5, n=3):
        return Image.blend(f, Image.new("RGBA", (W, H), col + (255,)), k * (1 - i / n)) if i < n else f

    def mocap(path, t0, dur, vf, caption, cap_y, sound=None, at_s=0.0):
        """Вставка с захватом движения: настоящий игрок и скелет позы поверх камеры."""
        start = len(frames)
        events.append([start / FPS, "whoosh"])
        if sound:
            events.append([start / FPS + at_s, sound])
        for i, fr in enumerate(video_frames(path, t0, dur, vf)):
            f = fr.convert("RGBA")
            put_caption(f, caption, cap_y, i)
            frames.append(flash(f, i))

    # ---------------- 0–1,3 с: «БОЛЬШОЕ ОБНОВЛЕНИЕ»
    events += [[0.0, "boom"], [0.0, "thunder"], [0.65, "whoosh"]]
    shakes.append((0, 10))
    hero = at["hero_giant_samurai_idle_0"]
    for i in range(39):
        f = Image.new("RGBA", (W, H), (12, 6, 10, 255))
        f.alpha_composite(rays(GOLD, i / FPS, 46))
        paste_scaled(f, hero, W / 2, 1180, 16 * ease_pop(i, 8, 0.6))
        d = ImageDraw.Draw(f)
        for word, y, size, col, t0 in ((T["big"], 210, 80, WHITE, 0), (T["update"], 330, 112, GOLD, 6)):
            if i < t0:
                continue
            s = fit_size(pf, word, size)
            z = ease_pop(i - t0, 6, 0.5)
            img = Image.new("RGBA", (W, s + 40), (0, 0, 0, 0))
            dd = ImageDraw.Draw(img)
            x = (W - pf.width(word, s)) // 2
            pf.draw(dd, (x + 8, 8), word, s, RED, stroke=6, stroke_fill=RED)
            pf.draw(dd, (x, 0), word, s, col, stroke=6, stroke_fill=(8, 6, 12))
            img = img.resize((int(W * z), int(img.height * z)), Image.BILINEAR)
            f.alpha_composite(img, ((W - img.width) // 2, y - (img.height - s) // 2))
        frames.append(flash(f, i, (255, 240, 200), 0.7, 4))

    # ---------------- 1,3–2,8 с: захват движения — «звёздочка» (настоящий игрок)
    mocap(a.jacks, 2.0, 1.5, "crop=576:1024:0:190,scale=1080:1920:flags=lanczos", two(T["body"], GOLD), 1500, "heal", 0.9)

    # ---------------- 2,8–3,8 с: свой сервер — рейтинг коротко
    c1 = two(T["server"], GOLD)
    start = len(frames)
    events += [[start / FPS, "boom"], [start / FPS + 0.1, "level"]]
    shakes.append((start, 6))
    for i in range(30):
        f = portrait_frame(a.engine, "mp_rating", min(i, 23), rows=760, y=520)
        put_caption(f, c1, 90, i)
        put_caption(f, sub(T["server_sub"], (150, 220, 150)), 1620, max(0, i - 4))
        frames.append(flash(f, i))

    # ---------------- 3,8–5,6 с: «Бросить вызов»: список на миг, затем победа
    c2 = two(T["challenge"], (255, 140, 100))
    start = len(frames)
    events += [[start / FPS, "whoosh"]]
    for i in range(15):
        f = portrait_frame(a.engine, "mp_challenge", min(i + 8, 23), rows=760, y=520)
        put_caption(f, c2, 90, i)
        frames.append(flash(f, i))
    start = len(frames)
    for k, e in ((0, "hit"), (14, "hit"), (26, "hit"), (28, "fanfare")):
        events.append([(start + k) / FPS, e])
    shakes += [(start, 5), (start + 14, 5), (start + 26, 8)]
    for i in range(42):
        f = Image.new("RGBA", (W, H), BG + (255,))
        f.paste(engine_crop(a.engine, "challenge", 8 + i, box=(60, 40, 580, 330), size=(W, 602)), (0, 660))
        put_caption(f, c2, 90, 99)
        put_caption(f, sub(T["challenge_sub"], GOLD), 1380, 99)
        frames.append(f)

    # ---------------- 5,6–9,3 с: дуэли — комната, замах, уворот игрока, выпад
    c3 = two(T["duel"], TEAL)
    start = len(frames)
    events += [[start / FPS, "boom"]]
    shakes.append((start, 8))
    for i in range(15):
        f = portrait_frame(a.engine, "mp_room", min(i, 23), rows=700, y=560)
        put_caption(f, c3, 90, i)
        frames.append(flash(f, i, (200, 255, 250), 0.6, 4))

    def duel_part(first, n, sounds=()):
        start = len(frames)
        for k, e in sounds:
            events.append([(start + k) / FPS, e])
        for i in range(n):
            f = Image.new("RGBA", (W, H), BG + (255,))
            f.paste(engine_crop(a.engine, "duel", first + i, box=(60, 40, 580, 330), size=(W, 602)), (0, 660))
            put_caption(f, c3, 90, 99)
            put_caption(f, sub(T["duel_sub"]), 1380, 99)
            frames.append(f)

    duel_part(8, 22, [(0, "alert")])                       # соперник замахнулся: «ПРИСЕДАЙ!»
    mocap(a.squat, 11.4, 0.9, V1, two(T["squat"], (140, 200, 255)), 770, "dodge", 0.8)  # игрок в присяде -> «УВОРОТ!»
    duel_part(30, 14, [(0, "dodge")])                      # «УВОРОТ!»
    mocap(a.pushups, 15.3, 0.8, "crop=576:1024:0:250,scale=1080:1920:flags=lanczos", two(T["push"], GOLD), 1500)
    duel_part(84, 20, [(7, "hit")])                        # выпад попал
    shakes.append((len(frames) - 13, 6))

    # ---------------- 9,3–12,6 с: доспех самурая
    c4, c4s = two(T["skin"], CRIMSON), sub(T["skin_sub"], (255, 183, 197))
    start = len(frames)
    events += [[start / FPS, "thunder"], [start / FPS, "boom"], [start / FPS + 0.3, "souls"]]
    shakes.append((start, 10))
    petals = Petals(rnd)
    for i in range(39):
        petals.step(burst=40 if i == 0 else 0)
        f = Image.new("RGBA", (W, H), (16, 6, 10, 255))
        f.alpha_composite(rays(CRIMSON, i / FPS, 44 if i > 3 else 90))
        spr = at["hero_steel_samurai_attack_0" if (i // 10) % 2 else "hero_steel_samurai_idle_0"]
        paste_scaled(f, spr, W / 2, 860, 18 * ease_pop(i, 7, 0.5))
        petals.draw(f)
        put_caption(f, c4, 90, i)
        put_caption(f, c4s, 1500, max(0, i - 6))
        frames.append(flash(f, i, (255, 220, 230), 0.7, 4))
    start = len(frames)
    for k in (12, 36):
        events.append([(start + k - 6) / FPS, "hit"])
        shakes.append((start + k - 6, 5))
    for i in range(48):
        f = Image.new("RGBA", (W, H), BG + (255,))
        f.paste(engine_crop(a.engine, "samurai_fight", 6 + i, box=(100, 90, 460, 300), size=(W, 630)), (0, 640))
        put_caption(f, c4, 90, 99)
        put_caption(f, c4s, 1400, 99)
        frames.append(f)

    # ---------------- 12,5–15 с: финал
    start = len(frames)
    events += [[start / FPS, "boom"], [start / FPS + 0.2, "fanfare"]]
    shakes.append((start, 8))
    c_end = cap(T["end"], [WHITE, GOLD], [54, 64])
    for i in range(450 - len(frames)):
        f = Image.new("RGBA", (W, H), (10, 6, 12, 255))
        f.paste(engine_crop(a.engine, "samurai_title", i % 60, box=(290, 196, 560, 322), size=(W, 504)), (0, 640))
        d = ImageDraw.Draw(f, "RGBA")
        t, s = "ASH & IRON", 104
        x = (W - pf.width(t, s)) // 2
        pf.draw(d, (x + 9, 170 + 9), t, s, RED, stroke=6, stroke_fill=RED)
        pf.draw(d, (x, 170), t, s, (232, 206, 160), stroke=6, stroke_fill=(8, 6, 12))
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
            d.rectangle([0, 1200, W, 1460], fill=(6, 4, 10, 220))
            f.alpha_composite(img, ((W - img.width) // 2, 1260 - (img.height - ss) // 2))
        if i >= 16:
            ts = fit_size(pf, T["tg"], 40)
            pf.draw(ImageDraw.Draw(f), ((W - pf.width(T["tg"], ts)) // 2, 1400), T["tg"], ts, (150, 220, 150), stroke=3, stroke_fill=(8, 6, 12))
        frames.append(f)

    total = len(frames)
    duration = total / FPS
    tmp = tempfile.mkdtemp()
    ev_path, wav = os.path.join(tmp, "events.json"), os.path.join(tmp, "music.wav")
    json.dump({"duration": duration, "events": events, "style": "epic", "drop": 1.3}, open(ev_path, "w"))
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
