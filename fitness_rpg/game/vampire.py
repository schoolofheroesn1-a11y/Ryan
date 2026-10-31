"""Граф — босс Шпиля Самайна: призрачный король-вампир (эскиз A «Король-Тень», выбран по опросу).

Огромный, сгорбленный: голова вжата в плечи под горбом тяжёлой мантии с пепельным мехом, иссохшее
лицо-череп с горящими лиловыми глазами, железная зубчатая корона с камнями, длинные руки до земли с
когтями, лиловая подкладка, серебряные застёжки и цепь с камнем. Подол тает в лиловом тумане.
Палитра — пепел и лиловый, без тыкв.

Объём — светотенью по маске каждой детали: свет из лунного окна сверху-слева, тень снизу-справа,
лиловый отсвет по правому краю, шахматный переход между тонами. Смотрит влево, на героя.
"""
import math
import random

import pygame

from game.abyss import outlined
from game.art import crouched, tinted

W, H = 88, 96
GROUND = H - 1

# палитры: [тень, основной, свет, блик]
ASH = [(30, 28, 38), (64, 60, 74), (104, 100, 114), (152, 148, 162)]
DARK = [(8, 6, 14), (20, 16, 30), (36, 30, 52), (60, 52, 84)]
LILAC = [(44, 26, 70), (82, 54, 122), (128, 94, 172), (188, 158, 226)]
PALE = [(66, 60, 84), (116, 110, 134), (164, 158, 180), (214, 210, 228)]
PALE_F = [(76, 54, 104), (130, 100, 160), (176, 150, 206), (222, 204, 240)]  # в ярости кожа отливает лиловым
BONE = [(94, 90, 104), (148, 144, 158), (196, 192, 204), (234, 232, 240)]
SILVER = [(70, 72, 86), (124, 128, 146), (178, 182, 198), (226, 230, 240)]
RIM = (176, 136, 236)  # лиловый отсвет лунного окна справа
EYE, EYE_HOT = (206, 150, 255), (255, 240, 255)
MAW = (26, 8, 34)


# ---------------------------------------------------------------- светотень
def _mask(draw):
    """Маска детали: draw(surface) рисует её белым."""
    s = pygame.Surface((W, H), pygame.SRCALPHA)
    draw(s)
    return pygame.mask.from_surface(s)


def _run(m, x, y, dx, dy, cap=6):
    """Сколько шагов от пикселя до края маски в направлении (dx, dy)."""
    for k in range(1, cap + 1):
        nx, ny = x + dx * k, y + dy * k
        if not (0 <= nx < W and 0 <= ny < H) or not m.get_at((nx, ny)):
            return k
    return cap + 1


def shade(s, m, pal, rim=False, soft=False):
    """Закрасить маску тонами: блик и свет к окну (вверх-влево), тень снизу-справа, отсвет тыкв справа."""
    for y in range(H):
        for x in range(W):
            if not m.get_at((x, y)):
                continue
            dl = min(_run(m, x, y, -1, -1), _run(m, x, y, 0, -1) + 1)
            dd = min(_run(m, x, y, 1, 1), _run(m, x, y, 0, 1) + 1)
            chk = (x + y) % 2
            if dl <= 1 and not soft:
                c = pal[3]
            elif dl <= 2 or (dl == 3 and chk):
                c = pal[2]
            elif dd <= 1 or (dd == 2 and chk):
                c = pal[0]
            else:
                c = pal[1]
            if rim and _run(m, x, y, 1, 0) == 1 and _run(m, x, y, 1, -1) <= 2:  # тонкий отсвет тыкв по правому краю
                c = _mix(c, RIM, 0.55)
            s.set_at((x, y), c)


def _mix(a, b, k):
    return tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(3))


def part(s, pal, draw, **kw):
    m = _mask(draw)
    shade(s, m, pal, **kw)
    return m


def poly(pts):
    return lambda t: pygame.draw.polygon(t, (255, 255, 255), pts)


def ell(r):
    return lambda t: pygame.draw.ellipse(t, (255, 255, 255), r)


def many(*fns):
    def d(t):
        for f in fns:
            f(t)
    return d


def line(s, col, a, b, w=1):
    pygame.draw.line(s, col, a, b, w)


# ---------------------------------------------------------------- детали
def mist_hem(s, top, seed):
    """Подол тает: редеет шахматкой, бледнеет в лиловый и уходит завитками тумана."""
    rnd = random.Random(seed)
    for y in range(top, H):
        k = (y - top) / max(1, H - top)
        for x in range(W):
            c = s.get_at((x, y))
            if not c.a:
                continue
            if rnd.random() < k * 0.85 or ((x + y) % 2 and k > 0.45):
                s.set_at((x, y), (0, 0, 0, 0))
            else:
                mix = min(1, k * 1.4)
                s.set_at((x, y), (*_mix(c[:3], LILAC[2], mix), int(255 - 150 * k)))
    for _ in range(9):
        x, y = rnd.randrange(12, W - 12), rnd.randrange(top + 2, H - 2)
        pygame.draw.arc(s, (*LILAC[3], 120), (x, y - 3, 8, 6), 0, math.pi * 1.4)


def eyes_glow(s, pts, fury):
    """Горящие глаза: широкий лиловый ореол, яркое ядро, у ярости — языки огня вверх."""
    halo = pygame.Surface((W, H), pygame.SRCALPHA)
    for x, y in pts:
        pygame.draw.circle(halo, (*EYE, 26 if not fury else 44), (x, y), 5)
        pygame.draw.circle(halo, (*EYE, 120 if not fury else 170), (x, y), 2)
    s.blit(halo, (0, 0))
    for x, y in pts:
        s.set_at((x, y), EYE_HOT)
        s.set_at((x + 1, y), EYE_HOT)
        s.set_at((x, y - 1), (236, 210, 255))
        if fury:  # огонь из глазниц
            for k, (dx, dy) in enumerate(((1, -2), (2, -3), (2, -4), (3, -6))):
                s.set_at((x + dx, y + dy), (*_mix(EYE_HOT, EYE, k / 3), 255))


def claws(s, hand, direction, long=12, skin=PALE):
    """Костлявая кисть с длинными пальцами и когтями веером."""
    pygame.draw.circle(s, skin[1], hand, 3)
    s.set_at((hand[0] - 1, hand[1] - 2), skin[3])
    for k in (-2, -1, 0, 1, 2):
        a = direction + k * 0.22
        ln = long - abs(k) * 1.3
        kn = (hand[0] + math.cos(a) * ln * 0.55, hand[1] + math.sin(a) * ln * 0.55)
        tip = (hand[0] + math.cos(a + 0.15) * ln, hand[1] + math.sin(a + 0.15) * ln)
        line(s, skin[1], hand, kn)
        s.set_at((round(kn[0]), round(kn[1])), skin[0])
        line(s, BONE[3], kn, tip)
        s.set_at((round(tip[0]), round(tip[1])), LILAC[3])


def limb(s, pts, w0=4, w1=5):
    """Рука в широком рукаве мантии: рукав расширяется к запястью, рваный лиловый край манжеты."""
    def quad(a, b, ha, hb):
        dx, dy = b[0] - a[0], b[1] - a[1]
        n = math.hypot(dx, dy) or 1
        nx, ny = -dy / n, dx / n
        return [(a[0] + nx * ha, a[1] + ny * ha), (b[0] + nx * hb, b[1] + ny * hb),
                (b[0] - nx * hb, b[1] - ny * hb), (a[0] - nx * ha, a[1] - ny * ha)]
    segs = list(zip(pts, pts[1:]))
    widths = [w0 + (w1 - w0) * i / max(1, len(segs)) for i in range(len(segs) + 1)]
    quads = [quad(a, b, widths[i], widths[i + 1]) for i, (a, b) in enumerate(segs)]
    part(s, DARK, many(*[poly(q) for q in quads], *[ell((p[0] - widths[i], p[1] - widths[i], widths[i] * 2, widths[i] * 2)) for i, p in enumerate(pts[1:-1], 1)]))
    end, prev = pts[-1], pts[-2]
    dx, dy = end[0] - prev[0], end[1] - prev[1]
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n * w1, dx / n * w1
    line(s, LILAC[2], (end[0] + nx, end[1] + ny), (end[0] - nx, end[1] - ny))  # манжета


def face(s, cx, top, skin, bite=False):
    """Иссохшее лицо-череп анфас. Возвращает точки глаз."""
    jaw = 6 if bite else 0
    part(s, skin, many(ell((cx - 10, top, 20, 20)),
                       poly([(cx - 9, top + 11), (cx + 9, top + 11), (cx + 6, top + 25 + jaw), (cx, top + 28 + jaw), (cx - 6, top + 25 + jaw)])))
    for sd in (-1, 1):  # впалые виски и щёки, скулы
        line(s, skin[0], (cx + sd * 8, top + 8), (cx + sd * 7, top + 14))
        line(s, skin[0], (cx + sd * 5, top + 17), (cx + sd * 4, top + 23 + jaw // 2))
        line(s, skin[3], (cx + sd * 6, top + 16), (cx + sd * 9, top + 15))
    line(s, skin[0], (cx - 4, top + 4), (cx + 4, top + 4))  # морщина лба
    line(s, skin[0], (cx - 3, top + 6), (cx + 3, top + 6))
    for ex in (cx - 7, cx + 2):  # глазницы — светятся изнутри
        pygame.draw.ellipse(s, (30, 14, 46), (ex, top + 9, 6, 5))
        pygame.draw.ellipse(s, LILAC[1], (ex + 1, top + 10, 4, 3))
    line(s, skin[0], (cx - 9, top + 7), (cx - 1, top + 10), 2)  # брови «галочкой»
    line(s, skin[0], (cx + 9, top + 7), (cx + 1, top + 10), 2)
    s.set_at((cx - 1, top + 17), (16, 10, 24))  # провал носа
    s.set_at((cx + 1, top + 17), (16, 10, 24))
    s.set_at((cx, top + 16), skin[0])
    my = top + 21
    if bite:  # пасть распахнута: ряды игл
        pygame.draw.polygon(s, MAW, [(cx - 6, my - 1), (cx + 6, my - 1), (cx + 5, my + 8), (cx - 5, my + 8)])
        for x in range(cx - 5, cx + 6, 2):
            line(s, BONE[3], (x, my - 1), (x, my - 1 + (4 if x in (cx - 3, cx + 3) else 2)))
        for x in range(cx - 4, cx + 5, 2):
            line(s, BONE[2], (x, my + 7), (x, my + 5))
        pygame.draw.ellipse(s, (120, 60, 140), (cx - 3, my + 4, 7, 2))
    else:
        line(s, (24, 12, 30), (cx - 5, my), (cx + 5, my))
        for x, ln in ((cx - 4, 5), (cx - 2, 2), (cx, 2), (cx + 2, 2), (cx + 4, 5)):
            line(s, BONE[3], (x, my), (x, my + ln))
            s.set_at((x, my + ln), BONE[1])
    return [(cx - 4, top + 11), (cx + 5, top + 11)]


def crown(s, cx, top, fury):
    """Железная зубчатая корона с лиловыми камнями."""
    part(s, SILVER, poly([(cx - 10, top + 2), (cx - 10, top - 4), (cx - 7, top - 1), (cx - 5, top - 10), (cx - 2, top - 3),
                          (cx + 1, top - 14), (cx + 4, top - 3), (cx + 7, top - 10), (cx + 9, top - 1), (cx + 12, top - 5), (cx + 11, top + 2)]))
    line(s, SILVER[0], (cx - 10, top + 1), (cx + 11, top + 1))
    for x in (cx - 5, cx + 1, cx + 7):
        s.set_at((x, top - 1), EYE_HOT if fury else LILAC[3])
        s.set_at((x, top), LILAC[1])


def mantle(s, pose, frame):
    """Мантия-горб и подкладка. В «стае» распахнута крыльями до краёв кадра."""
    if pose == "swarm":
        for sd in (-1, 1):
            cx = 46
            tips = [(cx + sd * d, y) for d, y in ((38, 6), (44, 28), (42, 54), (32, 76), (18, 90))]
            edge = []
            for a, b in zip(tips, tips[1:]):
                edge += [a, ((a[0] + b[0]) // 2 - sd * 6, (a[1] + b[1]) // 2)]
            edge.append(tips[-1])
            part(s, DARK, poly([(cx + sd * 4, 26), (cx + sd * 20, 10)] + edge + [(cx + sd * 6, 90)]), rim=sd > 0)
            part(s, LILAC, poly([(cx + sd * 6, 30), (cx + sd * 20, 16), (cx + sd * 32, 14)] +
                                [(x - sd * 6, y) for x, y in edge[2:-1]] + [(cx + sd * 8, 86)]), soft=True)
            for t in tips[:-1]:
                line(s, ASH[2], (cx + sd * 18, 14), t)
        return
    sway = frame
    part(s, DARK, poly([(30, 22), (48, 8 + sway), (70, 12 + sway), (82, 34), (86, 70), (80, 95), (14, 95), (18, 60), (22, 36)]), rim=True)
    part(s, LILAC, poly([(64, 30), (78, 40), (82, 88), (70, 94), (66, 60)]), soft=True)
    for x0, x1 in ((34, 26), (48, 46), (60, 62)):
        line(s, DARK[3], (x0, 30), (x1, 92))
        line(s, DARK[0], (x0 + 1, 32), (x1 + 1, 92))


def fur(s, frame, seed=3):
    """Пепельная меховая опушка по плечам и горбу — клочьями."""
    pts = [(20, 40), (24, 24), (34, 16 + frame), (50, 12 + frame), (66, 16 + frame), (76, 26), (78, 40), (66, 36), (54, 30), (40, 32), (30, 38)]
    m = part(s, ASH, poly(pts), rim=True)
    rnd = random.Random(seed + frame)
    for _ in range(90):
        x, y = rnd.randrange(20, 80), rnd.randrange(12, 42)
        if m.get_at((x, y)) and m.get_at((x, min(H - 1, y + 2))):
            line(s, rnd.choice((ASH[0], ASH[3], ASH[2], ASH[0])), (x, y), (x + rnd.choice((-1, 0, 1)), y + 2))


def chest(s, fury):
    """Камзол под мантией: серебряные застёжки, цепь с лиловым камнем."""
    part(s, DARK, poly([(30, 40), (52, 38), (56, 72), (28, 74)]))
    for y in (46, 53, 60, 67):
        s.set_at((41, y), SILVER[3])
        s.set_at((42, y), SILVER[1])
    line(s, DARK[3], (35, 44), (33, 72))
    line(s, DARK[0], (50, 44), (52, 72))
    pygame.draw.lines(s, SILVER[2], False, [(30, 44), (36, 52), (44, 54), (52, 48)])
    pygame.draw.circle(s, SILVER[1], (44, 55), 3)
    pygame.draw.circle(s, EYE_HOT if fury else LILAC[3], (44, 55), 1)


# ---------------------------------------------------------------- поза целиком
def vampire(pose="idle", frame=0, fury=False):
    """pose: idle, raised (когти вскинуты над головой), slash (взмах когтями), bite (бросок с раскрытой пастью),
    swarm (мантия распахнута крыльями)."""
    s = pygame.Surface((W, H), pygame.SRCALPHA)
    skin = PALE_F if fury else PALE
    bite = pose == "bite"
    cx, top = (26, 28) if bite else (34, 22 + frame)  # голова низко, вжата в плечи; в укусе — бросок вперёд
    mantle(s, pose, frame)
    # дальняя рука
    if pose == "swarm":
        limb(s, [(58, 40), (72, 24), (80, 10)])
        claws(s, (80, 9), -math.pi / 2 + 0.5, 10, skin)
    else:
        limb(s, [(58, 42), (64, 62), (64, 78 + frame)])
        claws(s, (64, 80 + frame), math.pi / 2 - 0.1, 11, skin)
    if pose != "swarm":
        fur(s, frame)
    chest(s, fury)
    eyes = face(s, cx, top, skin, bite)
    crown(s, cx, top, fury)
    # ближняя рука — длинная, до земли
    if pose == "raised":
        limb(s, [(28, 42), (20, 26), (14, 10)])
        claws(s, (14, 8), -math.pi / 2 - 0.3, 14, skin)
    elif pose == "slash":
        limb(s, [(28, 42), (14, 48), (4, 52)])
        claws(s, (3, 52), math.pi + 0.1, 14, skin)
    elif bite:
        limb(s, [(28, 44), (16, 56), (8, 62)])
        claws(s, (7, 63), math.pi * 0.75, 13, skin)
    elif pose == "swarm":
        limb(s, [(32, 40), (16, 24), (8, 10)])
        claws(s, (7, 9), -math.pi / 2 - 0.5, 10, skin)
    else:
        limb(s, [(28, 42), (20, 62), (16, 80 + frame)])
        claws(s, (15, 82 + frame), math.pi / 2 + 0.2, 13, skin)
    if pose == "swarm":
        fur(s, frame)
        eyes = face(s, cx, top, skin)
        crown(s, cx, top, fury)
    out = outlined(s, (6, 4, 12))
    mist_hem(out, 84, 1 + frame)  # туман — после контура, чтобы подол таял вместе с ним
    eyes_glow(out, eyes, fury)
    if pose == "slash":  # след когтей — лиловые дуги
        for k in range(3):
            pygame.draw.arc(out, (*_mix(EYE_HOT, EYE, k / 2), 255), (-8 + k * 2, 34 + k * 4, 28, 30), math.pi * 0.55, math.pi * 1.2)
    return out


def make_vampire_frames():
    idle, idle2 = vampire("idle", 0), vampire("idle", 1)
    raised = vampire("raised")
    glow = (200, 150, 255)
    swarm = vampire("swarm")
    frames = {
        "idle": [idle, idle2],
        "windup": [tinted(raised, glow, 0.22), raised],
        "attack": [vampire("slash")],
        "hurt": [tinted(idle, (255, 255, 255), 0.8)],
        "dead": [crouched(tinted(idle, (40, 34, 50), 0.55))],
        "enraged": [vampire("idle", 0, True), vampire("idle", 1, True)],
        "bite": [vampire("bite")],
        "swarm": [swarm, tinted(swarm, glow, 0.12)],
    }
    mist = []
    for src, a in ((idle, 150), (idle2, 100)):  # туман: полупрозрачный лиловый силуэт
        t = tinted(src, (150, 110, 190), 0.75)
        m = pygame.Surface(t.get_size(), pygame.SRCALPHA)
        for y in range(t.get_height()):
            for x in range(t.get_width()):
                c = t.get_at((x, y))
                if c.a:
                    m.set_at((x, y), (c.r, c.g, c.b, min(c.a, a)))
        mist.append(m)
    frames["mist"] = mist
    return frames
