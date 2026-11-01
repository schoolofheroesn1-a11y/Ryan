"""Полуночный Охотник — босс Шпиля Самайна (11-й этаж), две стадии.

Ночной хищник-полузверь: громадный сгорбленный корпус в индиговой шкуре, костяной гребень шипов
по хребту, тяжёлые рога, загнутые назад, огромные уши-перепонки, вытянутая морда с пастью клыков,
горящие янтарные глаза, могучие руки с тремя когтями-серпами, звериные ноги и хвост с костяным жалом.

I «Сумерки» — пригнулся для броска, крылья сложены. II «Полночь» — за спиной раскрываются
огромные перепончатые крылья, на груди загораются трещины-руны, глаза раскаляются добела,
рога светятся на концах.

Объём — светотенью по маске каждой детали: лунный свет сверху-слева, тень снизу-справа, холодный
синий отсвет по правому краю. Смотрит влево, на героя.
"""
import math
import random

import pygame

from game.abyss import outlined
from game.art import crouched, tinted

W, H = 124, 104
G = H - 1  # земля

HIDE = [(10, 12, 28), (26, 30, 62), (46, 56, 104), (84, 100, 160)]
BELLY = [(40, 40, 70), (78, 76, 112), (120, 116, 152), (168, 164, 196)]
BONE = [(110, 98, 86), (170, 158, 138), (218, 208, 186), (246, 240, 224)]
HORN = [(36, 30, 32), (92, 80, 74), (160, 146, 128), (220, 208, 186)]
MEMB = [(16, 8, 30), (40, 22, 64), (70, 42, 104), (112, 76, 156)]
MAW = (34, 6, 14)
RIM = (120, 156, 255)
EYE1, EYE2, EYE_HOT = (255, 170, 40), (255, 236, 140), (255, 255, 240)
RUNE, RUNE_HOT = (110, 200, 255), (220, 246, 255)


# ---------------------------------------------------------------- светотень
def _mix(a, b, k):
    return tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(3))


def _run(m, x, y, dx, dy, cap=6):
    for k in range(1, cap + 1):
        nx, ny = x + dx * k, y + dy * k
        if not (0 <= nx < W and 0 <= ny < H) or not m.get_at((nx, ny)):
            return k
    return cap + 1


_TEX = random.Random(11)


def part(s, pal, draw, rim=True, soft=False, tex=0):
    """Закрасить деталь тонами палитры по её маске: блик и свет сверху-слева, тень снизу-справа."""
    t = pygame.Surface((W, H), pygame.SRCALPHA)
    draw(t)
    m = pygame.mask.from_surface(t)
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
            if rim and _run(m, x, y, 1, 0) == 1 and _run(m, x, y, 1, -1) <= 2:
                c = _mix(c, RIM, 0.5)
            s.set_at((x, y), c)
    for _ in range(tex):  # фактура шкуры: короткие тёмные чешуйки и светлые волоски внутри детали
        x, y = _TEX.randrange(W), _TEX.randrange(H)
        if m.get_at((x, y)) and _run(m, x, y, 0, 1) > 2 and _run(m, x, y, -1, 0) > 1 and _run(m, x, y, 1, 0) > 1:
            dl = _run(m, x, y, -1, -1)
            col = pal[0] if dl > 2 else _mix(pal[2], pal[3], 0.5)
            line(s, col, (x, y), (x + _TEX.choice((-1, 0, 1)), y + 2))
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


def limb(a, b, ha, hb):
    """Четырёхугольник сегмента конечности от a до b с полутолщинами ha и hb."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n, dx / n
    return [(a[0] + nx * ha, a[1] + ny * ha), (b[0] + nx * hb, b[1] + ny * hb), (b[0] - nx * hb, b[1] - ny * hb), (a[0] - nx * ha, a[1] - ny * ha)]


def chain(pts, widths):
    """Конечность по суставам: сегменты и круглые суставы."""
    fns = [poly(limb(a, b, widths[i], widths[i + 1])) for i, (a, b) in enumerate(zip(pts, pts[1:]))]
    fns += [ell((p[0] - widths[i], p[1] - widths[i], widths[i] * 2, widths[i] * 2)) for i, p in enumerate(pts[1:-1], 1)]
    return many(*fns)


# ---------------------------------------------------------------- детали
def claws(s, hand, direction, long=13, n=3):
    """Три когтя-серпа: толстые у основания, загнуты, светлая кромка."""
    for k in range(n):
        a = direction + (k - (n - 1) / 2) * 0.34
        pts = []
        for i in range(long + 1):
            q = i / long
            bend = a + q * 0.7  # серп загибается
            pts.append((hand[0] + math.cos(bend) * i, hand[1] + math.sin(bend) * i))
        for i, (x, y) in enumerate(pts):
            w = 2 if i < long * 0.45 else 1
            pygame.draw.rect(s, BONE[1] if i < long * 0.7 else BONE[0], (round(x), round(y), w, w))
        for x, y in pts[: int(long * 0.6)]:
            s.set_at((round(x), round(y)), BONE[3])


def wings(s, spread):
    """Огромные перепончатые крылья за спиной (стадия «Полночь»). spread 0..1 — насколько раскрыты."""
    root = (78, 26)
    for side, pal_rim in ((-1, False), (1, True)):
        # кости: плечо крыла и четыре пальца веером
        reach = 1.0 if side > 0 else 1.5  # левое крыло — над головой, к краю кадра
        elbow = (root[0] + side * 22 * reach * (0.6 + 0.4 * spread), 6 + 6 * (1 - spread))
        tips = [(elbow[0] + side * dx * reach * (0.55 + 0.45 * spread), y) for dx, y in ((24, 1), (32, 16), (30, 36), (18, 54))]
        tips = [(max(1, min(W - 2, x)), max(1, y)) for x, y in tips]
        edge = []
        for a, b in zip(tips, tips[1:]):
            mid = ((a[0] + b[0]) / 2 - side * 7, (a[1] + b[1]) / 2 + 2)
            edge += [a, mid]
        edge.append(tips[-1])
        memb = [root, elbow] + edge + [(root[0] + side * 4, 58)]
        part(s, MEMB, poly(memb), rim=pal_rim, soft=True)
        for t in tips:  # жилки перепонки
            line(s, MEMB[3], elbow, t)
            line(s, MEMB[0], (elbow[0], elbow[1] + 1), (t[0], t[1] + 1))
        line(s, HIDE[2], root, elbow, 3)
        line(s, HIDE[3], (root[0], root[1] - 1), (elbow[0], elbow[1] - 1))
        for t in tips:  # когти на концах пальцев крыла
            pygame.draw.polygon(s, BONE[2], [(t[0], t[1]), (t[0] + side * 3, t[1] - 3), (t[0] + side, t[1] + 1)])


def spine(s, pts, glow=False):
    """Костяной гребень: крупные шипы, загнутые назад; у основания темнее."""
    for i, (x, y, h) in enumerate(pts):
        tip = (x + h * 0.7, y - h)
        part(s, BONE, poly([(x - 3, y + 2), (x + 4, y + 2), (tip[0] + 1, tip[1] + 2), tip, (x + h * 0.25, y - h * 0.5)]), rim=False)
        line(s, BONE[3], (x - 1, y), (tip[0] - 1, tip[1] + 1))
        if glow:
            s.set_at((round(tip[0]), round(tip[1])), RUNE_HOT)


def head(s, hx, hy, pose, stage2):
    """Голова: крупная, вытянутая морда к герою, пасть с клыками, рога назад, уши-перепонки, глаза."""
    roar = pose == "roar"
    jaw = 9 if roar else 4 if pose in ("slash", "pounce") else 2
    # дальний рог и дальнее ухо
    part(s, HORN, poly([(hx + 22, hy + 3), (hx + 36, hy - 10), (hx + 50, hy - 14), (hx + 44, hy - 7), (hx + 28, hy + 8)]), rim=False)
    part(s, MEMB, poly([(hx + 24, hy + 8), (hx + 40, hy - 2), (hx + 34, hy + 14)]), rim=False, soft=True)
    # череп и верхняя челюсть — массивная морда
    part(s, HIDE, tex=20, draw=many(ell((hx + 8, hy, 26, 22)), poly([(hx + 12, hy + 6), (hx - 8, hy + 10), (hx - 11, hy + 15), (hx - 8, hy + 18), (hx + 10, hy + 19), (hx + 22, hy + 16)])))
    # нижняя челюсть: открывается
    part(s, HIDE, poly([(hx - 7, hy + 18 + jaw), (hx + 14, hy + 18), (hx + 24, hy + 22 + jaw // 2), (hx + 4, hy + 25 + jaw)]))
    if jaw > 2:
        pygame.draw.polygon(s, MAW, [(hx - 8, hy + 17), (hx + 14, hy + 18), (hx + 2, hy + 18 + jaw)])
        pygame.draw.ellipse(s, (120, 30, 50), (hx - 3, hy + 16 + jaw // 2, 8, 3))
    for i, x in enumerate(range(hx - 8, hx + 14, 3)):  # верхние клыки
        ln = 4 if i in (0, 4) else 2
        line(s, BONE[3], (x, hy + 17), (x, hy + 17 + ln + (jaw > 4)))
    for x in range(hx - 6, hx + 12, 3):  # нижние
        line(s, BONE[2], (x, hy + 18 + jaw), (x, hy + 15 + jaw))
    # ноздри, морщины морды, шрам
    s.set_at((hx - 9, hy + 12), (6, 4, 14))
    s.set_at((hx - 7, hy + 12), (6, 4, 14))
    line(s, HIDE[0], (hx - 4, hy + 10), (hx + 6, hy + 9))
    line(s, HIDE[3], (hx - 6, hy + 9), (hx + 4, hy + 7))
    line(s, HIDE[0], (hx + 14, hy + 9), (hx + 20, hy + 15))
    # глубокие глазницы и горящие глаза
    for ex in (hx + 5, hx + 13):
        pygame.draw.ellipse(s, (6, 4, 12), (ex - 2, hy + 4, 7, 5))
        s.set_at((ex, hy + 6), EYE1)
        s.set_at((ex + 1, hy + 6), EYE_HOT if stage2 else EYE2)
        s.set_at((ex + 2, hy + 6), EYE2 if stage2 else EYE1)
        s.set_at((ex + 1, hy + 5), EYE1)
    line(s, HIDE[0], (hx + 2, hy + 3), (hx + 18, hy + 4), 2)  # тяжёлая надбровная дуга
    line(s, HIDE[3], (hx + 3, hy + 2), (hx + 16, hy + 2))
    # ближнее ухо-перепонка, огромное
    part(s, MEMB, poly([(hx + 22, hy + 2), (hx + 30, hy - 16), (hx + 38, hy - 6), (hx + 30, hy + 10)]), soft=True)
    line(s, HIDE[2], (hx + 23, hy + 2), (hx + 30, hy - 15))
    line(s, (120, 70, 110), (hx + 26, hy), (hx + 33, hy - 8))
    # ближний рог: толстый, загибается назад и вверх, с кольцами
    horn = [(hx + 14, hy + 1), (hx + 20, hy - 9), (hx + 32, hy - 18), (hx + 48, hy - 21), (hx + 40, hy - 15), (hx + 28, hy - 7), (hx + 22, hy + 3)]
    part(s, HORN, poly(horn))
    for k in range(3):
        a, b = horn[k + 1], horn[-(k + 2)]
        line(s, HORN[0], ((a[0] + b[0]) / 2 - 1, (a[1] + b[1]) / 2 - 1), ((a[0] + b[0]) / 2 + 1, (a[1] + b[1]) / 2 + 1))
    if stage2:
        s.set_at((hx + 47, hy - 21), RUNE_HOT)
        s.set_at((hx + 46, hy - 20), RUNE)
        s.set_at((hx + 45, hy - 20), RUNE)
    return [(hx + 6, hy + 6), (hx + 14, hy + 6)]


# ---------------------------------------------------------------- поза целиком
def stalker(pose="idle", frame=0, stage2=False):
    """pose: idle, raised (лапа занесена), slash (удар когтями), roar (вой ужаса), pounce (бросок)."""
    s = pygame.Surface((W, H), pygame.SRCALPHA)
    br = frame  # дыхание
    lean = {"slash": -6, "pounce": -10, "roar": 3}.get(pose, 0)
    if stage2:
        wings(s, 1.0 if pose != "raised" else 0.85)
    cx = 60 + lean  # ось корпуса
    # хвост: толстый, от крестца дугой к земле и вверх, костяное жало
    tail = [(cx + 18, 66), (cx + 34, 78), (cx + 46, 90), (cx + 56, 86), (cx + 60, 74)]
    part(s, HIDE, chain(tail, [6, 5, 4, 3, 1]))
    pygame.draw.polygon(s, BONE[2], [(cx + 60, 74), (cx + 63, 64), (cx + 61, 76)])
    # дальняя нога (звериная: бедро вперёд, скакательный сустав назад, лапа)
    far = [(cx + 12, 64 + br), (cx + 4, 80), (cx + 14, 92), (cx + 6, G - 2)]
    part(s, HIDE, chain(far, [8, 6, 4, 4]), tex=25)
    for k in (-2, 0, 2):
        pygame.draw.polygon(s, BONE[1], [(cx + 6 + k * 3, G - 2), (cx + 3 + k * 3, G), (cx + 7 + k * 3, G)])
    # дальняя рука — до земли
    part(s, HIDE, chain([(cx + 18, 34 + br), (cx + 22, 58), (cx + 16, 80)], [9, 7, 6]), tex=25)
    claws(s, (cx + 16, 81), math.pi / 2 + 0.5, 12)
    # корпус: широкие сгорбленные плечи, грудь вперёд, узкая талия
    body = many(ell((cx - 22, 22 + br, 50, 34)), poly([(cx - 16, 44 + br), (cx + 24, 40 + br), (cx + 18, 68 + br), (cx - 6, 70 + br)]),
                ell((cx + 6, 14 + br, 30, 26)))
    part(s, HIDE, body, tex=160)
    # грудь и брюхо: светлые пластины
    part(s, BELLY, many(ell((cx - 18, 32 + br, 24, 22)), poly([(cx - 12, 48 + br), (cx + 4, 48 + br), (cx + 4, 68 + br), (cx - 6, 68 + br)])), rim=False)
    for k in range(4):
        line(s, BELLY[0], (cx - 11, 52 + k * 4 + br), (cx + 3, 51 + k * 4 + br))
    for y in (34, 40):  # мускулы груди
        pygame.draw.arc(s, BELLY[3], (cx - 16, y + br, 16, 10), math.pi * 0.15, math.pi * 0.85)
    for y in (26, 36):  # мускулы плеча
        pygame.draw.arc(s, HIDE[3], (cx + 4, y + br, 22, 12), math.pi * 0.2, math.pi * 0.9)
    if stage2:  # трещины-руны на груди
        rune = [(cx - 10, 34), (cx - 6, 40), (cx - 10, 46), (cx - 4, 52), (cx - 8, 58)]
        pygame.draw.lines(s, RUNE, False, [(x, y + br) for x, y in rune], 2)
        pygame.draw.lines(s, RUNE_HOT, False, [(x, y + br) for x, y in rune])
        for x, y in ((cx + 2, 38), (cx - 2, 60)):
            pygame.draw.circle(s, RUNE, (x, y + br), 2)
            s.set_at((x, y + br), RUNE_HOT)
    # ближняя нога
    near = [(cx - 2, 64 + br), (cx - 12, 80), (cx - 2, 92), (cx - 10, G - 2)]
    part(s, HIDE, chain(near, [10, 7, 5, 4]), tex=30)
    line(s, HIDE[3], (cx - 6, 62 + br), (cx - 14, 78))
    for k in (-2, 0, 2):
        pygame.draw.polygon(s, BONE[2], [(cx - 10 + k * 3, G - 2), (cx - 14 + k * 3, G), (cx - 9 + k * 3, G)])
    # костяной гребень по горбу и шипы на плече
    spine(s, [(cx + 6, 16 + br, 9), (cx + 16, 14 + br, 12), (cx + 26, 18 + br, 11), (cx + 32, 28 + br, 8)], stage2)
    # наплечник: роговая пластина с тремя шипами (под головой и рукой)
    part(s, HORN, ell((cx - 20, 28 + br, 14, 9)), rim=False)
    for k in range(3):
        pygame.draw.polygon(s, HORN[2], [(cx - 18 + k * 4, 30 + br), (cx - 15 + k * 4, 30 + br), (cx - 19 + k * 4, 23 + br)])
    # ближняя рука — огромная, свисает до земли, когти-серпы
    sh = (cx - 14, 34 + br)
    if pose == "raised":  # лапа занесена за голову — морда остаётся открытой (голова рисуется поверх)
        arm, hand, d = [sh, (cx - 6, 10), (cx - 22, 3)], (cx - 23, 2), -math.pi * 0.8
    elif pose == "slash":
        arm, hand, d = [sh, (cx - 32, 50), (6, 60)], (4, 60), math.pi + 0.3
    elif pose == "pounce":
        arm, hand, d = [sh, (cx - 30, 44), (6, 48)], (4, 48), math.pi + 0.1
    elif pose == "roar":  # лапы разведены в рёве — ниже морды
        arm, hand, d = [sh, (cx - 26, 50), (cx - 44, 46)], (cx - 45, 45), math.pi + 0.5
    else:  # свисает почти до земли, локоть вперёд
        arm, hand, d = [sh, (cx - 30, 54 + br), (cx - 30, 80 + br)], (cx - 31, 81 + br), math.pi / 2 + 0.35
    part(s, HIDE, chain(arm, [11, 9, 7]), tex=40)
    # костяшки кисти и пучок жёсткой шерсти на локте
    pygame.draw.circle(s, HIDE[2], (round(hand[0]), round(hand[1])), 4)
    for k in range(3):
        s.set_at((round(hand[0]) - 2 + k * 2, round(hand[1]) - 2), HIDE[3])
    el = arm[1]
    for k in range(4):
        line(s, HIDE[0], (el[0] + 4, el[1] - 2 + k * 2), (el[0] + 9, el[1] + 1 + k * 2))
    line(s, HIDE[3], (arm[0][0] - 4, arm[0][1] - 3), (arm[1][0] - 4, arm[1][1] - 1))
    m0 = ((arm[1][0] + arm[2][0]) / 2, (arm[1][1] + arm[2][1]) / 2)  # костяной шип на предплечье
    pygame.draw.polygon(s, BONE[2], [(m0[0] + 3, m0[1] - 2), (m0[0] + 9, m0[1] - 7), (m0[0] + 6, m0[1] + 1)])
    claws(s, hand, d, 18)
    # голова — вперёд, на уровне плеч
    hx, hy = (12 + lean, 18 + br) if pose != "roar" else (16, 8)
    # шея: мощная, из-за плеч к затылку
    part(s, HIDE, poly([(hx + 22, hy + 8), (hx + 30, hy + 2), (cx - 2, 22 + br), (cx - 8, 40 + br), (hx + 20, hy + 22)]))
    eyes = head(s, hx, hy, pose, stage2)
    out = outlined(s, (4, 4, 12))
    glow = pygame.Surface((W, H), pygame.SRCALPHA)
    col = (255, 214, 80) if stage2 else (255, 160, 30)
    for x, y in eyes:
        pygame.draw.circle(glow, (*col, 60 if stage2 else 40), (x + 1, y), 3 if stage2 else 2)
    if stage2:
        pygame.draw.circle(glow, (110, 200, 255, 30), (cx - 6, 46 + br), 12)
    out.blit(glow, (0, 0))
    for x, y in eyes:
        out.set_at((x + 1, y), EYE_HOT if stage2 else EYE2)
    if pose == "slash":  # след когтей — три серпа
        for k in range(3):
            pygame.draw.arc(out, _mix((255, 255, 255), RUNE if stage2 else EYE1, k / 2) + (255,), (-12 + k * 3, 34 + k * 5, 34, 36), math.pi * 0.55, math.pi * 1.25)
    return out


def make_stalker_frames(stage2=False):
    idle, idle2 = stalker("idle", 0, stage2), stalker("idle", 1, stage2)
    raised = stalker("raised", 0, stage2)
    glow = (140, 200, 255) if stage2 else (255, 170, 60)
    frames = {
        "idle": [idle, idle2],
        "windup": [tinted(raised, glow, 0.22), raised],
        "attack": [stalker("slash", 0, stage2)],
        "hurt": [tinted(idle, (255, 255, 255), 0.8)],
        "dead": [crouched(tinted(idle, (30, 30, 50), 0.55))],
        "enraged": [idle, idle2],
        "roar": [stalker("roar", 0, stage2), stalker("roar", 1, stage2)],
        "pounce": [stalker("pounce", 0, stage2)],
    }
    if not stage2:  # наступление Полуночи: сжимается во тьме и раскрывает крылья
        frames["transform"] = [tinted(crouched(idle), (20, 20, 60), 0.6), tinted(stalker("roar", 0, True), (200, 220, 255), 0.35)]
    return frames
