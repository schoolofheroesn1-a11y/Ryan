"""Алая Бездна — четвёртая локация: фон, мелкие демоны и босс Алый Серафим.

Рисуется примитивами pygame прямо по пикселям (без символьных карт), затем — чёрный контур,
как у остальных спрайтов. Все враги смотрят влево, на героя.
"""
import math
import random

import pygame

from game.art import _lerp, crouched, shifted_breath, tinted

OUTLINE = (8, 4, 6)
BODY, BODY2 = (22, 14, 18), (44, 28, 34)          # чёрное тело и отсвет по краю
BONE, BONE2 = (236, 230, 220), (168, 158, 154)    # белые костяные метки
MEMB, MEMB2 = (50, 8, 12), (92, 16, 22)           # перепонка крыла
EYE = (255, 70, 40)
# вторая стадия: метки раскаляются, перепонка наливается кровью
MARK, MARK2 = (255, 104, 52), (210, 44, 30)
EYE2 = (255, 240, 180)
MEMB_2, MEMB2_2 = (110, 14, 18), (170, 34, 26)


def outlined(surf, col=OUTLINE):
    """Чёрный контур: пустой пиксель рядом с закрашенным."""
    w, h = surf.get_size()
    out = surf.copy()
    for y in range(h):
        for x in range(w):
            if surf.get_at((x, y)).a:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and surf.get_at((nx, ny)).a:
                    out.set_at((x, y), col)
                    break
    return out


def _line(s, col, a, b, w=1):
    pygame.draw.line(s, col, a, b, w)


def _poly(s, col, pts):
    pygame.draw.polygon(s, col, pts)


# ---------------------------------------------------------------- Алый Серафим
# Парит над землёй: тонкий чёрный силуэт с белыми мазками (плечо, лопатки, спина, нога), каре,
# рука указывает на героя, за спиной — огромное крыло с белыми костями и «стекающей» перепонкой.
# Ноги сходятся в острый хвост. Вторая стадия: второе крыло, рога, метки раскаляются.
SERAPH_W, SERAPH_H = 92, 86
OX = 10  # запас слева под выпад когтем
RIM = (74, 22, 28)  # тёплый отсвет по краю силуэта (свет углей снизу)
WING_IN, WING_IN2 = (26, 8, 12), (58, 14, 20)
WING_IN_2, WING_IN2_2 = (52, 10, 14), (104, 22, 20)


def _wing2(s, root, arc, ends, tip, memb, memb2, bone, bone2):
    """Крыло: толстая кость-дуга, пальцы веером вниз, перепонка стекает острыми языками."""
    edge = []
    for i, e in enumerate(ends):
        edge.append(e)
        if i + 1 < len(ends):
            n = ends[i + 1]
            edge.append(((e[0] + n[0]) // 2, (e[1] + n[1]) // 2 - 12))  # глубокий вырез между пальцами
    _poly(s, memb, [root] + arc + [tip] + list(reversed(edge)) + [(root[0] + 1, root[1] + 14)])
    for (fx, fy), (ex, ey) in zip(arc, ends):  # тёмно-алая тень вдоль каждого пальца
        _poly(s, memb2, [(fx, fy + 2), (fx + 2, fy + 3), (ex + 1, ey - 6), (ex, ey - 6)])
    for (fx, fy), (ex, ey) in zip(arc, ends):  # пальцы: у основания толще
        mx, my = (fx * 2 + ex) // 3, (fy * 2 + ey) // 3
        _line(s, bone, (fx, fy), (mx, my), 2)
        _line(s, bone, (mx, my), (ex, ey))
        _line(s, bone2, (mx + 1, my + 1), (ex + 1, ey - 2))
    pts = [root] + arc + [tip]
    for p0, p1 in zip(pts, pts[1:]):  # главная кость — широкий белый мазок
        _line(s, bone, p0, p1, 3)
    for p0, p1 in zip(pts[1:], pts[2:]):
        _line(s, bone2, (p0[0], p0[1] + 2), (p1[0], p1[1] + 2))


def seraph(stage2=False, pose="idle", flap=0):
    """pose: idle (указывает на героя), raised (рука вскинута, в ладони копится сгусток), swing (выпад когтем)."""
    s = pygame.Surface((SERAPH_W, SERAPH_H), pygame.SRCALPHA)
    mark, mark2 = (MARK, MARK2) if stage2 else (BONE, BONE2)
    memb, memb2 = (WING_IN_2, WING_IN2_2) if stage2 else (WING_IN, WING_IN2)
    o = OX
    f = (-3, -4) if flap == 1 else (2, 3) if flap == 2 else (0, 0)  # взмах: дуга и концы крыла

    def P(x, y):
        return (x + o, y)

    if stage2:  # второе крыло — за головой, меньше и темнее
        _wing2(s, P(27, 22), [P(22, 12 + f[0]), P(15, 6 + f[0]), P(8, 5 + f[0]), P(2, 9 + f[0])],
               [P(20, 40 + f[1]), P(14, 46 + f[1]), P(8, 44 + f[1]), P(3, 36 + f[1])], P(0, 16 + f[0]),
               (40, 8, 12), (90, 18, 20), MARK2, (120, 30, 24))
    # главное крыло: от лопатки вверх-вправо и длинным остриём вниз
    _wing2(s, P(40, 22), [P(46, 14 + f[0]), P(53, 8 + f[0]), P(60, 5 + f[0]), P(67, 5 + f[0]), P(73, 9 + f[0]), P(77, 16 + f[0])],
           [P(44, 54 + f[1]), P(51, 63 + f[1]), P(58, 70 + f[1]), P(65, 68 + f[1]), P(71, 60 + f[1]), P(76, 50 + f[1])],
           P(80, 30 + f[0]), memb, memb2, mark, mark2)
    # хвост вместо ног: бёдра сходятся в длинное острие
    _poly(s, BODY, [P(27, 42), P(37, 42), P(36, 54), P(33, 66), P(31, 77), P(29, 85), P(28, 74), P(27, 60), P(26, 50)])
    _line(s, mark, P(27, 50), P(28, 64), 2)  # белая полоса по ноге
    _line(s, mark, P(28, 64), P(29, 80))
    _line(s, RIM, P(36, 44), P(32, 70))
    # торс: вполоборота, видны лопатки
    _poly(s, BODY, [P(23, 21), P(31, 19), P(41, 20), P(43, 26), P(40, 34), P(37, 43), P(27, 43), P(25, 34), P(22, 27)])
    _line(s, RIM, P(41, 25), P(37, 42))
    _line(s, mark, P(39, 22), P(35, 30), 3)  # большой мазок через спину
    _line(s, mark, P(35, 30), P(30, 41), 2)
    pygame.draw.ellipse(s, mark, (*P(24, 26), 3, 7))  # лопатки
    pygame.draw.ellipse(s, mark, (*P(37, 27), 3, 6))
    _line(s, mark, P(25, 21), P(31, 20), 2)  # верх плеча
    _line(s, mark2, P(25, 35), P(26, 39))
    _line(s, mark2, P(40, 31), P(38, 37))
    # голова: каре с завитком у шеи, белая прядь сверху
    pygame.draw.rect(s, BODY, (*P(29, 15), 4, 6))
    pygame.draw.ellipse(s, BODY, (*P(26, 6), 8, 11))
    # каре: прямая чёлка, волосы до линии челюсти, кончики загибаются наружу
    _poly(s, BODY, [P(27, 7), P(31, 5), P(35, 7), P(36, 12), P(37, 15), P(39, 17), P(36, 17), P(34, 15), P(33, 11)])
    _poly(s, mark, [P(28, 7), P(31, 6), P(33, 7), P(30, 9)])  # белая прядь
    _line(s, RIM, P(36, 9), P(37, 14))
    if stage2:
        _poly(s, MARK, [P(28, 7), P(25, 0), P(30, 5)])  # рога
        _poly(s, MARK, [P(32, 5), P(36, 0), P(34, 7)])
        s.set_at(P(27, 11), EYE2)
        s.set_at(P(28, 11), EYE2)
    else:
        s.set_at(P(27, 11), EYE)
    # рука (ближняя к герою)
    if pose == "idle":  # указывает на героя
        _line(s, BODY, P(25, 22), P(14, 24), 3)
        _line(s, BODY, P(14, 24), P(4, 24), 2)
        _line(s, BODY, P(4, 24), P(0, 23))
        _line(s, mark, P(22, 22), P(16, 23))
    elif pose == "raised":  # рука вскинута, в ладони — сгусток пламени
        _line(s, BODY, P(25, 22), P(21, 13), 3)
        _line(s, BODY, P(21, 13), P(22, 4), 2)
        orb = (255, 120, 60) if stage2 else (230, 50, 40)
        pygame.draw.circle(s, orb, P(22, 3), 3)
        s.set_at(P(22, 3), (255, 240, 200))
        s.set_at(P(21, 2), (255, 200, 140))
    else:  # выпад: из пальцев — костяные когти
        _line(s, BODY, P(25, 22), P(12, 23), 3)
        _line(s, BODY, P(12, 23), P(2, 23), 2)
        for dy in (-2, 0, 2):
            _line(s, mark, P(2, 23 + dy // 2), P(-9, 23 + dy))
    return outlined(s, (6, 2, 4))


def make_seraph_frames(stage2=False):
    idle = seraph(stage2, "idle", 0)
    up = seraph(stage2, "idle", 1)
    down = seraph(stage2, "idle", 2)
    raised = seraph(stage2, "raised", 1)
    swing = seraph(stage2, "swing", 2)
    glow = (255, 120, 60) if stage2 else (255, 60, 40)
    frames = {
        "idle": [idle, up, idle, down],
        "windup": [tinted(raised, glow, 0.3), raised],
        "attack": [swing],
        "hurt": [tinted(idle, (255, 255, 255), 0.8)],
        "dead": [crouched(tinted(down, (50, 30, 30), 0.5))],
        "enraged": [idle, up, idle, down],
    }
    if not stage2:  # перерождение: сжимается в багровом свете и раскрывается во второй облик
        frames["transform"] = [tinted(crouched(idle), (255, 40, 30), 0.6), tinted(seraph(True, "idle", 1), (255, 200, 160), 0.5)]
    return frames


# ---------------------------------------------------------------- мелкие демоны
def imp(pose="up"):
    """Бес: маленький рогатый демон на перепончатых крыльях, летает и кусает сериями."""
    s = pygame.Surface((24, 18), pygame.SRCALPHA)
    if pose == "up":
        _poly(s, MEMB, [(13, 7), (22, 0), (23, 6), (18, 9)])
        _line(s, BONE2, (13, 7), (22, 1))
    else:
        _poly(s, MEMB, [(13, 8), (22, 14), (18, 16), (15, 11)])
        _line(s, BONE2, (13, 8), (21, 14))
    _line(s, BODY, (14, 13), (19, 16))  # хвост с жалом
    _line(s, BODY, (19, 16), (22, 13))
    _poly(s, BONE2, [(22, 12), (23, 14), (21, 14)])
    pygame.draw.ellipse(s, BODY, (8, 6, 8, 9))
    pygame.draw.ellipse(s, BODY, (6, 2, 7, 6))
    _line(s, BONE, (8, 2), (7, 0))  # рожки
    _line(s, BONE, (11, 2), (12, 0))
    _line(s, BONE, (13, 7), (10, 12))  # костяная метка
    s.set_at((7, 4), EYE)
    if pose == "down":  # дальнее крыло
        _poly(s, MEMB2, [(9, 8), (2, 12), (5, 14)])
    else:
        _poly(s, MEMB2, [(9, 7), (2, 1), (4, 6)])
    return outlined(s)


FIRE = ((150, 30, 20), (236, 104, 40), (255, 210, 120))  # тёмное, яркое и белое пламя


def _flame(s, x, y, h, flick):
    """Язык пламени высотой h от точки (x, y) вверх, кончик клонится назад (вправо)."""
    lean = 1 + flick
    _poly(s, FIRE[0], [(x - 1, y), (x + lean, y - h), (x + 2, y)])
    if h > 2:
        _line(s, FIRE[1], (x, y - 1), (x + lean, y - h + 1))
    if h > 3:
        s.set_at((x + lean // 2, y - 1), FIRE[2])


def hound(pose="idle", flick=0):
    """Адская гончая: поджарый чёрный зверь с белым волчьим черепом, рогами вдоль шеи, белыми рёбрами
    и хребтом, огненной гривой и хвостом-хлыстом с костяным жалом. Смотрит влево."""
    s = pygame.Surface((50, 28), pygame.SRCALPHA)
    atk, low = pose == "attack", pose == "windup"
    ox = 6 - (3 if atk else 0)  # слева запас под струю огня
    hy = 2 if low else 0  # перед броском голова пригнута

    def T(x, y):
        return (x + ox, y)

    def H(x, y):  # точки головы
        return (x + ox, y + hy)

    def legs(segs):
        for leg in segs:
            for i, (p0, p1) in enumerate(zip(leg, leg[1:])):
                _line(s, BODY, T(*p0), T(*p1), 2 if i < len(leg) - 2 else 1)
            e = T(*leg[-1])
            s.set_at((e[0] - 1, e[1]), BONE)
            s.set_at((e[0] - 2, e[1]), BONE2)

    # хвост-хлыст с костяным жалом
    tail = [(36, 11), (39, 8 - flick), (41, 4 - flick), (40, 1)]
    for i, (p0, p1) in enumerate(zip(tail, tail[1:])):
        _line(s, BODY, T(*p0), T(*p1), 2 if i == 0 else 1)
    _poly(s, BONE, [T(39, 2), T(42, -1), T(41, 3)])
    # задние лапы — с изломом; в прыжке выпрямлены назад
    legs([((30, 14), (34, 19), (32, 22), (33, 27)), ((33, 14), (37, 19), (36, 22), (37, 27))] if not atk else
         [((30, 14), (35, 18), (39, 21), (42, 23)), ((33, 14), (38, 17), (42, 19), (44, 21))])
    # туловище: высокая грудь, втянутый живот, мощный круп
    _poly(s, BODY, [T(*p) for p in [(10, 10), (16, 8), (24, 10), (30, 8), (36, 10), (35, 15), (29, 16), (25, 14), (18, 16), (11, 17)]])
    _line(s, RIM, T(11, 17), T(18, 16))
    _line(s, RIM, T(29, 16), T(35, 15))
    # передние лапы; в прыжке выброшены вперёд
    legs([((12, 16), (11, 21), (10, 27)), ((16, 16), (17, 21), (15, 27))] if not atk else
         [((12, 15), (7, 18), (3, 20)), ((15, 16), (11, 20), (7, 22))])
    # кости: хребет, рёбра, таз
    _line(s, BONE, T(16, 9), T(28, 9))
    for x in (15, 18, 21):
        _line(s, BONE, T(x, 11), T(x + 1, 15))
    _line(s, BONE2, T(24, 11), T(24, 13))
    pygame.draw.ellipse(s, BONE, (*T(29, 10), 4, 3))
    s.set_at(T(30, 11), BODY)
    # огненная грива: неровные языки, клонятся назад
    for i, (x, h) in enumerate(((11, 5), (13, 7), (16, 5), (18, 6), (21, 4), (24, 3), (27, 2))):
        _flame(s, *T(x, 9), h + (flick if i % 2 else -flick), 1 + flick)
    # шея и волчий череп
    _poly(s, BODY, [H(8, 8), H(13, 6), T(16, 10), T(11, 15)])
    if atk:  # пасть распахнута: морда вверх, челюсть вниз, из глотки — струя огня
        _poly(s, BONE, [H(0, 8), H(4, 6), H(9, 5), H(13, 7), H(12, 10), H(6, 10), H(1, 10)])
        _poly(s, BODY, [H(2, 13), H(11, 11), H(10, 15), H(4, 16)])
        _line(s, BONE, H(3, 14), H(10, 12))  # нижняя челюсть
        for x in (2, 5, 8):
            s.set_at(H(x, 10), BONE)
            s.set_at(H(x + 1, 12), BONE)
        _poly(s, FIRE[0], [H(9, 11), H(-6, 8), H(-6, 15)])
        _poly(s, FIRE[1], [H(8, 11), H(-4, 10), H(-4, 13)])
        _line(s, FIRE[2], H(6, 11), H(-1, 11))
        eye = H(9, 7)
    else:
        _poly(s, BONE, [H(0, 11), H(3, 9), H(8, 7), H(12, 8), H(13, 10), H(10, 12), H(4, 13), H(0, 12)])
        _line(s, BONE2, H(3, 13), H(10, 12))
        _poly(s, BODY, [H(2, 13), H(10, 12), H(9, 14), H(3, 14)])  # челюсть
        for x in (3, 6):
            s.set_at(H(x, 13), BONE)  # клыки
        eye = H(9, 9)
    s.set_at(H(0, 11 if not atk else 8), BODY)  # ноздря
    pygame.draw.rect(s, BODY, (eye[0] - 1, eye[1], 3, 2))  # косая глазница с огнём
    s.set_at((eye[0], eye[1] + 1), EYE)
    s.set_at((eye[0] - 1, eye[1] + 1), (255, 180, 80))
    # рога загнуты назад вдоль шеи
    r0 = H(11, 7) if not atk else H(11, 5)
    _line(s, BONE, r0, (r0[0] + 4, r0[1] - 2))
    _line(s, BONE, (r0[0] + 4, r0[1] - 2), (r0[0] + 8, r0[1] - 1))
    _line(s, BONE2, (r0[0] + 8, r0[1] - 1), (r0[0] + 9, r0[1] + 1))
    return outlined(s, (6, 2, 4))


def husk(pose="idle"):
    """Пустой: сгорбленная чёрная фигура с белыми трещинами и длинными когтями."""
    s = pygame.Surface((26, 34), pygame.SRCALPHA)
    _poly(s, BODY, [(10, 21), (14, 21), (13, 33), (10, 33)])  # ноги
    _poly(s, BODY, [(15, 21), (18, 21), (19, 33), (16, 33)])
    _poly(s, BODY, [(9, 9), (19, 10), (18, 22), (10, 22)])  # сгорбленный торс
    _line(s, BODY2, (19, 10), (18, 21))
    _line(s, BONE, (17, 11), (12, 20))  # трещины-кости
    _line(s, BONE2, (11, 12), (11, 15))
    _line(s, BONE2, (12, 24), (11, 31))
    pygame.draw.ellipse(s, BODY, (7, 3, 8, 8))  # голова вперёд
    s.set_at((9, 6), BONE)
    s.set_at((11, 6), BONE)
    if pose == "attack":  # рука с когтями выброшена вперёд
        _line(s, BODY, (11, 12), (2, 13), 2)
        for k in (-1, 1, 3):
            _line(s, BONE, (2, 13), (0, 13 + k))
    else:
        _line(s, BODY, (11, 12), (7, 20), 2)
        _line(s, BODY, (7, 20), (6, 26), 2)
        for k in (-1, 0, 1):
            _line(s, BONE, (6, 26), (5 + k, 29))
    return outlined(s)


def make_imp_frames():
    up, down = imp("up"), imp("down")
    return {
        "idle": [up, down],
        "windup": [tinted(up, (255, 90, 50), 0.35), tinted(down, (255, 90, 50), 0.35)],
        "attack": [down],
        "hurt": [tinted(down, (255, 255, 255), 0.8)],
        "dead": [pygame.transform.flip(tinted(down, (60, 40, 40), 0.5), False, True)],
    }


def make_hound_frames():
    idle, idle2 = hound("idle", 0), hound("idle", 1)  # грива и хвост колышутся
    low = hound("windup", 1)
    return {
        "idle": [idle, idle2],
        "windup": [tinted(low, (255, 90, 50), 0.3), low],
        "attack": [hound("attack", 1)],
        "hurt": [tinted(idle, (255, 255, 255), 0.8)],
        "dead": [crouched(tinted(idle, (60, 40, 40), 0.5))],
    }


def make_husk_frames():
    idle = husk("idle")
    return {
        "idle": [idle, shifted_breath(idle, 12)],
        "windup": [tinted(idle, (255, 90, 50), 0.35), idle],
        "attack": [husk("attack")],
        "hurt": [tinted(idle, (255, 255, 255), 0.8)],
        "dead": [crouched(tinted(idle, (60, 40, 40), 0.5))],
    }


# ---------------------------------------------------------------- фон
def make_abyss_background(w=320, h=180, seed=46):
    """Алая Бездна: пепельные сумерки. Тёмное небо в дымке, затменное солнце с тонкой алой каймой
    за пеленой облаков, руины собора и рёбра исполина в тумане, пепельная равнина с тлеющими трещинами.
    Красного немного — только угли, кайма солнца и отсвет у горизонта."""
    rnd = random.Random(seed)
    surf = pygame.Surface((w, h))
    horizon = 108
    stops = [(0.0, (12, 9, 14)), (0.45, (30, 18, 26)), (0.8, (66, 34, 38)), (1.0, (104, 58, 52))]
    for y in range(horizon):
        t = y / (horizon - 1)
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                pygame.draw.line(surf, _lerp(c0, c1, (t - t0) / (t1 - t0)), (0, y), (w, y))
                break
    for _ in range(500):  # неровное небо: лёгкие мазки
        x, y = rnd.randrange(w), rnd.randrange(horizon)
        c = surf.get_at((x, y))
        k = rnd.uniform(-8, 8)
        pygame.draw.rect(surf, (max(0, min(255, int(c.r + k))), max(0, min(255, int(c.g + k * 0.7))), max(0, min(255, int(c.b + k * 0.7)))),
                         (x, y, rnd.randint(3, 9), 1))
    for _ in range(40):  # редкие звёзды в верхней части
        surf.set_at((rnd.randrange(w), rnd.randrange(36)), rnd.choice([(120, 110, 120), (80, 70, 84)]))
    # затменное солнце: чёрный диск, тонкая алая кайма и тусклое гало
    sx, sy = 226, 36
    halo = pygame.Surface((w, h), pygame.SRCALPHA)
    for r, a in ((34, 14), (27, 22), (22, 34)):
        pygame.draw.circle(halo, (170, 60, 50, a), (sx, sy), r)
    surf.blit(halo, (0, 0))
    pygame.draw.circle(surf, (190, 70, 50), (sx, sy), 18)
    pygame.draw.circle(surf, (240, 150, 110), (sx, sy), 17)
    pygame.draw.circle(surf, (10, 6, 10), (sx, sy), 16)
    # облака-пелена поверх солнца и неба
    clouds = pygame.Surface((w, h), pygame.SRCALPHA)
    for _ in range(26):
        cx, cy = rnd.randrange(-20, w), rnd.randrange(16, 80)
        pygame.draw.ellipse(clouds, (36, 24, 32, rnd.randint(70, 130)), (cx, cy, rnd.randint(40, 90), rnd.randint(4, 8)))
    surf.blit(clouds, (0, 0))
    # дальние руины собора в тумане
    far = (44, 30, 38)
    for x0, wd, ht in ((20, 18, 40), (44, 10, 26), (58, 14, 48)):
        pygame.draw.rect(surf, far, (x0, horizon - ht, wd, ht))
        _poly(surf, far, [(x0 - 1, horizon - ht), (x0 + wd // 2, horizon - ht - 14), (x0 + wd + 1, horizon - ht)])
    for x in (26, 63, 66):  # пустые стрельчатые окна
        pygame.draw.rect(surf, (70, 42, 46), (x, horizon - 30, 3, 8))
    # рёбра исполина: силуэты в дымке
    rib = (52, 34, 40)
    _line(surf, rib, (150, horizon - 5), (306, horizon - 9), 3)
    for i, x in enumerate(range(160, 300, 15)):
        hgt = 38 - abs(i - 4) * 4
        pygame.draw.arc(surf, rib, (x - 4, horizon - 7 - hgt, 18, hgt * 2), 1.3, 3.1, 3)
    # дальние скалы
    pts, y = [(0, h)], 100
    for x in range(0, w + 6, 6):
        y = max(94, min(106, y + rnd.randint(-2, 2)))
        pts.append((x, y))
    pts.append((w, h))
    _poly(surf, (38, 26, 32), pts)
    # туман у горизонта — светлая полоса, на её фоне читаются чёрные силуэты
    fog = pygame.Surface((w, h), pygame.SRCALPHA)
    for i in range(18):
        a = int(60 * (1 - abs(i - 9) / 9))
        pygame.draw.line(fog, (150, 104, 98, a), (0, horizon - 24 + i * 2), (w, horizon - 24 + i * 2), 2)
    surf.blit(fog, (0, 0))
    # обсидиановые шпили по краям
    for x0, top, wd in ((2, 38, 12), (16, 62, 8), (282, 58, 8), (296, 30, 14), (312, 66, 8)):
        _poly(surf, (14, 10, 14), [(x0, horizon + 6), (x0 + wd // 2, top), (x0 + wd, horizon + 6)])
        _line(surf, (60, 36, 40), (x0 + wd // 2 + 1, top + 4), (x0 + wd // 2 + 2, horizon + 2))
    # пепельная равнина
    for yy in range(horizon, h):
        t = (yy - horizon) / (h - horizon)
        pygame.draw.line(surf, _lerp((74, 56, 56), (30, 22, 26), t), (0, yy), (w, yy))
    for _ in range(int(w * (h - horizon) * 0.06)):
        x, yy = rnd.randrange(w), rnd.randrange(horizon + 2, h)
        surf.set_at((x, yy), rnd.choice([(86, 68, 66), (52, 38, 40), (40, 30, 32), (96, 78, 74)]))
    for _ in range(18):  # камни
        x, yy = rnd.randrange(w), rnd.randrange(horizon + 6, h)
        pygame.draw.ellipse(surf, (24, 18, 22), (x, yy, rnd.randint(3, 7), 2))
    # тлеющие трещины — редкие, тусклые
    for _ in range(8):
        x, yy = rnd.randrange(w), rnd.randrange(horizon + 10, h - 4)
        for _ in range(rnd.randint(3, 5)):
            nx, ny = x + rnd.randint(-9, 9), yy + rnd.randint(-2, 3)
            _line(surf, (120, 36, 24), (x, yy), (nx, ny))
            if rnd.random() < 0.35:
                surf.set_at((x, yy), (230, 110, 50))
            x, yy = nx, ny
    # падающий пепел и редкие искры
    for _ in range(90):
        surf.set_at((rnd.randrange(w), rnd.randrange(h - 10)), rnd.choice([(120, 110, 112), (90, 80, 84), (150, 140, 140)]))
    for _ in range(14):
        surf.set_at((rnd.randrange(w), rnd.randrange(40, h - 20)), (240, 130, 60))
    return surf
