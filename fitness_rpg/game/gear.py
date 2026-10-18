"""Снаряжение: мечи за алые камни и уникальные вещи за синие (с боссов).

Порт-близнец: web/js/gear.js — значения должны совпадать.
"""

# Мечи. price: (алые, синие); unique — только за синие камни с боссов
SWORDS = {
    "rusty": {"name": "Ржавый меч", "desc": "старый, но свой", "dmg": 0, "cost": 20,
              "crit": 1.5, "lifesteal": 0, "price": (0, 0)},
    "steel": {"name": "Стальной клинок", "desc": "+5 урона", "dmg": 5, "cost": 20,
              "crit": 1.5, "lifesteal": 0, "price": (6, 0)},
    "great": {"name": "Двуручный меч", "desc": "+12 урона, крит x1.75, удар 28 сил", "dmg": 12, "cost": 28,
              "crit": 1.75, "lifesteal": 0, "price": (15, 0)},
    "ash": {"name": "Пепельный клинок", "desc": "+16 урона, крит x2, удар лечит 4", "dmg": 16, "cost": 20,
            "crit": 2.0, "lifesteal": 4, "price": (0, 3), "unique": True},
}

# Реликвии работают сразу после покупки
RELICS = {
    "armor": {"name": "Доспех Костяного Рыцаря", "desc": "получаемый урон -25%", "price": (0, 1), "unique": True},
    "amulet": {"name": "Амулет Углей", "desc": "+1 фляга эстуса", "price": (0, 2), "unique": True},
}

SHOP_ORDER = ["rusty", "steel", "great", "ash", "armor", "amulet"]


def item(key):
    return SWORDS.get(key) or RELICS[key]


def price_text(key):
    red, blue = item(key)["price"]
    if blue:
        return f"{blue} син."
    return f"{red} ал." if red else "—"


# --- Враги и награды ---
BOSS_EVERY = 5


def is_boss_wave(wave):
    return wave % BOSS_EVERY == 0


def rewards(wave):
    """(пепел, алые, синие) за победу над врагом этой волны."""
    if is_boss_wave(wave):
        return 2 * (80 + 40 * wave), 4 + wave // BOSS_EVERY, 1
    return 80 + 40 * wave, 2 + (wave - 1) // BOSS_EVERY, 0
