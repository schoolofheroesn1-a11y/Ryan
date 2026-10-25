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
SERAPH_W, SERAPH_H = 68, 58


def _wing(s, root, arc, ends, memb, memb2, bone):
    """Крыло летучей мыши: кость-дуга, пальцы вниз и перепонка с фестонами между ними."""
    pts = [root] + arc
    edge = []
    for i in range(len(ends)):
        edge.append(ends[i])
        if i + 1 < len(ends):  # фестон: край перепонки поднимается между пальцами
            mx, my = (ends[i][0] + ends[i + 1][0]) // 2, (ends[i][1] + ends[i + 1][1]) // 2 - 9
            edge.append((mx, my))
    _poly(s, memb, pts + list(reversed(edge)) + [(root[0] + 2, root[1] + 10)])
    for a, b in zip(arc, arc[1:]):  # тёмно-алый отсвет под костью
        _poly(s, memb2, [a, b, (b[0], b[1] + 4), (a[0], a[1] + 4)])
    fingers = arc[1:] if len(arc) == len(ends) + 1 else arc[-len(ends):]
    for f, e in zip(fingers, ends):
        _line(s, bone, f, e)
    _line(s, bone, root, arc[0], 2)
    for a, b in zip(arc, arc[1:]):
        _line(s, bone, a, b, 2)


def seraph(stage2=False, pose="idle", flap=0):
    """Алый Серафим. pose: idle (копьё у ноги), raised (замах над головой), swing (выпад влево)."""
    s = pygame.Surface((SERAPH_W, SERAPH_H), pygame.SRCALPHA)
    mark = MARK if stage2 else BONE
    mark2 = MARK2 if stage2 else BONE2
    memb, memb2 = (MEMB_2, MEMB2_2) if stage2 else (MEMB, MEMB2)
    up = -2 if flap else 0
    if stage2:  # второе крыло прорастает за головой
        _wing(s, (25, 16), [(19, 6 + up), (12, 1 + up), (5, 2 + up)], [(7, 20), (12, 24), (18, 22)], memb, memb2, mark2)
    # главное крыло — за спиной (справа)
    _wing(s, (33, 18), [(40, 9 + up), (46, 6 + up), (52, 4 + up), (58, 5 + up), (63, 8 + up), (66, 13 + up)],
          [(41, 36), (46, 43), (52, 47), (57, 43), (62, 36), (66, 28)], memb, memb2, mark)
    # ноги: передняя шагнула вперёд
    _poly(s, BODY, [(24, 34), (28, 34), (26, 45), (22, 57), (18, 57), (23, 45)])
    _poly(s, BODY, [(28, 34), (31, 34), (31, 45), (32, 57), (29, 57), (28, 45)])
    _line(s, mark, (26, 36), (20, 56))
    _line(s, BODY2, (31, 35), (31, 56))
    # торс: широкие плечи, узкая талия
    _poly(s, BODY, [(21, 17), (35, 17), (33, 25), (31, 35), (24, 35), (23, 25)])
    _line(s, BODY2, (34, 17), (31, 34))
    _line(s, mark, (33, 18), (25, 32), 2)       # косая кость через грудь
    _line(s, mark, (22, 19), (24, 24))           # рёбра
    _line(s, mark, (31, 21), (31, 25))
    _line(s, mark, (22, 17), (26, 17))           # наплечная кость
    _line(s, mark2, (25, 27), (28, 27))
    # голова и шея, капюшон-грива назад
    pygame.draw.rect(s, BODY, (26, 14, 4, 4))
    pygame.draw.ellipse(s, BODY, (23, 4, 9, 11))
    _poly(s, BODY, [(30, 5), (35, 9), (34, 16), (30, 13)])
    _poly(s, mark, [(23, 8), (27, 6), (27, 9), (24, 11)])  # костяная маска
    if stage2:  # рога
        _poly(s, mark, [(24, 6), (21, 0), (25, 4)])
        _poly(s, mark, [(29, 5), (32, 0), (31, 6)])
        s.set_at((24, 8), EYE2)
        s.set_at((25, 8), EYE2)
        s.set_at((24, 9), MARK)
    else:
        s.set_at((24, 8), EYE)
    blade = (MARK, EYE2) if stage2 else (BONE, BONE2)
    if pose == "idle":  # рука вниз, копьё стоит у ноги
        _line(s, BODY, (22, 18), (18, 25), 3)
        _line(s, BODY, (18, 25), (15, 31), 3)
        _line(s, BODY2, (14, 9), (14, 56))
        _poly(s, blade[0], [(14, 1), (16, 8), (14, 11), (12, 8)])
        _line(s, blade[1], (14, 3), (14, 9))
    elif pose == "raised":  # копьё над головой, остриём к герою
        _line(s, BODY, (22, 18), (19, 11), 3)
        _line(s, BODY, (19, 11), (21, 5), 3)
        _line(s, BODY2, (8, 5), (44, 3))
        _poly(s, blade[0], [(0, 6), (8, 3), (11, 5), (8, 8)])
        _line(s, blade[1], (2, 6), (9, 5))
    else:  # выпад: рука и копьё вытянуты влево
        _line(s, BODY, (22, 18), (15, 20), 3)
        _line(s, BODY, (15, 20), (8, 21), 3)
        _line(s, BODY2, (8, 21), (30, 21))
        _poly(s, blade[0], [(0, 21), (8, 18), (10, 21), (8, 24)])
        _line(s, blade[1], (2, 21), (8, 21))
    return outlined(s)


def make_seraph_frames(stage2=False):
    idle = seraph(stage2, "idle", 0)
    idle2 = seraph(stage2, "idle", 1)
    raised = seraph(stage2, "raised", 1)
    swing = seraph(stage2, "swing", 0)
    glow = (255, 120, 60) if stage2 else (255, 60, 40)
    frames = {
        "idle": [idle, idle2],
        "windup": [tinted(raised, glow, 0.35), raised],
        "attack": [swing],
        "hurt": [tinted(idle, (255, 255, 255), 0.8)],
        "dead": [crouched(tinted(idle, (50, 20, 20), 0.5))],
        "enraged": [idle, idle2],
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


def hound(pose="idle"):
    """Адская гончая: чёрный зверь с белыми рёбрами наружу и огнём в пасти."""
    s = pygame.Surface((36, 22), pygame.SRCALPHA)
    dx = -3 if pose == "attack" else 0
    _line(s, BODY, (30, 9), (35, 4), 2)  # хвост
    pygame.draw.ellipse(s, BODY, (10 + dx, 6, 22, 10))
    for x0, x1 in ((13, 11), (17, 16), (25, 26), (29, 31)):  # лапы
        stretch = 2 if pose == "attack" else 0
        _line(s, BODY, (x0 + dx, 13), (x1 + dx - stretch * (x0 < 20), 21), 2)
    for x in (16, 19, 22, 25):  # рёбра
        _line(s, BONE, (x + dx, 8), (x + dx - 1, 12))
    for x in (14, 18, 22, 26):  # шипы на хребте
        _poly(s, BONE2, [(x + dx, 6), (x + dx + 2, 3), (x + dx + 3, 6)])
    hx = 2 + dx
    _poly(s, BODY, [(hx, 9), (hx + 4, 6), (hx + 11, 6), (hx + 11, 13), (hx + 5, 12)])
    _line(s, BODY, (hx + 7, 6), (hx + 8, 1), 2)  # уши
    _line(s, BODY, (hx + 10, 6), (hx + 12, 2), 2)
    s.set_at((hx + 5, 8), EYE)
    s.set_at((hx + 6, 8), EYE)
    if pose == "attack":  # пасть раскрыта, внутри огонь
        _poly(s, BODY, [(hx, 12), (hx + 6, 12), (hx + 6, 16), (hx + 1, 15)])
        _line(s, MARK, (hx + 1, 12), (hx + 5, 13))
        _line(s, BONE, (hx, 11), (hx + 4, 11))
    else:
        _line(s, BONE, (hx + 1, 11), (hx + 4, 11))  # клыки
    return outlined(s)


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
    idle = hound("idle")
    return {
        "idle": [idle, shifted_breath(idle, 10)],
        "windup": [tinted(idle, (255, 90, 50), 0.35), idle],
        "attack": [hound("attack")],
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
    """Алая Бездна: багровое небо «мазками», чёрное солнце, рёбра исполина на горизонте,
    обсидиановые шпили и чёрная скала с раскалёнными трещинами."""
    rnd = random.Random(seed)
    surf = pygame.Surface((w, h))
    horizon = 108
    stops = [(0.0, (96, 4, 8)), (0.6, (150, 12, 14)), (1.0, (196, 40, 22))]
    for y in range(horizon):
        t = y / (horizon - 1)
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                pygame.draw.line(surf, _lerp(c0, c1, (t - t0) / (t1 - t0)), (0, y), (w, y))
                break
    for _ in range(900):  # мазки краски: небо неровное, как на холсте
        x, y = rnd.randrange(w), rnd.randrange(horizon)
        base = surf.get_at((x, y))
        k = rnd.uniform(-22, 18)
        col = (max(0, min(255, int(base.r + k))), max(0, int(base.g + k * 0.15)), max(0, int(base.b + k * 0.12)))
        pygame.draw.rect(surf, col, (x, y, rnd.randint(2, 7), rnd.randint(1, 2)))
    # чёрное солнце с алой короной
    sx, sy = 232, 38
    for r, col in ((24, (170, 30, 20)), (20, (230, 80, 40)), (18, (255, 150, 80)), (16, (14, 6, 8))):
        pygame.draw.circle(surf, col, (sx, sy), r)
    for _ in range(40):  # протуберанцы
        a = rnd.uniform(0, 6.283)
        r0 = 18 + rnd.randint(0, 6)
        surf.set_at((int(sx + math.cos(a) * r0), int(sy + math.sin(a) * r0)), (255, 190, 120))
    # летающие обломки скал
    for cx, cy, sz in ((52, 30, 6), (84, 18, 4), (150, 46, 5), (286, 70, 4), (120, 70, 3)):
        _poly(surf, (24, 6, 10), [(cx - sz, cy), (cx - sz // 2, cy - sz // 2), (cx + sz, cy - 1), (cx + sz // 2, cy + sz)])
    # рёбра исполина на горизонте
    bone_far = (82, 30, 30)
    _line(surf, bone_far, (150, horizon - 6), (300, horizon - 10), 3)
    for i, x in enumerate(range(158, 296, 16)):
        hgt = 34 - abs(i - 4) * 3
        pygame.draw.arc(surf, bone_far, (x - 4, horizon - 8 - hgt, 18, hgt * 2), 1.3, 3.1, 2)
    # дальние скалы
    pts, y = [(0, h)], 98
    for x in range(0, w + 6, 6):
        y = max(90, min(104, y + rnd.randint(-3, 3)))
        pts.append((x, y))
    pts.append((w, h))
    _poly(surf, (64, 10, 12), pts)
    # обсидиановые шпили по краям (середина свободна для боя)
    for x0, top, wd in ((4, 28, 14), (22, 52, 10), (34, 70, 8), (276, 60, 9), (290, 34, 13), (308, 54, 10)):
        _poly(surf, (14, 6, 10), [(x0, horizon + 4), (x0 + wd // 2, top), (x0 + wd, horizon + 4)])
        _line(surf, (60, 14, 18), (x0 + wd // 2, top + 3), (x0 + wd // 2 + 1, horizon))
    # земля: чёрная скала
    for yy in range(horizon, h):
        t = (yy - horizon) / (h - horizon)
        pygame.draw.line(surf, _lerp((104, 26, 22), (62, 14, 14), t), (0, yy), (w, yy))
    for _ in range(int(w * (h - horizon) * 0.05)):
        x, yy = rnd.randrange(w), rnd.randrange(horizon + 2, h)
        surf.set_at((x, yy), rnd.choice([(120, 36, 28), (70, 16, 16), (136, 44, 32)]))
    # раскалённые трещины
    for _ in range(14):
        x, yy = rnd.randrange(w), rnd.randrange(horizon + 8, h - 4)
        for _ in range(rnd.randint(3, 6)):
            nx, ny = x + rnd.randint(-10, 10), yy + rnd.randint(-2, 3)
            _line(surf, (230, 70, 30), (x, yy), (nx, ny))
            if rnd.random() < 0.5:
                surf.set_at((x, yy), (255, 150, 60))
            x, yy = nx, ny
    # пепел и искры в воздухе
    for _ in range(70):
        surf.set_at((rnd.randrange(w), rnd.randrange(h - 10)), rnd.choice([(255, 140, 60), (255, 200, 120), (60, 20, 20)]))
    return surf
