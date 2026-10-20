"""Рекламный ролик Ash & Iron (вертикальный 1080×1920, 30 к/с, H.264 + AAC).

Источники: записи игры с телефона (реальный игрок + экран игры) и кадры из движка игры
(tools/trailer: engine_capture.mjs). Музыка и звуки синтезируются в music.py.

Запуск:
  python compose.py --v1 IMG_7572.MOV --v2 IMG_7595.MP4 --v3 IMG_7620.MP4 \
      --engine ENGINE_DIR --fonts FONTS_DIR --out ash_and_iron_ad.mp4 [--lang ru|en]
"""
import argparse
import json
import math
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
BG = (10, 6, 12)
GOLD = (232, 190, 92)
WHITE = (240, 232, 214)
RED = (120, 30, 26)

TEXT = {
    "ru": {
        "hook": ["А ЕСЛИ ДЛЯ ПОБЕДЫ", "ПРИДЁТСЯ ДВИГАТЬСЯ", "САМОМУ?"],
        "push": ["ОТЖИМАЕШЬСЯ —", "АТАКУЕШЬ"],
        "squat": ["ПРИСЕДАЕШЬ —", "УВОРАЧИВАЕШЬСЯ"],
        "jack": ["«ЗВЁЗДОЧКА» —", "ЗЕЛЬЕ ЗДОРОВЬЯ"],
        "level": ["КАЧАЕШЬСЯ САМ —", "КАЧАЕТСЯ ГЕРОЙ"],
        "world": ["3 ЛОКАЦИИ", "3 БОССА · КУЗНИЦА"],
        "ask": "СМОЖЕШЬ ПОБЕДИТЬ?",
        "cta": ["Играй бесплатно в браузере", "daniil19991.github.io/-Ash-Iron", "Новости: t.me/melnikovdania"],
        "you": "ТЫ",
        "hero": "ГЕРОЙ",
        "jack_label": "ЗВЁЗДОЧКА",
    },
    "en": {
        "hook": ["WHAT IF TO WIN", "YOU HAD TO", "MOVE YOURSELF?"],
        "push": ["DO A PUSH-UP —", "ATTACK"],
        "squat": ["SQUAT —", "DODGE"],
        "jack": ["JUMPING JACK —", "HEALTH POTION"],
        "level": ["YOU TRAIN —", "YOUR HERO LEVELS"],
        "world": ["3 LANDS", "3 BOSSES · FORGE"],
        "ask": "CAN YOU WIN?",
        "cta": ["Play free in your browser", "daniil19991.github.io/-Ash-Iron", "News: t.me/melnikovdania"],
        "you": "YOU",
        "hero": "HERO",
        "jack_label": "JUMPING JACK",
    },
}


# ------------------------------------------------------------------ шрифт игры (Press Start 2P)
class PixelFont:
    """Кириллица и латиница лежат в разных файлах — символы берутся из того, где они есть."""

    def __init__(self, fonts_dir):
        self.dir = fonts_dir
        self.cache = {}
        from fontTools.ttLib import TTFont
        self.cyr_cmap = set(TTFont(os.path.join(fonts_dir, "ps2p-cyrillic.ttf")).getBestCmap())

    def font(self, size, cyr):
        key = (size, cyr)
        if key not in self.cache:
            name = "ps2p-cyrillic.ttf" if cyr else "ps2p-latin.ttf"
            self.cache[key] = ImageFont.truetype(os.path.join(self.dir, name), size)
        return self.cache[key]

    def draw(self, draw, xy, text, size, fill, stroke=0, stroke_fill=(0, 0, 0)):
        x, y = xy
        for ch in text:
            f = self.font(size, ord(ch) in self.cyr_cmap)
            draw.text((x, y), ch, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
            x += size  # моноширинный
        return x

    def width(self, text, size):
        return len(text) * size


def caption_image(pf, lines, sizes, colors):
    """Надпись в стиле игры: обводка, тёмно-красная тень, полупрозрачная плашка."""
    pad, gap = 34, 22
    widths = [pf.width(t, s) for t, s in zip(lines, sizes)]
    cw = max(widths) + pad * 2
    ch = sum(sizes) + gap * (len(lines) - 1) + pad * 2
    img = Image.new("RGBA", (W, ch + 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x0 = (W - cw) // 2
    d.rounded_rectangle([x0, 0, x0 + cw, ch], radius=18, fill=(10, 6, 12, 170), outline=(90, 64, 50, 220), width=4)
    y = pad
    for t, s, col, tw in zip(lines, sizes, colors, widths):
        x = (W - tw) // 2
        st = max(3, s // 12)
        pf.draw(d, (x + st + 2, y + st + 2), t, s, RED + (255,), stroke=st, stroke_fill=RED + (255,))
        pf.draw(d, (x, y), t, s, col + (255,), stroke=st, stroke_fill=(8, 6, 12, 255))
        y += s + gap
    return img


def fit_size(pf, text, want, max_w=W - 120):
    s = want
    while pf.width(text, s) > max_w and s > 20:
        s -= 2
    return s


# ------------------------------------------------------------------ источники кадров
def video_frames(path, start, dur, vf):
    """Кадры отрезка видео как массивы RGB 1080×1920 (ffmpeg режет и масштабирует)."""
    n = int(round(dur * FPS))
    if "[0:v]" in vf:  # сложная схема: несколько окон исходника в одном кадре
        filt = ["-filter_complex", f"{vf},fps={FPS}[out]", "-map", "[out]"]
    else:
        filt = ["-vf", f"{vf},fps={FPS}"]
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-i", path, "-t", f"{dur + 0.5:.3f}",
           *filt, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    size = W * H * 3
    frames = []
    last = None
    for _ in range(n):
        buf = p.stdout.read(size)
        if len(buf) < size:
            break
        last = Image.frombuffer("RGB", (W, H), buf, "raw", "RGB", 0, 1).copy()
        frames.append(last)
    p.stdout.close()
    p.wait()
    while len(frames) < n:  # если отрезок короче — держим последний кадр
        frames.append(last)
    return frames


def band_frames(path, start, dur, crop, y_center=824):
    """Полоса с игрой (часть экрана телефона) по центру на тёмном фоне."""
    cw, chh, cx, cy = crop
    scale_h = int(round(chh * W / cw / 2)) * 2
    vf = f"crop={cw}:{chh}:{cx}:{cy},scale={W}:{scale_h}:flags=lanczos,pad={W}:{H}:0:{y_center - scale_h // 2}:color=0x0a060c"
    return video_frames(path, start, dur, vf)


ENGINE_BAND_H = 853  # окно 456×360 экрана игры, растянутое на ширину кадра


def engine_band(engine_dir, shot, first, n, y_top, x0=100):
    """Кадры движка (640×360): окно 456×360 вокруг героя и врага → 1080×853 без сглаживания."""
    out = []
    for i in range(first, first + n):
        ui = Image.open(os.path.join(engine_dir, shot, f"ui_{i:04d}.png")).convert("RGB")
        big = ui.crop((x0, 0, x0 + 456, 360)).resize((W, ENGINE_BAND_H), Image.NEAREST)
        frame = Image.new("RGB", (W, H), BG)
        frame.paste(big, (0, y_top))
        out.append(frame)
    return out


# ------------------------------------------------------------------ иллюстрация движения («звёздочка»)
def jack_figure(open_k):
    """Пиксельная пиктограмма человека: open_k 0 — руки внизу, 1 — «звёздочка»."""
    g = Image.new("RGBA", (40, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    col, dark = GOLD + (255,), (60, 40, 20, 255)
    cx = 20
    d.ellipse([cx - 4, 2, cx + 4, 10], fill=col)                 # голова
    d.rectangle([cx - 2, 11, cx + 2, 27], fill=col)              # корпус
    a = -1.25 + 2.35 * open_k                                    # угол рук (от вниз до вверх)
    for side in (-1, 1):
        sx, sy = cx + side * 2, 13
        ex = sx + side * math.cos(a) * 13
        ey = sy - math.sin(a) * 13
        d.line([sx, sy, ex, ey], fill=col, width=3)
        lx = cx + side * (1 + 9 * open_k)
        d.line([cx + side * 1, 27, lx, 45], fill=col, width=3)   # ноги
        d.rectangle([lx - 2, 44, lx + 2, 46], fill=dark)
    return g


def jack_panel(open_k, label, pf):
    panel = Image.new("RGBA", (W - 120, 470), (20, 12, 22, 235))
    d = ImageDraw.Draw(panel)
    d.rectangle([0, 0, panel.width - 1, panel.height - 1], outline=GOLD + (255,), width=4)
    fig = jack_figure(open_k).resize((40 * 8, 48 * 8), Image.NEAREST)
    panel.alpha_composite(fig, ((panel.width - fig.width) // 2, 20))
    s = fit_size(pf, label, 40, panel.width - 40)
    pf.draw(d, ((panel.width - pf.width(label, s)) // 2, panel.height - 70), label, s, GOLD + (255,), stroke=3)
    return panel


# ------------------------------------------------------------------ финальный экран
def end_card(engine_dir, i, k, pf, T):
    frame = Image.new("RGB", (W, H), BG)
    world = Image.open(os.path.join(engine_dir, "title", f"w_{i % 120:04d}.png")).convert("RGB")
    crop = world.crop((122, 24, 302, 174))                     # рыцарь у костра, скелет, луна
    zoom = 1.0 + 0.04 * k                                      # медленный наезд
    big = crop.resize((int(900 * zoom), int(750 * zoom)), Image.NEAREST)
    frame.paste(big, ((W - big.width) // 2, 330 - (big.height - 750) // 2))
    d = ImageDraw.Draw(frame, "RGBA")
    d.rectangle([90 - 4, 330 - 4, 990 + 4, 1080 + 4], outline=GOLD + (255,), width=6)
    title = "ASH & IRON"
    s = 96
    x = (W - pf.width(title, s)) // 2
    pf.draw(d, (x + 9, 150 + 9), title, s, RED, stroke=6, stroke_fill=RED)
    pf.draw(d, (x, 150), title, s, (232, 206, 160), stroke=6, stroke_fill=(8, 6, 12))
    if k > 0.12:
        ask = T["ask"]
        sa = fit_size(pf, ask, 56)
        pf.draw(d, ((W - pf.width(ask, sa)) // 2, 1150), ask, sa, GOLD, stroke=5, stroke_fill=(8, 6, 12))
    if k > 0.3:
        for j, (line, size, col) in enumerate(zip(T["cta"], (34, 26, 30), (WHITE, (150, 200, 255), (150, 220, 150)))):
            ss = fit_size(pf, line, size)
            pf.draw(d, ((W - pf.width(line, ss)) // 2, 1290 + j * 62), line, ss, col, stroke=3, stroke_fill=(8, 6, 12))
    return frame


# ------------------------------------------------------------------ сборка
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--v1", required=True)
    ap.add_argument("--v2", required=True)
    ap.add_argument("--v3", required=True)
    ap.add_argument("--engine", required=True)
    ap.add_argument("--fonts", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--lang", default="ru")
    a = ap.parse_args()
    T = TEXT[a.lang]
    pf = PixelFont(a.fonts)

    # игра крупно сверху (окно вокруг героя и врага), игрок снизу
    V1 = ("[0:v]split[a][b];[a]crop=456:315:100:58,scale=1080:746:flags=lanczos[g];"
          "[b]crop=656:713:0:450,scale=1080:1174:flags=lanczos[c];[g][c]vstack")
    V2 = "crop=576:1024:0:250,scale=1080:1920:flags=lanczos"    # ритуал у костра
    V3 = "crop=576:1024:0:{y},scale=1080:1920:flags=lanczos"     # запись экрана

    # (кадры, подпись, позиция подписи y, события звука в секундах от начала отрезка, удары-«пинки»)
    segs = []

    def seg(frames, cap=None, cap_y=640, sfx=(), punch=(), flash_in=True):
        segs.append(dict(frames=frames, cap=cap, cap_y=cap_y, sfx=list(sfx), punch=list(punch), flash=flash_in))

    def cap(lines, big_last=True, sizes=None):
        if sizes is None:
            sizes = [fit_size(pf, t, 58) for t in lines]
            if big_last and len(lines) > 1:
                sizes[-1] = fit_size(pf, lines[-1], 80)
        colors = [WHITE] * len(lines)
        if big_last and len(lines) > 1:
            colors[-1] = GOLD
        return caption_image(pf, lines, sizes, colors)

    # 0–2 с: хук — отжимание, и молния бьёт скелета
    seg(video_frames(a.v1, 1.55, 2.0, V1), cap(T["hook"], big_last=False), 610, [(1.45, "thunder")], [1.45], flash_in=False)
    # 2–6 с: отжимаешься — атакуешь (два настоящих удара)
    c_push = cap(T["push"])
    seg(video_frames(a.v1, 6.2, 2.0, V1), c_push, 610, [(1.3, "thunder")], [1.3])
    seg(video_frames(a.v1, 8.3, 2.0, V1), c_push, 610, [(1.45, "hit")], [1.45], flash_in=False)
    # 6–10 с: приседаешь — уворачиваешься (два замаха врага и два уворота)
    c_sq = cap(T["squat"])
    seg(video_frames(a.v1, 10.0, 2.5, V1), c_sq, 610, [(0.25, "alert"), (2.0, "dodge")])
    seg(video_frames(a.v1, 4.5, 1.5, V1), c_sq, 610, [(0.25, "alert"), (1.0, "dodge")], flash_in=False)
    # 10–14 с: «звёздочка» — зелье (кадры движка + пиктограмма движения)
    heal = engine_band(a.engine, "heal", 0, 120, 330, x0=0)
    c_j = cap(T["jack"])
    for i, fr in enumerate(heal):
        k = 1.0 if (22 <= i < 36 or 76 <= i < 90) else 0.0  # «звёздочка» в моменты зелья
        panel = jack_panel(k, T["jack_label"], pf)
        f = fr.convert("RGBA")
        f.alpha_composite(panel, (60, 1200))
        heal[i] = f.convert("RGB")
    seg(heal, c_j, 80, [(1.0, "heal"), (2.8, "heal")])
    # 14–19 с: нарезка
    c_lv = cap(T["level"])
    seg(video_frames(a.v2, 15.3, 2.0, V2), c_lv, 560, [(1.7, "level")])
    c_w = cap(T["world"])
    seg(engine_band(a.engine, "wraith", 3, 15, 560), c_w, 250, [(0.0, "whoosh"), (0.05, "souls")])
    seg(engine_band(a.engine, "bat", 4, 15, 560), c_w, 250, [(0.0, "whoosh"), (0.1, "dodge")])
    seg(video_frames(a.v3, 21.2, 0.5, V3.format(y=120)), c_w, 250, [(0.0, "whoosh")])
    seg(video_frames(a.v3, 33.0, 0.5, V3.format(y=60)), c_w, 250, [(0.0, "whoosh")])
    seg(engine_band(a.engine, "chief", 4, 15, 560), c_w, 250, [(0.0, "whoosh")])
    seg(band_frames(a.v3, 18.0, 0.5, (576, 290, 0, 55)), c_w, 250, [(0.0, "whoosh")])
    # 19–21.5 с: самый сильный кадр — добивание молнией и «ВРАГ ПОВЕРЖЕН»
    seg(video_frames(a.v1, 14.3, 2.5, V1), None, 610, [(0.45, "thunder"), (0.75, "fanfare")], [0.45])
    # 21.5–25 с: логотип и призыв
    end = [end_card(a.engine, i, i / 105, pf, T) for i in range(105)]
    seg(end, None, 0, [(0.0, "boom")])

    total = sum(len(s["frames"]) for s in segs)
    duration = total / FPS
    events, t0 = [], 0.0
    for s in segs:
        events += [[round(t0 + t, 3), k] for t, k in s["sfx"]]
        s["t0"] = t0
        t0 += len(s["frames"]) / FPS

    tmp = tempfile.mkdtemp()
    ev_path, wav = os.path.join(tmp, "events.json"), os.path.join(tmp, "music.wav")
    json.dump({"duration": duration, "events": events}, open(ev_path, "w"))
    subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "music.py"), wav, ev_path], check=True)

    enc = subprocess.Popen([
        "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", wav, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-profile:v", "high",
        "-c:a", "aac", "-b:a", "192k", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-movflags", "+faststart",
        "-shortest", a.out], stdin=subprocess.PIPE)

    prev_cap = None
    cap_age = 0
    for s in segs:
        punches = [int(p * FPS) for p in s["punch"]]
        for i, fr in enumerate(s["frames"]):
            frame = fr
            # «пинок» камеры на ударе: короткий наезд
            for p in punches:
                d = i - p
                if 0 <= d < 7:
                    z = 1 + 0.07 * (1 - d / 7)
                    big = frame.resize((int(W * z), int(H * z)), Image.BILINEAR)
                    frame = big.crop(((big.width - W) // 2, (big.height - H) // 2, (big.width - W) // 2 + W, (big.height - H) // 2 + H))
            f = frame.convert("RGBA")
            # подпись: появление с увеличением; та же подпись на следующем отрезке не мигает
            if s["cap"] is not None:
                if s["cap"] is not prev_cap:
                    prev_cap, cap_age = s["cap"], 0
                k = min(1.0, cap_age / 6)
                img = s["cap"]
                if k < 1:
                    z = 1 + 0.25 * (1 - k) ** 2
                    img = img.resize((int(img.width * z), int(img.height * z)), Image.BILINEAR)
                    alpha = img.getchannel("A").point(lambda v: int(v * (0.3 + 0.7 * k)))
                    img.putalpha(alpha)
                f.alpha_composite(img, ((W - img.width) // 2, s["cap_y"] - (img.height - s["cap"].height) // 2))
                cap_age += 1
            else:
                prev_cap = None
            # вспышка на смене кадра и на ударах
            flash = 0.0
            if s["flash"] and i < 3:
                flash = 0.45 * (1 - i / 3)
            for p in punches:
                if 0 <= i - p < 4:
                    flash = max(flash, 0.6 * (1 - (i - p) / 4))
            if flash > 0:
                f = Image.blend(f, Image.new("RGBA", (W, H), (255, 255, 255, 255)), flash)
            enc.stdin.write(f.convert("RGB").tobytes())
    enc.stdin.close()
    enc.wait()
    print(f"Готово: {a.out} ({duration:.1f} с, {total} кадров)")


if __name__ == "__main__":
    main()
