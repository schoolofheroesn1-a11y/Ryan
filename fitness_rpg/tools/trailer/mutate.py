"""TikTok-ролик «Каждое отжимание меняет игру» (вертикальный 1080×1920, 30 к/с, ~36 с).

Игра в окне браузера «мутирует» под бит: с каждым ударом (отжиманием) мир превращается в новый —
1-бит → глаза героя и удар кулаком → Game Boy → четыре земли → синтвейв → реальность (видео отжиманий)
→ Хеллоуин и рисунки → туннель стикеров → хаос «Windows 95» и синий экран → психоделический босс
→ глаза и кулак → логотип. Всё рисуется из атласа игры в пикселях 200×150 (окно ×5), реальные кадры —
из видео игроков, глаза и кулак — вставки из видео-референса. Звук — отрезок трека (121 уд/мин), сцены режутся по долям:
кулак — на дроп, синий экран — в провал, босс — на повторный дроп. Кадр «качается» на каждую долю, трясётся на ударах,
на склейках — RGB-расслоение и глитч.

Запуск:
  python mutate.py --fonts FONTS_DIR --clips CLIP:старт:x:y:w:h ... --drawings QUEEN.png FLUFF.png \
      --ref REF.mp4 --track TRACK.mp3 --out mutate.mp4
"""
import argparse
import math
import random
import subprocess
import tempfile
import wave
import zlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps


from compose import H, W, PixelFont, caption_image, fit_size
from promo import Atlas

FPS = 30
BPM = 121.0  # темп трека (Angelov — Katalam)
BEAT = FPS * 60 / BPM  # кадров на долю (≈14.88)
TRACK_START = 186.731  # с этой секунды трека: 8 долей затишья, на 9-й — главный дроп (3:10.7), повторный — через 64 доли
CW, CH = 200, 150  # пиксельный холст игры (окно 1000×750)
SCALE = 5
WIN_X, WIN_Y = 40, 560
SR = 44100
GROUND = 120  # земля на холсте
rnd = random.Random(7)

# Сцены: (имя, долей). Счёт «ТЫ n : 0 ТЬМА» растёт на каждой новой земле, счётчик отжиманий — на каждом ударе.
# кулак — ровно на дроп, синий экран — в провал трека, босс — на повторный дроп (через 64 доли)
SCENES = [("onebit", 4), ("eyes", 4), ("fist", 1), ("gameboy", 7), ("lands", 8), ("synth", 10), ("real", 10),
          ("spire", 9), ("tunnel", 4), ("win95", 11), ("bsod", 4), ("boss", 12), ("eyes2", 3), ("fist2", 1),
          ("flash", 1), ("logo", 9)]
LABEL = {"onebit": "1-БИТ", "gameboy": "GAME BOY", "lands": "4 ЗЕМЛИ", "synth": "СИНТВЕЙВ", "real": "РЕАЛЬНОСТЬ",
         "spire": "ХЕЛЛОУИН", "tunnel": "???", "win95": "WINDOWS 95", "bsod": "", "boss": "ФИНАЛЬНЫЙ БОСС"}
BATTLE = {"onebit", "gameboy", "lands", "synth", "real", "spire", "win95", "boss"}


class Frames(list):
    def append(self, f):
        super().append(zlib.compress(f.convert("RGB").tobytes(), 1))

    def image(self, k):
        return Image.frombytes("RGB", (W, H), zlib.decompress(self[k]))


# ------------------------------------------------------------------ рисование на холсте
def tint(img, col, k):
    a = img.split()[3]
    flat = Image.new("RGBA", img.size, col + (255,))
    out = Image.blend(img.convert("RGBA"), flat, k)
    out.putalpha(a)
    return out


def silhouette(img, col):
    out = Image.new("RGBA", img.size, col + (255,))
    out.putalpha(img.split()[3])
    return out


def outline(img, col, w=1):
    a = img.split()[3].filter(ImageFilter.MaxFilter(2 * w + 1))
    o = Image.new("RGBA", img.size, col + (0,))
    o.putalpha(a)
    o.alpha_composite(img)
    return o


def paste_bottom(c, spr, x, ground=GROUND, dy=0):
    c.alpha_composite(spr, (int(x), int(ground - spr.height + dy)))


def slash(c, x, y, k, col):
    d = ImageDraw.Draw(c)
    r = 16
    end = -70 + 160 * min(1, k * 2.5)
    for deg in range(-70, int(end), 6):
        a = math.radians(deg)
        px, py = x + math.cos(a) * r * 0.6, y + math.sin(a) * r
        d.rectangle([px - 1, py - 1, px + 1, py + 1], fill=col + (int(255 * (1 - k)),))


class Fight:
    """Бой на холсте: чётная доля — герой бьёт (отжимание), нечётная — враг бьёт, герой уворачивается."""

    def __init__(self, at, hero, enemy, hx=34, ex=118, escale=1.0):
        self.at, self.hero, self.enemy, self.hx, self.ex, self.escale = at, hero, enemy, hx, ex, escale

    def spr(self, name):
        img = self.at[name]
        if self.escale != 1.0 and not name.startswith("hero"):
            img = img.resize((int(img.width * self.escale), int(img.height * self.escale)), Image.NEAREST)
        return img

    def draw(self, c, k, style=None, dmg_col=(255, 240, 200)):
        b = int(k // BEAT)
        p = k - b * BEAT
        hero_turn = b % 2 == 0
        at = self.at
        e_name = f"{self.enemy}_idle_{int(k // 8) % 2}"
        ex = self.ex
        if hero_turn and 1 <= p <= 4:
            e_name = f"{self.enemy}_hurt_0"
        if not hero_turn:
            e_name = f"{self.enemy}_windup_{int(k // 3) % 2}" if p >= 8 else f"{self.enemy}_attack_0" if p < 4 else f"{self.enemy}_idle_0"
            if p < 4:
                ex -= 26 * (1 - p / 4)
        h_name = f"{self.hero}_idle_{int(k // 10) % 2}"
        hx = self.hx
        if hero_turn and p < 5:
            h_name, hx = f"{self.hero}_attack_0", self.hx + 8
        elif not hero_turn and p < 5:
            h_name = f"{self.hero}_dodge_0"
        hs, es = self.spr(h_name), self.spr(e_name)
        if style:
            hs, es = style(hs), style(es)
        paste_bottom(c, es, ex)
        paste_bottom(c, hs, hx)
        if hero_turn and p < 5:
            slash(c, hx + 36, GROUND - 18, p / 5, (255, 255, 255) if not style else (255, 255, 255))
        if hero_turn and 1 <= p <= 9:  # урон всплывает
            d = ImageDraw.Draw(c)
            y = GROUND - 50 - p * 2
            txt = str(40 + (b * 37) % 60)
            d.text((ex + 8, y), txt, fill=dmg_col + (255,))
        if not hero_turn and p < 4:
            d = ImageDraw.Draw(c)
            d.text((self.hx - 4, GROUND - 46), "DODGE", fill=(140, 200, 255, 255))


# ------------------------------------------------------------------ сцены (кадр k внутри сцены)
def make_scenes(at, pf, clips, drawings):
    bgs = {n: at[n] for n in ("arena_bg", "castle_bg", "graveyard_bg", "abyss_bg", "spire_bg", "title_bg")}

    def bg_crop(name, x0=60):
        return bgs[name].crop((x0, 20, x0 + CW, 20 + CH)).convert("RGBA")

    def canvas(col=(0, 0, 0)):
        return Image.new("RGBA", (CW, CH), col + (255,))

    def text(c, xy, s, size, col, anchor_center=True, stroke=0, sc=(0, 0, 0)):
        d = ImageDraw.Draw(c)
        x, y = xy
        if anchor_center:
            x -= pf.width(s, size) // 2
        pf.draw(d, (x, y), s, size, col, stroke=stroke, stroke_fill=sc)

    def score(c, n, col=(255, 255, 255), bg=None):
        s = f"{n} : 0"
        if bg:
            ImageDraw.Draw(c).rectangle([CW // 2 - 26, 2, CW // 2 + 26, 14], fill=bg)
        text(c, (CW // 2, 4), s, 8, col)

    hero = "hero_giant_king"
    fights = {
        "onebit": Fight(at, hero, "skeleton"),
        "gameboy": Fight(at, hero, "skeleton"),
        "synth": Fight(at, "hero_void_wing", "bat"),
        "real": Fight(at, "hero_phoenix_king", "skeleton"),
        "spire": Fight(at, "hero_bat_wing", "fluff"),
        "win95": Fight(at, "hero_frost_both", "zombie"),
    }

    # --- 1-бит: чёрный экран, белые силуэты, пунктир посередине — как понг
    def onebit(k, sc):
        c = canvas()
        d = ImageDraw.Draw(c)
        for y in range(0, CH, 8):
            d.rectangle([CW // 2, y, CW // 2, y + 3], fill=(255, 255, 255, 255))
        d.line([0, GROUND + 1, CW, GROUND + 1], fill=(255, 255, 255, 255))
        fights["onebit"].draw(c, k, style=lambda s: silhouette(s, (255, 255, 255)))
        score(c, sc, bg=(0, 0, 0, 255))
        return c

    # --- глаза героя крупно: шлем со щелью, горящие глаза, диагональные полосы (кат-сцена)
    def eyes(k, sc):
        c = canvas((10, 6, 10))
        d = ImageDraw.Draw(c)
        shake = (k % 2) * 1
        d.polygon([(0, 30), (CW, 10), (CW, 120), (0, 140)], fill=(46, 48, 58, 255))  # шлем
        d.polygon([(0, 36), (CW, 16), (CW, 22), (0, 42)], fill=(120, 124, 140, 255))  # блик
        d.polygon([(0, 70 + shake), (CW, 56 + shake), (CW, 86 + shake), (0, 100 + shake)], fill=(8, 6, 12, 255))  # щель забрала
        glow = min(1, k / 10)
        for ex in (52, 140):
            ey = 82 - ex * 0.07 + shake
            for r, a in ((14, 50), (9, 100), (5, 220)):
                d.ellipse([ex - r * 1.6, ey - r * 0.6, ex + r * 1.6, ey + r * 0.6], fill=(255, 120, 40, int(a * glow)))
            d.ellipse([ex - 7, ey - 2, ex + 7, ey + 2], fill=(255, 250, 220, int(255 * glow)))
        for y0, col in ((4, (255, 210, 60)), (130, (255, 210, 60))):  # жёлтые полосы
            d.polygon([(0, y0 + 10), (CW, y0 - 4), (CW, y0), (0, y0 + 14)], fill=col + (255,))
        return c

    # --- кулак на комикс-взрыве
    FIST = [
        "....kkkkkkkk....",
        "..kkyyykyyykkk..",
        ".kyyyykyyyykyyk.",
        "kyYyyykyYyykyyyk",
        "kyyyyykyyyykyyyk",
        "kyYyyykyYyykyyyk",
        "kkkkkkkkkkkkkkyk",
        "kyyyyyyyyyyyyyyk",
        "kyYyyyyyyyyyyyyk",
        "kyyyyyyyyyyyyyk.",
        ".kyyyyyyyyyyyyk.",
        "..kkyyyyyyyykk..",
        "....kkkkkkkk....",
    ]

    def fist(k, sc):
        c = canvas((250, 250, 240))
        d = ImageDraw.Draw(c)
        cx, cy = CW // 2, CH // 2
        for i in range(24):  # лучи взрыва
            a0 = i * math.pi / 12 + k * 0.05
            col = (40, 60, 200) if i % 2 else (255, 255, 255)
            d.polygon([(cx, cy), (cx + 220 * math.cos(a0), cy + 220 * math.sin(a0)), (cx + 220 * math.cos(a0 + 0.2), cy + 220 * math.sin(a0 + 0.2))], fill=col + (255,))
        z = 7 - min(3, k * 0.6)
        pal = {"k": (20, 14, 10), "y": (255, 214, 40), "Y": (255, 250, 180)}
        w, h = len(FIST[0]) * z, len(FIST) * z
        for y, row in enumerate(FIST):
            for x, ch in enumerate(row):
                if ch != ".":
                    d.rectangle([cx - w / 2 + x * z, cy - h / 2 + y * z, cx - w / 2 + (x + 1) * z - 1, cy - h / 2 + (y + 1) * z - 1], fill=pal[ch] + (255,))
        return c

    # --- Game Boy: склеп в четырёх зелёных тонах
    GB = [(15, 56, 15), (48, 98, 48), (139, 172, 15), (155, 188, 15)]

    def gb(img):
        g = ImageOps.grayscale(img.convert("RGB"))
        lut = []
        for v in range(256):
            lut.append(min(3, v // 64))
        q = g.point(lambda v: min(3, v // 56))
        arr = np.array(q)
        out = np.array(GB, np.uint8)[arr]
        res = Image.fromarray(out).convert("RGBA")
        if img.mode == "RGBA":
            res.putalpha(img.split()[3])
        return res

    def gameboy(k, sc):
        c = bg_crop("arena_bg")
        fights["gameboy"].draw(c, k)
        score(c, sc)
        return gb(c)

    # --- четыре земли: каждые 2 доли — новая
    LANDS = [("arena_bg", "skeleton"), ("castle_bg", "bandit"), ("graveyard_bg", "wraith"), ("abyss_bg", "imp")]

    def lands(k, sc):
        bgn, en = LANDS[min(3, int(k // (BEAT * 2)))]
        c = bg_crop(bgn)
        Fight(at, hero, en, ex=112 if en != "wraith" else 100).draw(c, k)
        score(c, sc + int(k // (BEAT * 2)))
        return c

    # --- синтвейв: закат, полосатое солнце, неоновая сетка, герой с контуром
    def synth(k, sc):
        c = canvas((20, 4, 40))
        d = ImageDraw.Draw(c)
        for y in range(80):
            t = y / 80
            d.line([0, y, CW, y], fill=(int(40 + 200 * t), int(10 + 30 * t), int(90 + 60 * (1 - t)), 255))
        for y in range(20, 70):  # солнце с прорезями
            if y > 46 and (y // 3) % 2:
                continue
            w = math.sqrt(max(0, 26 ** 2 - (y - 46) ** 2))
            d.line([CW // 2 - w, y, CW // 2 + w, y], fill=(255, int(140 + (70 - y) * 2), 120, 255))
        d.rectangle([0, 80, CW, CH], fill=(16, 2, 30, 255))
        off = (k * 2) % 12
        for i in range(0, 80, 1):
            y = 80 + (i * i) / 40 + off * (i / 40)
            if y < CH and i % 6 == 0:
                d.line([0, y, CW, y], fill=(255, 40, 200, 255))
        for x in range(-200, 400, 20):
            d.line([CW // 2 + (x - CW // 2) * 0.1, 80, x, CH], fill=(255, 40, 200, 255))
        fights["synth"].draw(c, k, style=lambda s: outline(s, (0, 255, 255)), dmg_col=(0, 255, 255))
        score(c, sc, (0, 255, 255))
        return c

    # --- реальность: видео отжиманий игроков, поверх — пиксельный бой
    def real(k, sc):
        i = min(len(clips) - 1, int(k // (BEAT * 2.5)))
        fr = clips[i][int(k % (BEAT * 2.5)) % len(clips[i])]
        c = fr.copy()  # уже CW×CH пиксельное
        Fight(at, "hero_phoenix_king", "skeleton").draw(c, k)
        d = ImageDraw.Draw(c)
        d.rectangle([2, 2, 30, 13], fill=(0, 0, 0, 170))
        if int(k // 10) % 2:
            d.ellipse([5, 5, 10, 10], fill=(255, 40, 40, 255))
        d.text((13, 3), "REC", fill=(255, 255, 255, 255))
        score(c, sc + i)
        return c

    # --- Хеллоуин: зал Шпиля, рисунки игроков превращаются в монстров
    def spire(k, sc):
        c = bg_crop("spire_bg", 60)
        half = BEAT * 4
        idx = 0 if k < half else 1
        q = k % half
        draw_img = drawings[1 if idx == 0 else 0]
        enemy = "fluff" if idx == 0 else "eyequeen"
        if q < BEAT * 2:  # рисунок в рамке крупно, потом «оживает»
            card = draw_img.copy()
            card.thumbnail((84, 84))
            fr = Image.new("RGBA", (card.width + 6, card.height + 6), (240, 232, 214, 255))
            fr.paste(card, (3, 3))
            flip = max(0.05, 1 - max(0, q - BEAT * 1.5) / (BEAT * 0.5))
            fr = fr.resize((max(1, int(fr.width * flip)), fr.height))
            c.alpha_composite(fr, ((CW - fr.width) // 2, 20))
            if q > BEAT:
                text(c, (CW // 2, 112), "РИСУНОК -> МОНСТР", 8, (255, 170, 80), stroke=1)
        else:
            f = Fight(at, "hero_bat_wing", enemy, ex=118 if enemy == "fluff" else 112)
            f.draw(c, q - BEAT * 2)
        score(c, sc + idx)
        return c

    # --- туннель стикеров: квадраты летят на камеру, на стенах — мечи, сундуки, тыквы
    stickers = [at[n] for n in ("sword_phoenix", "sword_bat", "chest_samhain_0", "chest_abyss_1", "pumpkin_idle_0",
                                "fluff_idle_0", "skeleton_idle_0", "sword_void", "chest_castle_1", "imp_idle_0")]

    def tunnel(k, sc):
        c = canvas((10, 10, 20))
        d = ImageDraw.Draw(c)
        cx, cy = CW // 2 + math.sin(k / 6) * 12, CH // 2 + math.cos(k / 7) * 8
        for i in range(10):
            z = ((i + k / 6) % 10) / 10
            s = 6 + z * z * 260
            col = [(255, 230, 0), (0, 230, 255), (255, 0, 160)][i % 3]
            d.rectangle([cx - s, cy - s * 0.75, cx + s, cy + s * 0.75], outline=col + (255,), width=max(1, int(z * 4)))
            st = stickers[(i + int(k // 6)) % len(stickers)]
            sz = max(4, int(4 + z * 40))
            sti = st.copy()
            sti.thumbnail((sz, sz))
            c.alpha_composite(sti, (int(cx + s * 0.8 - sti.width), int(cy - s * 0.6)))
        for corner in ((0, 0), (CW, 0), (0, CH), (CW, CH)):
            d.line([corner, (cx, cy)], fill=(255, 230, 0, 255), width=2)
        return c

    # --- Windows 95: бирюзовый рабочий стол, окна ошибок по доле, герой скачет как мяч с радугой
    ERRS = ["Скелет.exe не отвечает", "Много отжиманий!", "Мышцы.dll перегружены", "Пресс не найден",
            "Присед: ошибка 404", "Огонёк дня: переполнение", "Сундук.exe: 25 раз", "Отжимайся медленнее"]
    trail = []

    def win95(k, sc):
        c = canvas((0, 128, 128))
        d = ImageDraw.Draw(c)
        for i, ic in enumerate(("chest_crypt_0", "sword_rusty", "skeleton_idle_0")):  # значки рабочего стола
            img = at[ic].copy()
            img.thumbnail((14, 14))
            c.alpha_composite(img, (6, 6 + i * 22))
        d.rectangle([0, CH - 12, CW, CH], fill=(192, 192, 192, 255))
        d.rectangle([2, CH - 10, 30, CH - 2], outline=(0, 0, 0, 255))
        # герой-мяч отскакивает от краёв, за ним радужный след
        t = k / FPS
        x = abs(((t * 90) % (2 * (CW - 30))) - (CW - 30))
        y = abs(((t * 70 + 20) % (2 * (CH - 50))) - (CH - 50)) + 4
        trail.append((x, y))
        del trail[:-18]
        for j, (tx, ty) in enumerate(trail):
            col = [(255, 0, 0), (255, 140, 0), (255, 230, 0), (0, 200, 0), (0, 120, 255), (160, 0, 255)][j % 6]
            d.rectangle([tx + 6, ty + 12, tx + 18, ty + 18], fill=col + (255,))
        hs = at["hero_frost_both_attack_0"] if int(k // 6) % 2 else at["hero_frost_both_idle_0"]
        c.alpha_composite(hs, (int(x), int(y)))
        big = c.resize((500, 375), Image.NEAREST)  # окна и надписи — пиксельным шрифтом игры в двойном разрешении
        d = ImageDraw.Draw(big)
        pf.draw(d, (14, 375 - 26), "Пуск", 8, (0, 0, 0))
        n = min(len(ERRS), int(k // BEAT) + 1)
        for i in range(n):  # окна ошибок копятся каскадом
            wx, wy = 30 + (i * 37) % 170, 40 + (i * 31) % 190
            d.rectangle([wx + 4, wy + 4, wx + 284, wy + 84], fill=(0, 0, 0))
            d.rectangle([wx, wy, wx + 280, wy + 80], fill=(192, 192, 192), outline=(0, 0, 0), width=2)
            d.rectangle([wx + 4, wy + 4, wx + 276, wy + 22], fill=(0, 0, 128))
            pf.draw(d, (wx + 10, wy + 9), "Ошибка", 8, (255, 255, 255))
            d.rectangle([wx + 260, wy + 7, wx + 272, wy + 19], fill=(192, 192, 192), outline=(0, 0, 0))
            d.ellipse([wx + 12, wy + 32, wx + 32, wy + 52], fill=(220, 0, 0))
            pf.draw(d, (wx + 18, wy + 38), "x", 8, (255, 255, 255))
            msg = ERRS[i]
            pf.draw(d, (wx + 42, wy + 34), msg[:28], 8, (0, 0, 0))
            d.rectangle([wx + 110, wy + 56, wx + 170, wy + 74], fill=(192, 192, 192), outline=(0, 0, 0), width=2)
            pf.draw(d, (wx + 132, wy + 61), "OK", 8, (0, 0, 0))
        sbig = big
        return sbig

    # --- синий экран
    def bsod(k, sc):
        c = Image.new("RGBA", (500, 375), (0, 0, 170, 255))
        d = ImageDraw.Draw(c)
        d.rectangle([190, 50, 310, 68], fill=(170, 170, 170))
        pf.draw(d, (250 - pf.width("ASH&IRON", 8) // 2, 55), "ASH&IRON", 8, (0, 0, 170))
        lines = ["Произошла фатальная ошибка:", "МЫШЦЫ_ПЕРЕГРУЖЕНЫ", "", "* Нажмите любую клавишу,", "  чтобы отжаться ещё раз.",
                 "* Ctrl+Alt+Del - к костру."]
        for i, ln in enumerate(lines):
            pf.draw(d, (36, 100 + i * 24), ln, 8, (255, 255, 255))
        if int(k // 8) % 2:
            pf.draw(d, (36, 100 + 7 * 24), "_", 8, (255, 255, 255))
        return c

    # --- психоделический босс: плазма, калейдоскоп, Полуночный Охотник и золотые искры
    yy, xx = np.mgrid[0:CH, 0:CW].astype(np.float32)
    sparks = []

    def boss(k, sc):
        t = k / FPS
        v = np.sin(xx / 13 + t * 3) + np.sin(yy / 9 - t * 2) + np.sin((xx + yy) / 17 + t) + np.sin(np.hypot(xx - CW / 2, yy - CH / 2) / 8 - t * 4)
        hue = ((v + 4) / 8 + t * 0.2) % 1.0
        hsv = np.stack([hue * 255, np.full_like(hue, 210), np.full_like(hue, 230)], -1).astype(np.uint8)
        c = Image.fromarray(hsv, "HSV").convert("RGBA")
        d = ImageDraw.Draw(c)
        cx, cy = CW / 2, CH / 2
        for i in range(4):  # неоновая рамка-туннель
            s = 20 + ((i * 25 + k * 3) % 100)
            d.rectangle([cx - s, cy - s * 0.7, cx + s, cy + s * 0.7], outline=(255, 0, 255, 255), width=2)
        en = "stalker2" if k < BEAT * 6 else "vampire"
        b = int(k // BEAT)
        p = k - b * BEAT
        es = at[f"{en}_hurt_0"] if 1 <= p <= 3 and b % 2 == 0 else at[f"{en}_idle_{int(k // 8) % 2}"]
        es = es.resize((int(es.width * 0.9), int(es.height * 0.9)), Image.NEAREST) if en == "stalker2" else es
        glow = outline(es, (255, 220, 60), 2)
        c.alpha_composite(glow, (int(CW - glow.width - 6 + math.sin(t * 9) * 2), int(GROUND + 18 - glow.height)))
        hs = at["hero_phoenix_wing_attack_0"] if p < 5 and b % 2 == 0 else at["hero_phoenix_wing_idle_0"]
        c.alpha_composite(outline(hs, (255, 255, 255)), (24, GROUND + 18 - hs.height))
        if 1 <= p < 2 and b % 2 == 0:
            for _ in range(40):
                a = rnd.uniform(0, math.tau)
                sparks.append([CW - 50, CH / 2, math.cos(a) * rnd.uniform(1, 4), math.sin(a) * rnd.uniform(1, 4), 1.0])
        for s in sparks:
            s[0] += s[2]
            s[1] += s[3]
            s[3] += 0.1
            s[4] -= 0.04
        sparks[:] = [s for s in sparks if s[4] > 0]
        for x, y, _, _, life in sparks:
            d.rectangle([x, y, x + 1, y + 1], fill=(255, 230, 80, int(255 * life)))
        score(c, sc, (255, 255, 0), (0, 0, 0, 200))
        return c

    def flash(k, sc):
        return canvas((255, 255, 250))

    def logo(k, sc):
        c = bg_crop("title_bg", 60)
        d = ImageDraw.Draw(c)
        d.rectangle([0, 0, CW, CH], fill=(0, 0, 0, 120))
        hs = at["hero_phoenix_wing_idle_" + str(int(k // 10) % 2)]
        c.alpha_composite(hs.resize((hs.width * 2, hs.height * 2), Image.NEAREST), (CW // 2 - hs.width, 66))
        text(c, (CW // 2, 18), "ASH & IRON", 16, (232, 206, 160), stroke=1, sc=(120, 30, 26))
        if k > 10:
            text(c, (CW // 2, 44), "ОТЖИМАЙСЯ, ЧТОБЫ ИГРАТЬ", 8, (255, 200, 90), stroke=1)
        return c

    return {"onebit": onebit, "eyes": eyes, "fist": fist, "gameboy": gameboy, "lands": lands, "synth": synth, "real": real,
            "spire": spire, "tunnel": tunnel, "win95": win95, "bsod": bsod, "boss": boss, "eyes2": eyes, "fist2": fist,
            "flash": flash, "logo": logo}


# ------------------------------------------------------------------ видео игроков → пиксельный холст
def load_clip(path, start, n, crop):
    """n кадров с секунды start, вырезка crop=(x, y, w, h) в 4:3, сжатая до холста и слегка упрощённая палитра."""
    x, y, w, h = crop
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-i", path, "-frames:v", str(n), "-r", str(FPS),
                          "-vf", f"crop={w}:{h}:{x}:{y},scale={CW}:{CH}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True, check=True).stdout
    frames = []
    for i in range(len(raw) // (CW * CH * 3)):
        img = Image.frombytes("RGB", (CW, CH), raw[i * CW * CH * 3:(i + 1) * CW * CH * 3])
        img = img.quantize(48, dither=Image.Dither.NONE).convert("RGBA")
        frames.append(img)
    return frames


def load_ref(path, start, n, box):
    """Кадры вставки из видео-референса (глаза, кулак): вырезка окна box=(x0, y0, x1, y1), RGB-массивы."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-i", path, "-frames:v", str(n), "-r", str(FPS),
                          "-vf", f"crop={w}:{h}:{x0}:{y0}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True, check=True).stdout
    return [np.frombuffer(raw[i * w * h * 3:(i + 1) * w * h * 3], np.uint8).reshape(h, w, 3) for i in range(len(raw) // (w * h * 3))]


def eyes_window(fr, k, base):
    """Полоса с глазами по жёлтым кромкам (без цифр понга) поверх нашего тёмного 1-бит поля."""
    yel = (fr[..., 0] > 190) & (fr[..., 1] > 160) & (fr[..., 2] < 110)
    mask = np.zeros(fr.shape[:2], bool)
    cols = np.where(yel.any(0))[0]
    for x in cols:
        ys = np.where(yel[:, x])[0]
        if ys[-1] - ys[0] > 20:
            mask[ys[0]:ys[-1] + 1, x] = True
    band = Image.fromarray(fr).convert("RGBA")
    band.putalpha(Image.fromarray((mask * 255).astype(np.uint8)))
    win = base.copy()
    band = band.resize((1000, int(band.height * 1000 / band.width)), Image.BILINEAR)
    win.alpha_composite(band, (0, (750 - band.height) // 2))
    return win


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fonts", required=True)
    ap.add_argument("--clips", nargs="+", required=True, help="видео:старт:x:y:w:h")
    ap.add_argument("--drawings", nargs=2, required=True)
    ap.add_argument("--ref", required=True, help="видео-референс: глаза 3.53–5.93 с, кулак 6.03–6.33 с")
    ap.add_argument("--track", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    pf = PixelFont(a.fonts)
    at = Atlas()
    clips = []
    for spec in a.clips:
        path, start, x, y, w, h = spec.rsplit(":", 5)
        clips.append(load_clip(path, float(start), int(BEAT * 2.5) + 2, (int(x), int(y), int(w), int(h))))
    drawings = [Image.open(p).convert("RGBA") for p in a.drawings]
    scenes = make_scenes(at, pf, clips, drawings)
    ref_eyes = load_ref(a.ref, 3.53, 75, (45, 115, 810, 705))
    ref_fist = load_ref(a.ref, 6.03, 10, (50, 125, 805, 691))

    def eyes_scene(k, sc):
        base = scenes["onebit"](0, sc).convert("RGBA").resize((1000, 750), Image.NEAREST)
        base = Image.blend(base, Image.new("RGBA", base.size, (0, 0, 0, 255)), 0.6)
        return eyes_window(ref_eyes[min(len(ref_eyes) - 1, k)], k, base)

    def fist_scene(k, sc):
        fr = Image.fromarray(ref_fist[min(len(ref_fist) - 1, k)]).convert("RGBA")
        z = 1.25 - min(0.25, k * 0.04)  # кулак летит в камеру
        big = fr.resize((int(1000 * z), int(750 * z)), Image.BILINEAR)
        win = Image.new("RGBA", (1000, 750))
        win.paste(big, ((1000 - big.width) // 2, (750 - big.height) // 2))
        return win

    scenes.update({"eyes": eyes_scene, "eyes2": eyes_scene, "fist": fist_scene, "fist2": fist_scene})

    hook = caption_image(pf, ["КАЖДОЕ ОТЖИМАНИЕ", "МЕНЯЕТ ИГРУ"], [fit_size(pf, "КАЖДОЕ ОТЖИМАНИЕ", 60), 76],
                         [(240, 232, 214), (255, 150, 60)])
    SCENE_COL = {"onebit": (60, 60, 60), "gameboy": (60, 110, 30), "lands": (150, 60, 30), "synth": (200, 40, 200),
                 "real": (60, 120, 200), "spire": (230, 110, 30), "tunnel": (230, 210, 0), "win95": (0, 128, 128),
                 "bsod": (0, 0, 170), "boss": (255, 40, 160), "logo": (150, 40, 30)}
    CALM = {"onebit", "eyes", "bsod", "logo"}
    frames = Frames()
    score, reps, beat_no = 0, 0, 0
    label_age = {}
    lines = []  # линии скорости на фоне
    meta = []  # (сцена, кадр в сцене, номер доли, фаза доли)
    for si, (name, nb) in enumerate(SCENES):
        f0, f1 = round(beat_no * BEAT), round((beat_no + nb) * BEAT)
        if name in BATTLE:
            score += 1
        for k in range(f1 - f0):
            gk = f0 + k
            gb = int(gk // BEAT)
            phase = gk - gb * BEAT
            if name in BATTLE and int(k // BEAT) % 2 == 0 and phase < 1:
                reps += 1
            win = scenes[name](k, score).convert("RGB").resize((CW * SCALE, CH * SCALE), Image.NEAREST)
            col = SCENE_COL.get(name, (40, 30, 50))
            calm = name in CALM
            pump = 0 if calm else math.exp(-phase / 3)  # «качка» на каждую долю
            f = Image.new("RGB", (W, H), tuple(int(c * 0.12) for c in col))
            d = ImageDraw.Draw(f, "RGBA")
            # фон: радиальная вспышка цвета сцены на долю и летящие линии скорости
            r = 700 + 200 * pump
            for rr, aa in ((r, 30), (r * 0.7, 40), (r * 0.45, 50)):
                d.ellipse([W / 2 - rr, 960 - rr, W / 2 + rr, 960 + rr], fill=col + (int(aa * (0.4 + pump)),))
            if not calm:
                for _ in range(3):
                    lines.append([rnd.uniform(0, W), -200, rnd.uniform(40, 90), rnd.uniform(100, 300)])
            for ln in lines:
                ln[1] += ln[2]
                d.line([ln[0], ln[1], ln[0], ln[1] + ln[3]], fill=col + (90,), width=4)
            lines[:] = [ln for ln in lines if ln[1] < H]
            # окно браузера
            d.rectangle([WIN_X - 4, WIN_Y - 52, WIN_X + CW * SCALE + 4, WIN_Y + CH * SCALE + 4], fill=(48, 46, 54))
            for i, cc in enumerate(((255, 95, 86), (255, 189, 46), (39, 201, 63))):
                d.ellipse([WIN_X + 14 + i * 34, WIN_Y - 38, WIN_X + 38 + i * 34, WIN_Y - 14], fill=cc)
            d.rounded_rectangle([WIN_X + 140, WIN_Y - 42, WIN_X + CW * SCALE - 140, WIN_Y - 10], 10, fill=(30, 28, 34))
            url = "ash-a-iron.com"
            pf.draw(d, ((W - pf.width(url, 22)) // 2, WIN_Y - 36), url, 22, (200, 196, 210))
            f.paste(win, (WIN_X, WIN_Y))
            fr = f.convert("RGBA")
            hz_ = 1 + 0.06 * pump  # зацепка подпрыгивает в такт
            hk = hook.resize((int(hook.width * hz_), int(hook.height * hz_)), Image.BILINEAR) if pump > 0.05 else hook
            fr.alpha_composite(hk, ((W - hk.width) // 2, 230 - (hk.height - hook.height) // 2))
            dd = ImageDraw.Draw(fr)
            if name != "logo":
                txt = f"ОТЖИМАНИЙ: {reps}"
                sz = int(54 * (1 + 0.3 * pump * (name in BATTLE)))
                pf.draw(dd, ((W - pf.width(txt, sz)) // 2 + 6, 1370 + 6), txt, sz, (120, 30, 26), stroke=4, stroke_fill=(120, 30, 26))
                pf.draw(dd, ((W - pf.width(txt, sz)) // 2, 1370), txt, sz, (255, 214, 110), stroke=4, stroke_fill=(10, 8, 12))
            lab = LABEL.get(name, "")
            if lab:
                ls = fit_size(pf, lab, 44)
                lc = (150, 220, 255) if name != "boss" else (255, 120, 90)
                pf.draw(dd, ((W - pf.width(lab, ls)) // 2, 1470), lab, ls, lc, stroke=3, stroke_fill=(10, 8, 12))
            if name == "logo" and k > 20:
                for i2, (ln, sz2, c2) in enumerate((("ASH-A-IRON.COM", 64, (255, 180, 90)), ("ИГРАЙ БЕСПЛАТНО В БРАУЗЕРЕ", 34, (240, 232, 214)))):
                    s2 = fit_size(pf, ln, sz2)
                    pf.draw(dd, ((W - pf.width(ln, s2)) // 2, 1380 + i2 * 100), ln, s2, c2, stroke=4, stroke_fill=(10, 8, 12))
            frames.append(fr)
            meta.append((name, k, gb, phase, si))
        beat_no += nb

    total = len(frames)
    dur = total / FPS
    # звук: отрезок трека; на логотипе — затухание
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(TRACK_START), "-t", str(dur + 0.5), "-i", a.track, "-ac", "2", "-ar", str(SR),
                          "-f", "s16le", "-"], capture_output=True, check=True).stdout
    track = np.frombuffer(raw, np.int16).reshape(-1, 2).astype(np.float32) / 32768
    track = track[: int(SR * dur)].copy()
    fade = int(SR * 3.0)
    track[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
    track[: int(SR * 0.03)] *= np.linspace(0, 1, int(SR * 0.03))[:, None]
    tmp = tempfile.mkdtemp()
    wav = f"{tmp}/a.wav"
    with wave.open(wav, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(track, -1, 1) * 32767).astype(np.int16).tobytes())
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-i", wav, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
                            "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-movflags", "+faststart", "-shortest", a.out], stdin=subprocess.PIPE)
    cuts = {i for i in range(total) if i == 0 or meta[i][4] != meta[i - 1][4]}
    since_cut = 99
    for i in range(total):
        f = frames.image(i)
        name, k, gb, phase, si = meta[i]
        since_cut = 0 if i in cuts else since_cut + 1
        calm = name in ("onebit", "eyes", "eyes2", "bsod", "logo")
        pump = 0 if calm else math.exp(-phase / 3)
        # 1) «качка»: кадр чуть приближается на каждую долю, в бою — ещё и наклон
        zoom = 1 + 0.045 * pump + (0.08 if since_cut < 3 and name in ("fist", "fist2", "boss", "gameboy") else 0)
        ang = 0
        if name in ("boss", "real", "synth", "tunnel"):
            ang = 1.6 * math.sin(i / 9) + (2.5 * pump if gb % 2 == 0 else -2.5 * pump)
        if zoom != 1 or ang:
            big = f.resize((int(W * zoom), int(H * zoom)), Image.BILINEAR)
            if ang:
                big = big.rotate(ang, resample=Image.BILINEAR, fillcolor=(10, 8, 12))
            f = big.crop(((big.width - W) // 2, (big.height - H) // 2, (big.width - W) // 2 + W, (big.height - H) // 2 + H))
        # 2) тряска: на склейках и на ударе героя (каждая вторая доля)
        amp = 0
        if since_cut < 8 and name not in ("onebit", "logo"):
            amp = 28 * (1 - since_cut / 8)
        elif not calm and gb % 2 == 0 and phase < 5:
            amp = 10 * (1 - phase / 5)
        if amp:
            moved = Image.new("RGB", (W, H), (10, 8, 12))
            moved.paste(f, (int(rnd.uniform(-amp, amp)), int(rnd.uniform(-amp, amp))))
            f = moved
        # 3) RGB-расслоение и глитч-полосы на склейках
        if since_cut < 4 and name != "onebit":
            arr = np.array(f)
            sh = int(18 * (1 - since_cut / 4))
            arr[..., 0] = np.roll(arr[..., 0], sh, 1)
            arr[..., 2] = np.roll(arr[..., 2], -sh, 1)
            for _ in range(6):
                y0 = rnd.randrange(0, H - 120)
                hh = rnd.randrange(20, 120)
                arr[y0:y0 + hh] = np.roll(arr[y0:y0 + hh], rnd.randint(-80, 80), 1)
            f = Image.fromarray(arr)
            if since_cut == 0:
                f = Image.blend(f, Image.new("RGB", (W, H), (255, 255, 255)), 0.55)
        elif not calm and pump > 0.8 and gb % 4 == 0:  # лёгкое расслоение на сильную долю
            arr = np.array(f)
            arr[..., 0] = np.roll(arr[..., 0], 6, 1)
            arr[..., 2] = np.roll(arr[..., 2], -6, 1)
            f = Image.fromarray(arr)
        enc.stdin.write(f.tobytes())
    enc.stdin.close()
    enc.wait()
    print(f"Готово: {a.out} ({dur:.1f} с, {total} кадров)")


if __name__ == "__main__":
    main()
