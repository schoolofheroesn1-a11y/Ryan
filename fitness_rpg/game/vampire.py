"""Граф Тыквенной Крови — босс Шпиля Самайна, детальный спрайт.

Высокий сгорбленный вампир-носферату: лысый вытянутый череп с венами, огромные заострённые уши,
глубокие глазницы с горящими красными глазами, крючковатый нос, пасть с рядами клыков; мантия из
серого меха шипами, доспех-камзол с костяными рёбрами, пояс с черепом и цепь тыквенных фонариков,
рваный плащ-крыло с багровой подкладкой, длинные пальцы с когтями.

Объём — светотенью по маске каждой детали: свет из лунного окна сверху-слева, тень снизу-справа,
тёплый отсвет тыкв по правому краю, шахматный переход между тонами. Смотрит влево, на героя.
"""
import math
import random

import pygame

from game.abyss import outlined
from game.art import crouched, tinted

W, H = 88, 96
GROUND = H - 1

# палитры: [тень, основной, свет, блик]
SKIN = [(52, 64, 62), (104, 120, 112), (150, 164, 152), (196, 206, 192)]
SKIN_F = [(70, 40, 48), (128, 96, 100), (176, 140, 140), (220, 190, 180)]  # в ярости кожа наливается кровью
FUR = [(30, 28, 36), (62, 58, 70), (100, 96, 108), (148, 144, 152)]
CAPE = [(8, 4, 12), (20, 12, 26), (38, 24, 48), (66, 44, 84)]
LINING = [(60, 4, 14), (108, 12, 26), (156, 24, 38), (206, 56, 62)]
ARMOR = [(12, 10, 16), (26, 22, 32), (44, 38, 54), (78, 70, 92)]
BONE = [(110, 100, 90), (170, 160, 144), (214, 206, 188), (244, 240, 226)]
RIM = (226, 120, 54)  # отсвет тыкв справа
EYE, EYE_CORE = (255, 30, 30), (255, 214, 170)
MAW = (46, 4, 10)


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


# ---------------------------------------------------------------- части тела
def cape_back(s, pose, sway):
    """Плащ за спиной: ниспадает до земли рваными языками или распахнут крыльями (стая мышей)."""
    if pose == "swarm":
        for side in (-1, 1):  # два крыла от плеч: костяные «пальцы» и перепонка с вырезами
            cx = 46
            tips = [(cx + side * d, y) for d, y in ((40, 6), (43, 30), (40, 56), (30, 78), (16, 92))]
            pts = [(cx + side * 4, 30)] + tips + [(cx + side * 6, 88)]
            edge = []
            for a, b in zip(tips, tips[1:]):
                edge += [a, ((a[0] + b[0]) // 2 - side * 5, (a[1] + b[1]) // 2)]
            edge.append(tips[-1])
            outer = [(cx + side * 4, 30), (cx + side * 22, 14), tips[0]] + edge[1:] + [(cx + side * 6, 88)]
            part(s, CAPE, poly(outer), rim=side > 0)
            inner = [(cx + side * 6, 34), (cx + side * 22, 20), (cx + side * 34, 16)] + \
                    [(x - side * 6, y) for x, y in edge[2:-1]] + [(cx + side * 8, 84)]
            part(s, LINING, poly(inner), rim=False, soft=True)
            for t in tips[:-1]:  # кости-пальцы крыла
                line(s, BONE[1], (cx + side * 20, 16), t)
            line(s, BONE[2], (cx + side * 4, 30), (cx + side * 20, 16), 2)
        return
    hem = []
    for i, x in enumerate(range(14, 87, 6)):  # рваный подол
        hem.append((x, GROUND - (0 if i % 2 else 6 + (i * 5 + sway * 3) % 4)))
    outer = [(36, 28), (60, 28), (74, 44), (84, 70 + sway)] + list(reversed(hem)) + [(18, 74 - sway), (26, 48)]
    part(s, CAPE, poly(outer), rim=True)
    lining = [(60, 32), (70, 46), (80, 70 + sway), (82, 88), (74, 90), (68, 80), (62, 58)]
    part(s, LINING, poly(lining), rim=False, soft=True)
    for x0, x1 in ((40, 30), (52, 50), (64, 70)):  # складки
        line(s, CAPE[0], (x0, 40), (x1, GROUND - 4))
        line(s, CAPE[2], (x0 + 1, 44), (x1 + 1, GROUND - 10))


def boots(s, lean):
    for x in (36 + lean // 2, 48 + lean // 2):
        part(s, ARMOR, poly([(x, 84), (x + 7, 84), (x + 8, GROUND), (x - 3, GROUND), (x - 2, 90)]))
        line(s, BONE[1], (x - 1, 89), (x + 6, 89))  # окованный носок


def coat(s, lean, fury):
    """Камзол-доспех: костяные рёбра на груди, пояс с черепом, цепь тыквенных фонариков, багровая кайма."""
    L = lean
    body = [(36 + L, 34), (58 + L // 2, 34), (60, 60), (62, 88), (34, 88), (34 + L // 2, 60)]
    part(s, ARMOR, poly(body))
    line(s, LINING[2], (34, 87), (62, 87))  # кайма подола
    line(s, LINING[1], (34, 86), (62, 86))
    cx = 47 + L * 2 // 3
    for i, y in enumerate(range(38, 56, 4)):  # рёбра
        w = 9 - abs(i - 2)
        pygame.draw.arc(s, BONE[2], (cx - w, y - 2, w * 2, 6), math.pi * 1.05, math.pi * 1.95)
        pygame.draw.arc(s, BONE[0], (cx - w, y - 1, w * 2, 6), math.pi * 1.1, math.pi * 1.9)
    line(s, BONE[3], (cx, 36), (cx, 56))  # грудина
    line(s, BONE[1], (cx + 1, 37), (cx + 1, 56))
    # пояс и пряжка-череп
    pygame.draw.rect(s, (40, 24, 20), (34 + L // 2, 58, 27, 4))
    line(s, (90, 60, 40), (34 + L // 2, 58), (60, 58))
    bx = cx - 3
    pygame.draw.ellipse(s, BONE[2], (bx, 56, 7, 6))
    pygame.draw.rect(s, BONE[1], (bx + 2, 61, 3, 2))
    s.set_at((bx + 2, 58), EYE if fury else (20, 10, 14))
    s.set_at((bx + 4, 58), EYE if fury else (20, 10, 14))
    # застёжки и полы камзола
    for y in (66, 72, 78):
        s.set_at((cx, y), BONE[3])
        s.set_at((cx + 1, y), BONE[1])
    line(s, ARMOR[0], (cx + 2, 62), (cx + 4, 87))
    line(s, ARMOR[3], (cx - 1, 62), (cx - 3, 87))
    for x0, x1 in ((38, 37), (44, 42), (54, 57)):  # складки полы
        line(s, ARMOR[2], (x0 + L // 2, 63), (x1, 85))
        line(s, ARMOR[0], (x0 + 1 + L // 2, 64), (x1 + 1, 85))
    for y in range(64, 86, 7):  # серебряная вышивка по краю полы
        s.set_at((cx - 4, y), (120, 116, 130))
        s.set_at((cx - 5, y + 1), (80, 76, 92))
    # цепь тыквенных фонариков на поясе
    pts = [(56, 61), (58, 65), (59, 70), (58, 75)]
    for a, b in zip(pts, pts[1:]):
        line(s, (150, 150, 160), a, b)
    for px, py in ((58, 66), (58, 76)):
        pygame.draw.ellipse(s, (150, 64, 12), (px - 3, py - 2, 7, 6))
        pygame.draw.ellipse(s, (236, 120, 30), (px - 2, py - 2, 5, 5))
        s.set_at((px - 1, py), (255, 230, 120))
        s.set_at((px + 1, py), (255, 230, 120))
        line(s, (255, 200, 80), (px - 1, py + 2), (px + 1, py + 2))
        s.set_at((px, py - 3), (60, 90, 30))


def claws(s, hand, direction, spread=1.0, long=7):
    """Длинные пальцы с когтями веером в направлении direction (радианы)."""
    pygame.draw.circle(s, SKIN[1], hand, 3)  # костлявая кисть
    s.set_at((hand[0] - 1, hand[1] - 2), SKIN[3])
    for k in (-2, -1, 0, 1, 2):
        a = direction + k * 0.24 * spread
        ln = long - abs(k) * 1.2
        kn = (hand[0] + math.cos(a) * ln * 0.6, hand[1] + math.sin(a) * ln * 0.6)
        tip = (hand[0] + math.cos(a + 0.12) * ln, hand[1] + math.sin(a + 0.12) * ln)
        line(s, SKIN[1], hand, kn)
        s.set_at((round(kn[0]), round(kn[1])), SKIN[0])  # сустав
        line(s, BONE[3], kn, tip)
        s.set_at((round(tip[0]), round(tip[1])), (120, 20, 30))  # кончик в крови


def arm(s, shoulder, elbow, hand, front=True):
    """Рука в длинном рукаве: плечо → локоть → кисть, рукав расширяется к запястью рваным краем."""
    sx, sy = shoulder
    ex, ey = elbow
    hx, hy = hand
    pts = [(sx - 3, sy - 2), (sx + 3, sy + 2), (ex + 2, ey + 2), (hx + 4, hy + 1), (hx - 1, hy + 4), (ex - 2, ey - 2)]
    part(s, ARMOR if front else CAPE, poly(pts), rim=not front)
    line(s, ARMOR[3] if front else CAPE[3], (sx - 2, sy - 1), (ex - 1, ey - 1))  # складка рукава на свету
    line(s, LINING[1], (hx + 4, hy + 2), (hx - 1, hy + 4))  # багровая манжета
    s.set_at((hand[0] - 1, hand[1] - 1), SKIN[2])


def collar(s, hx, hy):
    """Высокий стоячий воротник из серого меха: шипы обрамляют голову сзади, мех лежит на плечах."""
    spikes = [(hx - 10, hy + 36), (hx - 15, hy + 18), (hx - 6, hy + 27), (hx - 9, hy + 6), (hx + 1, hy + 26),
              (hx + 18, hy + 27), (hx + 27, hy + 9), (hx + 26, hy + 24), (hx + 37, hy + 12), (hx + 32, hy + 28),
              (hx + 42, hy + 24), (hx + 38, hy + 38)]
    m = part(s, FUR, poly(spikes + [(hx + 30, hy + 42), (hx + 4, hy + 42)]), rim=True)
    for (x0, y0), (x1, y1) in zip(spikes[1::2], spikes[2::2]):  # пряди вдоль шипов
        line(s, FUR[3], (x0 + 1, y0 + 3), ((x0 + x1) // 2, (y0 + y1) // 2 + 2))
        line(s, FUR[0], (x0 + 3, y0 + 6), ((x0 + x1) // 2 + 2, (y0 + y1) // 2 + 6))
    rnd = random.Random(7)  # фактура меха: короткие пряди вниз по всей мантии
    for _ in range(70):
        x, y = rnd.randrange(hx - 8, hx + 38), rnd.randrange(hy + 26, hy + 42)
        if m.get_at((x, y)) and m.get_at((x, min(H - 1, y + 2))):
            line(s, rnd.choice((FUR[0], FUR[2], FUR[3], FUR[0])), (x, y), (x + rnd.choice((-1, 0, 1)), y + 2))
    for x in (hx + 2, hx + 9, hx + 17, hx + 25):  # мех на плечах: неровные клочья
        line(s, FUR[2], (x, hy + 34), (x - 1, hy + 39))
        line(s, FUR[0], (x + 2, hy + 35), (x + 3, hy + 40))


def head(s, hx, hy, pose, fury):
    """Голова: вытянутый лысый череп, уши-крылья назад, глазницы, нос крючком, пасть с клыками."""
    skin = SKIN_F if fury else SKIN
    bite = pose == "bite"
    # дальнее ухо (за черепом) и ближнее
    part(s, skin, poly([(hx + 14, hy + 6), (hx + 34, hy - 4), (hx + 28, hy + 4), (hx + 30, hy + 8), (hx + 20, hy + 14)]))
    line(s, (120, 70, 80), (hx + 18, hy + 8), (hx + 31, hy - 2))  # прожилки уха
    # череп: высокий купол и челюсть клином вниз
    jaw_drop = 6 if bite else 0
    skull = many(ell((hx, hy - 3, 19, 24)), poly([(hx + 1, hy + 10), (hx + 18, hy + 12), (hx + 14, hy + 26 + jaw_drop),
                                               (hx + 6, hy + 28 + jaw_drop), (hx + 1, hy + 22 + jaw_drop)]))
    part(s, skin, skull)
    # вены на черепе
    for pts in (((hx + 8, hy + 2), (hx + 11, hy + 5), (hx + 10, hy + 9)), ((hx + 14, hy + 3), (hx + 16, hy + 7)),
                ((hx + 4, hy + 4), (hx + 5, hy + 7))):
        pygame.draw.lines(s, (90, 70, 110) if not fury else (180, 30, 40), False, pts)
    # ближнее ухо: огромное, острое, назад-вверх
    ear = [(hx + 11, hy + 9), (hx + 14, hy + 3), (hx + 30, hy - 9), (hx + 25, hy + 1), (hx + 28, hy + 5), (hx + 20, hy + 10), (hx + 17, hy + 16)]
    part(s, skin, poly(ear))
    pygame.draw.polygon(s, (110, 64, 74) if not fury else (150, 40, 50), [(hx + 15, hy + 7), (hx + 26, hy - 4), (hx + 19, hy + 9)])  # внутренняя сторона уха
    line(s, skin[3], (hx + 14, hy + 3), (hx + 29, hy - 8))
    line(s, skin[0], (hx + 20, hy + 10), (hx + 17, hy + 15))
    # нависшая бровь и глубокие глазницы
    line(s, skin[0], (hx + 1, hy + 9), (hx + 11, hy + 10), 2)
    line(s, skin[3], (hx + 1, hy + 8), (hx + 10, hy + 8))
    for ex in (hx + 2, hx + 8):
        pygame.draw.ellipse(s, skin[0], (ex - 1, hy + 10, 6, 5))  # тень глазницы
        pygame.draw.rect(s, (20, 6, 10), (ex, hy + 11, 4, 3))
        s.set_at((ex + 1, hy + 12), EYE)
        s.set_at((ex + 2, hy + 12), EYE_CORE if fury else EYE)
        s.set_at((ex + 1, hy + 11), (120, 10, 14))
    # морщины лба, впалые щёки, скулы
    line(s, skin[0], (hx + 3, hy + 5), (hx + 8, hy + 6))
    line(s, skin[0], (hx + 12, hy + 14), (hx + 11, hy + 21 + jaw_drop // 2))
    line(s, skin[3], (hx + 8, hy + 15), (hx + 12, hy + 16))  # скула
    line(s, skin[0], (hx + 6, hy + 17), (hx + 9, hy + 20))  # провал щеки
    # нос крючком
    pygame.draw.polygon(s, skin[1], [(hx + 1, hy + 13), (hx - 3, hy + 18), (hx + 1, hy + 19), (hx + 3, hy + 16)])
    line(s, skin[3], (hx, hy + 14), (hx - 2, hy + 17))
    s.set_at((hx, hy + 18), skin[0])
    # пасть
    my = hy + 21
    if bite:  # раскрыта: ряды игл и язык
        pygame.draw.polygon(s, MAW, [(hx - 1, my - 1), (hx + 11, my - 1), (hx + 10, my + 8), (hx + 1, my + 9)])
        pygame.draw.ellipse(s, (150, 30, 50), (hx + 2, my + 5, 6, 3))
        for x in range(hx, hx + 11, 2):  # верхние клыки
            ln = 4 if x in (hx, hx + 8) else 2
            line(s, BONE[3], (x, my - 1), (x, my - 1 + ln))
        for x in range(hx + 1, hx + 10, 2):  # нижние
            line(s, BONE[2], (x, my + 8), (x, my + 6))
    else:
        line(s, MAW, (hx - 1, my), (hx + 10, my + 1))
        line(s, skin[0], (hx + 1, my + 2), (hx + 9, my + 3))
        for x, ln in ((hx, 4), (hx + 3, 2), (hx + 6, 2), (hx + 8, 4)):  # клыки поверх губы
            line(s, BONE[3], (x, my), (x, my + ln))
            s.set_at((x, my + ln), BONE[1])
    if fury or bite:  # кровь стекает по подбородку
        for x, ln in ((hx + 1, 5), (hx + 7, 3)):
            line(s, (170, 10, 24), (x, my + 3 + jaw_drop), (x, my + 3 + jaw_drop + ln))
            s.set_at((x, my + 4 + jaw_drop + ln), (230, 40, 50))


def glow(s, pts, col=(255, 40, 40), a=90):
    """Свечение вокруг глаз — полупрозрачный ореол поверх контура."""
    halo = pygame.Surface((W, H), pygame.SRCALPHA)
    for x, y in pts:
        pygame.draw.circle(halo, (*col, a // 2), (x, y), 3)
        pygame.draw.circle(halo, (*col, a), (x, y), 1)
    s.blit(halo, (0, 0))


# ---------------------------------------------------------------- поза целиком
def vampire(pose="idle", sway=0, fury=False):
    """pose: idle, raised (когти вскинуты), slash (взмах когтями), bite (бросок с раскрытой пастью),
    swarm (плащ распахнут крыльями)."""
    s = pygame.Surface((W, H), pygame.SRCALPHA)
    lean = {"bite": -10, "slash": -5}.get(pose, 0)
    breath = sway if pose == "idle" else 0
    hx, hy = 30 + lean, 3 + breath + (8 if pose == "bite" else 0)
    cape_back(s, pose, sway)
    boots(s, lean)
    # дальняя рука держит край плаща
    if pose != "swarm":
        arm(s, (58, 36), (64, 50), (66, 60), front=False)
        claws(s, (66, 61), math.pi / 2, 0.7, 8)
    coat(s, lean, fury)
    collar(s, hx, hy)
    head(s, hx, hy, pose, fury)
    # ближняя рука
    sh = (38 + lean, 38 + breath)
    if pose == "raised":
        arm(s, sh, (28, 22), (22, 6))
        claws(s, (22, 5), -math.pi / 2 - 0.4, 1.3, 12)
    elif pose == "slash":
        arm(s, sh, (22, 40), (6, 46))
        claws(s, (6, 46), math.pi + 0.15, 1.2, 12)
    elif pose == "bite":
        arm(s, sh, (24, 50), (14, 56))
        claws(s, (13, 57), math.pi * 0.8, 1.0, 11)
    elif pose == "swarm":
        arm(s, sh, (24, 30), (10, 22))
        claws(s, (9, 21), -math.pi * 0.85, 1.4, 11)
    else:
        arm(s, sh, (30, 50), (26, 62 + breath))
        claws(s, (26, 63 + breath), math.pi / 2 + 0.25, 1.0, 12)
    out = outlined(s, (4, 2, 6))
    eyes = [(hx + 3, hy + 12), (hx + 9, hy + 12)]  # (голова поднята — глаза там же относительно черепа)
    glow(out, eyes, (255, 60, 40) if fury else (255, 30, 30), 130 if fury else 90)
    if pose == "slash":  # след когтей: три алые дуги
        for k in range(3):
            pygame.draw.arc(out, (255, 80 + k * 40, 90 + k * 30), (-6 + k * 2, 30 + k * 4, 26, 30), math.pi * 0.55, math.pi * 1.2)
    return out


def make_vampire_frames():
    idle, idle2 = vampire("idle", 0), vampire("idle", 1)
    raised = vampire("raised")
    blood = (255, 30, 40)
    swarm = vampire("swarm")
    frames = {
        "idle": [idle, idle2],
        "windup": [tinted(raised, blood, 0.22), raised],
        "attack": [vampire("slash")],
        "hurt": [tinted(idle, (255, 255, 255), 0.8)],
        "dead": [crouched(tinted(idle, (40, 30, 40), 0.55))],
        "enraged": [vampire("idle", 0, True), vampire("idle", 1, True)],
        "bite": [vampire("bite", 0, False)],
        "swarm": [swarm, tinted(swarm, blood, 0.15)],
    }
    mist = []
    for src, a in ((idle, 150), (idle2, 100)):  # туман: полупрозрачный лиловый силуэт
        t = tinted(src, (150, 110, 190), 0.75)
        m = pygame.Surface(t.get_size(), pygame.SRCALPHA)
        for y in range(t.get_height()):
            for x in range(t.get_width()):
                c = t.get_at((x, y))
                if c.a:
                    m.set_at((x, y), (c.r, c.g, c.b, a))
        mist.append(m)
    frames["mist"] = mist
    return frames
