"""Видео-инструкция «Как поставить Ash & Iron на экран "Домой"» (iPhone, Safari): текстом и с 8-битной музыкой.

Берёт запись экрана iPhone, делит её на шаги: на каждом шаге видео останавливается, место нажатия
подсвечивается (затемнение вокруг и пульсирующее кольцо), сверху — номер шага, снизу — что нажать.
Кадр держится столько, сколько нужно, чтобы прочитать подпись. Музыка — music.build_tutorial.
Вертикальное 1080×1920, 30 к/с, H.264 + AAC. Нужен ffmpeg.
Запуск:
  python howto.py --video IMG_7723.MP4 --fonts FONTS_DIR --icon ../../web/assets/icon_512.png --out howto.mp4
"""
import argparse
import math
import os
import subprocess
import tempfile
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from compose import BG, FPS, GOLD, H, RED, W, WHITE, PixelFont, caption_image, fit_size
from music import SR, build_tutorial, mix_at, t_

VX, VY, VW, VH = 217, 226, 646, 1400     # где на кадре стоит запись экрана (576×1248 -> 646×1400)
SRC_W, SRC_H = 576, 1248
DIM = (8, 5, 10)

# Шаги: заголовок, субтитры, текст озвучки, куски записи до остановки [(начало, конец, скорость)],
# кадр остановки и место нажатия (в пикселях исходной записи), куски после остановки.
STEPS = [
    dict(title=["ШАГ 1", "ОТКРОЙ ССЫЛКУ"], sub="Открой ссылку на игру: она есть в нашем Telegram-канале. Адрес: ash-a-iron.com",
         clips=[(0.0, 1.75, 1.0)], freeze=1.75, tap=(335, 462)),
    dict(title=["ШАГ 2", "ОТКРОЙ В SAFARI"], sub="Сайт открылся внутри Telegram? Нажми значок компаса внизу справа: игра откроется в Safari",
         clips=[(2.25, 4.4, 1.0)], freeze=4.45, tap=(487, 1171), after=[(4.75, 7.0, 2.5)]),
    dict(title=["ШАГ 3", "НАЖМИ «...»"], sub="В Safari внизу справа нажми на три точки «...»",
         clips=[(7.0, 7.35, 1.0)], freeze=7.4, tap=(493, 1158)),
    dict(title=["ШАГ 4", "«ПОДЕЛИТЬСЯ»"], sub="В меню выбери первый пункт: «Поделиться»",
         clips=[(7.75, 8.6, 1.0)], freeze=10.3, tap=(325, 748)),
    dict(title=["ШАГ 5", "«ПОКАЗАТЬ БОЛЬШЕ»"], sub="Нажми стрелку «Показать больше» в нижнем ряду",
         clips=[(11.0, 12.0, 1.0)], freeze=12.2, tap=(480, 1093)),
    dict(title=["ШАГ 6", "«НА ЭКРАН ДОМОЙ»"], sub="В списке выбери «Добавить на экран Домой»",
         clips=[(12.75, 13.3, 1.0)], freeze=13.4, tap=(281, 1115)),
    dict(title=["ШАГ 7", "«ДОБАВИТЬ»"], sub="Оставь включённым «Открыть как веб-приложение» и нажми «Добавить» вверху справа",
         clips=[(14.5, 15.6, 1.0)], freeze=16.3, tap=(468, 154)),
]


def read_time(text):
    """Сколько держать кадр, чтобы спокойно прочитать подпись (≈14 знаков в секунду, не меньше 2,4 с)."""
    return max(2.4, 1.0 + len(text) / 14)


def src_frames(path, t0, t1, speed):
    """Кадры записи экрана (уже в размере VW×VH)."""
    dur = (t1 - t0) / speed
    vf = f"setpts=PTS/{speed},fps={FPS},scale={VW}:{VH}:flags=lanczos" if speed != 1 else f"fps={FPS},scale={VW}:{VH}:flags=lanczos"
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{t0:.3f}", "-t", f"{t1 - t0 + 0.2:.3f}", "-i", path, "-vf", vf,
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    size = VW * VH * 3
    n = min(len(raw) // size, max(1, round(dur * FPS)))
    return [Image.frombytes("RGB", (VW, VH), raw[i * size:(i + 1) * size]) for i in range(n)]


def to_screen(x, y):
    return VX + x * VW / SRC_W, VY + y * VH / SRC_H


class Canvas:
    """Фон, рамка телефона, заголовок шага и субтитры."""

    def __init__(self, pf):
        self.pf = pf
        bg = Image.new("RGB", (W, H), DIM)
        glow = Image.new("L", (W, H), 0)
        ImageDraw.Draw(glow).ellipse([-300, 200, W + 300, H + 200], fill=60)
        glow = glow.filter(ImageFilter.GaussianBlur(160))
        self.bg = Image.composite(Image.new("RGB", (W, H), (60, 26, 22)), bg, glow).convert("RGBA")
        self.mask = Image.new("L", (VW, VH), 0)
        ImageDraw.Draw(self.mask).rounded_rectangle([0, 0, VW - 1, VH - 1], radius=48, fill=255)

    def frame(self, shot, title=None, sub=None, k=1.0):
        f = self.bg.copy()
        d = ImageDraw.Draw(f)
        d.rounded_rectangle([VX - 10, VY - 10, VX + VW + 10, VY + VH + 10], radius=56, fill=(20, 16, 22), outline=GOLD, width=5)
        f.paste(shot, (VX, VY), self.mask)
        if title:
            self.title(f, title, k)
        if sub:
            self.subtitle(f, sub)
        return f

    def title(self, f, title, k):
        num, text = title
        d = ImageDraw.Draw(f)
        pf = self.pf
        s1, s2 = 40, fit_size(pf, text, 60, W - 80)
        z = 1 + 0.25 * max(0.0, 1 - k) ** 2
        x = (W - pf.width(num, s1)) // 2
        pf.draw(d, (x, 40), num, s1, GOLD, stroke=4, stroke_fill=(8, 6, 12))
        img = Image.new("RGBA", (W, s2 + 30), (0, 0, 0, 0))
        dd = ImageDraw.Draw(img)
        x = (W - pf.width(text, s2)) // 2
        pf.draw(dd, (x + 6, 6), text, s2, RED, stroke=5, stroke_fill=RED)
        pf.draw(dd, (x, 0), text, s2, WHITE, stroke=5, stroke_fill=(8, 6, 12))
        if z > 1:
            img = img.resize((int(W * z), int(img.height * z)), Image.BILINEAR)
        f.alpha_composite(img, ((W - img.width) // 2, 104 - (img.height - s2 - 30) // 2))

    def subtitle(self, f, sub):
        pf = self.pf
        words, lines, cur = sub.split(), [], ""
        for w_ in words:
            nxt = f"{cur} {w_}".strip()
            if pf.width(nxt, 32) > W - 80 and cur:
                lines.append(cur)
                cur = w_
            else:
                cur = nxt
        lines.append(cur)
        d = ImageDraw.Draw(f, "RGBA")
        y0 = VY + VH + 34
        d.rounded_rectangle([30, y0 - 16, W - 30, y0 + len(lines[:4]) * 50 + 4], radius=18, fill=(10, 6, 12, 220), outline=(90, 64, 50, 255), width=3)
        for i, line in enumerate(lines[:4]):
            pf.draw(d, ((W - pf.width(line, 32)) // 2, y0 + i * 50), line, 32, WHITE, stroke=3, stroke_fill=(8, 6, 12))


def spotlight(f, cx, cy, t, strength):
    """Затемнение вокруг места нажатия, пульсирующие кольца и «палец»."""
    sx, sy = to_screen(cx, cy)
    shade = Image.new("L", (W, H), int(150 * strength))
    ImageDraw.Draw(shade).ellipse([sx - 120, sy - 120, sx + 120, sy + 120], fill=0)
    shade = shade.filter(ImageFilter.GaussianBlur(24))
    dark = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    dark.putalpha(shade)
    f.alpha_composite(dark)
    d = ImageDraw.Draw(f, "RGBA")
    for j in range(2):
        p = ((t * 1.3) + j * 0.5) % 1.0
        r = 34 + 70 * p
        d.ellipse([sx - r, sy - r, sx + r, sy + r], outline=(255, 214, 96, int(255 * (1 - p) * strength)), width=8)
    r = 26 * (1 - 0.15 * math.sin(t * 8))
    d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(255, 255, 255, int(150 * strength)), outline=(255, 214, 96, int(255 * strength)), width=4)


def click():
    n = int(SR * 0.05)
    return np.sin(2 * np.pi * 1400 * t_(0.05)) * np.exp(-np.linspace(0, 12, n)) * 0.5


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--fonts", required=True)
    ap.add_argument("--icon", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    pf = PixelFont(a.fonts)
    cv = Canvas(pf)
    tmp = tempfile.mkdtemp()
    vid = os.path.join(tmp, "video.mp4")
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                            "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", vid], stdin=subprocess.PIPE)
    clicks = []  # (время, звук нажатия)
    n = 0

    def put(img):
        nonlocal n
        enc.stdin.write(img.convert("RGB").tobytes())
        n += 1

    # ---------------- вступление: иконка игры и заголовок
    icon = Image.open(a.icon).convert("RGBA").resize((360, 360), Image.NEAREST)
    mask = Image.new("L", icon.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 359, 359], radius=80, fill=255)
    intro = int(3.0 * FPS)
    head = caption_image(pf, ["КАК ПОСТАВИТЬ ИГРУ", "НА ЭКРАН «ДОМОЙ»"], [fit_size(pf, "КАК ПОСТАВИТЬ ИГРУ", 54), fit_size(pf, "НА ЭКРАН «ДОМОЙ»", 64)], [WHITE, GOLD])
    for i in range(intro):
        f = cv.bg.copy()
        k = min(1.0, i / 8)
        size = int(360 * (0.6 + 0.4 * k))
        ic = icon.resize((size, size), Image.NEAREST)
        f.paste(ic, ((W - size) // 2, 520 + (360 - size) // 2), mask.resize((size, size)))
        f.alpha_composite(head, (0, 1000))
        d = ImageDraw.Draw(f)
        for j, (line, size_, col) in enumerate((("iPhone · Safari", 36, (150, 200, 255)), ("ash-a-iron.com", 40, (150, 220, 150)))):
            pf.draw(d, ((W - pf.width(line, size_)) // 2, 1340 + j * 70), line, size_, col, stroke=3, stroke_fill=(8, 6, 12))
        put(f)

    # ---------------- шаги
    for si, st in enumerate(STEPS):
        age = 0
        for t0, t1, sp in st["clips"]:
            for fr in src_frames(a.video, t0, t1, sp):
                put(cv.frame(fr, st["title"], st["sub"], min(1.0, age / 6)))
                age += 1
        freeze = src_frames(a.video, st["freeze"], st["freeze"] + 0.05, 1.0)[0]
        hold = int(read_time(st["sub"]) * FPS)
        clicks.append((n / FPS + hold / FPS - 0.25, click()))
        for i in range(hold):
            f = cv.frame(freeze)
            spotlight(f, *st["tap"], i / FPS, min(1.0, i / 6))
            cv.title(f, st["title"], min(1.0, age / 6))  # подписи — поверх затемнения, чтобы читались
            cv.subtitle(f, st["sub"])
            put(f)
            age += 1
        for t0, t1, sp in st.get("after", []):
            for fr in src_frames(a.video, t0, t1, sp):
                put(cv.frame(fr, st["title"], st["sub"]))

    # ---------------- финал: главный экран с иконкой игры
    outro = int(5.0 * FPS)
    rnd = np.random.default_rng(3)
    apps = [tuple(int(c) for c in rnd.integers(40, 110, 3)) for _ in range(24)]
    for i in range(outro):
        f = cv.bg.copy()
        d = ImageDraw.Draw(f, "RGBA")
        d.rounded_rectangle([VX - 10, 300, VX + VW + 10, 1300], radius=56, fill=(30, 40, 70), outline=GOLD, width=5)
        for j, col in enumerate(apps[:20]):  # условные значки других приложений
            cx, cy = VX + 70 + (j % 4) * 170, 380 + (j // 4) * 180
            if j == 9:
                continue
            d.rounded_rectangle([cx - 55, cy - 55 + 40, cx + 55, cy + 55 + 40], radius=26, fill=col + (255,))
        cx, cy = VX + 70 + 1 * 170, 380 + 2 * 180 + 40
        k = min(1.0, i / 10)
        pop = 1 + 0.35 * max(0.0, 1 - k) ** 2
        size = int(110 * pop)
        ic = icon.resize((size, size), Image.NEAREST)
        f.paste(ic, (cx - size // 2, cy - size // 2), mask.resize((size, size)))
        p = (i / FPS * 1.2) % 1.0
        r = 70 + 60 * p
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 214, 96, int(255 * (1 - p))), width=6)
        pf.draw(d, (cx - pf.width("Ash & Iron", 16) // 2, cy + 64), "Ash & Iron", 16, WHITE, stroke=2, stroke_fill=(8, 6, 12))
        done = "ГОТОВО!"
        pf.draw(d, ((W - pf.width(done, 96)) // 2, 110), done, 96, GOLD, stroke=6, stroke_fill=(8, 6, 12))
        for j, (line, s_, col) in enumerate((("Игра открывается на весь экран,", 30, WHITE), ("как обычное приложение", 30, WHITE),
                                             ("Android: Chrome > меню > «Установить", 26, (150, 200, 255)), ("приложение»", 26, (150, 200, 255)),
                                             ("ash-a-iron.com", 44, (150, 220, 150)))):
            y = 1380 + j * 66 + (30 if j >= 2 else 0) + (40 if j == 4 else 0)
            pf.draw(d, ((W - pf.width(line, s_)) // 2, y), line, s_, col, stroke=3, stroke_fill=(8, 6, 12))
        put(f)
    enc.stdin.close()
    enc.wait()

    # ---------------- звук: голос, щелчки нажатий и тихая подложка
    dur = n / FPS
    mix = build_tutorial(dur) * 0.8
    for t, snd in clicks:
        mix_at(mix, snd, t, 0.5)
    mix = mix[: int(SR * dur)]
    mix *= 0.9 / max(1e-9, np.max(np.abs(mix)))
    wav = os.path.join(tmp, "audio.wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", vid, "-i", wav, "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
                    "-af", "loudnorm=I=-15:TP=-1.5:LRA=11", "-ac", "2", "-movflags", "+faststart", "-shortest", a.out], check=True)
    print(f"Готово: {a.out} ({dur:.1f} с)")


if __name__ == "__main__":
    main()
