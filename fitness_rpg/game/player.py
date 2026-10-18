"""Персонаж игрока: характеристики, прокачка и сохранение."""
import json
import os
from dataclasses import asdict, dataclass, field

SAVE_PATH = os.path.join(os.path.dirname(__file__), "..", "save.json")

# Характеристика -> (название, упражнение для прокачки, описание)
STATS = {
    "strength": ("СИЛА", "pushup", "урон атаки"),
    "vigor": ("ЖИВУЧЕСТЬ", "squat", "запас здоровья"),
    "endurance": ("ВЫНОСЛИВОСТЬ", "jack", "запас и восстановление сил"),
}

ESTUS_MAX = 3


@dataclass
class Player:
    strength: int = 1
    vigor: int = 1
    endurance: int = 1
    souls: int = 100
    wave: int = 1             # номер следующего скелета
    lost_souls: int = 0       # души, оставленные на месте гибели
    lost_at_wave: int = 0
    total_reps: dict = field(default_factory=lambda: {"pushup": 0, "squat": 0, "jack": 0})

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
    def damage(self):
        return 10 + 3 * self.strength

    # --- Прокачка у костра ---
    def level_cost(self):
        """Цена следующего уровня в душах."""
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
            return cls(**known)
        except (OSError, ValueError, TypeError):
            return cls()
