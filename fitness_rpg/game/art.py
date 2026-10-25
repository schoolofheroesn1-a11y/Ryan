"""Процедурный пиксель-арт: спрайты из символьных карт и фон главного экрана.

Каждый спрайт описан строками, где один символ = один пиксель, а палитра
переводит символ в цвет. '.' — прозрачный пиксель. Так арт легко править
прямо в коде, а tools/generate_art.py выгружает его в PNG.
"""
import math
import random

import pygame

# --- Палитра (тёмное фэнтези: холодная сталь, ржавчина, кровь, пепел) ---
PALETTE = {
    "k": (16, 12, 22),     # контур
    "d": (52, 56, 70),     # тёмная сталь
    "s": (98, 106, 122),   # сталь
    "l": (158, 166, 180),  # светлая сталь
    "w": (222, 226, 232),  # блик / клинок
    "r": (70, 18, 22),     # тёмный плащ
    "R": (128, 32, 36),    # плащ
    "b": (66, 46, 34),     # кожа / рукоять
    "B": (112, 80, 54),    # светлая кожа
    "g": (176, 140, 60),   # золото
    "o": (122, 112, 92),   # тёмная кость
    "O": (196, 186, 156),  # кость
    "W": (236, 230, 206),  # светлая кость
    "e": (255, 60, 40),    # глаза скелета
    "E": (255, 190, 120),  # свечение глаз
    "m": (92, 52, 34),     # ржавчина
    "M": (150, 92, 54),    # светлая ржавчина
    "n": (40, 32, 48),     # истлевшая ткань
    "N": (70, 56, 80),     # ткань светлее
    "a": (40, 36, 48),     # тёмный доспех босса
    "A": (82, 76, 96),     # доспех босса
    "h": (138, 130, 150),  # блик доспеха
    "c": (110, 18, 24),    # тёмно-алая ткань
    "C": (170, 36, 36),    # алая ткань
    "v": (30, 38, 32),     # тёмный капюшон разбойника
    "V": (52, 66, 50),     # капюшон
    "u": (112, 84, 66),    # кожа в тени
    "U": (164, 124, 96),   # кожа
    "f": (96, 82, 70),     # мех
    "F": (146, 128, 108),  # светлый мех
    "x": (58, 84, 52),     # тёмная кожа зомби
    "X": (98, 128, 78),    # кожа зомби
    "Q": (150, 170, 110),  # блик гнилой кожи
    "S": (44, 48, 72),     # рваная рубаха
    "L": (76, 84, 112),    # рубаха светлее
    "D": (120, 24, 30),    # запёкшаяся кровь
}

# --- Главный герой: Негасимый рыцарь (смотрит вправо) ---
HERO_IDLE = [
    "..........kkkkkk........",
    ".........kllllssk.......",
    "........klwwllsssk......",
    "........klwlllsssk......",
    "........kllllssssk......",
    "........kkkkkkkkkk......",
    "........kslskkkkdk......",
    "........klllssssdk......",
    "........kdsssssddk......",
    ".......kkkkddddkkkk.....",
    "......krkllllsssdddk....",
    ".....krRkwlllsssddsdk...",
    ".....krRklllgggssdsldk..",
    ".....krRkkllsssskdslldk.",
    ".....krRkdklsssskdkslk..",
    ".....krRkdkkkkkkkdkbbk..",
    ".....krRkdkbbgbbkdkBBk..",
    ".....krRkkkkkkkkkkkbbk..",
    ".....krRkddsskdddsk.wk..",
    ".....krRRkdssk.kdsk.wk..",
    ".....krRRkdssk.kdsk.wk..",
    "......krRkdslk.kdsk.wk..",
    "......krRkdssk.kdsk.wk..",
    "......krRkkkkk.kkkk.wk..",
    ".......krkdssk.kdsk.wk..",
    ".......krkdssk.kdsk.wk..",
    "........kkdssk.kdsk.lk..",
    ".........kdssk.kdsk..k..",
    "........kkkkkk.kkkkk....",
    "........kbbbbk.kbbbbk...",
    "........kkkkkk.kkkkkk...",
    "........................",
]

HERO_ATTACK = [
    "..........kkkkkk................",
    ".........kllllssk...............",
    "........klwwllsssk..............",
    "........klwlllsssk..............",
    "........kllllssssk..............",
    "........kkkkkkkkkk..............",
    "........kslskkkkdk..............",
    "........klllssssdk..............",
    "........kdsssssddk..............",
    ".......kkkkddddkkkk.............",
    "......krkllllsssdddk............",
    ".....krRkwlllsssddsddkk.........",
    ".....krRklllgggsssslllbkkkkkkkkk",
    ".....krRkkllssssssslllBwwwwwwwwk",
    ".....krRkdklsssskkkkkkbkkkkkkkkk",
    ".....krRkdkkkkkkkk..............",
    ".....krRkdkbbgbbk...............",
    ".....krRkkkkkkkkk...............",
    ".....krRkddsskdddsk.............",
    ".....krRRkdssk..kdsk............",
    ".....krRRkdssk...kdsk...........",
    "......krRkdslk....kdsk..........",
    "......krRkdssk....kdsk..........",
    "......krRkkkkk....kkkk..........",
    ".......krkdssk....kdsk..........",
    ".......krkdssk....kdsk..........",
    "........kkdssk....kdsk..........",
    ".........kdssk....kdsk..........",
    "........kkkkkk....kkkkk.........",
    "........kbbbbk....kbbbbk........",
    "........kkkkkk....kkkkkk........",
    "................................",
]

# --- Монстр: Скелет-страж с ржавым мечом (смотрит влево) ---
SKELETON_IDLE = [
    "........................",
    "..........kkkkk.........",
    ".........kWWWOOk........",
    "........kWWWOOOok.......",
    "........kWWOOOOok.......",
    "........kkkOkkkok.......",
    "........kekkOkeok.......",
    "........kkkOOkkok.......",
    ".........kOkOkOk........",
    ".........kkOkOkk........",
    "..........kkkkk.........",
    "...........kok..........",
    ".........kkkOkkkk.......",
    "........kOOkOkOOOk......",
    ".......kOkkOOOkkOok.....",
    ".......kOkOkkkOkkOk.....",
    "......kOkkOOOOOkkOk.....",
    "......kOk.kOkOk.kok.....",
    ".kbk..kok.kOOOk.kok.....",
    ".kbk.kOk...kOk...kOk....",
    ".kbk.kWk.knnnnnk.kWk....",
    "kMMMkkWWkknNNNnnk.k.....",
    "kwlmk.kkknnNnNnnk.......",
    "kwlmk...knnnknnnk.......",
    "kwlmk...kOk...kOk.......",
    "kwlmk...kOk...kOk.......",
    "kwlmk...kok...kok.......",
    "kwlmk...kOk...kOk.......",
    "kwlmk...kOk...kOk.......",
    ".klk....kOk...kOk.......",
    "..k....kWWk..kWWk.......",
    ".......kkkk..kkkk.......",
]

SKELETON_ATTACK = [
    "................................",
    "..................kkkkk.........",
    ".................kWWWOOk........",
    "................kWWWOOOok.......",
    "................kWWOOOOok.......",
    "................kkkOkkkok.......",
    "................kekkOkeok.......",
    "................kkkOOkkok.......",
    ".................kOkOkOk........",
    ".................kkOkOkk........",
    "..................kkkkk.........",
    "...................kok..........",
    "...............kkkkkOkkkk.......",
    "kkkkkkkkkkkkkkkWOkkOkOOOk.......",
    "kwwwlllllllMMbkWkOOOOkkOok......",
    "kkkkkkkkkkkkkkkkkkOkkOkkOk......",
    "..............kOkkOOOOOkkOk.....",
    "..............kOk.kOkOk.kok.....",
    "...............k..kOOOk.kok.....",
    "...................kOk...kOk....",
    ".................knnnnnk.kWk....",
    "................knNNNnnk..k.....",
    "................knnNnNnnk.......",
    "...............knnnk.knnnk......",
    "..............kOk.....kOk.......",
    ".............kOk.......kOk......",
    ".............kok.......kok......",
    "............kOk.........kOk.....",
    "............kOk.........kOk.....",
    "............kOk.........kOk.....",
    "...........kWWk.........kWWk....",
    "...........kkkk.........kkkk....",
]

# --- Костёр (спрайт с 3 кадрами огня поверх общего основания) ---
BONFIRE_BASE = [
    "........kk......",
    "........ll......",
    ".......kwlk.....",
    "........sl......",
    "........sl......",
    "........sl......",
    "....kkk.sl.kkk..",
    "...kBBbkslkbBBk.",
    "..kbbBBBkkBBbbk.",
    ".kooOookkkkoOOok",
    "kkkkkkkkkkkkkkkk",
]


# --- Босс: Костяной Рыцарь — огромный скелет в латах с двуручным мечом (смотрит влево) ---
# Спрайт собирается из тела и руки с мечом (опущенной или в выпаде) на холсте 60×44.
BOSS_W, BOSS_H, BOSS_X = 60, 44, 16
BOSS_BODY = [
    "...................k..........k...........",
    "..................kOk........kOk..........",
    "..................kOOk......kOOk..........",
    "...................kOOkkkkkkOOk...........",
    "...................kkaAhhhhAakk...........",
    "..................kaAhhhhhhhhAak..........",
    "..................kaAAAAAAAAAAak..........",
    "..................kakkkkkkkkkkak..........",
    "..................kakWOOkkOOWkak..........",
    "..................kakeEkOOkeEkak..........",
    "..................kakkkOOOOkkkak..........",
    "..................kaAkOkOkOkAAak..........",
    "...................kaAkkkkkkAak...........",
    "...................kkaAAAAAAakk...........",
    "..............kkkkkkkkakkkakkkkkkkk.......",
    "............kkaAAhhAAkcCCckAAhhAAakk......",
    "...........kaAAhhhhAAkcCCCckAAhhhhAAak....",
    "...........kaAAAAAAAakcCCCCkaAAAAAAAAk....",
    "...........kkaaaaaaakkcCCCckkaaaaaaakk....",
    "................kkaAAhhhhhAAakk.kOOk......",
    "...............kaAAhhhhhhhAAak..kOk.......",
    "...............kaAAAhggghAAAak..kOOk......",
    "...............kaAAAAgggAAAAak...kOk......",
    "...............kaaAAAAgAAAAaak...kOOk.....",
    "................kkaaAAAAAaakk....kOk......",
    "................kOkkaaaaakkOk....kWWk.....",
    "................kOOOkkkkkOOOk....kWWk.....",
    "................kkOkOkOkOkOkk.....kk......",
    "................kcCCcCCCcCCck.............",
    "...............kcCCCCcgcCCCCck............",
    "...............kccCCCCcCCCCcck............",
    "...............kkcCcckkkccCckk............",
    "................kaAk.....kaAk.............",
    "................kaAhk...kaAhk.............",
    "................kaAAk...kaAAk.............",
    "................kkOkk...kkOkk.............",
    "................kOOOk...kOOOk.............",
    "................kaAAk...kaAAk.............",
    "................kaAhk...kaAhk.............",
    "................kaAAk...kaAAk.............",
    "................kaAAk...kaAAk.............",
    "...............kaAAAk..kaAAAk.............",
    "..............kaAAAAk.kaAAAAk.............",
    "..............kkkkkkk.kkkkkkk.............",
]
# Рука с мечом, опущенным остриём в землю (координаты холста 60×44)
BOSS_ARM_DOWN = {
    19: (26, "kOOk"), 20: (26, "kOk"), 21: (25, "kOOk"), 22: (25, "kOk"),
    23: (24, "kOOk"), 24: (24, "kOk"), 25: (23, "kWWk"), 26: (23, "kbWk"),
    27: (23, "kbBk"), 28: (20, "kkggggggk"),
    **{r: (23, "kwlhk") for r in range(29, 41)},
    41: (23, "kwlk"), 42: (24, "kwk"), 43: (25, "k"),
}
# Выпад: рука вытянута вперёд, клинок горизонтально
BOSS_ARM_SWING = {
    16: (17, "kgk"), 17: (17, "kgk"), 18: (17, "kgk"),
    19: (0, "kkkkkkkkkkkkkkkkkgkkkkkkkkkk"),
    20: (0, "kwwwwwwwwwwwwwwwkgbWOOOOOOOOk"),
    21: (0, "klllllllllllllllkgbWOOOOOOOOk"),
    22: (1, "kkkkkkkkkkkkkkkkgkkkkkkkkkk"),
    23: (17, "kgk"), 24: (17, "kgk"), 25: (18, "k"),
}


# Замах: меч поднят над головой
BOSS_ARM_RAISED = {
    0: (24, "kk"), **{r: (23, "kwlk") for r in range(1, 10)},
    10: (20, "kkggggggk"), 11: (23, "kbBk"), 12: (23, "kWWk"), 13: (24, "kOk"),
    14: (24, "kOOk"), 15: (25, "kOk"), 16: (25, "kOOk"), 17: (26, "kOk"), 18: (26, "kOk"),
}


# --- Разбойник: капюшон, алая повязка на лице, кинжал (смотрит влево) ---
BANDIT_IDLE = [
    "..........kkkkk.........",
    ".........kvVVVvk........",
    "........kvVVVVVvk.......",
    "........kvVkkkkVvk......",
    "........kvkuUUukVk......",
    "........kvkEuukEVk......",
    "........kvkCCCCkvk......",
    "........kvkcCCCkvk......",
    ".......kkvvkcckvvkk.....",
    "......kbBvvVVVVvvBbk....",
    ".....kbBBkbBBBBbkBBbk...",
    ".....kbBkkbBgBBbkkBbk...",
    "....kbBk.kbBBBBbk.kBbk..",
    "....kUuk.kbbbbbbk.kUuk..",
    "....kUUk.kgkkkkgk.kUUk..",
    "...kkkk..kbBBBBbk..kk...",
    "...kwk...kbBkkBbk.......",
    "..kwlk...kvVk.kVvk......",
    "..kwk....kvVk.kVvk......",
    ".kwk.....kvVk.kVvk......",
    ".kk......kvvk.kvvk......",
    ".........kbBk.kBbk......",
    ".........kbBk.kBbk......",
    "........kbbBk.kBbbk.....",
    "........kkkkk.kkkkk.....",
]
BANDIT_ATTACK = [
    "..................kkkkk.........",
    ".................kvVVVvk........",
    "................kvVVVVVvk.......",
    "................kvVkkkkVvk......",
    "................kvkuUUukVk......",
    "................kvkEuukEVk......",
    "................kvkCCCCkvk......",
    "................kvkcCCCkvk......",
    "...............kkvvkcckvvkk.....",
    "..............kbBvvVVVVvvBbk....",
    "kkkk.....kkkkkbBBkbBBBBbkBBbk...",
    "kwwlkkkkkUUuukbBkkbBgBBbkkBbk...",
    ".kkkkkkkkkkkkkkk.kbBBBBbk.kBbk..",
    ".................kbbbbbbk.kUuk..",
    ".................kgkkkkgk.kUUk..",
    ".................kbBBBBbk..kk...",
    "................kbBkkkBbk.......",
    "...............kvVk...kVvk......",
    "..............kvVk.....kVvk.....",
    ".............kvVk.......kVvk....",
    ".............kvvk.......kvvk....",
    ".............kbBk.......kBbk....",
    ".............kbBk.......kBbk....",
    "............kbbBk.......kBbbk...",
    "............kkkkk.......kkkkk...",
]

# --- Глава разбойников: меховой плащ, повязка на глазу, две сабли (смотрит влево) ---
CHIEF_IDLE = [
    "..............kkkkkkk.........",
    ".............kvVVVVVvk........",
    "............kvVVVVVVVvk.......",
    "............kvVkkkkkVvk.......",
    "............kvkuUUUukVk.......",
    "............kvkkkUUEkVk.......",
    "............kvkuUUUUkVk.......",
    "............kvkfFFFfkvk.......",
    "...........kkvkfFFFfkvkk......",
    ".........kkfFfkkfffkkfFfkk....",
    "........kfFFFfFfkkkfFfFFFfk...",
    ".......kfFFfkcCCCCCCCckfFFfk..",
    ".......kfFfkbBcCCCCCcBbkfFfk..",
    ".......kffkbBBBcCCCcBBBbkffk..",
    "......kfFk.kbBBgCCCgBBbk.kFfk.",
    "......kffk.kbBBBcCcBBBbk.kffk.",
    "......kUuk.kbbbbbbbbbbbk.kUuk.",
    ".....kkUUkkkgkkkkkkkkkgk.kUUk.",
    "....kwkkkk.kcCCCCCCCCCck..kk..",
    "...kwlk....kcCCCcccCCCck..kwk.",
    "..kwlk.....kcCCck.kcCCck..kwk.",
    ".kwlk.....kvVVk...kVVvk...kwk.",
    "kwlk......kvVVk...kVVvk...kwk.",
    "kwk.......kvVVk...kVVvk...klk.",
    "kk........kvvvk...kvvvk...kk..",
    "..........kbBBk...kBBbk.......",
    "..........kbBBk...kBBbk.......",
    ".........kbbBBk...kBBbbk......",
    ".........kkkkkk...kkkkkk......",
]


# Глава крупнее: тело вытягивается (ещё ряд торса и длиннее ноги), передняя рука — накладка
CHIEF_W, CHIEF_X = 44, 12


def _chief_body():
    raw = [r.ljust(30, ".") for r in CHIEF_IDLE]
    for y in range(16, 25):  # убираем переднюю руку с саблей — её рисуют накладки
        raw[y] = "." * 11 + raw[y][11:]
    peak = "................kkk..........."
    return [peak] + raw[:14] + [raw[13]] + raw[14:22] + [raw[21]] * 3 + raw[22:]


CHIEF_ARM_DOWN = {
    18: (6, "kUuk"), 19: (5, "kkUUk"), 20: (4, "kwk"), 21: (3, "kwlk"), 22: (2, "kwlk"),
    23: (1, "kwlk"), 24: (0, "kwlk"), 25: (0, "kwk"), 26: (0, "kk"),
}
CHIEF_ARM_RAISED = {
    14: (7, "kUk"), 13: (7, "kUk"), 12: (6, "kUk"), 11: (6, "kUuk"), 10: (5, "kUUk"),
    9: (4, "kwk"), 8: (3, "kwlk"), 7: (2, "kwlk"), 6: (1, "kwlk"), 5: (0, "kwlk"), 4: (0, "kwk"), 3: (0, "kk"),
}
CHIEF_ARM_SWING = {
    15: (-3, "kgk"), 16: (-12, "kkkkkkkkkkkgkkkkkk"), 17: (-12, "kwwwwwwwwlkgUUUUUUk"),
    18: (-12, "kkkkkkkkkkkgkkkkkk"), 19: (-3, "kgk"),
}
CHIEF_ARM_DRINK = {
    15: (7, "kUk"), 14: (8, "kUk"), 13: (8, "kUk"), 12: (9, "kUuk"), 11: (9, "kUUk"),
    10: (10, "kUUk"), 9: (10, "kRCk"), 8: (10, "kCCk"), 7: (10, "kCwk"), 6: (11, "kk"),
}


CHIEF_DUP_ROWS = (4, 11, 13, 15, 20, 24, 26, 28)   # капюшон, торс, кушак, ноги
CHIEF_DUP_COLS = (CHIEF_X + 15, CHIEF_X + 16)      # шире в плечах


def _enlarge(rows, dup_rows, dup_cols):
    """Увеличивает пиксельную карту, повторяя выбранные ряды и столбцы (пиксели остаются чёткими)."""
    out = []
    for y, row in enumerate(rows):
        wide = "".join(ch * (2 if x in dup_cols else 1) for x, ch in enumerate(row))
        out.append(wide)
        if y in dup_rows:
            out.append(wide)
    return out


def chief_map(arm):
    return _enlarge(_chief_map_base(arm), CHIEF_DUP_ROWS, CHIEF_DUP_COLS)


def _chief_map_base(arm):
    rows = [list("." * CHIEF_W) for _ in range(34)]
    for y, row in enumerate(_chief_body()):
        for x, ch in enumerate(row):
            if ch != ".":
                rows[y][CHIEF_X + x] = ch
    for y, (x0, seg) in arm.items():
        for i, ch in enumerate(seg):
            if ch != "." and 0 <= CHIEF_X + x0 + i < CHIEF_W:
                rows[y][CHIEF_X + x0 + i] = ch
    return ["".join(r) for r in rows]


def boss_map(arm):
    rows = [list("." * BOSS_W) for _ in range(BOSS_H)]
    for y, row in enumerate(BOSS_BODY):
        for x, ch in enumerate(row):
            if ch != ".":
                rows[y][BOSS_X + x] = ch
    for y, (x0, seg) in arm.items():
        for i, ch in enumerate(seg):
            if ch != "." and 0 <= x0 + i < BOSS_W:
                rows[y][x0 + i] = ch
    return ["".join(r) for r in rows]


# --- Снаряжение героя: у каждого меча своя модель, доспех и амулет меняют самого героя ---
# Мечи нарисованы вертикально (навершие сверху, остриё вниз); GRIP — строка рукояти.
# В стойке меч висит в руке остриём к земле, в выпаде — та же модель, повёрнутая на 90°.
SWORD_MAPS = {
    # короткий ржавый меч с зазубринами
    "rusty": [
        ".k.",
        "kmk",
        ".b.",
        ".b.",
        "kmk",
        "kMk",
        "kMk",
        ".Mk",
        "kmk",
        "kMk",
        "kmk",
        ".Mk",
        "kMk",
        ".k.",
    ],
    # длинный стальной клинок с золотой гардой
    "steel": [
        "..k..",
        ".kgk.",
        "..b..",
        "..b..",
        "kgggk",
        ".kwk.",
        ".kwk.",
        ".klk.",
        ".kwk.",
        ".kwk.",
        ".klk.",
        ".kwk.",
        ".kwk.",
        ".klk.",
        ".kwk.",
        "..k..",
    ],
    # двуручник: широкий клинок почти в рост героя
    "great": [
        "...k...",
        "..kgk..",
        "...b...",
        "...B...",
        "...b...",
        "kgggggk",
        "..kgk..",
        ".kwwlk.",
        ".kwwlk.",
        ".kwllk.",
        ".kwwlk.",
        ".kwwlk.",
        ".kwllk.",
        ".kwwlk.",
        ".kwwlk.",
        ".kwllk.",
        "..kwk..",
        "...k...",
    ],
    # пепельный клинок: зубчатый, раскалённый
    "ash": [
        "..k..",
        ".kYk.",
        "..n..",
        "..n..",
        "kzYzk",
        ".kyk.",
        "kYyk.",
        ".kyYk",
        "kYyk.",
        ".kyYk",
        "kYyk.",
        ".kyYk",
        "kYyk.",
        ".kyYk",
        ".kyk.",
        "..k..",
    ],
    # --- косметика (облик меча, без влияния на силу) ---
    # Клинок Бездны: обсидиан с фиолетовыми рунами и камнем в навершии
    "void": [
        "..k..",
        ".kPk.",
        "..q..",
        "..q..",
        "kpqpk",
        ".kqk.",
        "kqpqk",
        "kqPqk",
        "kqpqk",
        "kqpqk",
        "kqPqk",
        "kqpqk",
        "kqpqk",
        "kqPqk",
        ".kpk.",
        ".kpk.",
        "..k..",
    ],
    # Клинок Рассвета: золото, крылатая гарда, раскалённый сердечник
    "sun": [
        "...k...",
        "..kJk..",
        "...j...",
        "...b...",
        "kJjJjJk",
        "..kik..",
        ".kJiJk.",
        ".kJiJk.",
        ".kjiJk.",
        ".kJiJk.",
        ".kJiJk.",
        ".kjiJk.",
        ".kJiJk.",
        ".kJiJk.",
        "..kik..",
        "..kJk..",
        "...k...",
    ],
    # Ледяной Клык: кристаллический клинок
    "frost": [
        "..k..",
        ".kTk.",
        "..I..",
        "..I..",
        "kItIk",
        ".ktk.",
        ".kTtk",
        "kTtTk",
        "kTtTk",
        "kttTk",
        "kTtTk",
        ".kTtk",
        ".ktTk",
        ".kTk.",
        "..kk.",
        "..k..",
    ],
    # Гигантский меч: тяжёлый клинок в рост героя, носится на плече
    "giant": [
        "....k....",
        "...kgk...",
        "....b....",
        "....B....",
        "....b....",
        "....B....",
        "kkgggggkk",
        "kgggggggk",
        ".kwwwwlk.",
        ".kwwwwlk.",
        ".kwwwllk.",
        ".kwwwwlk.",
        ".kwwwwlk.",
        ".kwwwllk.",
        ".kwwwwlk.",
        ".kwwwwlk.",
        ".kwwwllk.",
        ".kwwwwlk.",
        ".kwwwwlk.",
        ".kwwwllk.",
        ".kwwwwlk.",
        "..kwwlk..",
        "..kwwlk..",
        "...kwk...",
        "....k....",
    ],
    # Гриф от штанги: стальной гриф с насечкой, замок и два блина
    "barbell": [
        "....k....",
        "...kdk...",
        "....s....",
        "....l....",
        "....s....",
        "....l....",
        "....s....",
        "....l....",
        "....s....",
        "....l....",
        ".kkkkkkk.",
        "kCCCCCCCk",
        "kcCCCCCck",
        "kkkkkkkkk",
        "kAAhAAAAk",
        "kaAAAAAak",
        "kkkkkkkkk",
        "...klk...",
        "....k....",
    ],
    # Радиатор: широкий золотой клинок с раскалёнными прорезями-рёбрами
    "radiator": [
        "....k....",
        "...kJk...",
        "....b....",
        "....b....",
        "kJjjJjjJk",
        ".kJJJJJk.",
        "kJJJJJJJk",
        "kjYYYYYjk",
        "kJJJJJJJk",
        "kjYyYyYjk",
        "kJJJJJJJk",
        "kjYYYYYjk",
        "kJJJJJJJk",
        "kjYyYyYjk",
        "kJJJJJJJk",
        "kjYYYYYjk",
        ".kJJJJJk.",
        "..kJJJk..",
        "...kJk...",
        "....k....",
    ],
    # Клинок Феникса (легендарный облик): раскалённое добела ядро, золото и пламя по краям,
    # языки огня по бокам, гарда — золотые крылья, на навершии рубин
    "phoenix": [
        "....k....",
        "...k5k...",
        "....b....",
        "....B....",
        "67.k6k.76",
        ".676667..",
        "..k626k..",
        ".k32123k.",
        "4k32123k.",
        ".k32123k4",
        ".k32123k.",
        "4k32123k.",
        ".k32123k4",
        ".k32123k.",
        "..k212k4.",
        "4.k212k..",
        "..k212k..",
        "...k1k...",
        "....k....",
    ],
    # Клинок Побратима (награда за приглашённого друга): две полосы стали, бирюзовая и золотая,
    # переплетаются по клинку; гарда — две сомкнутые ладони-кольца
    "kin": [
        "...k...",
        "..k9k..",
        "...b...",
        "...B...",
        "k8kgk6k",
        ".k898k.",
        "..k8k..",
        ".k886k.",
        ".k866k.",
        ".k668k.",
        ".k688k.",
        ".k886k.",
        ".k866k.",
        ".k668k.",
        ".k688k.",
        "..k86k.",
        "..k6k..",
        "...k...",
    ],
}
SWORD_MAPS["seraph"] = [
    # Крыло Серафима (с босса Алой Бездны): узкий клинок из белой кости с чёрной жилой,
    # гарда — костяные крылья, навершие — тлеющий глаз, с краёв стекают алые капли
    "...k...",
    "..k%k..",
    "...#...",
    "...#...",
    "!@k#k@!",
    ".!@#@!.",
    "..k#k..",
    ".k!#@k.",
    ".k!#@k.",
    "$k!#@k.",
    ".k!#@k.",
    ".k!#@k$",
    ".k!#@k.",
    "$k!#@k.",
    ".k!#@k.",
    "..k!k..",
    "..k!k.$",
    "..k!k..",
    "...k...",
]
COSMETIC_SWORDS = ("void", "sun", "frost", "phoenix", "kin")
SWORD_GRIP = 2
SWORD_PALETTE = dict(
    PALETTE, y=(255, 230, 160), Y=(246, 120, 40), z=(130, 36, 20),
    q=(36, 20, 54), p=(170, 80, 255), P=(236, 190, 255),        # Бездна
    j=(206, 146, 44), J=(255, 214, 96), i=(255, 252, 226),     # Рассвет
    t=(130, 206, 255), T=(214, 242, 255), I=(56, 110, 196),    # Иней
    **{"1": (255, 250, 222), "2": (255, 198, 64), "3": (240, 96, 30), "4": (206, 42, 30),   # Феникс: пламя
       "5": (230, 30, 64), "6": (255, 218, 100), "7": (196, 132, 36),                      # рубин и золотые крылья
       "8": (64, 222, 196), "9": (220, 255, 246),                                            # Побратим: бирюза
       "!": (240, 234, 224), "@": (166, 154, 150), "#": (26, 14, 18), "$": (176, 32, 28), "%": (255, 110, 60)},  # Серафим
)

# Где рука держит рукоять: (x центра рукояти, y её верха)
IDLE_GRIP = (20, 15)
ATTACK_GRIP = (22, 13)
ATTACK_W = 40

# Цвет следа удара для каждого меча
SLASH_COLORS = {
    "giant": (210, 220, 240),
    "barbell": (170, 180, 200),
    "radiator": (255, 170, 60),
    "void": (180, 90, 255),
    "sun": (255, 214, 96),
    "frost": (150, 220, 255),
    "phoenix": (255, 140, 40),
    "kin": (90, 230, 200),
    "rusty": (190, 140, 100),
    "steel": (235, 240, 250),
    "great": (200, 210, 230),
    "ash": (255, 150, 60),
    "seraph": (230, 60, 50),
}

# Облик героя: доспех Костяного Рыцаря и/или Амулет Углей
LOOKS = ("base", "armor", "amulet", "both", "king", "king_amulet", "wing", "wing_amulet", "samurai")
# Доспех Серафима: чёрные латы с белыми костяными мазками, алый плащ, глаза-угли и костяные крылья за спиной
WING_PALETTE = dict(
    PALETTE,
    d=(16, 10, 14), s=(34, 24, 30), l=(60, 46, 52), w=(236, 230, 220),
    r=(44, 8, 12), R=(104, 18, 22), e=(255, 90, 50),
    Y=(246, 120, 40), y=(255, 230, 160),
)
WING_LIFT = 7  # над плечами — кончики костяных крыльев
# Доспех самурая (облик из лавки, только внешний вид): алый лак, чёрный плащ, золотые рога кабуто
SAMURAI_PALETTE = dict(
    PALETTE,
    d=(64, 14, 18), s=(138, 28, 30), l=(196, 54, 42), w=(244, 124, 88),
    r=(20, 16, 24), R=(50, 42, 56), g=(232, 186, 70),
    a=(26, 20, 30), A=(52, 44, 60), h=(120, 108, 132),  # чёрный лак кабуто и маски
    Y=(246, 120, 40), y=(255, 230, 160),
)
# Доспех Короля-Призрака: латы цвета старой бирюзы, призрачный плащ, корона и горящие глаза
KING_PALETTE = dict(
    PALETTE,
    d=(20, 40, 44), s=(36, 78, 80), l=(70, 140, 136), w=(140, 220, 200),
    r=(20, 70, 56), R=(52, 150, 112), e=(120, 255, 230),
    Y=(246, 120, 40), y=(255, 230, 160),
)
ARMOR_PALETTE = dict(
    PALETTE,
    d=(30, 26, 36), s=(58, 52, 68), l=(98, 90, 112), w=(146, 136, 158),
    r=(80, 10, 16), R=(150, 24, 30),
    Y=(246, 120, 40), y=(255, 230, 160),
)
BODY_PALETTE = dict(PALETTE, Y=(246, 120, 40), y=(255, 230, 160))


def _body_rows(rows, width, look):
    """Тело героя без меча (+ рога, красные глаза и/или амулет)."""
    rows = [r.ljust(width, ".") for r in rows]
    is_attack = width > 24
    for y in range(len(rows)):
        cut = range(22, width) if is_attack and 11 <= y <= 14 else \
            (range(19, 22) if not is_attack and 15 <= y <= 27 else ())
        for x in cut:
            if is_attack and y == 11 and x == 21:
                continue
            _put(rows, x, y, ".")
    if look in ("armor", "both"):
        for x, y in ((7, 0), (8, 1), (18, 0), (17, 1)):  # рога
            _put(rows, x, y, "O")
        for x in (12, 14):  # глаза горят в прорези забрала
            _put(rows, x, 6, "e")
    if look in ("king", "king_amulet"):
        for x in (10, 12, 14):  # зубцы короны
            _put(rows, x, 0, "g")
        for x in range(10, 16):  # обод короны
            _put(rows, x, 1, "g")
        for x in (12, 14):  # призрачный огонь в прорези забрала
            _put(rows, x, 6, "e")
    if look in ("wing", "wing_amulet"):
        for x in (12, 14):  # угли в прорези забрала
            _put(rows, x, 6, "e")
        for x, y in ((10, 10), (11, 11), (12, 12), (13, 13)):  # белый мазок наискосок через грудь
            _put(rows, x, y, "w")
        for x, y in ((8, 1), (9, 0)):  # белая прядь-гребень на шлеме
            _put(rows, x, y, "W")
        for y in range(19, 23):  # полоса по ноге
            _put(rows, 11, y, "w")
    if look == "samurai":
        for y in range(0, 5):  # кабуто — чёрный лак
            rows[y] = rows[y].replace("s", "a").replace("l", "A").replace("w", "h")
        for x in (12, 14):  # глаза горят в прорезях маски
            _put(rows, x, 6, "e")
        for x in (7, 18):  # отогнутые края шлема фукигаэси
            _put(rows, x, 5, "g")
        for y in (6, 7, 8):  # широкий назатыльник сикоро
            _put(rows, 7, y, "k")
        for x in range(10, 16):  # маска мэмпо
            _put(rows, x, 7, "a")
        for x in (11, 12, 14, 15):  # белые усы маски
            _put(rows, x, 8, "W")
        for x in (10, 12, 14, 16):  # золотая шнуровка на груди
            _put(rows, x, 10, "g")
        for x in (10, 12, 15, 17):  # и на набедренных пластинах
            _put(rows, x, 18, "g")
    if look in ("amulet", "both", "king_amulet", "wing_amulet"):
        _put(rows, 11, 9, "g")
        _put(rows, 15, 9, "g")
        for x, ch in ((12, "Y"), (13, "y"), (14, "Y")):
            _put(rows, x, 10, ch)
        _put(rows, 13, 11, "Y")
    return rows


def _put(rows, x, y, ch):
    row = rows[y].ljust(x + 1, ".")
    rows[y] = row[:x] + ch + row[x + 1:]


def _rotate_ccw(rows):
    """Поворот карты на 90° против часовой: навершие слева, остриё справа."""
    w = max(len(r) for r in rows)
    rows = [r.ljust(w, ".") for r in rows]
    return ["".join(rows[c][w - 1 - r] for c in range(len(rows))) for r in range(w)]


def compose_hero(sword, look, pose):
    """Спрайт героя: меч рисуется первым, рука перчаткой ложится поверх рукояти."""
    attack = pose == "attack"
    width = ATTACK_W if attack else 24
    palette = ARMOR_PALETTE if look in ("armor", "both") else KING_PALETTE if look.startswith("king") \
        else WING_PALETTE if look.startswith("wing") else SAMURAI_PALETTE if look == "samurai" else BODY_PALETTE
    blade_map = SWORD_MAPS[sword]
    if attack:
        width = max(width, ATTACK_GRIP[0] - SWORD_GRIP + len(blade_map))  # длинный клинок не обрезается
    body = sprite_from_map(_body_rows(HERO_ATTACK if attack else HERO_IDLE, width, look), palette)
    if sword == "giant" and not attack:
        surf = _giant_on_shoulder(body, blade_map)
        return _samurai_dress(surf) if look == "samurai" else _wing_dress(surf) if look.startswith("wing") else surf
    if attack:
        blade = sprite_from_map(_rotate_ccw(blade_map), SWORD_PALETTE)
        gx, gy = ATTACK_GRIP
        pos = (gx - SWORD_GRIP, gy - blade.get_height() // 2)
    else:
        blade = sprite_from_map(blade_map, SWORD_PALETTE)
        gx, gy = IDLE_GRIP
        pos = (gx - blade.get_width() // 2, gy - SWORD_GRIP)
    surf = pygame.Surface((width, 32), pygame.SRCALPHA)
    surf.blit(blade, pos)
    surf.blit(body, (0, 0))
    return _samurai_dress(surf) if look == "samurai" else _wing_dress(surf) if look.startswith("wing") else surf


def _wing_dress(surf):
    """Доспех Серафима: два костяных крыла за спиной — кончики поднимаются над плечами (рисуются только в пустоте)."""
    w, h = surf.get_size()
    out = pygame.Surface((w, h + WING_LIFT), pygame.SRCALPHA)
    out.blit(surf, (0, WING_LIFT))
    top = h + WING_LIFT - 32
    bone, bone2, memb, memb2 = (240, 234, 224), (166, 154, 150), (40, 8, 12), (96, 18, 22)

    def px(x, y, col):
        yy = top + y
        if 0 <= x < w and 0 <= yy < h + WING_LIFT and out.get_at((x, yy)).a == 0:
            out.set_at((x, yy), col)

    # дальнее крыло — за левым плечом (герой смотрит вправо): дуга вверх-назад и пальцы вниз
    arc = [(7, 9), (6, 7), (5, 5), (4, 3), (3, 1), (2, -1), (1, -3), (0, -5)]
    for i, (x, y) in enumerate(arc):
        for yy in range(y + 1, min(y + 6 + i, 22)):  # перепонка под костью
            px(x, yy, memb2 if yy <= y + 1 else memb)
    for x, y in arc:
        px(x, y, bone)
        px(x + 1, y, bone2)
    for x, y0, y1 in ((1, -2, 10), (3, 2, 14), (5, 6, 17)):  # пальцы
        for yy in range(y0, y1):
            px(x, yy, bone2 if yy > (y0 + y1) // 2 else bone)
    # ближнее крыло — кончик над правым плечом
    for x, y in ((17, 9), (18, 7), (19, 5), (20, 3), (21, 1), (22, -1), (23, -4)):
        for yy in range(y + 1, y + 4):
            px(x, yy, memb)
        px(x, y, bone)
    return out


SAMURAI_LIFT = 11  # над шлемом: рога кувагата и знамя сасимоно


def _samurai_dress(surf):
    """Доспех самурая: знамя сасимоно за спиной (только там, где пусто) и большие золотые рога над шлемом."""
    w, h = surf.get_size()
    out = pygame.Surface((w, h + SAMURAI_LIFT), pygame.SRCALPHA)
    out.blit(surf, (0, SAMURAI_LIFT))
    top = h + SAMURAI_LIFT - 32  # где теперь макушка тела (у гигантского меча холст выше)

    def px(x, y, col, behind=False):
        yy = top + y
        if 0 <= x < w and 0 <= yy < h + SAMURAI_LIFT and (not behind or out.get_at((x, yy)).a == 0):
            out.set_at((x, yy), col)

    k, pole = (16, 12, 22), (70, 48, 34)
    crim, crim_d, white, gold, gold_d, gold_l = (196, 32, 40), (128, 18, 26), (244, 238, 222), (236, 188, 64), (150, 104, 30), (255, 236, 150)
    for y in range(-11, 12):  # древко за спиной
        px(6, y, pole, True)
        px(7, y, k, True)
    for x in range(0, 7):  # перекладина и флаг
        px(x, -11, k, True)
    for y in range(-10, -1):
        px(0, y, k, True)
        for x in range(1, 6):
            px(x, y, crim_d if x == 5 or y == -2 else crim, True)
    for x in range(0, 6):
        px(x, -1, k, True)
    for x, y in ((2, -8), (3, -8), (1, -7), (4, -7), (1, -6), (4, -6), (2, -5), (3, -5)):  # герб-мон: белое кольцо
        px(x, y, white)  # флаг уже нарисован — герб поверх него
    for x, y in ((2, -7), (3, -7), (2, -6), (3, -6)):  # с золотым солнцем внутри
        px(x, y, gold)
    # рога кувагата: широкая золотая «V» с тенью и бликами на концах
    horn = [(10, 0), (9, -1), (9, -2), (8, -3), (8, -4), (7, -5), (7, -6)]
    for x, y in horn:
        px(x, y, gold)
        px(x - 1, y, gold_d)
        px(25 - x, y, gold)
        px(26 - x, y, gold_d)
    for x, y in ((7, -7), (18, -7)):
        px(x, y, gold_l)
    for x, y in ((12, 0), (13, 0), (12, -1), (13, -1)):  # маэдатэ: красное солнце в золотой оправе
        px(x, y, crim)
    for x, y in ((11, 0), (14, 0), (11, -1), (14, -1), (12, -2), (13, -2)):
        px(x, y, gold)
    return out


def _giant_on_shoulder(body, blade_map):
    """Стойка с гигантским мечом: клинок остриём вверх лежит на плече, наклонён назад за голову."""
    rows = list(reversed(blade_map))            # остриё сверху, рукоять снизу
    grip = len(rows) - 1 - SWORD_GRIP           # строка рукояти после переворота
    gx, gy = IDLE_GRIP
    lift = max(0, grip - gy)                    # на сколько холст выше обычного
    h = 32 + lift
    surf = pygame.Surface((24, h), pygame.SRCALPHA)
    blade = sprite_from_map(rows, SWORD_PALETTE)
    bw = blade.get_width()
    for y in range(blade.get_height()):         # наклон: каждые 3 пикселя вверх — на 1 назад
        shift = (grip - y) // 3 if y < grip else 0
        surf.blit(blade, (gx - bw // 2 - shift, gy + lift - grip + y), pygame.Rect(0, y, bw, 1))
    surf.blit(body, (0, lift))
    return surf


def sprite_from_map(rows, palette=PALETTE):
    """Превращает символьную карту в pygame.Surface с прозрачностью."""
    width = max(len(r) for r in rows)
    surf = pygame.Surface((width, len(rows)), pygame.SRCALPHA)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row.ljust(width, ".")):
            if ch != ".":
                surf.set_at((x, y), palette[ch])
    return surf


def tinted(surf, color, strength=1.0):
    """Копия спрайта, окрашенная в цвет (вспышка урона / свечение)."""
    out = surf.copy()
    w, h = out.get_size()
    for y in range(h):
        for x in range(w):
            r, g, b, a = out.get_at((x, y))
            if a:
                out.set_at((x, y), (
                    int(r + (color[0] - r) * strength),
                    int(g + (color[1] - g) * strength),
                    int(b + (color[2] - b) * strength),
                    a,
                ))
    return out


def shifted_breath(surf, rows_from_top=14):
    """Кадр «дыхания»: верхняя часть тела опускается на 1 пиксель."""
    w, h = surf.get_size()
    out = pygame.Surface((w, h), pygame.SRCALPHA)
    out.blit(surf, (0, 1), pygame.Rect(0, 0, w, rows_from_top))
    out.blit(surf, (0, rows_from_top), pygame.Rect(0, rows_from_top, w, h - rows_from_top))
    return out


def crouched(surf):
    """Кадр уклонения (присед): спрайт сплющен по вертикали."""
    w, h = surf.get_size()
    small = pygame.transform.scale(surf, (w, int(h * 0.7)))
    out = pygame.Surface((w, h), pygame.SRCALPHA)
    out.blit(small, (0, h - small.get_height()))
    return out


def flame(frame, w=16, h=14):
    """Пламя костра — анимированный кадр, рисуется по пикселям."""
    surf = pygame.Surface((w, h), pygame.SRCALPHA)
    rnd = random.Random(frame * 7919)
    colors = [(255, 240, 170), (255, 190, 70), (240, 110, 30), (170, 50, 20)]
    cx = w / 2
    for y in range(h):
        t = y / (h - 1)  # 0 сверху, 1 снизу
        half = 1 + t * (w * 0.32) + math.sin(frame * 1.7 + y) * 0.8
        for x in range(w):
            d = abs(x + 0.5 - cx) / max(half, 0.1)
            if d < 1 and rnd.random() > 0.08 + (1 - t) * 0.35:
                idx = min(3, int(d * 2.2 + (1 - t) * 1.6))
                surf.set_at((x, y), colors[idx])
    return surf


def make_bonfire_frames(n=4):
    base = sprite_from_map(BONFIRE_BASE)
    frames = []
    for i in range(n):
        surf = pygame.Surface((16, 22), pygame.SRCALPHA)
        surf.blit(flame(i), (0, 0))
        surf.blit(base, (0, 11))
        frames.append(surf)
    return frames


def _lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_title_background(w=320, h=180, seed=13):
    """Главный экран: багровое небо, луна, горы, руины замка и кладбище."""
    rnd = random.Random(seed)
    surf = pygame.Surface((w, h))

    # Небо с ступенчатым (пиксельным) градиентом
    top, mid, low = (10, 8, 20), (44, 18, 34), (110, 40, 36)
    bands = 18
    for i in range(bands):
        t = i / (bands - 1)
        col = _lerp(top, mid, t * 2) if t < 0.5 else _lerp(mid, low, (t - 0.5) * 2)
        y0 = int(i * h * 0.72 / bands)
        pygame.draw.rect(surf, col, (0, y0, w, int(h * 0.72 / bands) + 1))
    pygame.draw.rect(surf, low, (0, int(h * 0.72), w, h))

    # Звёзды
    for _ in range(70):
        x, y = rnd.randrange(w), rnd.randrange(int(h * 0.45))
        surf.set_at((x, y), rnd.choice([(200, 190, 210), (120, 110, 140), (240, 230, 200)]))

    # Затмённая луна с ореолом
    mx, my = 262, 60
    for r, col in ((26, (70, 30, 40)), (22, (110, 50, 46)), (18, (230, 200, 160))):
        pygame.draw.circle(surf, col, (mx, my), r)
    pygame.draw.circle(surf, (190, 150, 120), (mx - 5, my + 3), 4)
    pygame.draw.circle(surf, (200, 165, 130), (mx + 6, my - 6), 3)
    pygame.draw.circle(surf, (24, 12, 22), (mx + 7, my - 1), 14)  # тёмный диск затмения
    for _ in range(40):  # «корона» затмения
        a = rnd.random() * math.tau
        rr = 15 + rnd.random() * 4
        surf.set_at((int(mx + 7 + math.cos(a) * rr), int(my - 1 + math.sin(a) * rr)), (255, 120, 60))

    # Дальние горы
    def ridge(base_y, amp, col, step, jag):
        pts = [(0, h)]
        y = base_y
        for x in range(0, w + step, step):
            y = max(base_y - amp, min(base_y + amp // 2, y + rnd.randint(-jag, jag)))
            pts.append((x, y))
        pts.append((w, h))
        pygame.draw.polygon(surf, col, pts)

    ridge(110, 22, (46, 22, 38), 6, 6)
    ridge(128, 16, (30, 16, 30), 5, 4)

    # Руины замка (силуэт)
    castle = (14, 10, 20)
    pygame.draw.rect(surf, castle, (40, 92, 70, 60))
    for tx, tw, th in ((34, 16, 70), (72, 12, 88), (100, 18, 64)):
        pygame.draw.rect(surf, castle, (tx, 150 - th, tw, th))
        for bx in range(tx, tx + tw, 4):  # зубцы
            pygame.draw.rect(surf, castle, (bx, 150 - th - 3, 2, 3))
    pygame.draw.polygon(surf, castle, [(72, 62), (78, 46), (84, 62)])  # шпиль
    for wx, wy in ((40, 100), (76, 74), (106, 104), (56, 112), (88, 118)):  # окна
        pygame.draw.rect(surf, (255, 150, 60), (wx, wy, 2, 3))
    # обвалившийся край
    for i in range(10):
        pygame.draw.rect(surf, castle, (110 + i * 3, 120 + i * 3 + rnd.randint(0, 2), 3, 40))

    # Земля и кладбище
    ground = 150
    pygame.draw.rect(surf, (20, 14, 22), (0, ground, w, h - ground))
    for x in range(0, w, 2):
        if rnd.random() < 0.5:
            pygame.draw.rect(surf, (32, 24, 30), (x, ground - rnd.randint(0, 2), 2, 3))
    for gx in (150, 172, 196, 262, 290):
        gh = rnd.randint(8, 13)
        pygame.draw.rect(surf, (12, 8, 16), (gx, ground - gh, 7, gh))
        pygame.draw.rect(surf, (12, 8, 16), (gx + 1, ground - gh - 1, 5, 1))
    for cx in (214, 304):  # кресты
        pygame.draw.rect(surf, (12, 8, 16), (cx, ground - 16, 2, 16))
        pygame.draw.rect(surf, (12, 8, 16), (cx - 3, ground - 12, 8, 2))
    # мёртвое дерево
    pygame.draw.line(surf, (12, 8, 16), (8, ground), (14, 100), 3)
    for (x1, y1, x2, y2) in ((13, 112, 2, 98), (14, 104, 26, 90), (20, 96, 30, 94), (6, 102, 0, 96)):
        pygame.draw.line(surf, (12, 8, 16), (x1, y1), (x2, y2), 1)

    # Туман: полупрозрачные пиксельные полосы
    fog = pygame.Surface((w, h), pygame.SRCALPHA)
    for _ in range(26):
        fx, fy = rnd.randrange(-20, w), rnd.randrange(ground - 14, ground + 6)
        pygame.draw.rect(fog, (140, 110, 130, 34), (fx, fy, rnd.randint(30, 70), 2))
    surf.blit(fog, (0, 0))
    return surf


def make_arena_background(w=320, h=180, seed=7):
    """Фон боя: склеп с колоннами и факелами."""
    rnd = random.Random(seed)
    surf = pygame.Surface((w, h))
    for i in range(12):
        col = _lerp((8, 6, 14), (34, 24, 36), i / 11)
        pygame.draw.rect(surf, col, (0, i * 12, w, 12))
    # кладка стены
    for y in range(0, 140, 8):
        off = 0 if (y // 8) % 2 == 0 else 8
        for x in range(-off, w, 16):
            shade = rnd.randint(26, 40)
            pygame.draw.rect(surf, (shade, shade - 6, shade + 4), (x + 1, y + 1, 14, 6))
    # колонны
    for cx in (30, 150, 270):
        pygame.draw.rect(surf, (18, 14, 24), (cx, 20, 22, 120))
        pygame.draw.rect(surf, (44, 38, 52), (cx + 3, 20, 4, 120))
        pygame.draw.rect(surf, (12, 10, 18), (cx - 3, 16, 28, 6))
        pygame.draw.rect(surf, (12, 10, 18), (cx - 3, 134, 28, 6))
    # пол
    pygame.draw.rect(surf, (22, 16, 24), (0, 140, w, 40))
    for x in range(0, w, 20):
        pygame.draw.line(surf, (12, 8, 16), (x, 140), (x - 10, 180))
    pygame.draw.line(surf, (60, 46, 56), (0, 140), (w, 140))
    # черепа и кости на полу
    for _ in range(14):
        bx, by = rnd.randrange(w), rnd.randrange(146, 176)
        pygame.draw.rect(surf, (90, 84, 70), (bx, by, rnd.choice((2, 3, 4)), 1))
    # виньетка
    vig = pygame.Surface((w, h), pygame.SRCALPHA)
    for i in range(16):
        pygame.draw.rect(vig, (0, 0, 0, 14), (i * 3, i * 2, w - i * 6, h - i * 4), 3)
    surf.blit(vig, (0, 0))
    return surf


def draw_gothic_castle(surf, cx, base, rnd):
    """Узкий высокий готический замок вдали на холме: шпили-иглы, собор с розой, стрельчатые окна."""
    hill_col, hill_mid, hill_hi = (30, 40, 32), (38, 50, 38), (84, 90, 62)
    pygame.draw.ellipse(surf, hill_col, (cx - 80, base - 4, 160, 40))
    pygame.draw.ellipse(surf, hill_mid, (cx - 46, base - 4, 92, 30))
    for x in range(cx - 44, cx + 44):  # травянистая кромка холма в свете заката
        y = base - 4 + int(15 * (1 - (1 - ((x - cx) / 46) ** 2) ** 0.5))
        surf.set_at((x, y), hill_hi)
        if x % 3 == 0:
            surf.set_at((x, y - 1), hill_hi)

    # даль: камень светлее и холоднее, чем силуэты на переднем плане
    stone, dark, rim = (44, 32, 54), (28, 20, 36), (120, 72, 74)
    glow, glow_dim = (255, 176, 90), (210, 120, 60)

    def needle(x, top, w, h):
        """Шпиль-игла с крестоцветом."""
        pygame.draw.polygon(surf, stone, [(x, top), (x + (w - 1) / 2, top - h), (x + w - 1, top)])
        pygame.draw.line(surf, rim, (x + (w - 1) // 2 + 1, top - h + 2), (x + w - 1, top))
        surf.set_at((x + (w - 1) // 2, top - h - 1), stone)

    def tower(x, top, w, spire_h, win_step=6):
        pygame.draw.rect(surf, stone, (x, top, w, base - top))
        pygame.draw.line(surf, rim, (x + w - 1, top), (x + w - 1, base - 1))  # край в свете заката
        surf.set_at((x - 1, top - 1), stone)  # угловые пинакли
        surf.set_at((x + w, top - 1), stone)
        needle(x, top, w, spire_h)
        for wy in range(top + 3, base - 4, win_step):  # стрельчатые окна-бойницы
            if rnd.random() < 0.7:
                surf.set_at((x + w // 2 - 1 + (w % 2), wy), glow_dim)
                pygame.draw.line(surf, glow, (x + w // 2 - 1 + (w % 2), wy + 1), (x + w // 2 - 1 + (w % 2), wy + 2))

    # стена с зубцами
    wall_top = base - 11
    pygame.draw.rect(surf, stone, (cx - 22, wall_top, 44, 11))
    for bx in range(cx - 22, cx + 22, 2):
        if (bx - cx) % 4 == 0:
            surf.set_at((bx, wall_top - 1), stone)
    # башни: низкие по краям, высокие и тонкие ближе к собору
    tower(cx - 25, base - 21, 4, 8)
    tower(cx + 21, base - 19, 4, 7)
    tower(cx - 16, base - 37, 5, 14)
    tower(cx + 11, base - 34, 5, 13)
    # контрфорсы к собору
    for sx, ex in ((cx - 11, cx - 5), (cx + 11, cx + 5)):
        pygame.draw.line(surf, stone, (sx, base - 18), (ex, base - 27))
        pygame.draw.line(surf, stone, (sx, base - 13), (ex, base - 21))
    # собор: самый высокий, узкий, с фронтоном и иглой
    top = base - 44
    pygame.draw.rect(surf, stone, (cx - 5, top, 10, base - top))
    pygame.draw.line(surf, rim, (cx + 4, top), (cx + 4, base - 1))
    pygame.draw.polygon(surf, stone, [(cx - 5, top), (cx, top - 5), (cx + 4, top)])
    needle(cx - 1, top - 4, 3, 20)
    for px in (cx - 6, cx + 5):  # пинакли по углам фасада
        needle(px, top, 2, 4)
    # розовое окно
    pygame.draw.circle(surf, glow_dim, (cx, top + 6), 2)
    surf.set_at((cx, top + 6), glow)
    for dx, dy in ((0, -2), (0, 2), (-2, 0), (2, 0)):
        surf.set_at((cx + dx, top + 6 + dy), dark)
    # высокие стрельчатые окна собора
    for wx in (cx - 3, cx + 2):
        for wy in (top + 12, top + 22):
            surf.set_at((wx, wy), glow_dim)
            pygame.draw.line(surf, glow, (wx, wy + 1), (wx, wy + 4))
    # стрельчатые ворота
    pygame.draw.rect(surf, (12, 8, 14), (cx - 2, base - 6, 4, 6))
    surf.set_at((cx - 1, base - 7), (12, 8, 14))
    surf.set_at((cx, base - 7), (12, 8, 14))
    # знамя на шпиле
    pygame.draw.rect(surf, (160, 30, 34), (cx + 1, top - 22, 3, 2))


def make_castle_background(w=320, h=180, seed=21):
    """Подступы к замку: травяное поле, горы и тёмный замок на холме под багровым закатом."""
    rnd = random.Random(seed)
    surf = pygame.Surface((w, h))
    horizon = 112
    # небо: ночь сверху, багровый закат у горизонта (ступенчатый градиент)
    stops = [(0.0, (14, 12, 28)), (0.45, (52, 30, 54)), (0.8, (128, 56, 50)), (1.0, (196, 104, 62))]
    bands = 20
    for i in range(bands):
        t = i / (bands - 1)
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                col = _lerp(c0, c1, (t - t0) / (t1 - t0))
                break
        y0 = int(i * horizon / bands)
        pygame.draw.rect(surf, col, (0, y0, w, horizon // bands + 2))
    for _ in range(40):  # редкие звёзды наверху
        surf.set_at((rnd.randrange(w), rnd.randrange(40)), rnd.choice([(170, 160, 190), (110, 100, 130)]))
    # тусклое солнце садится за замок
    sx, sy = 206, 92
    for r, col in ((22, (150, 70, 52)), (17, (190, 96, 60)), (13, (230, 150, 90))):
        pygame.draw.circle(surf, col, (sx, sy), r)
    # рваные тучи
    for _ in range(9):
        cx, cy = rnd.randrange(-20, w), rnd.randrange(14, 70)
        cw = rnd.randint(30, 80)
        pygame.draw.rect(surf, (36, 24, 44), (cx, cy, cw, 3))
        pygame.draw.rect(surf, (44, 30, 52), (cx + 6, cy - 2, cw - 14, 2))

    def ridge(base_y, amp, col, step, jag, snow=None):
        pts, y = [(0, h)], base_y
        tops = []
        for x in range(0, w + step, step):
            y = max(base_y - amp, min(base_y + amp // 3, y + rnd.randint(-jag, jag)))
            pts.append((x, y))
            tops.append((x, y))
        pts.append((w, h))
        pygame.draw.polygon(surf, col, pts)
        if snow:
            for x, y in tops:
                if y < base_y - amp * 0.55:
                    pygame.draw.line(surf, snow, (x - 2, y + 1), (x + 3, y + 1))

    ridge(92, 30, (58, 52, 76), 7, 7, snow=(150, 140, 160))  # дальние горы со снегом
    ridge(104, 16, (40, 36, 54), 5, 4)                        # ближние горы

    # далёкий холм и готический замок на нём
    draw_gothic_castle(surf, 214, 100, rnd)

    # поле: тёмная трава с полосами и светлыми стебельками
    for y in range(horizon, h):
        t = (y - horizon) / (h - horizon)
        col = _lerp((44, 54, 40), (30, 40, 28), t)
        pygame.draw.line(surf, col, (0, y), (w, y))
    for _ in range(int(w * (h - horizon) * 0.12)):
        x, y = rnd.randrange(w), rnd.randrange(horizon + 2, h)
        t = (y - horizon) / (h - horizon)
        blade = rnd.choice([(70, 86, 56), (88, 100, 62), (120, 112, 66), (56, 70, 46)])
        length = 1 + int(t * 3)
        pygame.draw.line(surf, blade, (x, y), (x + rnd.choice((-1, 0, 1)), y - length))
    # дорога к воротам
    road = [(212, 112), (216, 112), (250, 180), (150, 180)]
    pygame.draw.polygon(surf, (62, 50, 40), road)
    for _ in range(80):
        x = rnd.randrange(150, 250)
        y = rnd.randrange(116, 180)
        if 212 + (y - 114) * (-62 / 66) <= x <= 216 + (y - 114) * (34 / 66):
            surf.set_at((x, y), rnd.choice([(84, 70, 54), (48, 38, 30)]))
    # мёртвое дерево и вороны
    tree = (14, 10, 16)
    pygame.draw.line(surf, tree, (28, 150), (34, 96), 3)
    for x1, y1, x2, y2 in ((33, 110, 18, 92), (34, 102, 48, 86), (40, 94, 52, 92), (24, 100, 16, 96)):
        pygame.draw.line(surf, tree, (x1, y1), (x2, y2))
    for cx, cy in ((70, 40), (82, 46), (96, 38)):
        pygame.draw.lines(surf, tree, False, [(cx - 3, cy), (cx, cy + 1), (cx + 3, cy)])
    # туман у подножия холма
    fog = pygame.Surface((w, h), pygame.SRCALPHA)
    for _ in range(20):
        pygame.draw.rect(fog, (170, 140, 150, 30), (rnd.randrange(-30, w), rnd.randrange(104, 124), rnd.randint(30, 80), 2))
    surf.blit(fog, (0, 0))
    return surf


def make_torch_frames(n=4):
    frames = []
    for i in range(n):
        surf = pygame.Surface((8, 18), pygame.SRCALPHA)
        fl = pygame.transform.scale(flame(i + 10, 8, 8), (8, 9))
        surf.blit(fl, (0, 0))
        pygame.draw.rect(surf, (66, 46, 34), (3, 9, 2, 9))
        pygame.draw.rect(surf, (16, 12, 22), (2, 9, 4, 2))
        frames.append(surf)
    return frames


def make_hero_frames(sword, look="base"):
    hero = compose_hero(sword, look, "idle")
    return {
        "idle": [hero, shifted_breath(hero)],
        "attack": [compose_hero(sword, look, "attack")],
        "dodge": [crouched(hero)],
        "hurt": [tinted(hero, (255, 80, 60), 0.7)],
        "heal": [tinted(hero, (255, 200, 90), 0.45)],
        "dead": [tinted(crouched(hero), (40, 10, 10), 0.6)],
    }


def hero_look(owned):
    """Облик героя по купленным реликвиям."""
    armor, amulet = "armor" in owned, "amulet" in owned
    if "wingarmor" in owned:  # доспех Серафима — поверх всех остальных
        return "wing_amulet" if amulet else "wing"
    if "kingarmor" in owned:  # доспех Короля-Призрака надевается поверх костяного
        return "king_amulet" if amulet else "king"
    return "both" if armor and amulet else "armor" if armor else "amulet" if amulet else "base"


def make_boss_frames():
    boss = sprite_from_map(boss_map(BOSS_ARM_DOWN))
    swing = sprite_from_map(boss_map(BOSS_ARM_SWING))
    raised = sprite_from_map(boss_map(BOSS_ARM_RAISED))
    return {
        "idle": [boss, shifted_breath(boss, 19)],
        "windup": [tinted(raised, (255, 90, 50), 0.35), raised],
        "attack": [swing],
        "hurt": [tinted(boss, (255, 255, 255), 0.8)],
        "enraged": [tinted(boss, (255, 40, 30), 0.25), tinted(shifted_breath(boss, 19), (255, 40, 30), 0.25)],
        "dead": [crouched(tinted(boss, (60, 50, 50), 0.5))],
    }


def make_bandit_frames():
    idle = sprite_from_map(BANDIT_IDLE)
    return {
        "idle": [idle, shifted_breath(idle, 10)],
        "windup": [tinted(idle, (255, 90, 50), 0.35), idle],
        "attack": [sprite_from_map(BANDIT_ATTACK)],
        "hurt": [tinted(idle, (255, 255, 255), 0.8)],
        "dead": [crouched(tinted(idle, (60, 50, 50), 0.5))],
    }


def make_chief_frames():
    idle = sprite_from_map(chief_map(CHIEF_ARM_DOWN))
    raised = sprite_from_map(chief_map(CHIEF_ARM_RAISED))
    drink = sprite_from_map(chief_map(CHIEF_ARM_DRINK))
    return {
        "idle": [idle, shifted_breath(idle, 20)],
        "windup": [tinted(raised, (255, 90, 50), 0.35), raised],
        "attack": [sprite_from_map(chief_map(CHIEF_ARM_SWING))],
        "hurt": [tinted(idle, (255, 255, 255), 0.8)],
        "drink": [drink, tinted(drink, (255, 120, 120), 0.25)],
        "enraged": [tinted(idle, (255, 40, 30), 0.25), tinted(shifted_breath(idle, 20), (255, 40, 30), 0.25)],
        "dead": [crouched(tinted(idle, (60, 50, 50), 0.5))],
    }


# --- Кладбище: зомби, летучая мышь и Король-Призрак (смотрят влево) ---
ZOMBIE_IDLE = [
    "........................",
    "..........kkkkk.........",
    ".........kXXXXxk........",
    "........kXQXXXXxk.......",
    "........kXXXXXXxk.......",
    "........kkekkXexk.......",
    "........kXXXXXXxk.......",
    "........kXkkkkXxk.......",
    ".........kXDXXxk........",
    "..........kxxxk.........",
    "..kkkkkkkkSSLLSk........",
    ".kXXXXXXXkSLLLSSk.......",
    "..kkkkkkkSSLLSSSk.......",
    "..kkkkkkkSLLSSSSk.......",
    ".kXXXXxxkSSLSSDSk.......",
    "..kkkkkkkSLSSSSSk.......",
    ".........kSSSSSSk.......",
    ".........kSLSkSSk.......",
    ".........kbbbbbbk.......",
    ".........kSSkkSSk.......",
    ".........kSSk.kSSk......",
    "........kSSk..kSSk......",
    "........kSSk...kSk......",
    "........kxXk...kSk......",
    "........kXXk...kXk......",
    "........kXXk...kXk......",
    "........kXxk...kxk......",
    "........kXXk..kXXk......",
    ".......kXXk...kXXk......",
    ".......kXXk..kXXXk......",
    "......kkkkk..kkkkk......",
    "........................",
]


def zombie_attack_map():
    """Бросок: тело подаётся вперёд, руки вытянуты на 6 пикселей дальше."""
    rows = ["......" + r for r in ZOMBIE_IDLE]
    for y in (11, 14):  # руки
        r = rows[y]
        start = r.index("k")
        rows[y] = "k" + "X" * (start - 1) + r[start:] if y == 11 else "kx" + "X" * (start - 2) + r[start:]
    for y in (10, 12, 13, 15):
        r = rows[y]
        start = r.index("k")
        rows[y] = "." + "k" * (start - 1) + r[start:]
    return rows


BAT_UP = [
    "k................k",
    "kk..............kk",
    "kNk....k..k....kNk",
    "kNNk...kkkk...kNNk",
    ".kNNk.kNNNNk.kNNk.",
    ".kNNNkkeNNekkNNNk.",
    "..kNNNkNWWNkNNNk..",
    "...kkkkNNNNkkkk...",
    ".......kNNk.......",
    "........kk........",
    "..................",
    "..................",
]
BAT_DOWN = [
    "..................",
    ".......k..k.......",
    ".......kkkk.......",
    "......kNNNNk......",
    ".....kkeNNekk.....",
    "...kkNNNWWNNNkk...",
    "..kNNNNNNNNNNNNk..",
    ".kNNNk.kNNk.kNNNk.",
    "kNNk....kk....kNNk",
    "kNk............kNk",
    "kk..............kk",
    "k................k",
]
BAT_DUP_ROWS = (2, 3, 5, 6, 7)
BAT_DUP_COLS = (2, 3, 6, 8, 9, 11, 14, 15)

# Король-Призрак: собственная модель — высокая корона, череп с горящими глазницами,
# призрачная борода до пояса, рогатые наплечники, шипастый воротник и рваный плащ.
WRAITH_PALETTE = dict(
    PALETTE,
    a=(16, 34, 40), A=(32, 70, 76), h=(84, 156, 150),          # латы цвета старой бирюзы
    c=(10, 46, 40), C=(30, 110, 84), q=(50, 160, 120),          # призрачный плащ
    e=(120, 255, 230), E=(214, 255, 248),                       # огонь в глазницах и самоцветы
    O=(176, 196, 168), W=(222, 236, 210), o=(104, 122, 104),    # кость черепа
    y=(226, 255, 246), Y=(140, 222, 200), z=(62, 140, 128),     # призрачная борода
    g=(214, 168, 64), G=(255, 226, 120),                        # золото короны
    w=(176, 255, 226), l=(90, 200, 160),                        # клинок из призрачного пламени
)
WRAITH_W, WRAITH_H = 44, 44
WRAITH_DUP_ROWS = (9, 17, 24, 31, 37)
WRAITH_DUP_COLS = (BOSS_X + 21, BOSS_X + 30)


def wraith_body():
    """Король-Призрак (смотрит влево): высокая корона, череп с бородой до пояса, рогатые
    наплечники, шипастый воротник и рваный плащ до земли. Контур добавляется автоматически."""
    W, H = WRAITH_W, WRAITH_H
    g = [["."] * W for _ in range(H)]

    def px(x, y, ch):
        if 0 <= x < W and 0 <= y < H:
            g[y][x] = ch

    def ellipse(cx, cy, rx, ry, ch, top=None):
        for y in range(cy - ry, cy + ry + 1):
            for x in range(cx - rx, cx + rx + 1):
                if ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2 <= 1:
                    px(x, y, top if top and y <= cy - ry + 1 else ch)

    # 1. рваный плащ за спиной (правее тела), складки и рваный низ
    for y in range(14, H):
        x0 = 27 - (y - 14) // 5
        x1 = min(W - 1, 33 + (y - 14) // 2)
        rag = (y >= H - 4) and ((y * 7) % 3 != 0)
        for x in range(x0, x1 + 1):
            if rag and (x * 5 + y) % 4 == 0:
                continue
            px(x, y, "C" if (x - x0) % 4 == 1 else "q" if (x - x0) % 4 == 2 and y < 30 else "c")
    # 2. шипастый воротник за головой
    for i, (bx, h) in enumerate(((27, 8), (30, 10), (33, 7))):
        for k in range(h):
            for x in range(bx - (h - k) // 3, bx + (h - k) // 3 + 1):
                px(x, 14 - k, "h" if x == bx and k > 1 else "a")
    # 3. ноги в латных сапогах
    for lx in (17, 24):
        for y in range(33, 42):
            for x in range(lx, lx + 4):
                px(x, y, "h" if x == lx else "A")
        for x in range(lx - 1, lx + 5):
            px(x, 42, "a")
            px(x, 43, "a")
    # 4. латная юбка с золотой каймой
    for y in range(28, 34):
        for x in range(14 - (y - 28) // 2, 32 + (y - 28) // 3):
            px(x, y, "g" if y == 33 else "a" if (x - 14) % 4 == 0 else "A")
    # 5. кираса
    for y in range(15, 28):
        for x in range(16, 31):
            px(x, y, "h" if x in (17, 18) else "a" if x == 30 else "A")
    for x in range(15, 32):  # пояс с самоцветом
        px(x, 27, "g")
    px(19, 27, "e")
    # 6. дальний наплечник с рогом
    ellipse(32, 16, 5, 3, "A", top="h")
    for k in range(5):
        px(34 + k // 2, 12 - k, "W" if k > 2 else "O")
    # 7. ближний наплечник: крупный, с рогом и золотым ободом
    ellipse(13, 16, 7, 4, "A", top="h")
    for x in range(7, 20):
        px(x, 20, "g")
    for k in range(6):
        px(9 - k // 2, 12 - k, "W" if k > 3 else "O")
    # 8. череп
    ellipse(21, 9, 5, 4, "O")
    for x, y in ((17, 6), (17, 7), (18, 6), (16, 8)):  # блик на лбу
        px(x, y, "W")
    for y in range(7, 12):  # тень на затылке
        px(25, y, "o")
        px(24, y, "o" if y > 8 else "O")
    for x in range(16, 26):  # тень от короны
        px(x, 6, "o")
    for sx in (16, 20):  # глубокие глазницы с призрачным огнём
        for x in (sx, sx + 1, sx + 2):
            px(x, 8, "k")
        px(sx, 9, "k")
        px(sx + 1, 9, "E")
        px(sx + 2, 9, "e")
        px(sx + 1, 10, "e")
        px(sx + 1, 7, "e")  # язычок пламени над глазом
    px(19, 11, "k")  # нос
    px(18, 11, "o")
    for x in range(17, 24):  # челюсть
        px(x, 12, "o")
    # 9. борода: от челюсти до пояса, развевается вперёд (влево), светлые пряди
    for y in range(12, 27):
        t = (y - 12) / 14
        cx = 20 - int(t * 4)
        half = max(1, int(5 * (1 - t) + 1))
        for x in range(cx - half, cx + half + 1):
            edge = x in (cx - half, cx + half)
            strand = (x + y) % 3 == 0
            px(x, y, "z" if edge else "y" if strand else "Y")
    for x in range(17, 24, 2):  # усы над бородой
        px(x, 12, "Y")
    # 10. высокая корона: обод с самоцветами и пять зубцов
    for x in range(15, 27):
        px(x, 4, "g")
        px(x, 5, "G" if x % 3 else "e")
    for i, sx in enumerate((15, 18, 21, 24, 26)):
        h = 4 if i == 2 else 3
        for k in range(1, h + 1):
            px(sx, 4 - k, "G" if k == h else "g")
        if i != 4:
            px(sx + 1, 3, "g")
    # контур: пустая клетка рядом с закрашенной становится чёрной
    out = [row[:] for row in g]
    for y in range(H):
        for x in range(W):
            if g[y][x] == "." and any(0 <= x + dx < W and 0 <= y + dy < H and g[y + dy][x + dx] not in ".k"
                                      for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                out[y][x] = "k"
    return ["".join(r) for r in out]


def wraith_map(arm):
    """Тело Короля-Призрака + рука с мечом (те же позы, что у Костяного Рыцаря), крупнее."""
    body = wraith_body()
    W = BOSS_X + WRAITH_W
    rows = [list("." * W) for _ in range(WRAITH_H)]
    for y, row in enumerate(body):
        for x, ch in enumerate(row):
            if ch != ".":
                rows[y][BOSS_X + x] = ch
    for y, (x0, seg) in arm.items():
        for i, ch in enumerate(seg):
            if ch != "." and 0 <= x0 + i < W:
                rows[y][x0 + i] = ch
    return _enlarge(["".join(r) for r in rows], WRAITH_DUP_ROWS, WRAITH_DUP_COLS)


def make_zombie_frames():
    idle = sprite_from_map(ZOMBIE_IDLE)
    return {
        "idle": [idle, shifted_breath(idle, 10)],
        "windup": [tinted(idle, (255, 90, 50), 0.35), idle],
        "attack": [sprite_from_map(zombie_attack_map())],
        "hurt": [tinted(idle, (255, 255, 255), 0.8)],
        "dead": [crouched(tinted(idle, (60, 50, 50), 0.5))],
    }


def make_bat_frames():
    up = sprite_from_map(_enlarge(BAT_UP, BAT_DUP_ROWS, BAT_DUP_COLS))
    down = sprite_from_map(_enlarge(BAT_DOWN, BAT_DUP_ROWS, BAT_DUP_COLS))
    return {
        "idle": [up, down],
        "windup": [tinted(up, (255, 90, 50), 0.35), tinted(down, (255, 90, 50), 0.35)],
        "attack": [down],
        "hurt": [tinted(down, (255, 255, 255), 0.8)],
        "dead": [pygame.transform.flip(tinted(down, (60, 50, 50), 0.5), False, True)],
    }


def make_wraith_frames():
    idle = sprite_from_map(wraith_map(BOSS_ARM_DOWN), WRAITH_PALETTE)
    raised = sprite_from_map(wraith_map(BOSS_ARM_RAISED), WRAITH_PALETTE)
    swing = sprite_from_map(wraith_map(BOSS_ARM_SWING), WRAITH_PALETTE)
    return {
        "idle": [idle, shifted_breath(idle, 22)],
        "windup": [tinted(raised, (120, 255, 220), 0.35), raised],
        "attack": [swing],
        "hurt": [tinted(idle, (255, 255, 255), 0.8)],
        "enraged": [tinted(idle, (80, 255, 200), 0.3), tinted(shifted_breath(idle, 22), (80, 255, 200), 0.3)],
        "revive": [tinted(crouched(idle), (120, 255, 230), 0.6), tinted(idle, (120, 255, 230), 0.5)],
        "dead": [crouched(tinted(idle, (40, 60, 60), 0.5))],
    }


def _dead_tree(surf, x, base, h, rnd, col=(16, 12, 20)):
    """Кривое мёртвое дерево с ветками."""
    top = base - h
    pygame.draw.line(surf, col, (x, base), (x + 2, top), 4)
    pygame.draw.line(surf, col, (x - 3, base), (x + 4, base), 3)  # корни
    for i in range(6):
        by = top + 4 + i * (h // 8)
        side = -1 if i % 2 else 1
        ln = rnd.randint(8, 16)
        ex, ey = x + 2 + side * ln, by - rnd.randint(4, 10)
        pygame.draw.line(surf, col, (x + 2, by), (ex, ey), 2)
        pygame.draw.line(surf, col, (ex, ey), (ex + side * 4, ey - 4))


def _tombstone(surf, x, base, kind, scale, rnd):
    """Надгробие: kind 0 — закруглённое, 1 — крест, 2 — обелиск."""
    stone, dark, moss = (92, 92, 104), (52, 50, 62), (60, 82, 56)
    w, h = int(10 * scale), int(14 * scale)
    if kind == 0:
        pygame.draw.rect(surf, dark, (x - 1, base - h, w + 2, h + 1))
        pygame.draw.rect(surf, stone, (x, base - h + 3, w, h - 3))
        pygame.draw.ellipse(surf, stone, (x, base - h, w, 7))
        pygame.draw.line(surf, dark, (x + 2, base - h + 6), (x + w - 3, base - h + 6))
        pygame.draw.line(surf, dark, (x + 2, base - h + 9), (x + w - 4, base - h + 9))
    elif kind == 1:
        pygame.draw.rect(surf, dark, (x + w // 2 - 2, base - h - 2, 5, h + 2))
        pygame.draw.rect(surf, dark, (x, base - h + 2, w + 1, 5))
        pygame.draw.rect(surf, stone, (x + w // 2 - 1, base - h - 1, 3, h + 1))
        pygame.draw.rect(surf, stone, (x + 1, base - h + 3, w - 1, 3))
    else:
        pygame.draw.polygon(surf, dark, [(x, base), (x + 2, base - h - 6), (x + w // 2, base - h - 10), (x + w - 2, base - h - 6), (x + w, base)])
        pygame.draw.polygon(surf, stone, [(x + 1, base), (x + 3, base - h - 5), (x + w // 2, base - h - 8), (x + w - 3, base - h - 5), (x + w - 1, base)])
    for _ in range(int(3 * scale)):  # мох у основания
        surf.set_at((x + rnd.randrange(max(1, w)), base - rnd.randrange(3)), moss)


def make_graveyard_background(w=320, h=180, seed=33):
    """Кладбище: поле с надгробиями и мёртвыми деревьями под зеленоватой луной, стелется туман."""
    rnd = random.Random(seed)
    surf = pygame.Surface((w, h))
    horizon = 108
    stops = [(0.0, (8, 10, 22)), (0.55, (22, 30, 48)), (1.0, (56, 74, 78))]
    bands = 18
    for i in range(bands):
        t = i / (bands - 1)
        for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
            if t0 <= t <= t1:
                col = _lerp(c0, c1, (t - t0) / (t1 - t0))
                break
        pygame.draw.rect(surf, col, (0, int(i * horizon / bands), w, horizon // bands + 2))
    for _ in range(60):
        surf.set_at((rnd.randrange(w), rnd.randrange(70)), rnd.choice([(180, 190, 210), (110, 120, 150), (200, 230, 210)]))
    # большая зеленоватая луна с ореолом
    mx, my = 236, 40
    for r, col in ((26, (30, 52, 54)), (21, (46, 74, 72)), (17, (196, 220, 196)), (15, (220, 240, 214))):
        pygame.draw.circle(surf, col, (mx, my), r)
    for cx, cy, cr in ((230, 34, 3), (242, 46, 4), (228, 48, 2)):  # кратеры
        pygame.draw.circle(surf, (180, 204, 182), (cx, cy), cr)
    # дальние холмы и ограда
    pts, y = [(0, h)], 96
    for x in range(0, w + 6, 6):
        y = max(84, min(100, y + rnd.randint(-3, 3)))
        pts.append((x, y))
    pts.append((w, h))
    pygame.draw.polygon(surf, (20, 26, 34), pts)
    for x in range(0, w, 5):  # чугунная ограда на горизонте
        pygame.draw.line(surf, (12, 14, 20), (x, horizon - 9), (x, horizon))
        surf.set_at((x, horizon - 10), (12, 14, 20))
    pygame.draw.line(surf, (12, 14, 20), (0, horizon - 6), (w, horizon - 6))
    # часовня вдали
    pygame.draw.rect(surf, (14, 16, 24), (40, 76, 22, 32))
    pygame.draw.polygon(surf, (14, 16, 24), [(38, 77), (51, 62), (64, 77)])
    pygame.draw.rect(surf, (14, 16, 24), (49, 50, 4, 14))
    pygame.draw.rect(surf, (14, 16, 24), (46, 54, 10, 3))
    pygame.draw.rect(surf, (150, 190, 120), (49, 88, 4, 6))  # огонёк в окне
    # поле
    for yy in range(horizon, h):
        t = (yy - horizon) / (h - horizon)
        pygame.draw.line(surf, _lerp((34, 44, 40), (20, 26, 24), t), (0, yy), (w, yy))
    for _ in range(int(w * (h - horizon) * 0.1)):
        x, yy = rnd.randrange(w), rnd.randrange(horizon + 2, h)
        t = (yy - horizon) / (h - horizon)
        blade = rnd.choice([(52, 70, 50), (66, 84, 58), (44, 58, 44), (80, 92, 66)])
        pygame.draw.line(surf, blade, (x, yy), (x + rnd.choice((-1, 0, 1)), yy - 1 - int(t * 3)))
    # надгробия: дальний ряд мельче, ближний крупнее (середину оставляем для боя)
    for x in range(8, w, 26):
        _tombstone(surf, x + rnd.randint(-4, 4), horizon + 8 + rnd.randint(0, 4), rnd.randrange(3), 0.7, rnd)
    for x in (6, 34, 262, 296):
        _tombstone(surf, x, 136 + rnd.randint(0, 6), rnd.randrange(3), 1.1, rnd)
    for x in (18, 288):
        _tombstone(surf, x, 168, rnd.randrange(3), 1.4, rnd)
    # два мёртвых дерева
    _dead_tree(surf, 112, 122, 46, rnd)
    _dead_tree(surf, 300, 128, 58, rnd)
    # вороны на ветке и в небе
    for cx, cy in ((118, 80), (150, 34), (164, 40)):
        pygame.draw.lines(surf, (10, 10, 16), False, [(cx - 3, cy), (cx, cy + 1), (cx + 3, cy)])
    # зеленоватый туман над землёй
    fog = pygame.Surface((w, h), pygame.SRCALPHA)
    for _ in range(26):
        fog_y = rnd.randrange(104, 150)
        pygame.draw.rect(fog, (150, 200, 170, 26), (rnd.randrange(-30, w), fog_y, rnd.randint(30, 90), 2))
    surf.blit(fog, (0, 0))
    return surf


class Art:
    """Набор всех спрайтов игры, создаётся один раз после pygame.init()."""

    def __init__(self):
        skel = sprite_from_map(SKELETON_IDLE)
        skel_atk = sprite_from_map(SKELETON_ATTACK)
        self.heroes = {(sword, look): make_hero_frames(sword, look) for sword in SWORD_MAPS for look in LOOKS}
        self.hero = self.heroes[("rusty", "base")]
        self.boss = make_boss_frames()
        self.skeleton = {
            "idle": [skel, shifted_breath(skel, 12)],
            "windup": [tinted(skel, (255, 90, 50), 0.35), skel],
            "attack": [skel_atk],
            "hurt": [tinted(skel, (255, 255, 255), 0.8)],
            "dead": [crouched(tinted(skel, (60, 50, 50), 0.5))],
        }
        self.bonfire = make_bonfire_frames()
        self.torch = make_torch_frames()
        self.title_bg = make_title_background()
        self.arena_bg = make_arena_background()
        self.castle_bg = make_castle_background()
        self.bandit = make_bandit_frames()
        self.chief = make_chief_frames()
        self.graveyard_bg = make_graveyard_background()
        self.zombie = make_zombie_frames()
        self.bat = make_bat_frames()
        self.wraith = make_wraith_frames()
        from game import abyss  # Алая Бездна: фон, демоны и Алый Серафим (две стадии)
        self.abyss_bg = abyss.make_abyss_background()
        self.seraph = abyss.make_seraph_frames(False)
        self.seraph2 = abyss.make_seraph_frames(True)
        self.imp = abyss.make_imp_frames()
        self.hound = abyss.make_hound_frames()
        self.husk = abyss.make_husk_frames()

    def hero_for(self, sword, owned):
        """Кадры героя с этим мечом и обликом по реликвиям из owned."""
        return self.heroes[(sword, hero_look(owned))]
