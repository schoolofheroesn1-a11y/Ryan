"""Персонаж игрока: характеристики, прокачка и сохранение."""
import json
import os
from dataclasses import asdict, dataclass, field

from .gear import RELICS, SWORDS, item

SAVE_PATH = os.path.join(os.path.dirname(__file__), "..", "save.json")

# Характеристика -> (название, упражнение для прокачки, описание)
STATS = {
    "strength": ("СИЛА", "pushup", "урон атаки"),
    "vigor": ("ЖИВУЧЕСТЬ", "squat", "запас здоровья"),
    "endurance": ("ВЫНОСЛИВОСТЬ", "jack", "запас и восстановление сил"),
}

ESTUS_MAX = 3  # без Амулета Углей


@dataclass
class Player:
    strength: int = 1
    vigor: int = 1
    endurance: int = 1
    souls: int = 100          # пепел — валюта прокачки (поле зовётся souls ради старых сохранений)
    wave: int = 1             # номер следующего скелета
    lost_souls: int = 0       # пепел, оставленный на месте гибели
    lost_at_wave: int = 0
    total_reps: dict = field(default_factory=lambda: {"pushup": 0, "squat": 0, "jack": 0})
    red_gems: int = 0         # алые камни — за каждого врага, тратятся в кузнице
    blue_gems: int = 0        # синие камни — за боссов, на уникальное снаряжение
    owned: list = field(default_factory=lambda: ["rusty"])
    sword: str = "rusty"

    # --- Производные параметры ---
    @property
    def level(self):
        return self.strength + self.vigor + self.endurance - 2

    @property
    def max_hp(self):
        return 80 + 12 * self.vigor

    @property
    def max_stamina(self):
        return 60 + 8 * self.endurance

    @property
    def stamina_regen(self):
        return 10 + 2 * self.endurance

    @property
    def weapon(self):
        return SWORDS[self.sword]

    @property
    def damage(self):
        return 10 + 3 * self.strength + self.weapon["dmg"]

    @property
    def attack_cost(self):
        return self.weapon["cost"]

    @property
    def crit_mult(self):
        return self.weapon["crit"]

    @property
    def lifesteal(self):
        return self.weapon["lifesteal"]

    @property
    def damage_taken_mult(self):
        return 0.75 if "armor" in self.owned else 1.0

    @property
    def estus_max(self):
        return ESTUS_MAX + (1 if "amulet" in self.owned else 0)

    # --- Кузница ---
    def can_afford(self, key):
        red, blue = item(key)["price"]
        return self.red_gems >= red and self.blue_gems >= blue

    def buy(self, key):
        """Покупает вещь (меч сразу надевается). Возвращает False, если не хватает камней."""
        if key in self.owned or not self.can_afford(key):
            return False
        red, blue = item(key)["price"]
        self.red_gems -= red
        self.blue_gems -= blue
        self.owned.append(key)
        if key in SWORDS:
            self.sword = key
        return True

    def equip(self, key):
        if key in SWORDS and key in self.owned:
            self.sword = key

    # --- Прокачка у костра ---
    def level_cost(self):
        """Цена следующего уровня в пепле."""
        return 60 + 30 * (self.level - 1)

    def reps_needed(self, stat):
        """Сколько повторений нужно сделать, чтобы поднять характеристику."""
        return min(4 + getattr(self, stat), 20)

    def can_level(self):
        return self.souls >= self.level_cost()

    def level_up(self, stat):
        self.souls -= self.level_cost()
        setattr(self, stat, getattr(self, stat) + 1)

    def add_rep(self, exercise):
        if exercise in self.total_reps:
            self.total_reps[exercise] += 1

    # --- Сохранение ---
    def save(self, path=SAVE_PATH):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(asdict(self), f, ensure_ascii=False, indent=2)

    @classmethod
    def load(cls, path=SAVE_PATH):
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            known = {k: v for k, v in data.items() if k in cls.__dataclass_fields__}
            p = cls(**known)
            if p.sword not in SWORDS or p.sword not in p.owned:
                p.sword = "rusty"
            p.owned = [k for k in p.owned if k in SWORDS or k in RELICS] or ["rusty"]
            return p
        except (OSError, ValueError, TypeError):
            return cls()
