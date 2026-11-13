"""Морской поход: палуба корабля в штормовом море, Утопленник, Краб-громила, голова Кракена (щупальца
рисует игра — они живые), сундук моря, Меч Прилива и облик «Новый пират» (жилетка и треуголка поверх брони).

Объём — светотенью по маске каждой детали: свет сверху-слева, тень снизу-справа, холодный отсвет моря справа.
Враги смотрят влево, на героя.
"""
import math
import random

import pygame

from game.abyss import outlined
from game.art import _lerp, crouched, shifted_breath, tinted

SEA_RIM = (110, 190, 210)


def _mix(a, b, k):
    return tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(3))


def _run(m, w, h, x, y, dx, dy, cap=6):
    for k in range(1, cap + 1):
        nx, ny = x + dx * k, y + dy * k
        if not (0 <= nx < w and 0 <= ny < h) or not m.get_at((nx, ny)):
            return k
    return cap + 1


def part(s, pal, draw, rim=True, soft=False, rimcol=SEA_RIM):
    """Деталь по маске: блик и свет к свету (вверх-влево), тень снизу-справа, отсвет моря по правому краю."""
    w, h = s.get_size()
    t = pygame.Surface((w, h), pygame.SRCALPHA)
    draw(t)
    m = pygame.mask.from_surface(t)
    for y in range(h):
        for x in range(w):
            if not m.get_at((x, y)):
                continue
            dl = min(_run(m, w, h, x, y, -1, -1), _run(m, w, h, x, y, 0, -1) + 1)
            dd = min(_run(m, w, h, x, y, 1, 1), _run(m, w, h, x, y, 0, 1) + 1)
            chk = (x + y) % 2
            if dl <= 1 and not soft:
                c = pal[3]
            elif dl <= 2 or (dl == 3 and chk):
                c = pal[2]
            elif dd <= 1 or (dd == 2 and chk):
                c = pal[0]
            else:
                c = pal[1]
            if rim and _run(m, w, h, x, y, 1, 0) == 1 and _run(m, w, h, x, y, 1, -1) <= 2:
                c = _mix(c, rimcol, 0.45)
            s.set_at((x, y), c)
    return m


def poly(pts):
    return lambda t: pygame.draw.polygon(t, (255, 255, 255), [(round(x), round(y)) for x, y in pts])


def ell(r):
    return lambda t: pygame.draw.ellipse(t, (255, 255, 255), r)


def many(*fns):
    def d(t):
        for f in fns:
            f(t)
    return d


def line(s, col, a, b, w=1):
    pygame.draw.line(s, col, (round(a[0]), round(a[1])), (round(b[0]), round(b[1])), w)


# ---------------------------------------------------------------- фон: палуба в штормовом море
def make_sea_background(w=320, h=180, seed=77):
    """Палуба корабля на закате перед штормом: небо в тучах с прорехой света, море до горизонта с барашками,
    дальний борт с фальшбортом (за ним поднимется Кракен), мачта со свёрнутым парусом и вантами слева,
    бочки и канаты, доски палубы."""
    rnd = random.Random(seed)
    surf = pygame.Surface((w, h))
    horizon = 92
    stops = [(0.0, (16, 22, 40)), (0.5, (40, 54, 78)), (0.85, (120, 96, 92)), (1.0, (196, 140, 98))]
    for y in range(horizon):
        t = y / (horizon - 1)
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                pygame.draw.line(surf, _lerp(c0, c1, (t - t0) / (t1 - t0)), (0, y), (w, y))
                break
    clouds = pygame.Surface((w, h), pygame.SRCALPHA)  # тяжёлые тучи
    for _ in range(40):
        cx, cy = rnd.randrange(-40, w), rnd.randrange(0, 70)
        col = rnd.choice([(24, 30, 48, 170), (36, 42, 62, 150), (58, 60, 80, 120)])
        pygame.draw.ellipse(clouds, col, (cx, cy, rnd.randint(40, 110), rnd.randint(8, 18)))
    surf.blit(clouds, (0, 0))
    glow = pygame.Surface((w, h), pygame.SRCALPHA)  # прореха заката
    for r, a in ((60, 30), (40, 40), (22, 60)):
        pygame.draw.ellipse(glow, (255, 190, 120, a), (220 - r, horizon - 10 - r // 3, r * 2, r // 1.5))
    surf.blit(glow, (0, 0))
    # море: тёмная синева, отблески, барашки
    for y in range(horizon, h):
        t = (y - horizon) / (h - horizon)
        pygame.draw.line(surf, _lerp((40, 70, 96), (8, 22, 40), t), (0, y), (w, y))
    for _ in range(260):
        x, y = rnd.randrange(w), rnd.randrange(horizon + 1, 124)
        ln = rnd.randint(2, 8)
        col = rnd.choice([(80, 120, 140), (60, 96, 120), (200, 170, 140)]) if y < horizon + 10 else rnd.choice([(30, 60, 84), (70, 110, 130), (160, 200, 210)])
        pygame.draw.line(surf, col, (x, y), (x + ln, y))
    # дальний борт: фальшборт с поручнем и стойками (за ним — море и Кракен)
    rail_y = 112
    pygame.draw.rect(surf, (70, 44, 28), (0, rail_y, w, 22))
    for y in range(rail_y, rail_y + 22, 4):
        pygame.draw.line(surf, (54, 34, 22), (0, y), (w, y))
    pygame.draw.rect(surf, (120, 80, 48), (0, rail_y - 3, w, 4))  # поручень
    pygame.draw.line(surf, (160, 112, 68), (0, rail_y - 3), (w, rail_y - 3))
    for x in range(6, w, 26):  # стойки
        pygame.draw.rect(surf, (90, 58, 34), (x, rail_y - 1, 3, 23))
        pygame.draw.line(surf, (140, 96, 58), (x, rail_y - 1), (x, rail_y + 21))
    # палуба: доски в перспективе
    deck = 134
    for y in range(deck, h):
        t = (y - deck) / (h - deck)
        pygame.draw.line(surf, _lerp((132, 92, 56), (70, 46, 28), t), (0, y), (w, y))
    for y in (deck, deck + 7, deck + 16, deck + 28, deck + 42):
        if y < h:
            pygame.draw.line(surf, (60, 38, 22), (0, y), (w, y))
    for i in range(-10, 30):
        x0 = i * 22
        pygame.draw.line(surf, (88, 58, 34), (x0, deck), (x0 - 30, h))
    for _ in range(140):  # волокна и гвозди
        x, y = rnd.randrange(w), rnd.randrange(deck + 1, h)
        surf.set_at((x, y), rnd.choice([(150, 108, 66), (96, 62, 36), (60, 40, 26)]))
    # мачта слева: ствол, рея со свёрнутым парусом, ванты и фонарь
    pygame.draw.rect(surf, (74, 48, 30), (26, 0, 9, deck))
    pygame.draw.line(surf, (130, 90, 56), (27, 0), (27, deck))
    pygame.draw.line(surf, (44, 28, 18), (34, 0), (34, deck))
    pygame.draw.rect(surf, (80, 52, 32), (0, 22, 80, 5))
    pygame.draw.ellipse(surf, (196, 180, 150), (2, 18, 74, 12))  # свёрнутый парус
    pygame.draw.ellipse(surf, (150, 136, 110), (8, 24, 62, 6))
    for k in range(5):
        line(surf, (40, 30, 24), (31, 30), (48 + k * 18, deck - 2))  # ванты
    for k in range(4):
        line(surf, (52, 40, 30), (40 + k * 18, 70 + k * 12), (58 + k * 18, 70 + k * 12))
    pygame.draw.rect(surf, (40, 30, 24), (36, 60, 6, 9))  # фонарь
    pygame.draw.rect(surf, (255, 200, 110), (37, 62, 4, 5))
    halo = pygame.Surface((w, h), pygame.SRCALPHA)
    pygame.draw.circle(halo, (255, 190, 100, 34), (39, 64), 18)
    surf.blit(halo, (0, 0))
    # бочки и бухта каната у мачты
    for bx in (4, 52):
        pygame.draw.ellipse(surf, (96, 60, 34), (bx, deck - 4, 18, 22))
        pygame.draw.ellipse(surf, (140, 96, 56), (bx + 2, deck - 3, 14, 6))
        for yy in (deck + 2, deck + 10):
            pygame.draw.line(surf, (60, 60, 70), (bx + 1, yy), (bx + 16, yy))
    pygame.draw.ellipse(surf, (170, 140, 96), (70, deck + 6, 18, 8))
    pygame.draw.ellipse(surf, (120, 96, 64), (74, deck + 8, 10, 4))
    # брызги над бортом
    for _ in range(40):
        x, y = rnd.randrange(80, w), rnd.randrange(rail_y - 10, rail_y)
        surf.set_at((x, y), (210, 230, 240))
    return surf


# ---------------------------------------------------------------- Утопленник
SKIN = [(46, 70, 66), (86, 120, 104), (128, 160, 136), (176, 200, 176)]
SHIRT = [(40, 46, 70), (70, 80, 110), (196, 196, 210), (236, 236, 244)]


def drowned(pose="idle", frame=0):
    """Утопленник-матрос: раздутая бледно-зелёная кожа, полосатая тельняшка в лохмотьях, водоросли, бандана."""
    s = pygame.Surface((30, 40), pygame.SRCALPHA)
    lean = {"windup": 2, "attack": -5}.get(pose, 0)
    # ноги в рваных штанах
    part(s, [(30, 30, 40), (54, 52, 66), (80, 78, 94), (110, 108, 124)], many(poly([(10, 26), (15, 26), (14, 39), (10, 39)]), poly([(16, 26), (21, 26), (21, 39), (17, 39)])), rim=False)
    # тельняшка: полосы
    part(s, SHIRT, poly([(8 + lean, 13), (22 + lean, 13), (23, 28), (8, 28)]))
    for y in range(15, 28, 3):
        line(s, (40, 50, 96), (8 + lean * (28 - y) // 15, y), (23, y))
    for x, y in ((9, 27), (14, 28), (19, 27)):  # рваный край
        s.set_at((x, y), (0, 0, 0, 0))
    # голова: раздутая, с банданой
    hx = 9 + lean
    part(s, SKIN, ell((hx, 1 + frame, 13, 13)))
    part(s, [(120, 20, 24), (170, 40, 40), (210, 70, 60), (240, 120, 100)], poly([(hx - 1, 3 + frame), (hx + 13, 3 + frame), (hx + 12, 7 + frame), (hx, 7 + frame)]), rim=False)
    pygame.draw.polygon(s, (170, 40, 40), [(hx + 13, 5 + frame), (hx + 17, 7 + frame), (hx + 14, 9 + frame)])  # узел
    for ex in (hx + 2, hx + 7):  # мутные глаза
        pygame.draw.rect(s, (220, 230, 200), (ex, 8 + frame, 3, 2))
        s.set_at((ex + 1, 8 + frame), (60, 80, 70))
    line(s, (30, 40, 36), (hx + 2, 12 + frame), (hx + 8, 12 + frame))  # рот
    # водоросли с плеча и с головы
    for x0, y0, ln in ((hx + 11, 4 + frame, 9), (21, 14, 12), (9, 16, 8)):
        for k in range(ln):
            s.set_at((x0 + (k % 3 == 0), y0 + k), (40, 110, 60) if k % 2 else (70, 150, 80))
    # руки: тянется вперёд
    if pose == "attack":
        part(s, SKIN, poly([(8, 15), (11, 15), (0, 20), (0, 17)]))
    elif pose == "windup":
        part(s, SKIN, poly([(8, 15), (11, 15), (6, 3), (3, 4)]))
    else:
        part(s, SKIN, poly([(8, 15), (11, 15), (6, 26), (3, 25)]))
    # капли
    for x, y in ((12 + lean, 15 + frame), (20, 22), (6, 30)):
        s.set_at((x, y), (160, 210, 230))
    return outlined(s, (6, 10, 14))


def make_drowned_frames():
    idle, idle2 = drowned("idle", 0), drowned("idle", 1)
    up = drowned("windup")
    return {"idle": [idle, idle2], "windup": [tinted(up, (120, 220, 255), 0.3), up], "attack": [drowned("attack")],
            "hurt": [tinted(idle, (255, 255, 255), 0.8)], "dead": [crouched(tinted(idle, (30, 50, 60), 0.5))]}


# ---------------------------------------------------------------- Краб-громила
SHELL = [(78, 14, 16), (150, 38, 30), (204, 78, 50), (248, 150, 110)]
SHELL_D = [(52, 10, 14), (104, 26, 24), (150, 52, 40), (196, 100, 80)]  # дальняя сторона — в тени
BELLY = (240, 206, 170)
BARNACLE = [(70, 70, 70), (150, 146, 136), (200, 196, 184), (236, 232, 222)]
CRAB_W, CRAB_H = 82, 46


def _leg(s, pal, hip, knee, tip, w=3):
    """Членистая нога «домиком»: бедро вверх-наружу к колену, голень вниз к острому светлому кончику."""
    line(s, pal[0], hip, knee, w + 1)
    line(s, pal[1], hip, knee, w)
    line(s, pal[2], (hip[0], hip[1] - 1), (knee[0], knee[1] - 1))
    line(s, pal[0], knee, tip, w - 1)
    line(s, pal[1], knee, tip, 1)
    pygame.draw.circle(s, pal[2], (round(knee[0]), round(knee[1])), 2)
    s.set_at((round(knee[0]), round(knee[1]) - 2), pal[3])
    s.set_at((round(tip[0]), round(tip[1])), BELLY)
    s.set_at((round(tip[0]), round(tip[1]) - 1), pal[3])


def _chela(s, pal, cx, cy, size, opened, flip=False):
    """Клешня: мощная ладонь с буграми и два пальца с белыми зубьями; кончики смотрят вверх-наружу."""
    d = -1 if not flip else 1
    part(s, pal, ell((cx - size, cy - size + 2, size * 2, size * 2 - 2)))
    for kx, ky in ((-size // 2, -1), (0, size // 3), (size // 3, -size // 3)):
        s.set_at((cx + kx, cy + ky), pal[3])
        s.set_at((cx + kx + 1, cy + ky + 1), pal[0])
    L = size + 3
    lo = poly([(cx + d * (size - 3), cy - 1), (cx + d * (size + L - 4), cy - size - 1), (cx + d * (size + L - 2), cy - size + 2), (cx + d * (size - 1), cy + 3)])
    hi = poly([(cx + d * (size - 5), cy - size + 3), (cx + d * (size + L - 8 - opened), cy - size - L // 2 - opened), (cx + d * (size + L - 5 - opened), cy - size - L // 2 + 2 - opened), (cx + d * (size - 2), cy - size + 6)])
    part(s, pal, lo, rim=False)
    part(s, pal, hi, rim=False)
    for k in range(3):  # зубья по внутреннему краю
        s.set_at((cx + d * (size + k * 2), cy - 3 - k * 2), BELLY)
        s.set_at((cx + d * (size - 2 + k * 2 - opened // 2), cy - size + 2 - k * 2 - opened // 2), BELLY)


def crab(pose="idle", frame=0):
    """Краб-громила анфас: широкий бугристый панцирь с шипами и зубчатым краем, ракушки и водоросли,
    по четыре членистые ноги «домиком» с каждой стороны, глаза на стебельках, ротовые пластины с пузырями,
    малая клешня справа и огромная клешня-кувалда слева (к герою). windup — кувалда взлетает и раскрывается,
    attack — опускается ударом."""
    s = pygame.Surface((CRAB_W, CRAB_H), pygame.SRCALPHA)
    b = frame
    cx0, top = 44, 18 + b  # центр панциря
    # ноги правой стороны (дальние, в тени) и левой (ближние): колено высоко, кончик далеко наружу
    for k in (3, 2, 1, 0):
        _leg(s, SHELL_D, (cx0 + 12, top + 4 + k * 2), (cx0 + 18 + k * 5, top - 10 + k * 4), (cx0 + 22 + k * 6, CRAB_H - 1), 2)
    for k in (3, 2, 1, 0):
        _leg(s, SHELL, (cx0 - 12, top + 4 + k * 2), (cx0 - 18 - k * 5, top - 10 + k * 4), (cx0 - 22 - k * 6, CRAB_H - 1), 2)
    # малая клешня справа
    line(s, SHELL_D[0], (cx0 + 14, top + 10), (cx0 + 20, top + 4), 4)
    line(s, SHELL_D[1], (cx0 + 14, top + 10), (cx0 + 20, top + 4), 2)
    _chela(s, SHELL_D, cx0 + 23, top + 1, 4, 0, flip=True)
    # панцирь: широкий овал с выпуклым лбом
    part(s, SHELL, many(ell((cx0 - 18, top - 4, 36, 18)), ell((cx0 - 14, top - 7, 28, 10))))
    pygame.draw.ellipse(s, BELLY, (cx0 - 12, top + 10, 24, 5))  # светлое брюхо из-под панциря
    for x in range(cx0 - 9, cx0 + 10, 3):
        s.set_at((x, top + 12), (196, 150, 120))
    # бороздки: «маска» и рёбра
    pygame.draw.arc(s, SHELL[0], (cx0 - 10, top - 3, 20, 12), math.pi * 1.05, math.pi * 1.95)
    for dx in (-12, -6, 6, 12):
        line(s, SHELL[0], (cx0 + dx, top - 2), (cx0 + dx * 1.3, top + 6))
    line(s, SHELL[0], (cx0, top - 6), (cx0, top + 2))
    # зубчатый край по бокам
    for side in (-1, 1):
        for k in range(4):
            x, y = cx0 + side * (16 + k % 2), top + k * 3 - 2
            pygame.draw.polygon(s, SHELL[2], [(x, y), (x + side * 4, y + 1), (x, y + 2)])
            s.set_at((x + side * 4, y + 1), SHELL[3])
    # шипы по верху
    for dx, h in ((-10, 3), (-4, 5), (4, 5), (10, 3)):
        x = cx0 + dx
        pygame.draw.polygon(s, SHELL[2], [(x - 2, top - 5), (x, top - 5 - h), (x + 2, top - 5)])
        s.set_at((x, top - 5 - h), SHELL[3])
    # крапины, ракушки и водоросль
    rnd = random.Random(11)
    for _ in range(22):
        x, y = rnd.randrange(cx0 - 16, cx0 + 16), rnd.randrange(top - 5, top + 9)
        if s.get_at((x, y)).a and s.get_at((x, y))[:3] in (SHELL[1], SHELL[2]):
            s.set_at((x, y), SHELL[0] if rnd.random() < 0.6 else SHELL[3])
    for bx, by, r in ((cx0 + 9, top - 3, 3), (cx0 + 14, top + 2, 2), (cx0 + 4, top - 5, 2)):
        pygame.draw.circle(s, BARNACLE[1], (bx, by), r)
        pygame.draw.circle(s, BARNACLE[3], (bx - 1, by - 1), max(1, r - 1))
        s.set_at((bx, by), BARNACLE[0])
    for k in range(10):
        s.set_at((cx0 + 17 + (k % 3 == 1), top + 4 + k), (40, 120, 70) if k % 2 else (80, 170, 90))
    # глаза на стебельках
    for dx in (-5, 5):
        x = cx0 + dx
        line(s, SHELL[0], (x, top - 4), (x + dx // 5, top - 12), 3)
        line(s, SHELL[2], (x, top - 4), (x + dx // 5, top - 12))
        ex, ey = x + dx // 5, top - 13
        pygame.draw.circle(s, (14, 6, 10), (ex, ey), 3)
        s.set_at((ex - 1, ey - 1), (255, 255, 255))
        s.set_at((ex, ey - 1), (170, 190, 220))
    # «злая» бровь-гребень над глазами и ротовые пластины
    line(s, SHELL[0], (cx0 - 8, top - 6), (cx0 - 2, top - 4))
    line(s, SHELL[0], (cx0 + 8, top - 6), (cx0 + 2, top - 4))
    pygame.draw.rect(s, SHELL[0], (cx0 - 4, top + 5, 8, 5))
    for x in range(cx0 - 3, cx0 + 4, 2):
        line(s, SHELL[3], (x, top + 6), (x, top + 8))
    for bx, by in ((cx0 - 2, top + 1 - frame), (cx0 + 1, top - 2 - frame)):
        pygame.draw.circle(s, (190, 235, 255), (bx, by), 1)
    # клешня-кувалда слева: плечо, запястье и огромная ладонь
    up = {"windup": -12, "attack": 8}.get(pose, 0)
    hx, hy = 16, top - 3 + up
    line(s, SHELL[0], (cx0 - 14, top + 8), (hx + 6, hy + 6), 6)
    line(s, SHELL[1], (cx0 - 14, top + 8), (hx + 6, hy + 6), 4)
    line(s, SHELL[2], (cx0 - 14, top + 6), (hx + 6, hy + 4))
    pygame.draw.circle(s, SHELL[2], (hx + 6, hy + 6), 3)
    s.set_at((hx + 5, hy + 4), SHELL[3])
    _chela(s, SHELL, hx, hy, 9, 5 if pose == "windup" else 0)
    if pose == "attack":  # удар: щепки и брызги
        for x, y in ((2, CRAB_H - 2), (6, CRAB_H - 4), (12, CRAB_H - 2), (0, CRAB_H - 6)):
            s.set_at((x, y), (255, 230, 190))
    return outlined(s, (20, 6, 6))


def make_crab_frames():
    idle, idle2 = crab("idle", 0), crab("idle", 1)
    w = crab("windup")
    return {"idle": [idle, idle2], "windup": [tinted(w, (255, 200, 120), 0.25), w], "attack": [crab("attack")],
            "hurt": [tinted(idle, (255, 255, 255), 0.8)], "dead": [pygame.transform.flip(tinted(idle, (60, 40, 40), 0.5), False, True)]}


# ---------------------------------------------------------------- Нага: морская змея-воительница
NG_W, NG_H = 56, 66
TAIL = [(8, 44, 58), (18, 100, 108), (50, 160, 152), (160, 236, 214)]
SCUTE = [(150, 110, 50), (214, 176, 96), (244, 214, 146), (255, 244, 200)]
NSKIN = [(64, 110, 120), (114, 168, 168), (168, 210, 200), (222, 244, 234)]
HAIR = [(36, 12, 56), (88, 30, 112), (150, 64, 170), (226, 140, 230)]
NGOLD = [(120, 80, 20), (200, 150, 50), (240, 200, 90), (255, 240, 170)]


def _spine(pts, r0, r1):
    """Тело змеи как ряд кругов вдоль ломаной: толщина плавно от r0 к r1."""
    def d(t):
        n = len(pts) - 1
        for i in range(n):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            steps = max(1, int(math.hypot(x1 - x0, y1 - y0)))
            for k in range(steps + 1):
                u = (i + k / steps) / n
                pygame.draw.circle(t, (255, 255, 255), (round(x0 + (x1 - x0) * k / steps), round(y0 + (y1 - y0) * k / steps)), max(1, round(r0 + (r1 - r0) * u)))
    return d


def naga(pose="idle", frame=0):
    """Нага: бирюзовый змеиный хвост S-образным кольцом с золотыми брюшными щитками и плавником,
    стройный торс цвета морской волны в золотом чешуйчатом нагруднике, длинные фиолетовые волосы волнами
    до пояса, ухо-плавник, тиара с жемчужиной и золотой трезубец. Смотрит влево.
    pose: idle, windup (трезубец отведён), attack (выпад), song (песня сирены)."""
    s = pygame.Surface((NG_W, NG_H), pygame.SRCALPHA)
    sw = frame
    lean = {"windup": 3, "attack": -4, "song": 1}.get(pose, 0)
    cx = 30 + lean  # ось торса
    # хвост: от бёдер вниз-вправо, по палубе влево и кончик вверх
    tail = [(cx, 36), (cx + 4, 44), (40, 52), (44, 58), (40, 62), (28, 63), (16, 62), (8, 59), (5, 54), (7, 49 - sw)]
    fin = pygame.Surface((NG_W, NG_H), pygame.SRCALPHA)  # плавник вдоль спины хвоста
    for (x0, y0), (x1, y1) in zip(tail[1:4], tail[2:5]):
        pygame.draw.polygon(fin, (110, 220, 230, 150), [(x0 + 3, y0), (x1 + 3, y1), ((x0 + x1) // 2 + 8, (y0 + y1) // 2 - 2)])
        line(fin, (200, 250, 255, 200), (x0 + 3, y0), ((x0 + x1) // 2 + 8, (y0 + y1) // 2 - 2))
    s.blit(fin, (0, 0))
    part(s, TAIL, _spine(tail, 7, 2), rimcol=(170, 240, 255))
    # чешуя: ряды полукружий
    m = pygame.mask.from_surface(s)
    for y in range(38, NG_H):
        for x in range(NG_W):
            if m.get_at((x, y)) and ((x + (y // 2) * 2) % 4 == 0) and y % 2 == 0:
                c = s.get_at((x, y))[:3]
                if c == TAIL[1]:
                    s.set_at((x, y), TAIL[0])
                elif c == TAIL[2]:
                    s.set_at((x, y), TAIL[1])
    # золотые брюшные щитки по внутренней (нижней-левой) стороне
    for (x0, y0), (x1, y1) in zip(tail[2:8], tail[3:9]):
        n = max(2, int(math.hypot(x1 - x0, y1 - y0)))
        for k in range(n):
            x, y = x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n
            dx, dy = (y1 - y0) / n, -(x1 - x0) / n  # нормаль
            ln = math.hypot(dx, dy) or 1
            px, py = round(x - dx / ln * 4), round(y - dy / ln * 4)
            if 0 <= px < NG_W and 0 <= py < NG_H and s.get_at((px, py)).a:
                s.set_at((px, py), SCUTE[3] if k % 3 == 0 else SCUTE[1 + k % 2])
    tx, ty = tail[-1]  # кончик — веер
    pygame.draw.polygon(s, (130, 236, 226), [(tx, ty), (tx - 3, ty - 7), (tx + 2, ty - 4)])
    pygame.draw.polygon(s, (70, 180, 190), [(tx, ty), (tx + 4, ty - 6), (tx + 2, ty - 1)])
    # волосы за спиной: волнами до пояса
    hx, hy = cx - 2, 9  # центр головы
    back_hair = [(hx - 4, hy - 6), (hx + 3, hy - 7), (hx + 8, hy - 3), (hx + 9, hy + 5), (hx + 12 + sw, hy + 12), (hx + 10, hy + 18), (hx + 13 + sw, hy + 25),
                 (hx + 9, hy + 28), (hx + 6, hy + 20), (hx + 5, hy + 10), (hx + 1, hy + 2)]
    part(s, HAIR, poly(back_hair), rimcol=(240, 170, 255))
    for k in range(3):  # пряди
        pts = [(hx + 4 + k * 2 + round(2 * math.sin(j * 0.9 + k + sw)), hy + 2 + j * 3) for j in range(8)]
        pygame.draw.lines(s, HAIR[3] if k == 1 else HAIR[2], False, pts)
    # дальняя рука (в тени)
    if pose != "song":
        line(s, NSKIN[0], (cx + 4, 19), (cx + 7, 28), 3)
    # торс: песочные часы
    torso = poly([(cx - 5, 18), (cx + 5, 18), (cx + 4, 24), (cx + 3, 30), (cx + 6, 37), (cx - 5, 37), (cx - 3, 30), (cx - 4, 24)])
    part(s, NSKIN, torso, rimcol=(170, 240, 255))
    for y in range(32, 38):  # переход кожи в чешую
        for x in range(cx - 5, cx + 7):
            if s.get_at((x, y)).a and (x + y) % 3 == 0:
                s.set_at((x, y), TAIL[2] if y < 35 else TAIL[1])
    pygame.draw.circle(s, NSKIN[0], (cx - 1, 29), 0)  # пупок
    # нагрудник: золотые чешуйки и жемчужина
    part(s, NGOLD, poly([(cx - 5, 20), (cx + 5, 20), (cx + 4, 25), (cx, 26), (cx - 4, 25)]), rim=False)
    for x in range(cx - 4, cx + 5, 2):
        s.set_at((x, 22), NGOLD[0])
        s.set_at((x + 1, 24), NGOLD[0])
    pygame.draw.circle(s, (236, 244, 255), (cx, 20), 1)
    # пояс с подвесками
    line(s, NGOLD[1], (cx - 4, 33), (cx + 5, 33))
    for x in (cx - 2, cx + 1, cx + 4):
        s.set_at((x, 34), NGOLD[3])
        s.set_at((x, 35), (236, 244, 255))
    # шея и голова в профиль
    pygame.draw.rect(s, NSKIN[1], (cx - 2, 14, 4, 5))
    part(s, NSKIN, many(ell((hx - 6, hy - 6, 12, 13)), poly([(hx - 6, hy), (hx - 8, hy + 1), (hx - 6, hy + 3)])), rimcol=(170, 240, 255))
    pygame.draw.polygon(s, HAIR[1], [(hx - 6, hy - 3), (hx - 2, hy - 7), (hx + 5, hy - 6), (hx + 6, hy + 1), (hx + 2, hy - 3), (hx - 3, hy - 2)])  # чёлка и макушка
    line(s, HAIR[3], (hx - 3, hy - 5), (hx + 2, hy - 6))
    # ухо-плавник
    pygame.draw.polygon(s, (90, 210, 220), [(hx + 2, hy), (hx + 9, hy - 5), (hx + 8, hy + 1), (hx + 5, hy + 4)])
    line(s, (210, 255, 250), (hx + 3, hy), (hx + 8, hy - 4))
    line(s, (40, 130, 150), (hx + 4, hy + 2), (hx + 8, hy))
    # тиара: золотой обруч с зубцами и жемчужиной
    line(s, NGOLD[1], (hx - 5, hy - 4), (hx + 3, hy - 6))
    for k, (x, y) in enumerate(((hx - 4, hy - 5), (hx - 1, hy - 6), (hx + 2, hy - 7))):
        line(s, NGOLD[2], (x, y), (x, y - (3 if k == 1 else 2)))
    pygame.draw.circle(s, (236, 244, 255), (hx - 1, hy - 9), 1)
    # лицо: глаз с ресницами и бирюзовой радужкой, нос, губы
    line(s, (20, 10, 30), (hx - 5, hy - 1), (hx - 2, hy - 1))
    s.set_at((hx - 4, hy), (40, 230, 220))
    s.set_at((hx - 3, hy), (220, 255, 250))
    s.set_at((hx - 6, hy - 2), (20, 10, 30))  # ресница
    s.set_at((hx - 8, hy + 2), NSKIN[2])  # кончик носа
    lip = (90, 20, 50) if pose == "song" else (210, 90, 140)
    s.set_at((hx - 6, hy + 4), lip)
    s.set_at((hx - 5, hy + 4), lip)
    s.set_at((hx - 6, hy + 5), lip if pose == "song" else NSKIN[1])
    # ближняя рука и трезубец
    sh = (cx - 3, 19)
    if pose == "attack":
        hand, shaft = (cx - 13, 23), ((cx + 2, 23), (cx - 30, 23))
    elif pose == "windup":
        hand, shaft = (cx + 6, 13), ((cx + 14, 16), (cx - 14, 6))
    elif pose == "song":
        hand, shaft = (cx, 23), None
    else:
        hand, shaft = (cx - 9, 27), ((cx - 9, 50), (cx - 9, 6))
    line(s, NSKIN[0], sh, hand, 3)
    line(s, NSKIN[2], sh, hand)
    mid = (round((sh[0] + hand[0]) / 2), round((sh[1] + hand[1]) / 2))
    s.set_at(mid, NGOLD[2])  # браслет
    if shaft:
        (ax, ay), (bx, by) = shaft
        bx, by = max(5, bx), by
        line(s, NGOLD[0], (ax, ay + 1), (bx, by + 1))
        line(s, NGOLD[2], (ax, ay), (bx, by))
        dx, dy = bx - ax, by - ay
        ln = math.hypot(dx, dy) or 1
        ux, uy = dx / ln, dy / ln
        px, py = -uy, ux
        line(s, NGOLD[1], (bx + px * 3, by + py * 3), (bx - px * 3, by - py * 3))
        for o in (-3, 0, 3):
            base = (bx + px * o, by + py * o)
            tip = (base[0] + ux * (5 if o == 0 else 3), base[1] + uy * (5 if o == 0 else 3))
            line(s, NGOLD[2], base, tip)
            s.set_at((round(tip[0]), round(tip[1])), NGOLD[3])
        pygame.draw.circle(s, (120, 240, 255), (round(bx - ux * 2), round(by - uy * 2)), 1)
    pygame.draw.circle(s, NSKIN[2], hand, 1)
    if pose == "song":  # волны песни и ноты
        for r in (6, 10, 14):
            pygame.draw.arc(s, (170, 230, 255), (hx - 6 - r, hy + 3 - r, r * 2, r * 2), math.pi * 0.7, math.pi * 1.3)
        for nx, ny in ((4, 10), (9, 3)):
            pygame.draw.rect(s, (230, 200, 255), (nx, ny + 3, 2, 2))
            line(s, (230, 200, 255), (nx + 1, ny + 3), (nx + 1, ny))
            s.set_at((nx + 2, ny), (230, 200, 255))
    for x, y in ((42, 47), (14, 58), (30, 60), (cx + 4, 22)):  # блёстки
        if s.get_at((x, y)).a:
            s.set_at((x, y), (240, 255, 255))
    return outlined(s, (6, 10, 24))


def make_naga_frames():
    idle, idle2 = naga("idle", 0), naga("idle", 1)
    w = naga("windup")
    return {"idle": [idle, idle2], "windup": [tinted(w, (140, 240, 255), 0.25), w], "attack": [naga("attack")],
            "song": [naga("song", 0), naga("song", 1)],
            "hurt": [tinted(idle, (255, 255, 255), 0.8)], "dead": [crouched(crouched(tinted(idle, (30, 50, 70), 0.5)))]}


# ---------------------------------------------------------------- Кракен: голова и мантия (щупальца — в игре)
KW, KH = 112, 84
MANTLE = [(26, 6, 22), (70, 18, 42), (118, 36, 66), (170, 82, 112)]
MANTLE_F = [(60, 6, 16), (122, 18, 34), (186, 46, 56), (240, 110, 100)]


def kraken(pose="idle", frame=0, fury=False):
    """Голова гигантского осьминога над водой: высокая бугристая мантия в венах, злые брови над горящими
    глазами со щелевыми зрачками, крючковатый клюв. Низ прячется за фальшбортом — щупальца рисует игра.
    pose: idle, windup (мантия раздувается, глаза разгораются), attack (клюв раскрыт), ink."""
    s = pygame.Surface((KW, KH), pygame.SRCALPHA)
    pal = MANTLE_F if fury else MANTLE
    puff = {"windup": 4, "ink": 5}.get(pose, 0) + frame
    # мантия: высокий бугристый купол, откинут назад
    mantle = many(ell((24 - puff, 0 - puff, 70 + puff * 2, 58 + puff)), ell((14, 26, 84, 40)), poly([(14, 46), (98, 46), (104, 84), (8, 84)]))
    part(s, pal, mantle, rimcol=(120, 200, 230))
    rnd = random.Random(5)
    for _ in range(34):  # бугры и тёмные пятна
        x, y = rnd.randrange(22, 92), rnd.randrange(6, 60)
        r = rnd.randint(1, 3)
        pygame.draw.circle(s, pal[0] if rnd.random() < 0.65 else pal[3], (x, y), r)
    for x0 in (36, 50, 62, 76):  # вены вниз по куполу
        pts = [(x0 + int(3 * math.sin(k / 3 + x0)), 4 + k * 3) for k in range(10)]
        pygame.draw.lines(s, (150, 40, 70) if not fury else (255, 80, 60), False, pts)
    for k in range(3):  # складки над глазами
        pygame.draw.arc(s, pal[0], (28 + k * 5, 18 + k * 6, 56 - k * 10, 18), math.pi * 0.15, math.pi * 0.85, 1)
    # глаза: тёмные глазницы, горящая радужка, щелевой зрачок, злые брови «галочкой»
    hot = pose in ("windup", "ink") or fury
    iris = (255, 210, 90) if hot else (255, 130, 40)
    for ex, ey, sd in ((32, 46, 1), (76, 46, -1)):
        pygame.draw.ellipse(s, (10, 2, 8), (ex - 12, ey - 8, 25, 17))
        pygame.draw.ellipse(s, iris, (ex - 10, ey - 6, 21, 13))
        pygame.draw.ellipse(s, (255, 240, 180) if hot else (255, 180, 80), (ex - 6, ey - 4, 13, 7))
        pygame.draw.rect(s, (8, 2, 6), (ex - 8, ey - 1, 18, 3))  # щелевой зрачок
        s.set_at((ex - 5, ey - 4), (255, 255, 255))
        brow = [(ex - 14 * sd, ey - 12), (ex + 13 * sd, ey - 4), (ex + 13 * sd, ey + 1), (ex - 14 * sd, ey - 6)]
        pygame.draw.polygon(s, pal[0], brow)  # бровь срезает верх глаза клином к переносице — злой взгляд
        line(s, pal[3], (ex - 14 * sd, ey - 13), (ex + 13 * sd, ey - 5))
        line(s, (8, 2, 6), (ex - 14 * sd, ey - 6), (ex + 13 * sd, ey + 1))
    # клюв: крючковатый, костяной
    beak_open = 6 if pose == "attack" else 0
    pygame.draw.polygon(s, (30, 22, 24), [(46, 58), (66, 58), (60, 70), (56, 76)])
    line(s, (140, 120, 110), (48, 59), (58, 74))
    if beak_open:
        pygame.draw.polygon(s, (90, 6, 20), [(48, 62), (64, 62), (56, 74 + beak_open)])
        pygame.draw.polygon(s, (30, 22, 24), [(50, 70 + beak_open), (62, 70 + beak_open), (56, 82)])
    if pose == "ink":  # чернила из-под мантии
        for k in range(22):
            pygame.draw.circle(s, (10, 8, 16), (56 + rnd.randint(-36, 36), 74 + rnd.randint(-8, 8)), rnd.randint(2, 6))
    return outlined(s, (8, 2, 8))


def make_kraken_frames():
    idle, idle2 = kraken("idle", 0), kraken("idle", 1)
    wind = kraken("windup")
    return {"idle": [idle, idle2], "windup": [tinted(wind, (255, 200, 120), 0.2), wind], "attack": [kraken("attack")],
            "hurt": [tinted(idle, (255, 255, 255), 0.8)], "dead": [crouched(tinted(idle, (40, 30, 50), 0.6))],
            "enraged": [kraken("idle", 0, True), kraken("idle", 1, True)], "ink": [kraken("ink")]}


# ---------------------------------------------------------------- облик «Новый пират»: слой поверх героя
VEST = [(70, 40, 20), (118, 72, 36), (156, 104, 56), (196, 146, 90)]
HAT = (16, 14, 18), (40, 36, 44), (70, 64, 78)
GOLD = (220, 176, 70)


def pirate_overlay(pose="idle"):
    """Коричневая жилетка и чёрная капитанская треуголка — по геометрии героя (24×32, смотрит вправо)."""
    s = pygame.Surface((24, 32), pygame.SRCALPHA)
    vest = pygame.Surface((24, 32), pygame.SRCALPHA)
    # жилетка: две полы, сужаются к плечам, распахнута посередине; лацканы светлее
    for y in range(10, 18):
        w = 2 if y < 12 else 3
        for x in range(13 - w, 13):
            vest.set_at((x, y), VEST[1] if x > 13 - w else VEST[0])
        for x in range(15, 15 + w + (1 if y > 13 else 0)):
            vest.set_at((x, y), VEST[1] if x < 15 + w - 1 else VEST[0])
    for y in range(10, 13):  # лацканы
        vest.set_at((12, y), VEST[3])
        vest.set_at((15, y), VEST[3])
    for y in (13, 15):  # латунные пуговицы
        vest.set_at((12, y), GOLD)
    for x in range(10, 19):  # низ жилетки — тёмная кромка
        if vest.get_at((x, 17)).a:
            vest.set_at((x, 17), VEST[0])
    if pose == "attack":
        for y in range(12, 15):
            vest.set_at((18, y), (0, 0, 0, 0))
    s.blit(vest, (0, 0))
    # треуголка: тулья поверх шлема, широкие загнутые поля с золотой каймой и кокардой
    hat = pygame.Surface((24, 32), pygame.SRCALPHA)
    pygame.draw.polygon(hat, HAT[1], [(10, 0), (17, 0), (18, 3), (9, 3)])
    pygame.draw.polygon(hat, HAT[0], [(5, 4), (12, 2), (15, 2), (22, 4), (20, 5), (7, 5)])
    line(hat, GOLD, (5, 4), (12, 2))
    line(hat, GOLD, (15, 2), (22, 4))
    line(hat, HAT[2], (11, 1), (16, 1))
    hat.set_at((13, 2), (230, 230, 230))
    hat.set_at((14, 2), (230, 230, 230))
    s.blit(outlined(hat, (8, 6, 8)), (0, 0))
    return s


def make_pirate_frames():
    idle = pirate_overlay("idle")
    return {"idle": [idle, shifted_breath(idle)], "attack": [pirate_overlay("attack")], "dodge": [crouched(idle)],
            "hurt": [tinted(idle, (255, 80, 60), 0.7)], "heal": [tinted(idle, (255, 200, 90), 0.45)],
            "dead": [tinted(crouched(idle), (40, 10, 10), 0.6)]}
