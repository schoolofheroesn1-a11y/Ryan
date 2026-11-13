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
SHELL = [(90, 20, 20), (170, 46, 34), (220, 90, 60), (250, 160, 120)]


def crab(pose="idle", frame=0):
    """Краб-громила: широкий алый панцирь с шипами, глаза на стебельках, огромная клешня-кувалда."""
    s = pygame.Surface((46, 30), pygame.SRCALPHA)
    up = {"windup": -10, "attack": 4}.get(pose, 0)
    for k in range(4):  # ноги
        x = 14 + k * 6
        line(s, SHELL[0], (x, 20), (x - 3, 28), 2)
        line(s, SHELL[1], (x + 3, 20), (x + 6, 28), 2)
    part(s, SHELL, many(ell((10, 10 + frame, 30, 15)), poly([(12, 16 + frame), (38, 16 + frame), (34, 22 + frame), (16, 22 + frame)])))
    for x in (14, 20, 26, 32):  # шипы панциря
        pygame.draw.polygon(s, SHELL[2], [(x, 11 + frame), (x + 2, 6 + frame), (x + 4, 11 + frame)])
    for x in (16, 22):  # глаза на стебельках
        line(s, SHELL[1], (x, 11 + frame), (x - 1, 5 + frame))
        pygame.draw.circle(s, (20, 10, 10), (x - 1, 4 + frame), 2)
        s.set_at((x - 2, 3 + frame), (255, 255, 255))
    # огромная клешня (ближняя, к герою)
    cx, cy = 6, 12 + up
    line(s, SHELL[1], (14, 16 + frame), (cx + 6, cy + 6), 3)
    part(s, SHELL, many(ell((cx - 4, cy - 4, 14, 12)), poly([(cx - 6, cy - 2), (cx + 2, cy - 8), (cx + 4, cy - 2)])))
    pygame.draw.polygon(s, SHELL[3], [(cx - 5, cy + 4), (cx + 3, cy + 2), (cx - 2, cy + 8)])  # нижняя «челюсть»
    if pose == "attack":
        pygame.draw.polygon(s, (255, 255, 255), [(cx - 6, cy + 9), (cx, cy + 11), (cx - 3, cy + 13)])
    return outlined(s, (20, 6, 6))


def make_crab_frames():
    idle, idle2 = crab("idle", 0), crab("idle", 1)
    w = crab("windup")
    return {"idle": [idle, idle2], "windup": [tinted(w, (255, 200, 120), 0.25), w], "attack": [crab("attack")],
            "hurt": [tinted(idle, (255, 255, 255), 0.8)], "dead": [pygame.transform.flip(tinted(idle, (60, 40, 40), 0.5), False, True)]}


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
