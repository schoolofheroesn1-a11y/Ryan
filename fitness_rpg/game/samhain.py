"""Шпиль Самайна — хеллоуинский режим: фон башни, Пухоглот и Королева Тринадцатого Ока.

Рисуется примитивами pygame, затем — чёрный контур, как у демонов Бездны. Враги смотрят влево.
"""
import math
import random

import pygame

from game.abyss import _line, _poly, outlined
from game.art import _lerp, crouched, shifted_breath, tinted

# ---------------------------------------------------------------- Пухоглот
# Пушистое облачко-обжора: две тучки-помпона на макушке, сонные тяжёлые веки, рот с двумя клыками,
# коротенькие лапки и завиток-«тройка» на боку. Кусает парами и высасывает силы.
FLUFF_W, FLUFF_H = 32, 30
FUR, FUR2, FUR3 = (236, 230, 246), (196, 184, 222), (150, 132, 186)   # свет, полутень, тень
LID = (120, 98, 160)
IRIS = (255, 150, 40)  # тыквенный огонёк в глазах
MOUTH, FANG = (54, 16, 40), (255, 252, 240)


def _cloud(s, col, blobs):
    for x, y, r in blobs:
        pygame.draw.circle(s, col, (x, y), r)


def fluff(pose="idle"):
    s = pygame.Surface((FLUFF_W, FLUFF_H), pygame.SRCALPHA)
    dy = {"idle": 0, "puff": -1, "attack": 2, "down": 0}[pose]
    big = 1 if pose == "puff" else 0
    # лапки
    for lx in (11, 19):
        pygame.draw.rect(s, FUR3, (lx, 25, 4, 4))
        pygame.draw.rect(s, FUR2, (lx, 25, 3, 3))
    # тело: облако из кругов (тень снизу-справа, свет сверху-слева)
    body = [(16, 18 + dy, 10 + big), (9, 19 + dy, 6 + big), (23, 19 + dy, 6 + big), (16, 12 + dy, 8 + big)]
    _cloud(s, FUR3, [(x + 1, y + 1, r) for x, y, r in body])
    _cloud(s, FUR2, body)
    _cloud(s, FUR, [(x - 1, y - 1, r - 2) for x, y, r in body])
    # две тучки-помпона на макушке
    for px, py in ((11, 5 + dy), (20, 4 + dy)):
        _cloud(s, FUR2, [(px, py, 4), (px + 3, py + 1, 3)])
        _cloud(s, FUR, [(px - 1, py - 1, 2), (px + 2, py, 2)])
    # завиток-«тройка» на боку
    pygame.draw.arc(s, FUR3, (21, 15 + dy, 5, 4), -1.6, 1.6)
    pygame.draw.arc(s, FUR3, (21, 18 + dy, 5, 4), -1.6, 1.6)
    # сонные глаза: тяжёлые веки закрывают верх, внизу — тыквенный огонёк
    ey = 13 + dy
    for ex in (8, 15):
        pygame.draw.ellipse(s, (30, 14, 40), (ex, ey, 5, 4))
        s.set_at((ex + 1, ey + 2), IRIS)
        s.set_at((ex + 2, ey + 2), IRIS)
        lid_h = 1 if pose in ("puff", "attack") else 2  # перед укусом глаза приоткрываются
        pygame.draw.rect(s, LID, (ex, ey, 5, lid_h))
        _line(s, FUR3, (ex - 1, ey - 1), (ex + 5, ey))  # бровь-веко
    # рот с двумя клыками
    my = 19 + dy
    if pose == "attack":  # пасть распахнута
        pygame.draw.ellipse(s, MOUTH, (5, my - 1, 12, 7))
        pygame.draw.ellipse(s, (120, 30, 60), (8, my + 3, 6, 2))  # язык
        _poly(s, FANG, [(7, my), (9, my), (8, my + 3)])
        _poly(s, FANG, [(13, my), (15, my), (14, my + 3)])
    else:
        w = 10 if pose == "puff" else 9
        pygame.draw.ellipse(s, MOUTH, (6, my, w, 4))
        _poly(s, FANG, [(7, my + 1), (9, my + 1), (8, my + 4)])
        _poly(s, FANG, [(12, my + 1), (14, my + 1), (13, my + 4)])
    return outlined(s, (34, 20, 44))


def make_fluff_frames():
    idle, puff, bite = fluff("idle"), fluff("puff"), fluff("attack")
    return {
        "idle": [idle, shifted_breath(idle, 12)],
        "windup": [tinted(puff, (255, 150, 60), 0.3), puff],
        "attack": [bite],
        "hurt": [tinted(idle, (255, 255, 255), 0.8)],
        "dead": [crouched(tinted(idle, (70, 60, 90), 0.5))],
    }


# ---------------------------------------------------------------- Королева Тринадцатого Ока
# Высокая ведьма-королева: квадратное бледное лицо, синие глаз и губы, чёрные волосы с золотом,
# золотые рога-корона, посох с синим навершием, чёрно-золотая мантия с синими завитками и
# огромным золотым Оком на груди. Когда Око открыто, бить нельзя: взгляд отражает удар.
QUEEN_W, QUEEN_H = 48, 74
ROBE, ROBE2 = (18, 14, 22), (38, 30, 44)
GOLD, GOLD2 = (236, 186, 70), (170, 116, 36)
SKIN, SKIN2 = (236, 228, 214), (196, 184, 172)
BLUE, BLUE2 = (70, 150, 255), (40, 80, 180)
HAIR = (12, 10, 14)


def queen(pose="idle", eye="closed", fury=False, sway=0):
    s = pygame.Surface((QUEEN_W, QUEEN_H), pygame.SRCALPHA)
    blue, blue2 = ((130, 210, 255), (70, 150, 255)) if fury else (BLUE, BLUE2)
    # посох: в замахе поднят и отведён, в ударе — выброшен вперёд
    if pose == "raised":  # посох занесён над головой, навершие позади короны
        st0, st1 = (36, 3), (6, 44)
    elif pose == "strike":
        st0, st1 = (0, 22), (18, 48)
    else:
        st0, st1 = (8, 8 + sway), (8, 73)
    # мантия: широкий конус, подол волнами
    hem = [(4, 73), (10, 70), (16, 73), (22, 70), (28, 73), (34, 70), (40, 73), (45, 72)]
    _poly(s, ROBE, [(17, 24), (31, 24), (38, 46), (45, 72)] + list(reversed(hem)))
    _poly(s, ROBE2, [(28, 26), (31, 24), (38, 46), (45, 72), (40, 73), (33, 50)])  # отсвет справа
    # золотая кайма по краям и по подолу
    _line(s, GOLD2, (17, 24), (4, 73))
    _line(s, GOLD2, (31, 24), (45, 72))
    for a, b in zip(hem, hem[1:]):
        _line(s, GOLD, a, b)
    # центральная полоса мантии с синими завитками
    _poly(s, (26, 20, 34), [(21, 44), (27, 44), (31, 72), (17, 72)])
    _line(s, GOLD2, (21, 44), (17, 72))
    _line(s, GOLD2, (27, 44), (31, 72))
    for yy in (50, 58, 66):
        pygame.draw.arc(s, blue2, (18, yy, 6, 5), 0, 4.2)
        pygame.draw.arc(s, blue, (24, yy + 2, 6, 5), 3.1, 7.2)
    # синие завитки и знаки-глаза по бокам мантии
    for cx, cy in ((11, 58), (37, 60)):
        pygame.draw.ellipse(s, GOLD2, (cx - 3, cy - 2, 7, 4), 1)
        s.set_at((cx, cy), blue)
    pygame.draw.arc(s, blue2, (6, 44, 8, 8), 0.5, 4.5)
    pygame.draw.arc(s, blue2, (34, 46, 8, 8), -1.4, 2.6)
    # плечи-наплечники: золотые дуги
    pygame.draw.ellipse(s, ROBE2, (13, 22, 22, 10))
    pygame.draw.arc(s, GOLD, (13, 22, 22, 10), 0.2, 2.9, 2)
    # Око на груди
    ex, ey = 24, 36
    pygame.draw.ellipse(s, GOLD2, (ex - 8, ey - 5, 17, 11))
    if eye == "open":
        pygame.draw.ellipse(s, (255, 244, 210), (ex - 7, ey - 4, 15, 9))
        pygame.draw.circle(s, blue, (ex, ey), 3)
        pygame.draw.circle(s, (10, 10, 30), (ex, ey), 1)
        s.set_at((ex + 1, ey - 2), (255, 255, 255))
        for k in range(-3, 4, 2):  # золотые ресницы-лучи
            _line(s, GOLD, (ex + k * 2, ey - 6), (ex + k * 3, ey - 9))
    elif eye == "half":
        pygame.draw.ellipse(s, (255, 244, 210), (ex - 6, ey - 1, 13, 5))
        pygame.draw.circle(s, blue2, (ex, ey + 1), 2)
        pygame.draw.rect(s, GOLD, (ex - 7, ey - 3, 15, 3))
    else:  # закрытое веко: золотая дуга
        pygame.draw.ellipse(s, GOLD, (ex - 7, ey - 4, 15, 9))
        pygame.draw.arc(s, GOLD2, (ex - 6, ey - 2, 13, 6), 3.4, 6.0)
        for k in (-4, 0, 4):
            _line(s, GOLD2, (ex + k, ey + 2), (ex + k, ey + 4))
    # рука в широком рукаве держит посох
    hand = (st0[0] + (st1[0] - st0[0]) * 0.45, st0[1] + (st1[1] - st0[1]) * 0.45)
    hand = (int(hand[0]), int(hand[1]))
    _poly(s, ROBE2, [(16, 26), (20, 30), (hand[0] + 3, hand[1] + 3), (hand[0] - 1, hand[1] + 1)])
    _line(s, GOLD2, (16, 26), (hand[0] - 1, hand[1] + 1))
    # посох с синим навершием
    _line(s, GOLD2, st0, st1, 2)
    _line(s, GOLD, st0, (st0[0] + (st1[0] - st0[0]) // 3, st0[1] + (st1[1] - st0[1]) // 3))
    orb = (st0[0], st0[1] - 1)
    pygame.draw.circle(s, GOLD, orb, 3)
    pygame.draw.circle(s, blue2, orb, 2)
    s.set_at((orb[0] - 1, orb[1] - 1), (220, 240, 255))
    pygame.draw.circle(s, SKIN2, hand, 2)
    # шея и лицо: квадратное, бледное
    pygame.draw.rect(s, SKIN2, (21, 19, 5, 5))
    pygame.draw.rect(s, SKIN, (17, 8, 12, 13))
    pygame.draw.rect(s, SKIN2, (26, 8, 3, 13))
    # чёрные волосы с золотыми прядями по сторонам лица, ниже плеч
    _poly(s, HAIR, [(15, 6), (31, 6), (33, 30), (29, 28), (29, 10), (17, 10), (16, 26), (13, 28)])
    _line(s, GOLD2, (30, 12), (32, 26))
    _line(s, GOLD2, (15, 12), (14, 24))
    _poly(s, HAIR, [(17, 7), (29, 7), (29, 10), (17, 11)])  # чёлка
    # лицо смотрит влево: синий глаз, синие губы
    pygame.draw.rect(s, (250, 250, 255), (18, 13, 4, 2))
    pygame.draw.rect(s, blue, (18, 13, 2, 2))
    pygame.draw.rect(s, (250, 250, 255), (24, 13, 3, 2))
    pygame.draw.rect(s, blue, (24, 13, 1, 2))
    _line(s, (40, 30, 40), (18, 12), (21, 12))
    _line(s, (40, 30, 40), (24, 12), (26, 12))
    pygame.draw.rect(s, blue2 if not fury else blue, (19, 18, 4, 1))
    s.set_at((20, 17), blue2)
    # золотые рога-корона
    for base, tip in (((18, 7), (12, 0)), ((28, 7), (34, 0))):
        _poly(s, GOLD2, [base, (base[0] + (2 if base[0] < 24 else -2), base[1]), tip])
        _line(s, GOLD, base, tip)
    _poly(s, GOLD, [(19, 7), (21, 3), (23, 6), (25, 2), (27, 7)])  # зубцы короны
    s.set_at((23, 5), blue)
    return outlined(s, (6, 4, 10))


def make_eyequeen_frames():
    idle = queen("idle", "closed", sway=0)
    idle2 = queen("idle", "closed", sway=1)
    raised = queen("raised", "half")
    strike = queen("strike", "half")
    gaze = queen("idle", "open")
    fury = queen("idle", "closed", True)
    fury2 = queen("idle", "closed", True, 1)
    glow = (120, 190, 255)
    return {
        "idle": [idle, idle2],
        "windup": [tinted(raised, glow, 0.3), raised],
        "attack": [strike],
        "hurt": [tinted(idle, (255, 255, 255), 0.8)],
        "dead": [crouched(tinted(idle, (40, 40, 70), 0.5))],
        "enraged": [fury, fury2],
        "gaze": [gaze, queen("idle", "open", sway=1)],
    }


# ---------------------------------------------------------------- фон
def make_spire_background(w=320, h=180, seed=1031):
    """Зал Шпиля Самайна: каменная кладка, стрельчатые окна в лиловую ночь с тыквенной луной,
    свечи, тыквы-фонари вдоль пола, паутина в углах и уходящая вверх винтовая лестница."""
    rnd = random.Random(seed)
    surf = pygame.Surface((w, h))
    floor_y = 132
    # стены: вертикальный градиент и кирпичная кладка
    for y in range(floor_y):
        pygame.draw.line(surf, _lerp((20, 14, 30), (46, 32, 52), y / floor_y), (0, y), (w, y))
    for row, y in enumerate(range(0, floor_y, 8)):
        off = 0 if row % 2 else 9
        _line(surf, (14, 10, 20), (0, y), (w, y))
        for x in range(off, w, 18):
            _line(surf, (14, 10, 20), (x, y), (x, y + 7))
            if rnd.random() < 0.25:  # редкие светлые камни
                pygame.draw.rect(surf, (54, 40, 60), (x + 1, y + 1, rnd.randint(4, 16), 6))
    # стрельчатые окна в лиловую ночь
    def window(x, top, wd, ht, moon=False):
        sky = pygame.Surface((wd, ht))
        for yy in range(ht):
            pygame.draw.line(sky, _lerp((24, 10, 46), (96, 40, 92), yy / ht), (0, yy), (wd, yy))
        for _ in range(wd * ht // 40):
            sky.set_at((rnd.randrange(wd), rnd.randrange(ht)), (200, 180, 230))
        if moon:  # тыквенная луна
            pygame.draw.circle(sky, (150, 70, 20), (wd // 2 + 3, ht // 3), 10)
            pygame.draw.circle(sky, (255, 160, 60), (wd // 2 + 3, ht // 3), 9)
            pygame.draw.circle(sky, (255, 200, 110), (wd // 2 + 1, ht // 3 - 2), 5)
            for k in (-4, 0, 4):
                _line(sky, (220, 120, 40), (wd // 2 + 3 + k, ht // 3 - 8), (wd // 2 + 3 + k, ht // 3 + 8))
            _poly(sky, (16, 8, 24), [(wd // 2 - 12, ht // 3 + 12), (wd // 2 - 6, ht // 3 + 6), (wd // 2 - 2, ht // 3 + 10)])  # летучая мышь
        mask = pygame.Surface((wd, ht), pygame.SRCALPHA)
        pygame.draw.rect(mask, (255, 255, 255, 255), (0, wd // 2, wd, ht))
        pygame.draw.ellipse(mask, (255, 255, 255, 255), (0, 0, wd, wd))
        sky.set_colorkey(None)
        out = pygame.Surface((wd, ht), pygame.SRCALPHA)
        out.blit(sky, (0, 0))
        out.blit(mask, (0, 0), special_flags=pygame.BLEND_RGBA_MULT)
        surf.blit(out, (x, top))
        pygame.draw.ellipse(surf, (80, 60, 70), (x - 2, top - 2, wd + 4, wd + 4), 2)
        pygame.draw.rect(surf, (80, 60, 70), (x - 2, top + wd // 2, 2, ht - wd // 2))
        pygame.draw.rect(surf, (80, 60, 70), (x + wd, top + wd // 2, 2, ht - wd // 2))
        _line(surf, (30, 20, 34), (x + wd // 2, top + 2), (x + wd // 2, top + ht - 1), 2)  # переплёт
        _line(surf, (30, 20, 34), (x, top + ht // 2), (x + wd, top + ht // 2), 2)
        pygame.draw.rect(surf, (70, 52, 62), (x - 4, top + ht, wd + 8, 3))  # подоконник

    window(36, 24, 26, 54)
    window(140, 14, 40, 70, moon=True)
    window(258, 24, 26, 54)
    # лиловый свет из окон на полу
    glow = pygame.Surface((w, h), pygame.SRCALPHA)
    for cx, r in ((49, 20), (160, 34), (271, 20)):
        _poly(glow, (140, 80, 200, 26), [(cx - r // 2, 80), (cx + r // 2, 80), (cx + r, floor_y), (cx - r, floor_y)])
    surf.blit(glow, (0, 0))
    # винтовая лестница уходит вверх (справа, за окном)
    for i in range(7):
        x0, y0 = 300 - i * 4, floor_y - 6 - i * 12
        pygame.draw.rect(surf, (30, 22, 34), (x0, y0, 20, 4))
        _line(surf, (70, 54, 66), (x0, y0), (x0 + 20, y0))
    # пол из плит
    for y in range(floor_y, h):
        pygame.draw.line(surf, _lerp((54, 40, 54), (20, 14, 22), (y - floor_y) / (h - floor_y)), (0, y), (w, y))
    for y in (floor_y, floor_y + 10, floor_y + 24):
        _line(surf, (24, 16, 26), (0, y), (w, y))
    for x in range(-20, w + 40, 28):
        _line(surf, (24, 16, 26), (x, floor_y), (x - 14, h))
    # тыквы-фонари вдоль пола
    def pumpkin(x, y, r):
        pygame.draw.ellipse(surf, (150, 66, 14), (x - r - 2, y - r, 2 * r + 4, 2 * r))
        pygame.draw.ellipse(surf, (230, 110, 26), (x - r, y - r, 2 * r, 2 * r))
        pygame.draw.ellipse(surf, (190, 86, 18), (x - r // 3, y - r, 2 * r // 3, 2 * r))
        pygame.draw.rect(surf, (60, 90, 30), (x - 1, y - r - 3, 2, 3))
        lit = (255, 220, 90)
        _poly(surf, lit, [(x - r + 2, y - 2), (x - r // 2, y - 4), (x - r // 3, y - 1)])
        _poly(surf, lit, [(x + r - 2, y - 2), (x + r // 2, y - 4), (x + r // 3, y - 1)])
        _poly(surf, lit, [(x - r + 2, y + 2), (x + r - 2, y + 2), (x, y + r - 2)])
        halo = pygame.Surface((w, h), pygame.SRCALPHA)
        pygame.draw.circle(halo, (255, 140, 40, 26), (x, y), r * 3)
        surf.blit(halo, (0, 0))

    for x, r in ((14, 6), (28, 4), (118, 5), (214, 4), (302, 6)):
        pumpkin(x, floor_y + 4 - r // 2, r)
    # свечи на подоконниках и полу
    for x, y in ((40, 80), (54, 80), (262, 80), (278, 80), (100, 136), (240, 134)):
        pygame.draw.rect(surf, (230, 220, 200), (x, y - 5, 2, 5))
        surf.set_at((x, y - 6), (255, 200, 80))
        surf.set_at((x, y - 7), (255, 240, 170))
    # паутина в верхних углах
    for cx, sgn in ((0, 1), (w - 1, -1)):
        for k in range(5):
            a = k * (math.pi / 2) / 4
            _line(surf, (120, 110, 130), (cx, 0), (cx + sgn * int(34 * math.cos(a)), int(34 * math.sin(a))))
        for rr in (10, 18, 26):
            pts = [(cx + sgn * int(rr * math.cos(k * (math.pi / 2) / 4)), int(rr * math.sin(k * (math.pi / 2) / 4))) for k in range(5)]
            pygame.draw.lines(surf, (100, 90, 112), False, pts)
    # висящий паучок
    _line(surf, (100, 90, 112), (92, 0), (92, 22))
    pygame.draw.circle(surf, (14, 10, 18), (92, 24), 2)
    surf.set_at((91, 24), (255, 120, 40))
    return surf
